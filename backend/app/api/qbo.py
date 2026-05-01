"""QuickBooks Online admin endpoints: OAuth, settings, sync queue, backfill."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from app.core.auth import CurrentUser, get_current_admin
from app.core.config import settings
from app.core.supabase import get_supabase_client
from app.services import qbo, qbo_sync
from app.services.encryption import sign_oauth_state, verify_oauth_state

logger = logging.getLogger(__name__)

router = APIRouter()


def _redirect_uri() -> str:
    if settings.qbo_redirect_uri:
        return settings.qbo_redirect_uri
    base = settings.frontend_url.rstrip("/")
    return f"{base}/api/admin/qbo/callback"


class QboSettings(BaseModel):
    expense_account_id: str


# --- OAuth flow ---


@router.get("/connect")
async def qbo_connect(
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Build the Intuit OAuth consent URL with HMAC-signed state (no cookies)."""
    state = sign_oauth_state(current_user.id, purpose="qbo")
    url = qbo.get_consent_url(state=state, redirect_uri=_redirect_uri())
    return {"url": url}


@router.get("/callback")
async def qbo_callback(
    code: str,
    state: str,
    realmId: str,  # noqa: N803 — Intuit query param name
):
    try:
        user_id = verify_oauth_state(state, purpose="qbo")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid OAuth state: {exc}") from exc

    try:
        tokens = qbo.exchange_code_for_tokens(code, _redirect_uri())
    except Exception as exc:
        logger.error("QBO code exchange failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"QBO exchange failed: {exc}") from exc

    supabase = get_supabase_client()
    qbo.save_connection(
        supabase,
        realm_id=realmId,
        refresh_token=tokens["refresh_token"],
        access_token=tokens["access_token"],
        expires_in=int(tokens.get("expires_in", 3600)),
        connected_by=user_id,
    )

    target = f"{settings.frontend_url.rstrip('/')}/admin/integrations/quickbooks?qbo=connected"
    return RedirectResponse(url=target, status_code=302)


@router.post("/disconnect")
async def qbo_disconnect(
    current_user: CurrentUser = Depends(get_current_admin),
):
    supabase = get_supabase_client()
    qbo.disconnect(supabase)
    return {"ok": True}


# --- Status + settings ---


@router.get("/status")
async def qbo_status(
    current_user: CurrentUser = Depends(get_current_admin),
):
    supabase = get_supabase_client()
    conn = qbo.get_connection(supabase)
    if not conn:
        return {"connected": False}

    pending = (
        supabase.table("qbo_sync_queue")
        .select("status", count="exact")
        .eq("status", "pending")
        .execute()
    )
    manual = (
        supabase.table("qbo_sync_queue")
        .select("status", count="exact")
        .eq("status", "manual_review")
        .execute()
    )

    return {
        "connected": True,
        "realm_id": conn["realm_id"],
        "connected_at": conn["connected_at"],
        "expense_account_id": conn.get("expense_account_id"),
        "queue_pending": pending.count or 0,
        "queue_manual_review": manual.count or 0,
    }


@router.get("/accounts")
async def qbo_accounts(
    current_user: CurrentUser = Depends(get_current_admin),
):
    """List active expense accounts so the admin can pick one."""
    supabase = get_supabase_client()
    conn = qbo.get_connection(supabase)
    if not conn:
        raise HTTPException(status_code=400, detail="QBO not connected")
    try:
        accounts = qbo.expense_accounts(supabase, realm_id=conn["realm_id"])
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"QBO query failed: {exc}") from exc
    return {
        "accounts": [
            {"id": a.get("Id"), "name": a.get("Name"), "subtype": a.get("AccountSubType")}
            for a in accounts
        ]
    }


@router.post("/settings")
async def qbo_settings(
    payload: QboSettings,
    current_user: CurrentUser = Depends(get_current_admin),
):
    supabase = get_supabase_client()
    conn = qbo.get_connection(supabase)
    if not conn:
        raise HTTPException(status_code=400, detail="QBO not connected")
    supabase.table("qbo_connection").update(
        {"expense_account_id": payload.expense_account_id}
    ).eq("id", conn["id"]).execute()
    return {"ok": True}


# --- Queue + backfill ---


@router.get("/queue")
async def qbo_queue(
    status: str | None = Query(None),
    limit: int = Query(50, le=200),
    current_user: CurrentUser = Depends(get_current_admin),
):
    supabase = get_supabase_client()
    q = supabase.table("qbo_sync_queue").select(
        "id, kind, ba_id, payment_id, attempts, status, last_error, last_attempt_at, next_attempt_at, created_at, ba_profiles(name), payments(amount, jobs(title))"
    )
    if status:
        q = q.eq("status", status)
    res = q.order("created_at", desc=True).limit(limit).execute()
    return {"items": res.data or []}


@router.post("/queue/{queue_id}/retry")
async def qbo_queue_retry(
    queue_id: str,
    current_user: CurrentUser = Depends(get_current_admin),
):
    supabase = get_supabase_client()
    supabase.table("qbo_sync_queue").update(
        {"status": "pending", "next_attempt_at": "now()", "attempts": 0, "last_error": None}
    ).eq("id", queue_id).execute()
    return {"ok": True}


@router.post("/queue/{queue_id}/resolve")
async def qbo_queue_resolve(
    queue_id: str,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Mark a manual_review item as resolved without retrying (admin fixed it manually)."""
    supabase = get_supabase_client()
    supabase.table("qbo_sync_queue").update({"status": "succeeded"}).eq("id", queue_id).execute()
    return {"ok": True}


@router.post("/backfill")
async def qbo_backfill(
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Enqueue vendor sync for every BA with a W-9 but no QBO vendor, and payment sync
    for every completed payment without a QBO purchase."""
    supabase = get_supabase_client()
    bas = (
        supabase.table("ba_profiles")
        .select("id")
        .not_.is_("w9_submitted_at", "null")
        .is_("qbo_vendor_id", "null")
        .execute()
    )
    pmts = (
        supabase.table("payments")
        .select("id")
        .eq("status", "completed")
        .is_("qbo_purchase_id", "null")
        .execute()
    )
    for ba in bas.data or []:
        qbo_sync.enqueue_vendor_sync(supabase, ba_id=ba["id"])
    for p in pmts.data or []:
        qbo_sync.enqueue_payment_sync(supabase, payment_id=p["id"])
    return {
        "vendor_enqueued": len(bas.data or []),
        "payment_enqueued": len(pmts.data or []),
    }


@router.post("/process-queue")
async def qbo_process_queue(
    batch_size: int = Query(20, le=100),
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Run the sync worker. Cron-pingable; returns processing summary."""
    return qbo_sync.process_pending(batch_size=batch_size)

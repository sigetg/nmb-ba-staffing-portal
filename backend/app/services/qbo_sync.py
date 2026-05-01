"""High-level QuickBooks Online sync logic.

Vendor sync is enqueued from W-9 submission; payment sync is enqueued from
PayPal webhook completion. Both share `qbo_sync_queue` with a `kind`
discriminator. Worker processes pending rows with exponential backoff;
after 3 failures the row goes to `manual_review` and the admin is emailed.
"""

import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.core.config import settings
from app.core.supabase import get_supabase_client
from app.services import qbo
from app.services.email import _send_email
from app.services.encryption import decrypt

logger = logging.getLogger(__name__)


# --- Enqueue ---


def enqueue_vendor_sync(supabase, *, ba_id: str) -> None:
    """Insert a pending vendor-sync row. Idempotent: skip if a pending vendor row exists."""
    existing = (
        supabase.table("qbo_sync_queue")
        .select("id")
        .eq("kind", "vendor")
        .eq("ba_id", ba_id)
        .eq("status", "pending")
        .limit(1)
        .execute()
    )
    if existing.data:
        return
    supabase.table("qbo_sync_queue").insert(
        {"kind": "vendor", "ba_id": ba_id, "status": "pending"}
    ).execute()


def enqueue_payment_sync(supabase, *, payment_id: str) -> None:
    existing = (
        supabase.table("qbo_sync_queue")
        .select("id")
        .eq("kind", "payment")
        .eq("payment_id", payment_id)
        .eq("status", "pending")
        .limit(1)
        .execute()
    )
    if existing.data:
        return
    supabase.table("qbo_sync_queue").insert(
        {"kind": "payment", "payment_id": payment_id, "status": "pending"}
    ).execute()


# --- Sync logic ---


def ensure_vendor(supabase, *, ba_id: str) -> str:
    """Return cached qbo_vendor_id or look up / create a Vendor in QBO."""
    profile = (
        supabase.table("ba_profiles")
        .select(
            "id, name, qbo_vendor_id, w9_legal_name, w9_business_name, w9_entity_type, "
            "w9_address_line1, w9_address_line2, w9_city, w9_state, w9_zip, "
            "w9_tin_encrypted, w9_tin_type, user_id"
        )
        .eq("id", ba_id)
        .single()
        .execute()
    )
    p = profile.data
    if not p:
        raise RuntimeError(f"BA profile {ba_id} not found")
    if p.get("qbo_vendor_id"):
        return p["qbo_vendor_id"]
    if not p.get("w9_legal_name"):
        raise RuntimeError(f"BA {ba_id} has no W-9 on file; cannot sync to QBO")

    conn = qbo.get_connection(supabase)
    if not conn:
        raise RuntimeError("QBO not connected")
    realm_id = conn["realm_id"]

    display_name = p["w9_legal_name"]
    existing = qbo.vendor_query_by_name(supabase, realm_id=realm_id, display_name=display_name)
    if existing:
        vendor_id = existing.get("Id")
    else:
        # Look up email from users table
        email = None
        try:
            u = (
                supabase.table("users")
                .select("email")
                .eq("id", p["user_id"])
                .maybe_single()
                .execute()
            )
            email = (u.data or {}).get("email") if u else None
        except Exception:
            pass

        tin = decrypt(p["w9_tin_encrypted"]) if p.get("w9_tin_encrypted") else None

        is_individual = p.get("w9_entity_type") in {"individual", "sole_proprietor", "llc_single"}
        vendor_payload: dict = {
            "DisplayName": display_name,
            "Vendor1099": True,
            "PrintOnCheckName": display_name,
            "Active": True,
        }
        if is_individual and " " in display_name:
            given, family = display_name.split(" ", 1)
            vendor_payload["GivenName"] = given
            vendor_payload["FamilyName"] = family
        else:
            vendor_payload["CompanyName"] = display_name
        if email:
            vendor_payload["PrimaryEmailAddr"] = {"Address": email}
        addr = {
            "Line1": p.get("w9_address_line1") or "",
            "City": p.get("w9_city") or "",
            "CountrySubDivisionCode": p.get("w9_state") or "",
            "PostalCode": p.get("w9_zip") or "",
        }
        if p.get("w9_address_line2"):
            addr["Line2"] = p["w9_address_line2"]
        vendor_payload["BillAddr"] = addr
        if tin:
            vendor_payload["TaxIdentifier"] = tin

        created = qbo.vendor_create(supabase, realm_id=realm_id, vendor=vendor_payload)
        vendor_id = created.get("Id")

    if not vendor_id:
        raise RuntimeError("QBO vendor create did not return an Id")
    supabase.table("ba_profiles").update({"qbo_vendor_id": vendor_id}).eq("id", ba_id).execute()
    return vendor_id


def post_payment(supabase, *, payment_id: str) -> str:
    """Create a Purchase entity in QBO for a completed payment. Returns qbo_purchase_id."""
    payment = (
        supabase.table("payments")
        .select("id, ba_id, job_id, amount, hours_worked, payment_method, qbo_purchase_id, jobs(title)")
        .eq("id", payment_id)
        .single()
        .execute()
    )
    p = payment.data
    if not p:
        raise RuntimeError(f"Payment {payment_id} not found")
    if p.get("qbo_purchase_id"):
        return p["qbo_purchase_id"]

    conn = qbo.get_connection(supabase)
    if not conn:
        raise RuntimeError("QBO not connected")
    if not conn.get("expense_account_id"):
        raise RuntimeError("QBO expense account not configured — pick one in admin settings")

    vendor_id = ensure_vendor(supabase, ba_id=p["ba_id"])
    realm_id = conn["realm_id"]
    expense_account_id = conn["expense_account_id"]
    amount = float(Decimal(str(p["amount"])))
    job_title = (p.get("jobs") or {}).get("title", "")

    purchase_payload = {
        "PaymentType": "Cash",
        "AccountRef": {"value": expense_account_id},
        "EntityRef": {"value": vendor_id, "type": "Vendor"},
        "TotalAmt": amount,
        "Line": [
            {
                "DetailType": "AccountBasedExpenseLineDetail",
                "Amount": amount,
                "AccountBasedExpenseLineDetail": {
                    "AccountRef": {"value": expense_account_id}
                },
            }
        ],
        "PrivateNote": f"Job: {job_title} | PaymentID: {p['id']} | Hours: {p.get('hours_worked')}",
        "DocNumber": str(p["id"])[:21],  # QBO DocNumber max length
    }

    created = qbo.purchase_create(supabase, realm_id=realm_id, purchase=purchase_payload)
    purchase_id = created.get("Id")
    if not purchase_id:
        raise RuntimeError("QBO purchase create did not return an Id")
    supabase.table("payments").update({"qbo_purchase_id": purchase_id}).eq("id", payment_id).execute()
    return purchase_id


# --- Worker ---


_BACKOFF_SCHEDULE = [30, 300, 1800]  # seconds: 30s, 5m, 30m


def _next_backoff(attempts: int) -> datetime:
    idx = min(attempts, len(_BACKOFF_SCHEDULE) - 1)
    return datetime.now(timezone.utc) + timedelta(seconds=_BACKOFF_SCHEDULE[idx])


def process_pending(batch_size: int = 20) -> dict:
    """Pick pending queue rows due for retry; sync them; persist outcomes."""
    supabase = get_supabase_client()
    now_iso = datetime.now(timezone.utc).isoformat()

    res = (
        supabase.table("qbo_sync_queue")
        .select("*")
        .eq("status", "pending")
        .lte("next_attempt_at", now_iso)
        .order("created_at", desc=False)
        .limit(batch_size)
        .execute()
    )
    rows = res.data or []
    summary = {"processed": 0, "succeeded": 0, "failed": 0, "manual_review": 0}

    for row in rows:
        attempts = (row.get("attempts") or 0) + 1
        try:
            if row["kind"] == "vendor":
                ensure_vendor(supabase, ba_id=row["ba_id"])
            elif row["kind"] == "payment":
                post_payment(supabase, payment_id=row["payment_id"])
            else:
                raise RuntimeError(f"Unknown kind: {row['kind']}")
            supabase.table("qbo_sync_queue").update(
                {"status": "succeeded", "attempts": attempts, "last_attempt_at": now_iso}
            ).eq("id", row["id"]).execute()
            summary["succeeded"] += 1
        except Exception as exc:
            err = str(exc)[:1000]
            if attempts >= 3:
                supabase.table("qbo_sync_queue").update(
                    {
                        "status": "manual_review",
                        "attempts": attempts,
                        "last_attempt_at": now_iso,
                        "last_error": err,
                    }
                ).eq("id", row["id"]).execute()
                _alert_admin_on_manual_review(row, err)
                summary["manual_review"] += 1
            else:
                supabase.table("qbo_sync_queue").update(
                    {
                        "attempts": attempts,
                        "last_attempt_at": now_iso,
                        "next_attempt_at": _next_backoff(attempts).isoformat(),
                        "last_error": err,
                    }
                ).eq("id", row["id"]).execute()
                summary["failed"] += 1
        summary["processed"] += 1
    return summary


def _alert_admin_on_manual_review(row: dict, error: str) -> None:
    """Best-effort admin email when a queue row needs manual intervention."""
    try:
        admin_email = settings.email_from
        # Pull the actual support email from settings if we have a dedicated one;
        # for now, route to a simple notification address (env var TBD)
        body = f"""
        <h2>QBO sync needs manual review</h2>
        <p>Kind: {row['kind']}</p>
        <p>BA ID: {row.get('ba_id')}</p>
        <p>Payment ID: {row.get('payment_id')}</p>
        <p>Attempts: {row.get('attempts')}</p>
        <p>Last error: <code>{error}</code></p>
        <p>Resolve at <a href="{settings.frontend_url}/admin/integrations/quickbooks">/admin/integrations/quickbooks</a>.</p>
        """
        # Send to the configured email_from sender by default; a dedicated admin
        # notification address could be added as a future env var.
        _send_email(_extract_email(admin_email), "[NMB] QBO sync manual review", body)
    except Exception as exc:
        logger.warning("Failed to send QBO manual-review alert: %s", exc)


def _extract_email(from_str: str) -> str:
    """Turn 'NMB Media <noreply@nmbmedia.com>' into 'noreply@nmbmedia.com'."""
    if "<" in from_str and ">" in from_str:
        return from_str.split("<", 1)[1].split(">", 1)[0]
    return from_str

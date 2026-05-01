"""Public webhook endpoints (PayPal Payouts).

Verified via PayPal's signature-verification API; rejects unsigned requests.
"""

import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request

from app.core.supabase import get_supabase_client
from app.services import paypal, payouts as payouts_svc, qbo_sync

logger = logging.getLogger(__name__)

router = APIRouter()


_SUCCESS_EVENTS = {"PAYMENT.PAYOUTS-ITEM.SUCCEEDED"}
_FAILED_EVENTS = {
    "PAYMENT.PAYOUTS-ITEM.FAILED",
    "PAYMENT.PAYOUTS-ITEM.RETURNED",
    "PAYMENT.PAYOUTS-ITEM.DENIED",
    "PAYMENT.PAYOUTS-ITEM.BLOCKED",
    "PAYMENT.PAYOUTS-ITEM.REFUNDED",
    "PAYMENT.PAYOUTS-ITEM.UNCLAIMED",
}


@router.post("/paypal")
async def paypal_webhook(request: Request):
    """Handle PayPal Payouts events to reconcile payment row status."""
    raw = await request.body()
    headers = dict(request.headers)

    if not paypal.verify_webhook_signature(headers=headers, raw_body=raw):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        import json

        event = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Malformed body") from exc

    event_type = event.get("event_type", "")
    resource = event.get("resource", {}) or {}
    payout_item_id = resource.get("payout_item_id") or resource.get("item_id")
    sender_item_id = (
        (resource.get("payout_item") or {}).get("sender_item_id")
        or resource.get("sender_item_id")
    )

    if not payout_item_id and not sender_item_id:
        logger.warning("PayPal event missing payout_item_id and sender_item_id: %s", event_type)
        return {"received": True, "matched": False}

    supabase = get_supabase_client()

    # Match by paypal_item_id first; fall back to id (sender_item_id is our payments.id).
    query = supabase.table("payments").select("id, status, ba_id, job_id")
    if payout_item_id:
        query = query.eq("paypal_item_id", payout_item_id)
    else:
        query = query.eq("id", sender_item_id)
    res = query.execute()
    rows = res.data or []
    if not rows:
        logger.warning("PayPal webhook for unknown payout_item_id=%s sender_item_id=%s",
                       payout_item_id, sender_item_id)
        return {"received": True, "matched": False}

    payment_id = rows[0]["id"]
    update: dict = {}
    if event_type in _SUCCESS_EVENTS:
        update = {
            "status": "completed",
            "processed_at": datetime.utcnow().isoformat(),
            "tax_year": datetime.utcnow().year,
        }
    elif event_type in _FAILED_EVENTS:
        update = {"status": "failed"}
    elif event_type == "PAYMENT.PAYOUTS-ITEM.CANCELED":
        update = {"status": "cancelled"}
    else:
        # Other events (e.g. PAYOUTSBATCH.SUCCESS) — ignore
        return {"received": True, "matched": True, "no_op": True, "event_type": event_type}

    supabase.table("payments").update(update).eq("id", payment_id).execute()

    # On success, notify the BA + enqueue QBO sync. Both best-effort.
    if update.get("status") == "completed":
        try:
            payouts_svc.notify_payment_sent(supabase, payment_id=payment_id)
        except Exception as exc:
            logger.warning("notify_payment_sent failed for %s: %s", payment_id, exc)
        try:
            qbo_sync.enqueue_payment_sync(supabase, payment_id=payment_id)
        except Exception as exc:
            logger.warning("enqueue_payment_sync failed for %s: %s", payment_id, exc)

    return {"received": True, "matched": True, "payment_id": payment_id, "new_status": update["status"]}

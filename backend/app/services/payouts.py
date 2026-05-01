"""Payout helpers: hours computation, PayPal Payouts dispatch, completion email."""

import logging
from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from app.services import paypal
from app.services.email import get_ba_email, send_payment_sent_email

logger = logging.getLogger(__name__)


def compute_hours(supabase, *, job_id: str, ba_id: str) -> Decimal:
    """Sum check_out - check_in across all non-skipped location_check_ins for (job, BA)."""
    res = (
        supabase.table("location_check_ins")
        .select(
            "check_in_time, check_out_time, skipped, "
            "job_day_locations!inner(job_day_id, job_days!inner(job_id))"
        )
        .eq("ba_id", ba_id)
        .execute()
    )
    rows = res.data or []
    total = Decimal("0")
    for r in rows:
        if r.get("skipped"):
            continue
        try:
            jdl = r["job_day_locations"]
            jd = jdl["job_days"] if isinstance(jdl, dict) else None
            if not jd or jd.get("job_id") != job_id:
                continue
        except (KeyError, TypeError):
            continue
        ci = r.get("check_in_time")
        co = r.get("check_out_time")
        if not ci or not co:
            continue
        ci_dt = datetime.fromisoformat(ci.replace("Z", "+00:00"))
        co_dt = datetime.fromisoformat(co.replace("Z", "+00:00"))
        delta = co_dt - ci_dt
        seconds = max(delta.total_seconds(), 0)
        total += Decimal(seconds) / Decimal(3600)
    return total.quantize(Decimal("0.01"))


def notify_payment_sent(supabase, *, payment_id: str) -> None:
    """Email the BA that a payment has been completed."""
    res = (
        supabase.table("payments")
        .select("id, ba_id, amount, payment_method, payment_reference, jobs(title)")
        .eq("id", payment_id)
        .single()
        .execute()
    )
    p = res.data
    if not p:
        return
    email, name = get_ba_email(supabase, p["ba_id"])
    if not email:
        return
    job_title = (p.get("jobs") or {}).get("title")
    send_payment_sent_email(
        email,
        name,
        amount=float(p.get("amount") or 0),
        method=p.get("payment_method") or "",
        job_title=job_title,
        reference=p.get("payment_reference"),
    )


def send_paypal_payouts(supabase, *, payment_ids: list[str], paid_by: str | None = None) -> dict:
    """Send selected payments via PayPal Payouts API.

    Marks each payment as 'processing' and stores paypal_item_id + batch_id.
    The PayPal webhook handler transitions rows to 'completed' / 'failed'.
    """
    if not payment_ids:
        raise ValueError("payment_ids cannot be empty")

    pmts = (
        supabase.table("payments")
        .select(
            "id, amount, ba_id, job_id, "
            "ba_profiles(name, w9_legal_name, payout_method, payout_paypal_email), "
            "jobs(title)"
        )
        .in_("id", payment_ids)
        .execute()
    )
    rows = pmts.data or []
    if len(rows) != len(payment_ids):
        raise ValueError("One or more payment_ids not found")

    items = []
    for p in rows:
        prof = p.get("ba_profiles") or {}
        if prof.get("payout_method") != "paypal":
            raise ValueError(f"Payment {p['id']} BA does not have PayPal as payout method")
        email = prof.get("payout_paypal_email")
        if not email:
            raise ValueError(f"Payment {p['id']} BA has no PayPal email on file")
        items.append(
            {
                "recipient_email": email,
                "amount": f"{Decimal(str(p['amount'])):.2f}",
                "currency": "USD",
                "sender_item_id": p["id"],
                "note": (p.get("jobs") or {}).get("title", "Payment for completed job"),
            }
        )

    sender_batch_id = f"nmb-{uuid4().hex}"
    response = paypal.create_payout_batch(items, sender_batch_id=sender_batch_id)
    paypal_batch_id = response.get("batch_header", {}).get("payout_batch_id")

    paypal_items = response.get("items") or []
    by_sender_id = {it.get("sender_item_id"): it for it in paypal_items}

    for p in rows:
        pp_item = by_sender_id.get(p["id"])
        update = {
            "status": "processing",
            "payment_method": "paypal",
            "batch_id": str(UUID(paypal_batch_id)) if _is_uuid(paypal_batch_id) else None,
            "fee_amount": "0.25",
        }
        if paid_by:
            update["paid_by"] = paid_by
        if pp_item:
            update["paypal_item_id"] = pp_item.get("payout_item_id") or pp_item.get(
                "sender_item_id"
            )
            update["payment_reference"] = (
                f"{paypal_batch_id}/{update.get('paypal_item_id', '')}"
            )
        supabase.table("payments").update(update).eq("id", p["id"]).execute()

    return {
        "paypal_batch_id": paypal_batch_id,
        "item_count": len(items),
    }


def _is_uuid(value: str | None) -> bool:
    if not value:
        return False
    try:
        UUID(value)
        return True
    except (ValueError, TypeError):
        return False

from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.auth import CurrentUser, get_current_admin
from app.core.supabase import get_supabase_client
from app.services import payouts as payouts_svc
from app.services.email import (
    get_ba_email,
    get_job_display_info,
    send_application_approved_email,
    send_application_rejected_email,
    send_ba_approved_email,
    send_ba_reinstated_email,
    send_ba_rejected_email,
    send_ba_suspended_email,
    send_job_reminder_email,
)

router = APIRouter()


class BAApproval(BaseModel):
    status: str  # "approved", "rejected", or "suspended"
    notes: str | None = None


class ApplicationStatusUpdate(BaseModel):
    status: str  # "approved" or "rejected"
    notes: str | None = None


class JobAssignment(BaseModel):
    ba_ids: list[str]


class PaymentTrigger(BaseModel):
    job_id: str
    ba_id: str
    amount: float
    notes: str | None = None


class PaymentCreate(BaseModel):
    job_id: str
    ba_id: str
    base_amount: float
    bonus_amount: float = 0
    reimbursement_amount: float = 0
    hours_worked: float | None = None
    notes: str | None = None


class PaypalSendRequest(BaseModel):
    payment_ids: list[str]


class PaymentStatusUpdate(BaseModel):
    status: str | None = None
    payment_reference: str | None = None
    notes: str | None = None


class BANotesUpdate(BaseModel):
    notes: str


class BAStatusResponse(BaseModel):
    id: str
    status: str
    updated_at: str


@router.get("/dashboard")
async def get_dashboard(
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Get admin dashboard stats."""
    supabase = get_supabase_client()

    # Get counts
    pending_bas = (
        supabase.table("ba_profiles")
        .select("*", count="exact", head=True)
        .eq("status", "pending")
        .execute()
    )

    total_bas = supabase.table("ba_profiles").select("*", count="exact", head=True).execute()

    active_jobs = (
        supabase.table("jobs")
        .select("*", count="exact", head=True)
        .eq("status", "published")
        .execute()
    )

    today = datetime.utcnow().date().isoformat()
    upcoming_jobs = (
        supabase.table("job_days")
        .select("job_id, jobs!inner(status)", count="exact", head=True)
        .gte("date", today)
        .eq("jobs.status", "published")
        .execute()
    )

    pending_applications = (
        supabase.table("job_applications")
        .select("*", count="exact", head=True)
        .eq("status", "pending")
        .execute()
    )

    return {
        "pending_bas": pending_bas.count or 0,
        "total_bas": total_bas.count or 0,
        "active_jobs": active_jobs.count or 0,
        "upcoming_jobs": upcoming_jobs.count or 0,
        "pending_applications": pending_applications.count or 0,
    }


@router.patch("/bas/{ba_id}/status", response_model=BAStatusResponse)
async def update_ba_status(
    ba_id: str,
    approval: BAApproval,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Approve, reject, or suspend a BA."""
    supabase = get_supabase_client()

    # Validate status
    valid_statuses = ["pending", "approved", "rejected", "suspended"]
    if approval.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}",
        )

    # Check BA exists and get profile data
    existing = (
        supabase.table("ba_profiles")
        .select("id, user_id, name, status")
        .eq("id", ba_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="BA not found")

    # Update status and admin notes
    updated_at = datetime.utcnow().isoformat()
    update_data = {"status": approval.status, "updated_at": updated_at}
    if approval.notes is not None:
        update_data["admin_notes"] = approval.notes
    result = supabase.table("ba_profiles").update(update_data).eq("id", ba_id).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update BA status")

    # Send status email
    email, name = get_ba_email(supabase, ba_id)
    if email:
        previous_status = existing.data.get("status")
        if approval.status == "approved" and previous_status == "suspended":
            send_ba_reinstated_email(email, name, notes=approval.notes)
        elif approval.status == "approved":
            send_ba_approved_email(email, name, notes=approval.notes)
        elif approval.status == "rejected":
            send_ba_rejected_email(email, name, notes=approval.notes)
        elif approval.status == "suspended":
            send_ba_suspended_email(email, name, notes=approval.notes)

    return BAStatusResponse(
        id=ba_id,
        status=approval.status,
        updated_at=updated_at,
    )


@router.patch("/bas/{ba_id}/notes")
async def update_ba_notes(
    ba_id: str,
    body: BANotesUpdate,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Update admin notes on a BA profile."""
    supabase = get_supabase_client()

    # Check BA exists
    existing = supabase.table("ba_profiles").select("id").eq("id", ba_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="BA not found")

    result = (
        supabase.table("ba_profiles")
        .update({"admin_notes": body.notes, "updated_at": datetime.utcnow().isoformat()})
        .eq("id", ba_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update notes")

    return {"id": ba_id, "admin_notes": body.notes}


@router.post("/jobs/{job_id}/assign")
async def assign_bas_to_job(
    job_id: str,
    assignment: JobAssignment,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Assign BAs to a job by approving their applications."""
    supabase = get_supabase_client()

    # Check job exists
    job = (
        supabase.table("jobs")
        .select(
            "slots, slots_filled, title, job_days(date, job_day_locations(location, start_time))"
        )
        .eq("id", job_id)
        .single()
        .execute()
    )
    if not job.data:
        raise HTTPException(status_code=404, detail="Job not found")

    available_slots = job.data["slots"] - job.data["slots_filled"]

    if len(assignment.ba_ids) > available_slots:
        raise HTTPException(
            status_code=400,
            detail=f"Only {available_slots} slots available, but trying to assign {len(assignment.ba_ids)} BAs",
        )

    # Update applications to approved
    updated = 0
    for ba_id in assignment.ba_ids:
        result = (
            supabase.table("job_applications")
            .update(
                {
                    "status": "approved",
                    "reviewed_at": datetime.utcnow().isoformat(),
                    "reviewed_by": current_user.id,
                }
            )
            .eq("job_id", job_id)
            .eq("ba_id", ba_id)
            .eq("status", "pending")
            .execute()
        )
        if result.data:
            updated += 1
            email, name = get_ba_email(supabase, ba_id)
            if email:
                info = get_job_display_info(supabase, job_id, job.data)
                send_application_approved_email(
                    to_email=email,
                    name=name,
                    job_title=job.data["title"],
                    job_date=info["date"],
                    job_location=info["location"],
                    start_time=info["start_time"],
                    job_id=job_id,
                )

    # Update slots_filled
    if updated > 0:
        supabase.table("jobs").update(
            {
                "slots_filled": job.data["slots_filled"] + updated,
            }
        ).eq("id", job_id).execute()

    return {
        "message": f"Assigned {updated} BAs to job",
        "assigned": updated,
    }


@router.delete("/jobs/{job_id}/assign/{ba_id}")
async def unassign_ba_from_job(
    job_id: str,
    ba_id: str,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Remove a BA from a job assignment."""
    supabase = get_supabase_client()

    # Check application exists and is approved
    application = (
        supabase.table("job_applications")
        .select("id, status")
        .eq("job_id", job_id)
        .eq("ba_id", ba_id)
        .single()
        .execute()
    )

    if not application.data:
        raise HTTPException(status_code=404, detail="Application not found")

    if application.data["status"] != "approved":
        raise HTTPException(status_code=400, detail="BA is not currently assigned to this job")

    # Check for existing check-in at any location in this job
    loc_ids_result = (
        supabase.table("job_day_locations")
        .select("id")
        .eq("job_id", job_id)
        .execute()
    )
    loc_ids = [r["id"] for r in (loc_ids_result.data or [])]
    if loc_ids:
        checkin = (
            supabase.table("location_check_ins")
            .select("id")
            .eq("ba_id", ba_id)
            .in_("job_day_location_id", loc_ids)
            .limit(1)
            .single()
            .execute()
        )
        if checkin.data:
            raise HTTPException(
                status_code=400,
                detail="Cannot unassign BA who has already checked in",
            )

    # Update application to withdrawn
    supabase.table("job_applications").update(
        {
            "status": "withdrawn",
        }
    ).eq("id", application.data["id"]).execute()

    # Update slots_filled
    job = supabase.table("jobs").select("slots_filled").eq("id", job_id).single().execute()
    if job.data and job.data["slots_filled"] > 0:
        supabase.table("jobs").update(
            {
                "slots_filled": job.data["slots_filled"] - 1,
            }
        ).eq("id", job_id).execute()

    return {"message": "BA unassigned from job"}


@router.patch("/applications/{application_id}/status")
async def update_application_status(
    application_id: str,
    body: ApplicationStatusUpdate,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Approve or reject a job application."""
    supabase = get_supabase_client()

    if body.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")

    # Fetch application with job and BA data
    application = (
        supabase.table("job_applications")
        .select(
            "id, status, job_id, ba_id, jobs(id, title, slots_filled, job_days(date, job_day_locations(location, start_time))), ba_profiles(id, name, user_id)"
        )
        .eq("id", application_id)
        .single()
        .execute()
    )

    if not application.data:
        raise HTTPException(status_code=404, detail="Application not found")

    previous_status = application.data["status"]
    job_data = application.data["jobs"]
    ba_data = application.data["ba_profiles"]

    # Update application
    supabase.table("job_applications").update(
        {
            "status": body.status,
            "reviewed_at": datetime.utcnow().isoformat(),
            "reviewed_by": current_user.id,
            "notes": body.notes,
        }
    ).eq("id", application_id).execute()

    # Adjust slots_filled
    if body.status == "approved" and previous_status != "approved":
        supabase.table("jobs").update(
            {
                "slots_filled": job_data["slots_filled"] + 1,
            }
        ).eq("id", application.data["job_id"]).execute()
    elif body.status == "rejected" and previous_status == "approved":
        supabase.table("jobs").update(
            {
                "slots_filled": max(0, job_data["slots_filled"] - 1),
            }
        ).eq("id", application.data["job_id"]).execute()

    # Send email
    email, name = get_ba_email(supabase, ba_data["id"])
    if email:
        if body.status == "approved":
            info = get_job_display_info(supabase, job_data["id"], job_data)
            send_application_approved_email(
                to_email=email,
                name=name,
                job_title=job_data["title"],
                job_date=info["date"],
                job_location=info["location"],
                start_time=info["start_time"],
                job_id=job_data["id"],
                notes=body.notes,
            )
        elif body.status == "rejected":
            send_application_rejected_email(
                to_email=email,
                name=name,
                job_title=job_data["title"],
                notes=body.notes,
            )

    return {"id": application_id, "status": body.status}


@router.post("/jobs/send-reminders")
async def send_job_reminders(
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Send reminder emails to BAs with jobs tomorrow. Manually triggerable; hookable to cron."""
    supabase = get_supabase_client()

    tomorrow = (datetime.utcnow() + timedelta(days=1)).date().isoformat()

    # Get job_days happening tomorrow with their jobs and locations
    day_results = (
        supabase.table("job_days")
        .select(
            "job_id, date, job_day_locations(location, start_time), jobs!inner(id, title, status)"
        )
        .eq("date", tomorrow)
        .eq("jobs.status", "published")
        .execute()
    )

    sent = 0
    seen_jobs: dict[str, bool] = {}
    for day in day_results.data or []:
        job_id = day["job_id"]
        if job_id in seen_jobs:
            continue
        seen_jobs[job_id] = True

        job_info = day["jobs"]
        locs = day.get("job_day_locations") or []
        location = locs[0]["location"] if locs else ""
        start_time = locs[0]["start_time"] if locs else ""

        # Get approved BAs for this job
        applications = (
            supabase.table("job_applications")
            .select("ba_id")
            .eq("job_id", job_id)
            .eq("status", "approved")
            .execute()
        )

        for app in applications.data or []:
            email, name = get_ba_email(supabase, app["ba_id"])
            if email:
                send_job_reminder_email(
                    to_email=email,
                    name=name,
                    job_title=job_info["title"],
                    job_date=day["date"],
                    job_location=location,
                    start_time=start_time,
                    job_id=job_id,
                )
                sent += 1

    return {"sent": sent}


@router.get("/jobs/{job_id}/attendance")
async def get_job_attendance(
    job_id: str,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Get attendance records for a job, including per-location data for multi-day jobs."""
    supabase = get_supabase_client()

    # Check job exists with days/locations
    job = (
        supabase.table("jobs")
        .select("*, job_days(*, job_day_locations(*))")
        .eq("id", job_id)
        .single()
        .execute()
    )
    if not job.data:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get approved applications
    applications = (
        supabase.table("job_applications")
        .select("*, ba_profiles(name, phone)")
        .eq("job_id", job_id)
        .eq("status", "approved")
        .execute()
    )

    ba_list = []
    for app in applications.data or []:
        ba_list.append(
            {
                "ba_id": app["ba_id"],
                "ba_name": app["ba_profiles"]["name"] if app.get("ba_profiles") else None,
                "ba_phone": app["ba_profiles"]["phone"] if app.get("ba_profiles") else None,
            }
        )

    ba_ids = [b["ba_id"] for b in ba_list]

    # Get location check-ins for all locations in this job
    location_ids = []
    for day in job.data.get("job_days", []):
        for loc in day.get("job_day_locations", []):
            location_ids.append(loc["id"])

    location_check_ins = []
    if location_ids and ba_ids:
        loc_result = (
            supabase.table("location_check_ins")
            .select("*")
            .in_("job_day_location_id", location_ids)
            .in_("ba_id", ba_ids)
            .execute()
        )
        location_check_ins = loc_result.data or []

    # Get travel logs
    loc_ci_ids = [ci["id"] for ci in location_check_ins]
    travel_logs = []
    if loc_ci_ids:
        travel_result = (
            supabase.table("travel_logs")
            .select("*")
            .in_("from_location_check_in_id", loc_ci_ids)
            .execute()
        )
        travel_logs = travel_result.data or []

    # Build attendance from location check-ins
    attendance = []
    for ba in ba_list:
        ba_check_ins = [ci for ci in location_check_ins if ci["ba_id"] == ba["ba_id"]]
        has_checked_in = len(ba_check_ins) > 0
        has_checked_out = any(ci.get("check_out_time") for ci in ba_check_ins)
        first_check_in = min((ci["check_in_time"] for ci in ba_check_ins), default=None) if ba_check_ins else None
        last_check_out = max((ci["check_out_time"] for ci in ba_check_ins if ci.get("check_out_time")), default=None) if ba_check_ins else None
        attendance.append(
            {
                **ba,
                "checked_in": has_checked_in,
                "check_in_time": first_check_in,
                "checked_out": has_checked_out,
                "check_out_time": last_check_out,
            }
        )

    return {
        "job": job.data,
        "attendance": attendance,
        "location_check_ins": location_check_ins,
        "travel_logs": travel_logs,
        "total_assigned": len(ba_list),
        "checked_in": sum(1 for a in attendance if a["checked_in"]),
        "checked_out": sum(1 for a in attendance if a["checked_out"]),
    }


@router.get("/jobs/{job_id}/payout-summary")
async def get_job_payout_summary(
    job_id: str,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Per-BA payout summary for a job: hours worked + suggested base amount + existing payment status.

    Used by the Payouts card on the admin job detail page.
    """
    supabase = get_supabase_client()

    job = (
        supabase.table("jobs")
        .select("id, title, pay_rate")
        .eq("id", job_id)
        .single()
        .execute()
    )
    if not job.data:
        raise HTTPException(status_code=404, detail="Job not found")

    pay_rate = Decimal(str(job.data.get("pay_rate") or 0))

    apps = (
        supabase.table("job_applications")
        .select(
            "ba_id, ba_profiles(id, name, payout_method, payout_paypal_email, "
            "w9_submitted_at, dl_uploaded_at, payout_info_submitted_at)"
        )
        .eq("job_id", job_id)
        .eq("status", "approved")
        .execute()
    )

    existing_pmts = (
        supabase.table("payments")
        .select(
            "id, ba_id, amount, base_amount, bonus_amount, reimbursement_amount, "
            "fee_amount, hours_worked, status, payment_method, payment_reference, "
            "batch_id, paypal_item_id, processed_at, created_at"
        )
        .eq("job_id", job_id)
        .execute()
    )
    pmts_by_ba: dict[str, list[dict]] = {}
    for p in existing_pmts.data or []:
        pmts_by_ba.setdefault(p["ba_id"], []).append(p)

    rows = []
    for app in apps.data or []:
        ba_id = app["ba_id"]
        prof = app.get("ba_profiles") or {}
        hours = payouts_svc.compute_hours(supabase, job_id=job_id, ba_id=ba_id)
        base_amount = (pay_rate * hours).quantize(Decimal("0.01"))
        ba_payments = pmts_by_ba.get(ba_id, [])
        rows.append(
            {
                "ba_id": ba_id,
                "ba_name": prof.get("name"),
                "payout_method": prof.get("payout_method"),
                "payout_paypal_email": prof.get("payout_paypal_email"),
                "onboarding_complete": bool(
                    prof.get("w9_submitted_at")
                    and prof.get("dl_uploaded_at")
                    and prof.get("payout_info_submitted_at")
                ),
                "hours_worked": str(hours),
                "suggested_base_amount": str(base_amount),
                "payments": ba_payments,
            }
        )

    return {
        "job_id": job_id,
        "job_title": job.data.get("title"),
        "pay_rate": str(pay_rate),
        "rows": rows,
    }


@router.post("/payments")
async def create_payment(
    payload: PaymentCreate,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Create a payment record in 'queued' status for a (job, BA).

    The actual disbursement happens later via either:
      - POST /payments/ach-batch/export  (for ACH method)
      - POST /payments/paypal/send       (for PayPal method)
    """
    supabase = get_supabase_client()

    # Refuse duplicates: one 'completed' payment per (job, ba) is the cap.
    existing = (
        supabase.table("payments")
        .select("id, status")
        .eq("job_id", payload.job_id)
        .eq("ba_id", payload.ba_id)
        .in_("status", ["queued", "processing", "completed"])
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Payment for this BA on this job already exists "
                f"(status: {existing.data[0]['status']})"
            ),
        )

    base = Decimal(str(payload.base_amount))
    bonus = Decimal(str(payload.bonus_amount))
    reimb = Decimal(str(payload.reimbursement_amount))
    total = (base + bonus + reimb).quantize(Decimal("0.01"))

    # Look up BA's chosen payout method to pre-tag the row.
    prof = (
        supabase.table("ba_profiles")
        .select("payout_method")
        .eq("id", payload.ba_id)
        .single()
        .execute()
    )
    method = (prof.data or {}).get("payout_method")
    payment_method = "ach_batch" if method == "ach" else "paypal" if method == "paypal" else None

    insert = {
        "job_id": payload.job_id,
        "ba_id": payload.ba_id,
        "amount": float(total),
        "base_amount": float(base),
        "bonus_amount": float(bonus),
        "reimbursement_amount": float(reimb),
        "hours_worked": float(payload.hours_worked) if payload.hours_worked is not None else None,
        "status": "queued",
        "payment_method": payment_method,
        "notes": payload.notes,
        "paid_by": current_user.id,
    }

    res = supabase.table("payments").insert(insert).execute()
    return {"payment": (res.data or [None])[0]}


@router.patch("/payments/{payment_id}")
async def update_payment(
    payment_id: str,
    payload: PaymentStatusUpdate,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Update an existing payment row (e.g. retry → queued, mark cancelled, etc.)."""
    supabase = get_supabase_client()
    update: dict = {}
    if payload.status is not None:
        if payload.status not in {
            "queued",
            "pending",
            "processing",
            "completed",
            "failed",
            "cancelled",
        }:
            raise HTTPException(status_code=400, detail="Invalid status")
        update["status"] = payload.status
    if payload.payment_reference is not None:
        update["payment_reference"] = payload.payment_reference
    if payload.notes is not None:
        update["notes"] = payload.notes
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")

    res = supabase.table("payments").update(update).eq("id", payment_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {"payment": res.data[0]}


@router.get("/payments/queue")
async def get_payments_queue(
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Active queue + pending payments grouped by method (for the admin Payouts page)."""
    supabase = get_supabase_client()
    res = (
        supabase.table("payments")
        .select("*, ba_profiles(id, name), jobs(id, title)")
        .in_("status", ["queued", "processing"])
        .order("created_at", desc=False)
        .execute()
    )
    rows = res.data or []
    ach = [r for r in rows if (r.get("payment_method") or "") == "ach_batch"]
    paypal_rows = [r for r in rows if (r.get("payment_method") or "") == "paypal"]
    return {"ach": ach, "paypal": paypal_rows, "total": len(rows)}


@router.post("/payments/paypal/send")
async def send_paypal_payouts_endpoint(
    payload: PaypalSendRequest,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Trigger an instant PayPal Payouts batch for the given payment IDs.

    Each payment row is transitioned to 'processing' with the paypal_item_id
    captured. The webhook handler later moves them to 'completed' / 'failed'.
    """
    supabase = get_supabase_client()
    try:
        result = payouts_svc.send_paypal_payouts(
            supabase, payment_ids=payload.payment_ids, paid_by=current_user.id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"PayPal API error: {exc}") from exc
    return result


@router.get("/payouts/pending-jobs")
async def get_payouts_pending_jobs(
    current_user: CurrentUser = Depends(get_current_admin),
):
    """List completed jobs that still have at least one approved BA without a 'completed' payment.

    Used by the admin dashboard to surface 'Jobs Awaiting Payout'.
    """
    supabase = get_supabase_client()
    today = datetime.utcnow().date().isoformat()

    jobs_res = (
        supabase.table("jobs")
        .select("id, title, brand, pay_rate, status, job_days(date)")
        .eq("status", "published")
        .execute()
    )
    jobs = jobs_res.data or []

    completed_job_ids = []
    for j in jobs:
        days = j.get("job_days") or []
        if not days:
            continue
        max_date = max(d["date"] for d in days if d.get("date"))
        if max_date < today:
            completed_job_ids.append(j["id"])

    if not completed_job_ids:
        return {"jobs": []}

    apps_res = (
        supabase.table("job_applications")
        .select("job_id, ba_id")
        .in_("job_id", completed_job_ids)
        .eq("status", "approved")
        .execute()
    )
    pmts_res = (
        supabase.table("payments")
        .select("job_id, ba_id, status")
        .in_("job_id", completed_job_ids)
        .execute()
    )
    completed_pairs: set[tuple[str, str]] = {
        (p["job_id"], p["ba_id"])
        for p in (pmts_res.data or [])
        if p.get("status") == "completed"
    }

    unpaid_by_job: dict[str, int] = {}
    for app in apps_res.data or []:
        if (app["job_id"], app["ba_id"]) not in completed_pairs:
            unpaid_by_job[app["job_id"]] = unpaid_by_job.get(app["job_id"], 0) + 1

    out = []
    for j in jobs:
        if j["id"] not in unpaid_by_job:
            continue
        out.append({**j, "unpaid_count": unpaid_by_job[j["id"]]})
    out.sort(
        key=lambda j: max((d["date"] for d in (j.get("job_days") or []) if d.get("date")), default=""),
        reverse=True,
    )
    return {"jobs": out}


@router.get("/payments")
async def list_payments(
    job_id: str | None = None,
    ba_id: str | None = None,
    status: str | None = None,
    limit: int = Query(20, le=100),
    offset: int = 0,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """List payment history."""
    supabase = get_supabase_client()

    query = supabase.table("payments").select("*, ba_profiles(name), jobs(title)", count="exact")

    if job_id:
        query = query.eq("job_id", job_id)
    if ba_id:
        query = query.eq("ba_id", ba_id)
    if status:
        query = query.eq("status", status)

    result = query.range(offset, offset + limit - 1).order("created_at", desc=True).execute()

    return {
        "payments": result.data or [],
        "total": result.count or 0,
        "limit": limit,
        "offset": offset,
    }


@router.get("/reports/jobs")
async def get_jobs_report(
    start_date: str | None = None,
    end_date: str | None = None,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Generate jobs report."""
    supabase = get_supabase_client()

    result = supabase.table("jobs").select("*, job_days(date)").execute()
    all_jobs = result.data or []

    # Filter by date range using job_days
    def get_job_dates(j: dict) -> list[str]:
        days = j.get("job_days") or []
        return [d["date"] for d in days if d.get("date")]

    jobs = []
    for j in all_jobs:
        dates = get_job_dates(j)
        if not dates:
            # Include jobs with no date info if no date filter
            if not start_date and not end_date:
                jobs.append(j)
            continue
        min_date = min(dates)
        max_date = max(dates)
        if start_date and max_date < start_date:
            continue
        if end_date and min_date > end_date:
            continue
        jobs.append(j)

    # Calculate stats
    total_jobs = len(jobs)
    today = datetime.utcnow().date().isoformat()

    def is_completed(j: dict) -> bool:
        if j["status"] != "published":
            return False
        dates = get_job_dates(j)
        return bool(dates) and max(dates) < today

    completed_jobs = sum(1 for j in jobs if is_completed(j))
    total_slots = sum(j["slots"] for j in jobs)
    filled_slots = sum(j["slots_filled"] for j in jobs)
    total_pay = sum(j["pay_rate"] * j["slots_filled"] for j in jobs)

    return {
        "report": {
            "total_jobs": total_jobs,
            "completed_jobs": completed_jobs,
            "total_slots": total_slots,
            "filled_slots": filled_slots,
            "fill_rate": round(filled_slots / total_slots * 100, 2) if total_slots > 0 else 0,
            "estimated_total_pay": round(total_pay, 2),
        },
        "jobs": jobs,
    }


@router.get("/reports/bas")
async def get_bas_report(
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Generate BAs performance report."""
    supabase = get_supabase_client()

    # Get all approved BAs with their stats
    bas = (
        supabase.table("ba_profiles")
        .select("id, name, zip_code, status")
        .eq("status", "approved")
        .execute()
    )

    ba_stats = []
    for ba in bas.data or []:
        # Get completed location check-ins
        checkins = (
            supabase.table("location_check_ins")
            .select("check_in_time, check_out_time")
            .eq("ba_id", ba["id"])
            .eq("skipped", False)
            .not_.is_("check_out_time", "null")
            .execute()
        )

        total_hours = 0
        for checkin in checkins.data or []:
            if checkin["check_in_time"] and checkin["check_out_time"]:
                check_in = datetime.fromisoformat(checkin["check_in_time"].replace("Z", "+00:00"))
                check_out = datetime.fromisoformat(checkin["check_out_time"].replace("Z", "+00:00"))
                total_hours += (check_out - check_in).total_seconds() / 3600

        ba_stats.append(
            {
                "id": ba["id"],
                "name": ba["name"],
                "zip_code": ba["zip_code"],
                "jobs_completed": len(checkins.data or []),
                "total_hours": round(total_hours, 2),
            }
        )

    # Sort by jobs completed
    ba_stats.sort(key=lambda x: x["jobs_completed"], reverse=True)

    return {
        "report": {
            "total_active_bas": len(ba_stats),
            "total_jobs_completed": sum(b["jobs_completed"] for b in ba_stats),
            "total_hours_worked": round(sum(b["total_hours"] for b in ba_stats), 2),
        },
        "bas": ba_stats,
    }

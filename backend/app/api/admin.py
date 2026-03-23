from fastapi import APIRouter, HTTPException, Query, Depends, Header
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta

from app.core.auth import get_current_admin, CurrentUser
from app.core.config import settings
from app.core.supabase import get_supabase_client
from app.services.email import (
    get_ba_email,
    send_ba_approved_email,
    send_ba_rejected_email,
    send_ba_suspended_email,
    send_ba_reinstated_email,
    send_application_approved_email,
    send_application_rejected_email,
    send_job_reminder_email,
)

router = APIRouter()


class BAApproval(BaseModel):
    status: str  # "approved", "rejected", or "suspended"
    notes: Optional[str] = None


class ApplicationStatusUpdate(BaseModel):
    status: str  # "approved" or "rejected"
    notes: Optional[str] = None


class JobAssignment(BaseModel):
    ba_ids: List[str]


class PaymentTrigger(BaseModel):
    job_id: str
    ba_id: str
    amount: float
    notes: Optional[str] = None


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

    total_bas = (
        supabase.table("ba_profiles")
        .select("*", count="exact", head=True)
        .execute()
    )

    active_jobs = (
        supabase.table("jobs")
        .select("*", count="exact", head=True)
        .eq("status", "published")
        .execute()
    )

    today = datetime.utcnow().date().isoformat()
    upcoming_jobs = (
        supabase.table("jobs")
        .select("*", count="exact", head=True)
        .gte("date", today)
        .eq("status", "published")
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
    result = (
        supabase.table("ba_profiles")
        .update(update_data)
        .eq("id", ba_id)
        .execute()
    )

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
    existing = (
        supabase.table("ba_profiles")
        .select("id")
        .eq("id", ba_id)
        .single()
        .execute()
    )
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
        .select("slots, slots_filled, title, date, location, start_time")
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
            .update({
                "status": "approved",
                "reviewed_at": datetime.utcnow().isoformat(),
                "reviewed_by": current_user.id,
            })
            .eq("job_id", job_id)
            .eq("ba_id", ba_id)
            .eq("status", "pending")
            .execute()
        )
        if result.data:
            updated += 1
            email, name = get_ba_email(supabase, ba_id)
            if email:
                send_application_approved_email(
                    to_email=email,
                    name=name,
                    job_title=job.data["title"],
                    job_date=job.data["date"],
                    job_location=job.data["location"],
                    start_time=job.data["start_time"],
                    job_id=job_id,
                )

    # Update slots_filled
    if updated > 0:
        supabase.table("jobs").update({
            "slots_filled": job.data["slots_filled"] + updated,
        }).eq("id", job_id).execute()

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

    # Check for existing check-in
    checkin = (
        supabase.table("check_ins")
        .select("id")
        .eq("job_id", job_id)
        .eq("ba_id", ba_id)
        .single()
        .execute()
    )

    if checkin.data:
        raise HTTPException(
            status_code=400,
            detail="Cannot unassign BA who has already checked in",
        )

    # Update application to withdrawn
    supabase.table("job_applications").update({
        "status": "withdrawn",
    }).eq("id", application.data["id"]).execute()

    # Update slots_filled
    job = supabase.table("jobs").select("slots_filled").eq("id", job_id).single().execute()
    if job.data and job.data["slots_filled"] > 0:
        supabase.table("jobs").update({
            "slots_filled": job.data["slots_filled"] - 1,
        }).eq("id", job_id).execute()

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
        .select("id, status, job_id, ba_id, jobs(id, title, date, location, start_time, slots_filled), ba_profiles(id, name, user_id)")
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
    supabase.table("job_applications").update({
        "status": body.status,
        "reviewed_at": datetime.utcnow().isoformat(),
        "reviewed_by": current_user.id,
        "notes": body.notes,
    }).eq("id", application_id).execute()

    # Adjust slots_filled
    if body.status == "approved" and previous_status != "approved":
        supabase.table("jobs").update({
            "slots_filled": job_data["slots_filled"] + 1,
        }).eq("id", application.data["job_id"]).execute()
    elif body.status == "rejected" and previous_status == "approved":
        supabase.table("jobs").update({
            "slots_filled": max(0, job_data["slots_filled"] - 1),
        }).eq("id", application.data["job_id"]).execute()

    # Send email
    email, name = get_ba_email(supabase, ba_data["id"])
    if email:
        if body.status == "approved":
            send_application_approved_email(
                to_email=email,
                name=name,
                job_title=job_data["title"],
                job_date=job_data["date"],
                job_location=job_data["location"],
                start_time=job_data["start_time"],
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

    # Get jobs happening tomorrow
    jobs = (
        supabase.table("jobs")
        .select("id, title, date, location, start_time")
        .eq("date", tomorrow)
        .eq("status", "published")
        .execute()
    )

    sent = 0
    for job in jobs.data or []:
        # Get approved applications for this job
        applications = (
            supabase.table("job_applications")
            .select("ba_id")
            .eq("job_id", job["id"])
            .eq("status", "approved")
            .execute()
        )

        for app in applications.data or []:
            email, name = get_ba_email(supabase, app["ba_id"])
            if email:
                send_job_reminder_email(
                    to_email=email,
                    name=name,
                    job_title=job["title"],
                    job_date=job["date"],
                    job_location=job["location"],
                    start_time=job["start_time"],
                    job_id=job["id"],
                )
                sent += 1

    return {"sent": sent}


@router.get("/jobs/{job_id}/attendance")
async def get_job_attendance(
    job_id: str,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Get attendance records for a job."""
    supabase = get_supabase_client()

    # Check job exists
    job = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    if not job.data:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get approved applications with check-in data
    applications = (
        supabase.table("job_applications")
        .select("*, ba_profiles(name, phone), check_ins(*)")
        .eq("job_id", job_id)
        .eq("status", "approved")
        .execute()
    )

    attendance = []
    for app in applications.data or []:
        checkin = app.get("check_ins")
        if isinstance(checkin, list):
            checkin = checkin[0] if checkin else None

        attendance.append({
            "ba_id": app["ba_id"],
            "ba_name": app["ba_profiles"]["name"] if app.get("ba_profiles") else None,
            "ba_phone": app["ba_profiles"]["phone"] if app.get("ba_profiles") else None,
            "checked_in": checkin is not None,
            "check_in_time": checkin["check_in_time"] if checkin else None,
            "checked_out": checkin.get("check_out_time") is not None if checkin else False,
            "check_out_time": checkin.get("check_out_time") if checkin else None,
        })

    return {
        "job": job.data,
        "attendance": attendance,
        "total_assigned": len(attendance),
        "checked_in": sum(1 for a in attendance if a["checked_in"]),
        "checked_out": sum(1 for a in attendance if a["checked_out"]),
    }


@router.post("/payments/trigger")
async def trigger_payment(
    payment: PaymentTrigger,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Trigger a payment to a BA via Stripe Connect."""
    # TODO: Implement with Stripe Connect
    raise HTTPException(
        status_code=501,
        detail="Stripe Connect integration not yet implemented",
    )


@router.get("/payments")
async def list_payments(
    job_id: Optional[str] = None,
    ba_id: Optional[str] = None,
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

    result = query.range(offset, offset + limit - 1).order("created_at", desc=True).execute()

    return {
        "payments": result.data or [],
        "total": result.count or 0,
        "limit": limit,
        "offset": offset,
    }


@router.get("/reports/jobs")
async def get_jobs_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Generate jobs report."""
    supabase = get_supabase_client()

    query = supabase.table("jobs").select("*")

    if start_date:
        query = query.gte("date", start_date)
    if end_date:
        query = query.lte("date", end_date)

    result = query.execute()
    jobs = result.data or []

    # Calculate stats
    total_jobs = len(jobs)
    today = datetime.utcnow().date().isoformat()
    completed_jobs = sum(1 for j in jobs if j["status"] == "published" and j["date"] < today)
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
        # Get completed check-ins
        checkins = (
            supabase.table("check_ins")
            .select("check_in_time, check_out_time")
            .eq("ba_id", ba["id"])
            .not_.is_("check_out_time", "null")
            .execute()
        )

        total_hours = 0
        for checkin in checkins.data or []:
            if checkin["check_in_time"] and checkin["check_out_time"]:
                check_in = datetime.fromisoformat(checkin["check_in_time"].replace("Z", "+00:00"))
                check_out = datetime.fromisoformat(checkin["check_out_time"].replace("Z", "+00:00"))
                total_hours += (check_out - check_in).total_seconds() / 3600

        ba_stats.append({
            "id": ba["id"],
            "name": ba["name"],
            "zip_code": ba["zip_code"],
            "jobs_completed": len(checkins.data or []),
            "total_hours": round(total_hours, 2),
        })

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

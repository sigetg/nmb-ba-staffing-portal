from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

router = APIRouter()


class BAApproval(BaseModel):
    status: str  # "approved" or "rejected"
    notes: Optional[str] = None


class JobAssignment(BaseModel):
    ba_ids: List[str]


class PaymentTrigger(BaseModel):
    job_id: str
    ba_id: str
    amount: float
    notes: Optional[str] = None


@router.get("/dashboard")
async def get_dashboard():
    """Get admin dashboard stats."""
    # TODO: Implement with Supabase + admin auth check
    return {
        "pending_applications": 0,
        "active_jobs": 0,
        "total_bas": 0,
        "upcoming_jobs": 0,
    }


@router.patch("/bas/{ba_id}/status")
async def update_ba_status(ba_id: str, approval: BAApproval):
    """Approve or reject a BA application."""
    # TODO: Implement with Supabase + admin auth check
    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("/jobs/{job_id}/assign")
async def assign_bas_to_job(job_id: str, assignment: JobAssignment):
    """Assign BAs to a job."""
    # TODO: Implement with Supabase + admin auth check
    raise HTTPException(status_code=501, detail="Not implemented")


@router.delete("/jobs/{job_id}/assign/{ba_id}")
async def unassign_ba_from_job(job_id: str, ba_id: str):
    """Remove a BA from a job assignment."""
    # TODO: Implement with Supabase + admin auth check
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/jobs/{job_id}/attendance")
async def get_job_attendance(job_id: str):
    """Get attendance records for a job."""
    # TODO: Implement with Supabase + admin auth check
    return {"attendance": []}


@router.post("/payments/trigger")
async def trigger_payment(payment: PaymentTrigger):
    """Trigger a payment to a BA via Stripe Connect."""
    # TODO: Implement with Stripe Connect + admin auth check
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/payments")
async def list_payments(
    job_id: Optional[str] = None,
    ba_id: Optional[str] = None,
    limit: int = Query(20, le=100),
    offset: int = 0,
):
    """List payment history."""
    # TODO: Implement with Supabase + admin auth check
    return {"payments": [], "total": 0, "limit": limit, "offset": offset}


@router.get("/reports/jobs")
async def get_jobs_report(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
):
    """Generate jobs report."""
    # TODO: Implement with Supabase + admin auth check
    return {"report": {}}


@router.get("/reports/bas")
async def get_bas_report():
    """Generate BAs performance report."""
    # TODO: Implement with Supabase + admin auth check
    return {"report": {}}

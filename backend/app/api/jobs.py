from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum

router = APIRouter()


class JobStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class JobCreate(BaseModel):
    title: str
    brand: str
    description: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    date: datetime
    start_time: str
    end_time: str
    pay_rate: float
    slots: int
    worksheet_url: Optional[str] = None


class JobUpdate(BaseModel):
    title: Optional[str] = None
    brand: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    date: Optional[datetime] = None
    pay_rate: Optional[float] = None
    slots: Optional[int] = None
    status: Optional[JobStatus] = None


@router.get("/")
async def list_jobs(
    status: Optional[JobStatus] = None,
    brand: Optional[str] = None,
    limit: int = Query(20, le=100),
    offset: int = 0,
):
    """List all jobs with optional filters."""
    # TODO: Implement with Supabase
    return {"jobs": [], "total": 0, "limit": limit, "offset": offset}


@router.get("/{job_id}")
async def get_job(job_id: str):
    """Get a specific job by ID."""
    # TODO: Implement with Supabase
    raise HTTPException(status_code=404, detail="Job not found")


@router.post("/")
async def create_job(job: JobCreate):
    """Create a new job (admin only)."""
    # TODO: Implement with Supabase + admin auth check
    raise HTTPException(status_code=501, detail="Not implemented")


@router.patch("/{job_id}")
async def update_job(job_id: str, job: JobUpdate):
    """Update a job (admin only)."""
    # TODO: Implement with Supabase + admin auth check
    raise HTTPException(status_code=501, detail="Not implemented")


@router.delete("/{job_id}")
async def delete_job(job_id: str):
    """Delete a job (admin only)."""
    # TODO: Implement with Supabase + admin auth check
    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("/{job_id}/apply")
async def apply_to_job(job_id: str):
    """Apply to a job as a BA."""
    # TODO: Implement with Supabase + BA auth check
    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("/{job_id}/check-in")
async def check_in(job_id: str, latitude: float, longitude: float):
    """Check in to a job with GPS coordinates."""
    # TODO: Implement with Supabase + location verification
    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("/{job_id}/check-out")
async def check_out(job_id: str, latitude: float, longitude: float):
    """Check out from a job with GPS coordinates."""
    # TODO: Implement with Supabase
    raise HTTPException(status_code=501, detail="Not implemented")

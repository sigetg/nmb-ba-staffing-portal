from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum
import math

from app.core.auth import get_current_user, get_current_admin, get_current_ba, CurrentUser, get_optional_user
from app.core.supabase import get_supabase_client
from app.services.email import (
    get_ba_email,
    send_application_confirmed_email,
    send_job_cancelled_email,
)
from timezonefinder import TimezoneFinder

_tf = TimezoneFinder()

DEFAULT_TIMEZONE = "America/Chicago"


def _detect_timezone(latitude: Optional[float], longitude: Optional[float], explicit_tz: Optional[str] = None) -> str:
    """Detect timezone from lat/lng, or use explicit value, or fall back to default."""
    if explicit_tz:
        return explicit_tz
    if latitude is not None and longitude is not None:
        detected = _tf.timezone_at(lat=latitude, lng=longitude)
        if detected:
            return detected
    return DEFAULT_TIMEZONE

router = APIRouter()

# Maximum distance in meters for valid check-in
MAX_CHECKIN_DISTANCE_METERS = 200


class JobStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    CANCELLED = "cancelled"


class JobCreate(BaseModel):
    title: str
    brand: str
    description: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    date: str  # YYYY-MM-DD
    start_time: str  # HH:MM
    end_time: str  # HH:MM
    pay_rate: float
    slots: int
    worksheet_url: Optional[str] = None
    status: JobStatus = JobStatus.DRAFT
    timezone: Optional[str] = None


class JobUpdate(BaseModel):
    title: Optional[str] = None
    brand: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    pay_rate: Optional[float] = None
    slots: Optional[int] = None
    status: Optional[JobStatus] = None
    worksheet_url: Optional[str] = None
    timezone: Optional[str] = None


class JobResponse(BaseModel):
    id: str
    title: str
    brand: str
    description: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    date: str
    start_time: str
    end_time: str
    pay_rate: float
    slots: int
    slots_filled: int
    status: str
    timezone: str
    worksheet_url: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None


class CheckInRequest(BaseModel):
    latitude: float
    longitude: float


class CheckOutRequest(BaseModel):
    latitude: float
    longitude: float
    notes: Optional[str] = None


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in meters using Haversine formula."""
    R = 6371000  # Earth's radius in meters

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


@router.get("/", response_model=dict)
async def list_jobs(
    status: Optional[JobStatus] = None,
    brand: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(20, le=100),
    offset: int = 0,
    current_user: Optional[CurrentUser] = Depends(get_optional_user),
):
    """List all jobs with optional filters.

    For BAs: Only shows published and in_progress jobs.
    For admins: Shows all jobs.
    For unauthenticated: Shows only published jobs.
    """
    supabase = get_supabase_client()

    query = supabase.table("jobs").select("*", count="exact")

    # Filter by status
    if status:
        query = query.eq("status", status.value)
    elif not current_user or current_user.role != "admin":
        # Non-admins can only see published jobs
        query = query.in_("status", ["published"])

    if brand:
        query = query.ilike("brand", f"%{brand}%")
    if date_from:
        query = query.gte("date", date_from)
    if date_to:
        query = query.lte("date", date_to)

    query = query.range(offset, offset + limit - 1).order("date", desc=False)

    result = query.execute()

    return {
        "jobs": result.data or [],
        "total": result.count or 0,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str):
    """Get a specific job by ID."""
    supabase = get_supabase_client()

    result = supabase.table("jobs").select("*").eq("id", job_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobResponse(**result.data)


@router.post("/", response_model=JobResponse)
async def create_job(
    job: JobCreate,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Create a new job (admin only)."""
    supabase = get_supabase_client()

    timezone = _detect_timezone(job.latitude, job.longitude, job.timezone)

    result = (
        supabase.table("jobs")
        .insert(
            {
                "title": job.title,
                "brand": job.brand,
                "description": job.description,
                "location": job.location,
                "latitude": job.latitude,
                "longitude": job.longitude,
                "date": job.date,
                "start_time": job.start_time,
                "end_time": job.end_time,
                "pay_rate": job.pay_rate,
                "slots": job.slots,
                "slots_filled": 0,
                "status": job.status.value,
                "timezone": timezone,
                "worksheet_url": job.worksheet_url,
            }
        )
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create job")

    return JobResponse(**result.data[0])


@router.patch("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: str,
    job: JobUpdate,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Update a job (admin only)."""
    supabase = get_supabase_client()

    # Check job exists
    existing = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Job not found")

    # Build update data
    update_data = {}
    if job.title is not None:
        update_data["title"] = job.title
    if job.brand is not None:
        update_data["brand"] = job.brand
    if job.description is not None:
        update_data["description"] = job.description
    if job.location is not None:
        update_data["location"] = job.location
    if job.latitude is not None:
        update_data["latitude"] = job.latitude
    if job.longitude is not None:
        update_data["longitude"] = job.longitude
    if job.date is not None:
        update_data["date"] = job.date
    if job.start_time is not None:
        update_data["start_time"] = job.start_time
    if job.end_time is not None:
        update_data["end_time"] = job.end_time
    if job.pay_rate is not None:
        update_data["pay_rate"] = job.pay_rate
    if job.slots is not None:
        update_data["slots"] = job.slots
    if job.status is not None:
        update_data["status"] = job.status.value
    if job.worksheet_url is not None:
        update_data["worksheet_url"] = job.worksheet_url

    # Auto-detect timezone if lat/lng changed and timezone not explicitly set
    if job.timezone is not None:
        update_data["timezone"] = job.timezone
    elif job.latitude is not None and job.longitude is not None:
        detected = _tf.timezone_at(lat=job.latitude, lng=job.longitude)
        if detected:
            update_data["timezone"] = detected

    if not update_data:
        return JobResponse(**existing.data)

    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = supabase.table("jobs").update(update_data).eq("id", job_id).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update job")

    # Send cancellation emails if job was just cancelled
    if job.status == JobStatus.CANCELLED and existing.data.get("status") != "cancelled":
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
                send_job_cancelled_email(
                    to_email=email,
                    name=name,
                    job_title=existing.data["title"],
                    job_date=existing.data["date"],
                )

    return JobResponse(**result.data[0])


@router.delete("/{job_id}")
async def delete_job(
    job_id: str,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Delete a job (admin only)."""
    supabase = get_supabase_client()

    # Check job exists
    existing = supabase.table("jobs").select("id").eq("id", job_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Job not found")

    # Delete job (cascade will handle related records)
    supabase.table("jobs").delete().eq("id", job_id).execute()

    return {"message": "Job deleted successfully"}


@router.post("/{job_id}/apply")
async def apply_to_job(
    job_id: str,
    current_user: CurrentUser = Depends(get_current_ba),
):
    """Apply to a job as a BA."""
    supabase = get_supabase_client()

    # Get BA profile
    profile = (
        supabase.table("ba_profiles")
        .select("id, status")
        .eq("user_id", current_user.id)
        .single()
        .execute()
    )

    if not profile.data:
        raise HTTPException(status_code=404, detail="BA profile not found")

    if profile.data["status"] != "approved":
        raise HTTPException(status_code=403, detail="Your profile must be approved to apply for jobs")

    ba_id = profile.data["id"]

    # Check job exists and is available
    job = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    if not job.data:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.data["status"] != "published":
        raise HTTPException(status_code=400, detail="This job is not accepting applications")

    if job.data["slots_filled"] >= job.data["slots"]:
        raise HTTPException(status_code=400, detail="This job has no available slots")

    # Check for existing application
    existing = (
        supabase.table("job_applications")
        .select("id, status")
        .eq("job_id", job_id)
        .eq("ba_id", ba_id)
        .single()
        .execute()
    )

    if existing.data:
        raise HTTPException(
            status_code=400,
            detail=f"You have already applied to this job. Status: {existing.data['status']}",
        )

    # Create application
    result = (
        supabase.table("job_applications")
        .insert(
            {
                "job_id": job_id,
                "ba_id": ba_id,
                "status": "pending",
                "applied_at": datetime.utcnow().isoformat(),
            }
        )
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to submit application")

    # Send confirmation email
    if current_user.email and current_user.profile:
        send_application_confirmed_email(
            to_email=current_user.email,
            name=current_user.profile.get("name"),
            job_title=job.data["title"],
            job_date=job.data["date"],
            job_location=job.data["location"],
        )

    return {"message": "Application submitted successfully", "application_id": result.data[0]["id"]}


@router.post("/{job_id}/check-in")
async def check_in(
    job_id: str,
    check_in_data: CheckInRequest,
    current_user: CurrentUser = Depends(get_current_ba),
):
    """Check in to a job with GPS coordinates."""
    supabase = get_supabase_client()

    # Get BA profile
    profile = (
        supabase.table("ba_profiles")
        .select("id")
        .eq("user_id", current_user.id)
        .single()
        .execute()
    )

    if not profile.data:
        raise HTTPException(status_code=404, detail="BA profile not found")

    ba_id = profile.data["id"]

    # Get job
    job = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    if not job.data:
        raise HTTPException(status_code=404, detail="Job not found")

    # Check BA is approved for this job
    application = (
        supabase.table("job_applications")
        .select("id, status")
        .eq("job_id", job_id)
        .eq("ba_id", ba_id)
        .single()
        .execute()
    )

    if not application.data or application.data["status"] != "approved":
        raise HTTPException(status_code=403, detail="You are not approved for this job")

    # Check for existing check-in
    existing_checkin = (
        supabase.table("check_ins")
        .select("id")
        .eq("job_id", job_id)
        .eq("ba_id", ba_id)
        .single()
        .execute()
    )

    if existing_checkin.data:
        raise HTTPException(status_code=400, detail="You have already checked in to this job")

    # Validate GPS distance if job has coordinates
    distance = None
    if job.data.get("latitude") and job.data.get("longitude"):
        distance = calculate_distance(
            check_in_data.latitude,
            check_in_data.longitude,
            job.data["latitude"],
            job.data["longitude"],
        )

        if distance > MAX_CHECKIN_DISTANCE_METERS:
            raise HTTPException(
                status_code=400,
                detail=f"You are too far from the job location. Distance: {int(distance)}m (max: {MAX_CHECKIN_DISTANCE_METERS}m)",
            )

    # Create check-in
    result = (
        supabase.table("check_ins")
        .insert(
            {
                "job_id": job_id,
                "ba_id": ba_id,
                "check_in_time": datetime.utcnow().isoformat(),
                "check_in_latitude": check_in_data.latitude,
                "check_in_longitude": check_in_data.longitude,
            }
        )
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to check in")

    return {
        "message": "Checked in successfully",
        "check_in_id": result.data[0]["id"],
        "distance_meters": int(distance) if distance else None,
    }


@router.post("/{job_id}/check-out")
async def check_out(
    job_id: str,
    check_out_data: CheckOutRequest,
    current_user: CurrentUser = Depends(get_current_ba),
):
    """Check out from a job with GPS coordinates."""
    supabase = get_supabase_client()

    # Get BA profile
    profile = (
        supabase.table("ba_profiles")
        .select("id")
        .eq("user_id", current_user.id)
        .single()
        .execute()
    )

    if not profile.data:
        raise HTTPException(status_code=404, detail="BA profile not found")

    ba_id = profile.data["id"]

    # Get existing check-in
    checkin = (
        supabase.table("check_ins")
        .select("*")
        .eq("job_id", job_id)
        .eq("ba_id", ba_id)
        .single()
        .execute()
    )

    if not checkin.data:
        raise HTTPException(status_code=400, detail="You have not checked in to this job")

    if checkin.data.get("check_out_time"):
        raise HTTPException(status_code=400, detail="You have already checked out from this job")

    # Update check-in with check-out data
    result = (
        supabase.table("check_ins")
        .update(
            {
                "check_out_time": datetime.utcnow().isoformat(),
                "check_out_latitude": check_out_data.latitude,
                "check_out_longitude": check_out_data.longitude,
            }
        )
        .eq("id", checkin.data["id"])
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to check out")

    # Calculate hours worked
    check_in_time = datetime.fromisoformat(checkin.data["check_in_time"].replace("Z", "+00:00"))
    check_out_time = datetime.utcnow()
    hours_worked = (check_out_time - check_in_time).total_seconds() / 3600

    return {
        "message": "Checked out successfully",
        "hours_worked": round(hours_worked, 2),
    }

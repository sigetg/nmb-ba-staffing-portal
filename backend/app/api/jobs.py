import math
from datetime import datetime
from enum import StrEnum

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from timezonefinder import TimezoneFinder

from app.core.auth import (
    CurrentUser,
    get_current_admin,
    get_current_ba,
    get_optional_user,
)
from app.core.supabase import get_supabase_client
from app.models.job import (
    SkipLocationRequest,
)
from app.services.email import (
    get_ba_email,
    get_job_display_info,
    send_application_confirmed_email,
    send_job_cancelled_email,
)

_tf = TimezoneFinder()

DEFAULT_TIMEZONE = "America/Chicago"


def _detect_timezone(
    latitude: float | None, longitude: float | None, explicit_tz: str | None = None
) -> str:
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


class JobStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    CANCELLED = "cancelled"


class CheckoutResponseValueIn(BaseModel):
    kpi_id: str | None = None
    question_id: str | None = None
    numeric_value: float | None = None
    text_value: str | None = None
    option_id: str | None = None


class JobCreate(BaseModel):
    title: str
    brand: str
    description: str
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    date: str | None = None  # YYYY-MM-DD
    start_time: str | None = None  # HH:MM
    end_time: str | None = None  # HH:MM
    pay_rate: float
    slots: int
    worksheet_url: str | None = None
    status: JobStatus = JobStatus.DRAFT
    timezone: str | None = None
    job_type_id: str | None = None
    # Multi-day support
    days: list[dict] | None = None


class JobUpdate(BaseModel):
    title: str | None = None
    brand: str | None = None
    description: str | None = None
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    date: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    pay_rate: float | None = None
    slots: int | None = None
    status: JobStatus | None = None
    worksheet_url: str | None = None
    timezone: str | None = None
    job_type_id: str | None = None
    # Multi-day support
    days: list[dict] | None = None


class CheckInRequest(BaseModel):
    latitude: float
    longitude: float
    # Multi-location support
    job_day_location_id: str | None = None
    gps_override: bool = False
    gps_override_reason: str | None = None


class CheckOutRequest(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None
    # Multi-location support
    job_day_location_id: str | None = None
    is_end_of_day: bool = False
    # Dynamic checkout responses
    checkout_responses: list[CheckoutResponseValueIn] | None = None


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in meters using Haversine formula."""
    R = 6371000  # Earth's radius in meters

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def _insert_job_days(supabase, job_id: str, days: list[dict], timezone: str):
    """Insert job_days and job_day_locations for a job."""
    for i, day in enumerate(days):
        day_result = (
            supabase.table("job_days")
            .insert(
                {
                    "job_id": job_id,
                    "date": day["date"],
                    "sort_order": day.get("sort_order", i),
                }
            )
            .execute()
        )
        if not day_result.data:
            raise HTTPException(status_code=500, detail="Failed to create job day")

        day_id = day_result.data[0]["id"]

        for j, loc in enumerate(day.get("locations", [])):
            loc_result = (
                supabase.table("job_day_locations")
                .insert(
                    {
                        "job_day_id": day_id,
                        "job_id": job_id,
                        "location": loc["location"],
                        "latitude": loc.get("latitude"),
                        "longitude": loc.get("longitude"),
                        "start_time": loc["start_time"],
                        "end_time": loc["end_time"],
                        "sort_order": loc.get("sort_order", j),
                    }
                )
                .execute()
            )
            if not loc_result.data:
                raise HTTPException(status_code=500, detail="Failed to create job day location")


@router.get("/", response_model=dict)
async def list_jobs(
    status: JobStatus | None = None,
    brand: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = Query(20, le=100),
    offset: int = 0,
    current_user: CurrentUser | None = Depends(get_optional_user),
):
    """List all jobs with optional filters."""
    supabase = get_supabase_client()

    query = supabase.table("jobs").select("*, job_days(*, job_day_locations(*))", count="exact")

    # Filter by status
    if status:
        query = query.eq("status", status.value)
    elif not current_user or current_user.role != "admin":
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


@router.get("/{job_id}")
async def get_job(job_id: str):
    """Get a specific job by ID with nested days and locations."""
    supabase = get_supabase_client()

    result = (
        supabase.table("jobs")
        .select("*, job_days(*, job_day_locations(*))")
        .eq("id", job_id)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")

    # Sort days and locations by sort_order
    job = result.data
    if job.get("job_days"):
        job["job_days"].sort(key=lambda d: d.get("sort_order", 0))
        for day in job["job_days"]:
            if day.get("job_day_locations"):
                day["job_day_locations"].sort(key=lambda loc: loc.get("sort_order", 0))

    return job


@router.post("/")
async def create_job(
    job: JobCreate,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Create a new job (admin only). Supports optional multi-day structure."""
    supabase = get_supabase_client()

    # Detect timezone from first location if multi-day
    tz_lat = job.latitude
    tz_lng = job.longitude
    if job.days and not tz_lat:
        first_loc = job.days[0].get("locations", [{}])[0] if job.days[0].get("locations") else {}
        tz_lat = first_loc.get("latitude")
        tz_lng = first_loc.get("longitude")

    timezone = _detect_timezone(tz_lat, tz_lng, job.timezone)

    job_data = {
        "title": job.title,
        "brand": job.brand,
        "description": job.description,
        "pay_rate": job.pay_rate,
        "slots": job.slots,
        "slots_filled": 0,
        "status": job.status.value,
        "timezone": timezone,
        "worksheet_url": job.worksheet_url,
        "job_type_id": job.job_type_id,
    }

    # If multi-day, legacy columns are null; otherwise use them
    if job.days:
        job_data["location"] = None
        job_data["latitude"] = None
        job_data["longitude"] = None
        job_data["date"] = None
        job_data["start_time"] = None
        job_data["end_time"] = None
    else:
        job_data["location"] = job.location
        job_data["latitude"] = job.latitude
        job_data["longitude"] = job.longitude
        job_data["date"] = job.date
        job_data["start_time"] = job.start_time
        job_data["end_time"] = job.end_time

    result = supabase.table("jobs").insert(job_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create job")

    created_job = result.data[0]

    # Insert days/locations if multi-day
    if job.days:
        _insert_job_days(supabase, created_job["id"], job.days, timezone)

    # Re-fetch with nested data
    full_job = (
        supabase.table("jobs")
        .select("*, job_days(*, job_day_locations(*))")
        .eq("id", created_job["id"])
        .single()
        .execute()
    )

    return full_job.data


@router.patch("/{job_id}")
async def update_job(
    job_id: str,
    job: JobUpdate,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Update a job (admin only). Supports optional multi-day schedule replacement."""
    supabase = get_supabase_client()

    # Check job exists
    existing = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Job not found")

    # Build update data
    update_data = {}
    for field in [
        "title",
        "brand",
        "description",
        "location",
        "latitude",
        "longitude",
        "date",
        "start_time",
        "end_time",
        "pay_rate",
        "slots",
        "worksheet_url",
        "job_type_id",
    ]:
        val = getattr(job, field, None)
        if val is not None:
            update_data[field] = val

    if job.status is not None:
        update_data["status"] = job.status.value

    # Auto-detect timezone if lat/lng changed
    if job.timezone is not None:
        update_data["timezone"] = job.timezone
    elif job.latitude is not None and job.longitude is not None:
        detected = _tf.timezone_at(lat=job.latitude, lng=job.longitude)
        if detected:
            update_data["timezone"] = detected

    # Handle multi-day schedule replacement
    if job.days is not None:
        # Clear legacy columns
        update_data["location"] = None
        update_data["latitude"] = None
        update_data["longitude"] = None
        update_data["date"] = None
        update_data["start_time"] = None
        update_data["end_time"] = None

        # Delete existing days (cascade deletes locations)
        supabase.table("job_days").delete().eq("job_id", job_id).execute()

        # Insert new days
        tz = update_data.get("timezone") or existing.data.get("timezone") or DEFAULT_TIMEZONE
        _insert_job_days(supabase, job_id, job.days, tz)

    if update_data:
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
        cancel_info = get_job_display_info(supabase, job_id, existing.data)
        for app in applications.data or []:
            email, name = get_ba_email(supabase, app["ba_id"])
            if email:
                send_job_cancelled_email(
                    to_email=email,
                    name=name,
                    job_title=existing.data["title"],
                    job_date=cancel_info["date"],
                )

    # Re-fetch with nested data
    full_job = (
        supabase.table("jobs")
        .select("*, job_days(*, job_day_locations(*))")
        .eq("id", job_id)
        .single()
        .execute()
    )

    return full_job.data


@router.delete("/{job_id}")
async def delete_job(
    job_id: str,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Delete a job (admin only)."""
    supabase = get_supabase_client()

    existing = supabase.table("jobs").select("id").eq("id", job_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Job not found")

    supabase.table("jobs").delete().eq("id", job_id).execute()

    return {"message": "Job deleted successfully"}


@router.post("/{job_id}/apply")
async def apply_to_job(
    job_id: str,
    current_user: CurrentUser = Depends(get_current_ba),
):
    """Apply to a job as a BA."""
    supabase = get_supabase_client()

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
        raise HTTPException(
            status_code=403, detail="Your profile must be approved to apply for jobs"
        )

    ba_id = profile.data["id"]

    job = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    if not job.data:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.data["status"] != "published":
        raise HTTPException(status_code=400, detail="This job is not accepting applications")

    if job.data["slots_filled"] >= job.data["slots"]:
        raise HTTPException(status_code=400, detail="This job has no available slots")

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

    if current_user.email and current_user.profile:
        # For multi-day jobs, get location from first day
        job_location = job.data.get("location") or ""
        job_date = job.data.get("date") or ""
        if not job_location:
            days = (
                supabase.table("job_days")
                .select("date, job_day_locations(location)")
                .eq("job_id", job_id)
                .order("sort_order")
                .limit(1)
                .execute()
            )
            if days.data:
                job_date = days.data[0].get("date", "")
                locs = days.data[0].get("job_day_locations", [])
                if locs:
                    job_location = locs[0].get("location", "")

        send_application_confirmed_email(
            to_email=current_user.email,
            name=current_user.profile.get("name"),
            job_title=job.data["title"],
            job_date=job_date,
            job_location=job_location,
        )

    return {"message": "Application submitted successfully", "application_id": result.data[0]["id"]}


@router.post("/{job_id}/check-in")
async def check_in(
    job_id: str,
    check_in_data: CheckInRequest,
    current_user: CurrentUser = Depends(get_current_ba),
):
    """Check in to a job location with GPS coordinates.

    If job_day_location_id is provided, creates a location_check_ins record.
    Otherwise falls back to legacy check_ins table.
    """
    supabase = get_supabase_client()

    profile = (
        supabase.table("ba_profiles").select("id").eq("user_id", current_user.id).single().execute()
    )

    if not profile.data:
        raise HTTPException(status_code=404, detail="BA profile not found")

    ba_id = profile.data["id"]

    # Verify BA is approved for this job
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

    # Multi-location check-in
    if check_in_data.job_day_location_id:
        # Verify location belongs to this job
        location = (
            supabase.table("job_day_locations")
            .select("*")
            .eq("id", check_in_data.job_day_location_id)
            .eq("job_id", job_id)
            .single()
            .execute()
        )

        if not location.data:
            raise HTTPException(status_code=404, detail="Location not found for this job")

        # Check for existing check-in at this location
        existing = (
            supabase.table("location_check_ins")
            .select("id")
            .eq("job_day_location_id", check_in_data.job_day_location_id)
            .eq("ba_id", ba_id)
            .single()
            .execute()
        )

        if existing.data:
            raise HTTPException(
                status_code=400, detail="You have already checked in to this location"
            )

        # Validate GPS distance
        distance = None
        if location.data.get("latitude") and location.data.get("longitude"):
            distance = calculate_distance(
                check_in_data.latitude,
                check_in_data.longitude,
                float(location.data["latitude"]),
                float(location.data["longitude"]),
            )

            if distance > MAX_CHECKIN_DISTANCE_METERS and not check_in_data.gps_override:
                raise HTTPException(
                    status_code=400,
                    detail=f"You are too far from the location. Distance: {int(distance)}m (max: {MAX_CHECKIN_DISTANCE_METERS}m). Use GPS override if needed.",
                )

        # Create location check-in
        result = (
            supabase.table("location_check_ins")
            .insert(
                {
                    "job_day_location_id": check_in_data.job_day_location_id,
                    "ba_id": ba_id,
                    "check_in_time": datetime.utcnow().isoformat(),
                    "check_in_latitude": check_in_data.latitude,
                    "check_in_longitude": check_in_data.longitude,
                    "check_in_gps_override": check_in_data.gps_override,
                    "check_in_gps_override_explanation": check_in_data.gps_override_reason,
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
            "gps_override": check_in_data.gps_override,
        }

    # Legacy single-location check-in
    job = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    if not job.data:
        raise HTTPException(status_code=404, detail="Job not found")

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

    distance = None
    if job.data.get("latitude") and job.data.get("longitude"):
        distance = calculate_distance(
            check_in_data.latitude,
            check_in_data.longitude,
            job.data["latitude"],
            job.data["longitude"],
        )

        if distance > MAX_CHECKIN_DISTANCE_METERS and not check_in_data.gps_override:
            raise HTTPException(
                status_code=400,
                detail=f"You are too far from the job location. Distance: {int(distance)}m (max: {MAX_CHECKIN_DISTANCE_METERS}m)",
            )

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
    """Check out from a job location.

    If job_day_location_id is provided, uses location_check_ins.
    Mid-day departure: only records time + GPS, creates travel log.
    End-of-day: records full survey data.
    """
    supabase = get_supabase_client()

    profile = (
        supabase.table("ba_profiles").select("id").eq("user_id", current_user.id).single().execute()
    )

    if not profile.data:
        raise HTTPException(status_code=404, detail="BA profile not found")

    ba_id = profile.data["id"]

    # Multi-location check-out
    if check_out_data.job_day_location_id:
        checkin = (
            supabase.table("location_check_ins")
            .select("*")
            .eq("job_day_location_id", check_out_data.job_day_location_id)
            .eq("ba_id", ba_id)
            .single()
            .execute()
        )

        if not checkin.data:
            raise HTTPException(status_code=400, detail="You have not checked in to this location")

        if checkin.data.get("check_out_time"):
            raise HTTPException(
                status_code=400, detail="You have already checked out from this location"
            )

        now = datetime.utcnow().isoformat()

        update_data = {
            "check_out_time": now,
            "check_out_latitude": check_out_data.latitude,
            "check_out_longitude": check_out_data.longitude,
            "is_end_of_day": check_out_data.is_end_of_day,
        }

        result = (
            supabase.table("location_check_ins")
            .update(update_data)
            .eq("id", checkin.data["id"])
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to check out")

        # Store dynamic checkout responses for end-of-day
        if check_out_data.is_end_of_day and check_out_data.checkout_responses:
            resp_result = (
                supabase.table("checkout_responses")
                .insert(
                    {
                        "job_id": job_id,
                        "ba_id": ba_id,
                        "location_check_in_id": checkin.data["id"],
                    }
                )
                .execute()
            )
            if resp_result.data:
                resp_id = resp_result.data[0]["id"]
                for val in check_out_data.checkout_responses:
                    val_data = {"checkout_response_id": resp_id}
                    if val.kpi_id:
                        val_data["kpi_id"] = val.kpi_id
                    if val.question_id:
                        val_data["question_id"] = val.question_id
                    if val.numeric_value is not None:
                        val_data["numeric_value"] = val.numeric_value
                    if val.text_value is not None:
                        val_data["text_value"] = val.text_value
                    if val.option_id:
                        val_data["option_id"] = val.option_id
                    supabase.table("checkout_response_values").insert(val_data).execute()

        # Create travel log for mid-day departures
        travel_log_id = None
        if not check_out_data.is_end_of_day:
            travel_result = (
                supabase.table("travel_logs")
                .insert(
                    {
                        "ba_id": ba_id,
                        "from_location_check_in_id": checkin.data["id"],
                        "departure_time": now,
                    }
                )
                .execute()
            )
            if travel_result.data:
                travel_log_id = travel_result.data[0]["id"]

        # Calculate hours worked at this location
        check_in_time = datetime.fromisoformat(checkin.data["check_in_time"].replace("Z", "+00:00"))
        check_out_time = datetime.utcnow()
        hours_worked = (check_out_time - check_in_time).total_seconds() / 3600

        return {
            "message": "Checked out successfully",
            "hours_worked": round(hours_worked, 2),
            "is_end_of_day": check_out_data.is_end_of_day,
            "travel_log_id": travel_log_id,
        }

    # Legacy single-location check-out
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

    # Store dynamic checkout responses for legacy checkout
    if check_out_data.checkout_responses:
        resp_result = (
            supabase.table("checkout_responses")
            .insert(
                {
                    "job_id": job_id,
                    "ba_id": ba_id,
                    "check_in_id": checkin.data["id"],
                }
            )
            .execute()
        )
        if resp_result.data:
            resp_id = resp_result.data[0]["id"]
            for val in check_out_data.checkout_responses:
                val_data = {"checkout_response_id": resp_id}
                if val.kpi_id:
                    val_data["kpi_id"] = val.kpi_id
                if val.question_id:
                    val_data["question_id"] = val.question_id
                if val.numeric_value is not None:
                    val_data["numeric_value"] = val.numeric_value
                if val.text_value is not None:
                    val_data["text_value"] = val.text_value
                if val.option_id:
                    val_data["option_id"] = val.option_id
                supabase.table("checkout_response_values").insert(val_data).execute()

    check_in_time = datetime.fromisoformat(checkin.data["check_in_time"].replace("Z", "+00:00"))
    check_out_time = datetime.utcnow()
    hours_worked = (check_out_time - check_in_time).total_seconds() / 3600

    return {
        "message": "Checked out successfully",
        "hours_worked": round(hours_worked, 2),
    }


@router.post("/{job_id}/locations/{location_id}/skip")
async def skip_location(
    job_id: str,
    location_id: str,
    skip_data: SkipLocationRequest,
    current_user: CurrentUser = Depends(get_current_ba),
):
    """Skip a location (mark as missed with reason)."""
    supabase = get_supabase_client()

    profile = (
        supabase.table("ba_profiles").select("id").eq("user_id", current_user.id).single().execute()
    )

    if not profile.data:
        raise HTTPException(status_code=404, detail="BA profile not found")

    ba_id = profile.data["id"]

    # Verify location belongs to job
    location = (
        supabase.table("job_day_locations")
        .select("id")
        .eq("id", location_id)
        .eq("job_id", job_id)
        .single()
        .execute()
    )

    if not location.data:
        raise HTTPException(status_code=404, detail="Location not found for this job")

    # Create or update location_check_in as skipped
    existing = (
        supabase.table("location_check_ins")
        .select("id")
        .eq("job_day_location_id", location_id)
        .eq("ba_id", ba_id)
        .single()
        .execute()
    )

    if existing.data:
        supabase.table("location_check_ins").update(
            {
                "skipped": True,
                "skipped_reason": skip_data.reason,
            }
        ).eq("id", existing.data["id"]).execute()
    else:
        supabase.table("location_check_ins").insert(
            {
                "job_day_location_id": location_id,
                "ba_id": ba_id,
                "check_in_latitude": 0,
                "check_in_longitude": 0,
                "skipped": True,
                "skipped_reason": skip_data.reason,
            }
        ).execute()

    return {"message": "Location skipped", "location_id": location_id}


@router.post("/{job_id}/travel/{travel_log_id}/arrive")
async def record_travel_arrival(
    job_id: str,
    travel_log_id: str,
    current_user: CurrentUser = Depends(get_current_ba),
):
    """Record arrival at next location (completes travel log)."""
    supabase = get_supabase_client()

    profile = (
        supabase.table("ba_profiles").select("id").eq("user_id", current_user.id).single().execute()
    )

    if not profile.data:
        raise HTTPException(status_code=404, detail="BA profile not found")

    result = (
        supabase.table("travel_logs")
        .update({"arrival_time": datetime.utcnow().isoformat()})
        .eq("id", travel_log_id)
        .eq("ba_id", profile.data["id"])
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Travel log not found")

    return {"message": "Arrival recorded"}


@router.get("/{job_id}/my-progress")
async def get_my_job_progress(
    job_id: str,
    current_user: CurrentUser = Depends(get_current_ba),
):
    """Get current BA's progress for a multi-day job."""
    supabase = get_supabase_client()

    profile = (
        supabase.table("ba_profiles").select("id").eq("user_id", current_user.id).single().execute()
    )

    if not profile.data:
        raise HTTPException(status_code=404, detail="BA profile not found")

    ba_id = profile.data["id"]

    # Get job with days and locations
    job = (
        supabase.table("jobs")
        .select("*, job_days(*, job_day_locations(*))")
        .eq("id", job_id)
        .single()
        .execute()
    )

    if not job.data:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get all check-ins for this BA across this job's locations
    location_ids = []
    for day in job.data.get("job_days", []):
        for loc in day.get("job_day_locations", []):
            location_ids.append(loc["id"])

    check_ins = []
    if location_ids:
        check_ins_result = (
            supabase.table("location_check_ins")
            .select("*")
            .eq("ba_id", ba_id)
            .in_("job_day_location_id", location_ids)
            .execute()
        )
        check_ins = check_ins_result.data or []

    # Get travel logs
    check_in_ids = [ci["id"] for ci in check_ins]
    travel_logs = []
    if check_in_ids:
        travel_result = (
            supabase.table("travel_logs")
            .select("*")
            .eq("ba_id", ba_id)
            .in_("from_location_check_in_id", check_in_ids)
            .execute()
        )
        travel_logs = travel_result.data or []

    return {
        "job": job.data,
        "check_ins": check_ins,
        "travel_logs": travel_logs,
    }

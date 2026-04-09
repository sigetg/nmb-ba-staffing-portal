from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import Optional, List, Tuple
from enum import Enum
from datetime import datetime
import httpx
import logging

from app.core.auth import get_current_user, get_current_ba, get_current_admin, CurrentUser
from app.core.supabase import get_supabase_client
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


async def geocode_zip(zip_code: str) -> Tuple[float, float] | None:
    """Geocode a US zip code using Google Maps Geocoding API. Returns (lat, lng) or None."""
    if not settings.google_maps_api_key:
        logger.warning("Google Maps API key not configured, skipping geocoding")
        return None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={"address": zip_code, "components": "country:US", "key": settings.google_maps_api_key},
            )
            data = resp.json()
            if data.get("status") == "OK" and data.get("results"):
                loc = data["results"][0]["geometry"]["location"]
                return (loc["lat"], loc["lng"])
    except Exception as e:
        logger.error(f"Geocoding failed for zip {zip_code}: {e}")
    return None


class BAStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


class BAProfileCreate(BaseModel):
    name: str
    phone: str
    zip_code: str
    availability: dict  # JSON structure for availability
    languages: Optional[List[str]] = None
    shirt_size: Optional[str] = None
    additional_info: Optional[str] = None
    resume_url: Optional[str] = None


class BAProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    zip_code: Optional[str] = None
    availability: Optional[dict] = None
    languages: Optional[List[str]] = None
    shirt_size: Optional[str] = None
    additional_info: Optional[str] = None
    resume_url: Optional[str] = None


class BAProfileResponse(BaseModel):
    id: str
    user_id: str
    name: str
    phone: str
    zip_code: str
    status: str
    availability: dict
    languages: Optional[List[str]] = None
    shirt_size: Optional[str] = None
    additional_info: Optional[str] = None
    admin_notes: Optional[str] = None
    resume_url: Optional[str] = None
    has_seen_welcome: Optional[bool] = None
    stripe_account_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: str
    updated_at: Optional[str] = None


class BAPhoto(BaseModel):
    id: str
    ba_id: str
    photo_type: str
    url: str
    created_at: str


@router.get("/")
async def list_bas(
    status: Optional[BAStatus] = None,
    zip_code: Optional[str] = None,
    limit: int = Query(20, le=100),
    offset: int = 0,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """List all brand ambassadors (admin only)."""
    supabase = get_supabase_client()

    query = supabase.table("ba_profiles").select("*", count="exact")

    if status:
        query = query.eq("status", status.value)
    if zip_code:
        query = query.eq("zip_code", zip_code)

    query = query.range(offset, offset + limit - 1).order("created_at", desc=True)

    result = query.execute()

    return {
        "bas": result.data or [],
        "total": result.count or 0,
        "limit": limit,
        "offset": offset,
    }


@router.get("/profile", response_model=BAProfileResponse)
async def get_my_profile(
    current_user: CurrentUser = Depends(get_current_ba),
):
    """Get current BA's profile."""
    supabase = get_supabase_client()

    result = (
        supabase.table("ba_profiles")
        .select("*")
        .eq("user_id", current_user.id)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    return BAProfileResponse(**result.data)


@router.post("/profile", response_model=BAProfileResponse)
async def create_profile(
    profile: BAProfileCreate,
    current_user: CurrentUser = Depends(get_current_ba),
):
    """Create BA profile after registration."""
    supabase = get_supabase_client()

    # Check if profile already exists
    existing = (
        supabase.table("ba_profiles")
        .select("id")
        .eq("user_id", current_user.id)
        .single()
        .execute()
    )

    if existing.data:
        raise HTTPException(status_code=400, detail="Profile already exists")

    # Create profile
    insert_data = {
        "user_id": current_user.id,
        "name": profile.name,
        "phone": profile.phone,
        "zip_code": profile.zip_code,
        "status": "pending",
        "availability": profile.availability,
    }
    if profile.languages is not None:
        insert_data["languages"] = profile.languages
    if profile.shirt_size is not None:
        insert_data["shirt_size"] = profile.shirt_size
    if profile.additional_info is not None:
        insert_data["additional_info"] = profile.additional_info
    if profile.resume_url is not None:
        insert_data["resume_url"] = profile.resume_url

    result = (
        supabase.table("ba_profiles")
        .insert(insert_data)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create profile")

    return BAProfileResponse(**result.data[0])


@router.patch("/profile", response_model=BAProfileResponse)
async def update_profile(
    profile: BAProfileUpdate,
    current_user: CurrentUser = Depends(get_current_ba),
):
    """Update current BA's profile."""
    supabase = get_supabase_client()

    # Get existing profile
    existing = (
        supabase.table("ba_profiles")
        .select("*")
        .eq("user_id", current_user.id)
        .single()
        .execute()
    )

    if not existing.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Build update data (only include non-None fields)
    update_data = {}
    if profile.name is not None:
        update_data["name"] = profile.name
    if profile.phone is not None:
        update_data["phone"] = profile.phone
    if profile.zip_code is not None:
        update_data["zip_code"] = profile.zip_code
    if profile.availability is not None:
        update_data["availability"] = profile.availability
    if profile.languages is not None:
        update_data["languages"] = profile.languages
    if profile.shirt_size is not None:
        update_data["shirt_size"] = profile.shirt_size
    if profile.additional_info is not None:
        update_data["additional_info"] = profile.additional_info
    if profile.resume_url is not None:
        update_data["resume_url"] = profile.resume_url

    if not update_data:
        # Nothing to update, return existing
        return BAProfileResponse(**existing.data)

    update_data["updated_at"] = datetime.utcnow().isoformat()

    result = (
        supabase.table("ba_profiles")
        .update(update_data)
        .eq("user_id", current_user.id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update profile")

    return BAProfileResponse(**result.data[0])


@router.post("/geocode-zip")
async def geocode_zip_endpoint(
    zip_code: str = Query(..., min_length=5, max_length=5),
    current_user: CurrentUser = Depends(get_current_ba),
):
    """Geocode a zip code and return lat/lng. Optionally updates the BA's profile."""
    result = await geocode_zip(zip_code)
    if result is None:
        return {"latitude": None, "longitude": None}
    return {"latitude": result[0], "longitude": result[1]}


@router.get("/{ba_id}", response_model=BAProfileResponse)
async def get_ba(
    ba_id: str,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Get a specific BA by ID (admin only)."""
    supabase = get_supabase_client()

    result = (
        supabase.table("ba_profiles").select("*").eq("id", ba_id).single().execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="BA not found")

    return BAProfileResponse(**result.data)


@router.get("/my-jobs")
async def get_my_jobs(
    status: Optional[str] = None,
    limit: int = Query(20, le=100),
    offset: int = 0,
    current_user: CurrentUser = Depends(get_current_ba),
):
    """Get jobs the current BA has applied to or is assigned to."""
    supabase = get_supabase_client()

    # First get the BA profile
    profile = (
        supabase.table("ba_profiles")
        .select("id")
        .eq("user_id", current_user.id)
        .single()
        .execute()
    )

    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    ba_id = profile.data["id"]

    # Get job applications with job details
    query = (
        supabase.table("job_applications")
        .select("*, jobs(*)")
        .eq("ba_id", ba_id)
    )

    if status:
        query = query.eq("status", status)

    query = query.range(offset, offset + limit - 1).order("applied_at", desc=True)

    result = query.execute()

    # Transform the result
    jobs = []
    for app in result.data or []:
        job_data = app.get("jobs", {})
        jobs.append({
            "application_id": app["id"],
            "application_status": app["status"],
            "applied_at": app["applied_at"],
            "job": job_data,
        })

    return {"jobs": jobs, "total": len(jobs), "limit": limit, "offset": offset}


@router.post("/photos")
async def upload_photo(
    photo_type: str,
    current_user: CurrentUser = Depends(get_current_ba),
):
    """Upload a photo (headshot, full body, etc.).

    Note: Photo upload is handled client-side via Supabase Storage.
    This endpoint creates the photo record in the database after upload.
    """
    # This would typically receive a URL after client-side upload
    raise HTTPException(
        status_code=501,
        detail="Photo upload is handled client-side via Supabase Storage. Use this endpoint to register the photo URL after upload.",
    )


@router.get("/photos", response_model=List[BAPhoto])
async def get_my_photos(
    current_user: CurrentUser = Depends(get_current_ba),
):
    """Get current BA's uploaded photos."""
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
        raise HTTPException(status_code=404, detail="Profile not found")

    ba_id = profile.data["id"]

    result = (
        supabase.table("ba_photos")
        .select("*")
        .eq("ba_id", ba_id)
        .order("created_at", desc=True)
        .execute()
    )

    return [BAPhoto(**photo) for photo in (result.data or [])]

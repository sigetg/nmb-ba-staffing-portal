from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from enum import Enum

router = APIRouter()


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


class BAProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    zip_code: Optional[str] = None
    availability: Optional[dict] = None


@router.get("/")
async def list_bas(
    status: Optional[BAStatus] = None,
    zip_code: Optional[str] = None,
    limit: int = Query(20, le=100),
    offset: int = 0,
):
    """List all brand ambassadors (admin only)."""
    # TODO: Implement with Supabase + admin auth check
    return {"bas": [], "total": 0, "limit": limit, "offset": offset}


@router.get("/profile")
async def get_my_profile():
    """Get current BA's profile."""
    # TODO: Implement with Supabase + BA auth check
    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("/profile")
async def create_profile(profile: BAProfileCreate):
    """Create BA profile after registration."""
    # TODO: Implement with Supabase
    raise HTTPException(status_code=501, detail="Not implemented")


@router.patch("/profile")
async def update_profile(profile: BAProfileUpdate):
    """Update current BA's profile."""
    # TODO: Implement with Supabase + BA auth check
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{ba_id}")
async def get_ba(ba_id: str):
    """Get a specific BA by ID (admin only)."""
    # TODO: Implement with Supabase + admin auth check
    raise HTTPException(status_code=404, detail="BA not found")


@router.get("/my-jobs")
async def get_my_jobs(
    status: Optional[str] = None,
    limit: int = Query(20, le=100),
    offset: int = 0,
):
    """Get jobs the current BA has applied to or is assigned to."""
    # TODO: Implement with Supabase + BA auth check
    return {"jobs": [], "total": 0, "limit": limit, "offset": offset}


@router.post("/photos")
async def upload_photo(photo_type: str):
    """Upload a photo (headshot, full body, etc.)."""
    # TODO: Implement with Supabase Storage
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/photos")
async def get_my_photos():
    """Get current BA's uploaded photos."""
    # TODO: Implement with Supabase
    return {"photos": []}

import logging
import time
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.core.auth import CurrentUser, get_current_admin, get_current_ba, get_current_user
from app.core.supabase import get_supabase_client
from app.services import dropbox_storage

logger = logging.getLogger(__name__)
router = APIRouter()

PORTAL_ROOT = "/NMB-Portal"


# --- Job Photos (BA) ---


@router.post("/upload/job-photo")
async def upload_job_photo(
    file: UploadFile = File(...),
    job_id: str = Form(...),
    photo_type: str = Form(...),
    job_day_location_id: Optional[str] = Form(None),
    ba_id: Optional[str] = Form(None),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Upload a job photo to Dropbox and insert into job_photos table."""
    if current_user.role == "admin":
        if not ba_id:
            raise HTTPException(status_code=400, detail="ba_id required for admin uploads")
        resolved_ba_id = ba_id
    else:
        resolved_ba_id = current_user.profile["id"] if current_user.profile else None
        if not resolved_ba_id:
            raise HTTPException(status_code=400, detail="BA profile not found")

    file_bytes = await file.read()
    dropbox_storage.validate_image(file_bytes, file.content_type or "", file.filename or "")

    ext = (file.filename or "photo.jpg").rsplit(".", 1)[-1]
    timestamp = int(time.time() * 1000)
    dropbox_path = f"{PORTAL_ROOT}/job-photos/{current_user.id}/{job_id}/{photo_type}-{timestamp}.{ext}"

    url = dropbox_storage.upload_file(file_bytes, dropbox_path)

    # Insert into job_photos table
    supabase = get_supabase_client()
    insert_data = {
        "job_id": job_id,
        "ba_id": resolved_ba_id,
        "url": url,
        "photo_type": photo_type,
        "dropbox_path": dropbox_path,
    }
    if job_day_location_id:
        insert_data["job_day_location_id"] = job_day_location_id

    result = supabase.table("job_photos").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save photo record")

    row = result.data[0]
    return {"id": row["id"], "url": row["url"]}


@router.delete("/job-photo/{photo_id}")
async def delete_job_photo(
    photo_id: str,
    current_user: CurrentUser = Depends(get_current_ba),
):
    """Delete a job photo from Dropbox and the database."""
    ba_id = current_user.profile["id"] if current_user.profile else None
    if not ba_id:
        raise HTTPException(status_code=400, detail="BA profile not found")

    supabase = get_supabase_client()

    # Fetch photo (verify ownership)
    photo = (
        supabase.table("job_photos")
        .select("id, dropbox_path")
        .eq("id", photo_id)
        .eq("ba_id", ba_id)
        .single()
        .execute()
    )

    if not photo.data:
        raise HTTPException(status_code=404, detail="Photo not found")

    # Delete from Dropbox if path is stored
    if photo.data.get("dropbox_path"):
        dropbox_storage.delete_file(photo.data["dropbox_path"])

    # Delete from database
    supabase.table("job_photos").delete().eq("id", photo_id).execute()

    return {"ok": True}


# --- BA Profile Photos (BA) ---


@router.post("/upload/ba-photo")
async def upload_ba_photo(
    file: UploadFile = File(...),
    photo_type: str = Form(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Upload a BA profile photo (headshot or full_length) to Dropbox."""
    file_bytes = await file.read()
    dropbox_storage.validate_image(file_bytes, file.content_type or "", file.filename or "")

    ext = (file.filename or "photo.jpg").rsplit(".", 1)[-1]
    dropbox_path = f"{PORTAL_ROOT}/ba-photos/{current_user.id}/{photo_type}.{ext}"

    url = dropbox_storage.upload_file(file_bytes, dropbox_path)

    return {"url": url}


# --- BA Resume (BA) ---


@router.post("/upload/ba-resume")
async def upload_ba_resume(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Upload a BA resume PDF to Dropbox."""
    file_bytes = await file.read()
    dropbox_storage.validate_pdf(file_bytes, file.content_type or "", file.filename or "")

    dropbox_path = f"{PORTAL_ROOT}/ba-resumes/{current_user.id}/resume.pdf"

    url = dropbox_storage.upload_file(file_bytes, dropbox_path)

    return {"url": url}


# --- Job Worksheet (Admin) ---


@router.post("/upload/job-worksheet")
async def upload_job_worksheet(
    file: UploadFile = File(...),
    job_id: str = Form(...),
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Upload a job worksheet PDF to Dropbox and update jobs.worksheet_url."""
    file_bytes = await file.read()
    dropbox_storage.validate_pdf(file_bytes, file.content_type or "", file.filename or "")

    dropbox_path = f"{PORTAL_ROOT}/job-worksheets/{job_id}/worksheet.pdf"

    url = dropbox_storage.upload_file(file_bytes, dropbox_path)

    # Update job record
    supabase = get_supabase_client()
    supabase.table("jobs").update({"worksheet_url": url}).eq("id", job_id).execute()

    return {"url": url}


@router.delete("/job-worksheet/{job_id}")
async def delete_job_worksheet(
    job_id: str,
    current_user: CurrentUser = Depends(get_current_admin),
):
    """Delete a job worksheet from Dropbox and null out jobs.worksheet_url."""
    supabase = get_supabase_client()

    # Get current worksheet URL to confirm it exists
    job = supabase.table("jobs").select("worksheet_url").eq("id", job_id).single().execute()
    if not job.data:
        raise HTTPException(status_code=404, detail="Job not found")

    dropbox_path = f"{PORTAL_ROOT}/job-worksheets/{job_id}/worksheet.pdf"
    dropbox_storage.delete_file(dropbox_path)

    supabase.table("jobs").update({"worksheet_url": None}).eq("id", job_id).execute()

    return {"ok": True}

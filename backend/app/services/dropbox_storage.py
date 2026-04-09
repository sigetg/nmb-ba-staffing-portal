import logging

import dropbox
from dropbox.exceptions import ApiError
from dropbox.files import WriteMode

from app.core.config import settings

logger = logging.getLogger(__name__)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
ALLOWED_PDF_TYPES = {"application/pdf"}

_dbx_client: dropbox.Dropbox | None = None


def get_client() -> dropbox.Dropbox:
    """Return a singleton Dropbox client using refresh token auth."""
    global _dbx_client
    if _dbx_client is None:
        _dbx_client = dropbox.Dropbox(
            oauth2_refresh_token=settings.dropbox_refresh_token,
            app_key=settings.dropbox_app_key,
            app_secret=settings.dropbox_app_secret,
        )
    return _dbx_client


def upload_file(file_bytes: bytes, dropbox_path: str) -> str:
    """Upload file to Dropbox and return a direct-access URL.

    Args:
        file_bytes: Raw file content.
        dropbox_path: Full path in Dropbox, e.g. "/NMB-Portal/job-photos/userId/jobId/photo.jpg".

    Returns:
        A direct URL (shared link with ?raw=1) suitable for <img> tags.
    """
    dbx = get_client()

    # Upload (overwrite if exists)
    dbx.files_upload(file_bytes, dropbox_path, mode=WriteMode.overwrite)

    # Create or get shared link
    try:
        shared_link = dbx.sharing_create_shared_link_with_settings(dropbox_path)
        url = shared_link.url
    except ApiError as e:
        if e.error.is_shared_link_already_exists():
            links = dbx.sharing_list_shared_links(path=dropbox_path, direct_only=True).links
            if links:
                url = links[0].url
            else:
                raise RuntimeError(f"Shared link exists but not found for {dropbox_path}") from e
        else:
            raise

    # Convert to direct-download URL
    return url.replace("&dl=0", "&raw=1").replace("?dl=0", "?raw=1")


def delete_file(dropbox_path: str) -> None:
    """Delete a file from Dropbox. Silently ignores if file doesn't exist."""
    dbx = get_client()
    try:
        dbx.files_delete_v2(dropbox_path)
    except ApiError as e:
        if e.error.is_path_lookup() and e.error.get_path_lookup().is_not_found():
            logger.warning("File not found in Dropbox (already deleted?): %s", dropbox_path)
        else:
            raise


def validate_image(
    file_bytes: bytes, content_type: str, filename: str, max_size_mb: float = 5
) -> None:
    """Validate an image file. Raises ValueError on failure."""
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise ValueError(f"Invalid image type '{content_type}'. Allowed: JPEG, PNG, WebP, HEIC")

    max_bytes = int(max_size_mb * 1024 * 1024)
    if len(file_bytes) > max_bytes:
        raise ValueError(
            f"Image too large ({len(file_bytes) / (1024 * 1024):.1f}MB). Max: {max_size_mb}MB"
        )


def validate_pdf(
    file_bytes: bytes, content_type: str, filename: str, max_size_mb: float = 10
) -> None:
    """Validate a PDF file. Raises ValueError on failure."""
    if content_type not in ALLOWED_PDF_TYPES:
        raise ValueError(f"Invalid file type '{content_type}'. Must be PDF")

    max_bytes = int(max_size_mb * 1024 * 1024)
    if len(file_bytes) > max_bytes:
        raise ValueError(
            f"PDF too large ({len(file_bytes) / (1024 * 1024):.1f}MB). Max: {max_size_mb}MB"
        )

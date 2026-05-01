"""W-9, driver's license, and PayPal OAuth endpoints for BAs.

W-9 fields are stored encrypted (TIN). Driver's license images are stored in
Dropbox via existing `services/dropbox_storage.py`. PayPal payout email is
collected via "Log In with PayPal" OAuth, not typed entry — guarantees a real,
verified PayPal account.
"""

import logging
import re
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field, field_validator

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.core.supabase import get_supabase_client
from app.services import dropbox_storage, paypal, qbo_sync
from app.services.encryption import (
    decrypt,
    encrypt,
    last4,
    sign_oauth_state,
    verify_oauth_state,
)
from app.services.w9_pdf import generate_w9_pdf

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Schemas ---

ENTITY_TYPES = {
    "individual",
    "sole_proprietor",
    "llc_single",
    "llc_partnership",
    "llc_corp",
    "c_corp",
    "s_corp",
    "partnership",
    "other",
}


class W9Submit(BaseModel):
    legal_name: str = Field(..., min_length=1, max_length=200)
    business_name: str | None = Field(None, max_length=200)
    entity_type: str
    address_line1: str = Field(..., min_length=1, max_length=200)
    address_line2: str | None = Field(None, max_length=200)
    city: str = Field(..., min_length=1, max_length=100)
    state: str = Field(..., min_length=2, max_length=2)
    zip_code: str = Field(..., min_length=5, max_length=10)
    tin: str = Field(..., min_length=9, max_length=11)
    tin_type: str  # 'ssn' | 'ein'
    signature_name: str = Field(..., min_length=1, max_length=200)
    signature_date: date
    electronic_consent: bool = False

    @field_validator("entity_type")
    @classmethod
    def validate_entity_type(cls, v: str) -> str:
        if v not in ENTITY_TYPES:
            raise ValueError(f"entity_type must be one of {sorted(ENTITY_TYPES)}")
        return v

    @field_validator("tin_type")
    @classmethod
    def validate_tin_type(cls, v: str) -> str:
        if v not in {"ssn", "ein"}:
            raise ValueError("tin_type must be 'ssn' or 'ein'")
        return v

    @field_validator("tin")
    @classmethod
    def validate_tin(cls, v: str) -> str:
        digits = re.sub(r"\D", "", v)
        if len(digits) != 9:
            raise ValueError("TIN must contain exactly 9 digits")
        return digits


class W9Status(BaseModel):
    submitted: bool
    submitted_at: str | None = None
    legal_name: str | None = None
    entity_type: str | None = None
    tin_last4: str | None = None
    tin_type: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    zip_code: str | None = None
    electronic_consent: bool = False


class PayoutMethodStatus(BaseModel):
    submitted: bool
    submitted_at: str | None = None
    method: str | None = None  # always 'paypal' once submitted
    paypal_email: str | None = None


class DriversLicenseStatus(BaseModel):
    front_uploaded: bool
    back_uploaded: bool
    uploaded_at: str | None = None


# --- Helpers ---


def _get_ba_profile(supabase, user_id: str) -> dict:
    res = (
        supabase.table("ba_profiles")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="BA profile not found")
    return res.data


# --- W-9 endpoints ---


@router.post("/w9", response_model=W9Status)
async def submit_w9(
    payload: W9Submit,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Submit (or update) the BA's W-9 tax information.

    TIN is encrypted server-side; only `last4` is returned/persisted in plaintext.
    """
    if current_user.role != "ba":
        raise HTTPException(status_code=403, detail="Only BAs can submit a W-9")

    supabase = get_supabase_client()
    profile = _get_ba_profile(supabase, current_user.id)

    tin_ciphertext: str = encrypt(payload.tin)

    update = {
        "w9_legal_name": payload.legal_name,
        "w9_business_name": payload.business_name,
        "w9_entity_type": payload.entity_type,
        "w9_address_line1": payload.address_line1,
        "w9_address_line2": payload.address_line2,
        "w9_city": payload.city,
        "w9_state": payload.state.upper(),
        "w9_zip": payload.zip_code,
        "w9_tin_encrypted": tin_ciphertext,
        "w9_tin_type": payload.tin_type,
        "w9_tin_last4": last4(payload.tin),
        "w9_signature_name": payload.signature_name,
        "w9_signature_date": payload.signature_date.isoformat(),
        "w9_electronic_consent": payload.electronic_consent,
        "w9_submitted_at": "now()",
    }

    supabase.table("ba_profiles").update(update).eq("id", profile["id"]).execute()

    # Best-effort: enqueue QBO Vendor sync. Failure here doesn't block W-9 submission.
    try:
        qbo_sync.enqueue_vendor_sync(supabase, ba_id=profile["id"])
    except Exception as exc:
        logger.warning("Failed to enqueue QBO vendor sync for ba_id=%s: %s", profile["id"], exc)

    return await get_w9_status(current_user)


@router.get("/w9", response_model=W9Status)
async def get_w9_status(
    current_user: CurrentUser = Depends(get_current_user),
):
    """Return the BA's masked W-9 status (no plaintext TIN)."""
    if current_user.role != "ba":
        raise HTTPException(status_code=403, detail="Only BAs can view their own W-9")

    supabase = get_supabase_client()
    profile = _get_ba_profile(supabase, current_user.id)

    return W9Status(
        submitted=profile.get("w9_submitted_at") is not None,
        submitted_at=profile.get("w9_submitted_at"),
        legal_name=profile.get("w9_legal_name"),
        entity_type=profile.get("w9_entity_type"),
        tin_last4=profile.get("w9_tin_last4"),
        tin_type=profile.get("w9_tin_type"),
        address_line1=profile.get("w9_address_line1"),
        address_line2=profile.get("w9_address_line2"),
        city=profile.get("w9_city"),
        state=profile.get("w9_state"),
        zip_code=profile.get("w9_zip"),
        electronic_consent=profile.get("w9_electronic_consent") or False,
    )


@router.get("/w9/pdf")
async def download_w9_pdf(
    current_user: CurrentUser = Depends(get_current_user),
):
    """Render the BA's W-9 PDF on demand. Decrypts TIN in memory; never persists the rendered PDF."""
    if current_user.role != "ba":
        raise HTTPException(status_code=403, detail="Only BAs can download their own W-9")

    supabase = get_supabase_client()
    profile = _get_ba_profile(supabase, current_user.id)

    if not profile.get("w9_submitted_at"):
        raise HTTPException(status_code=404, detail="W-9 not yet submitted")

    tin_plaintext = decrypt(profile["w9_tin_encrypted"])
    sig_date_str = profile["w9_signature_date"]
    sig_date = date.fromisoformat(sig_date_str) if isinstance(sig_date_str, str) else sig_date_str

    pdf_bytes = generate_w9_pdf(
        legal_name=profile["w9_legal_name"],
        business_name=profile.get("w9_business_name"),
        entity_type=profile["w9_entity_type"],
        address_line1=profile["w9_address_line1"],
        address_line2=profile.get("w9_address_line2"),
        city=profile["w9_city"],
        state=profile["w9_state"],
        zip_code=profile["w9_zip"],
        tin_plaintext=tin_plaintext,
        tin_type=profile["w9_tin_type"],
        signature_name=profile["w9_signature_name"],
        signature_date=sig_date,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="W-9.pdf"'},
    )


# --- Driver's license upload ---


_DL_MAX_MB = 10
_DL_ALLOWED_CONTENT = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}


@router.get("/drivers-license", response_model=DriversLicenseStatus)
async def get_drivers_license(
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.role != "ba":
        raise HTTPException(status_code=403, detail="Only BAs can view their own DL")
    supabase = get_supabase_client()
    profile = _get_ba_profile(supabase, current_user.id)
    return DriversLicenseStatus(
        front_uploaded=bool(profile.get("dl_front_url")),
        back_uploaded=bool(profile.get("dl_back_url")),
        uploaded_at=profile.get("dl_uploaded_at"),
    )


@router.post("/drivers-license/upload", response_model=DriversLicenseStatus)
async def upload_drivers_license(
    side: str = Form(..., description="'front' or 'back'"),
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.role != "ba":
        raise HTTPException(status_code=403, detail="Only BAs can upload their own DL")
    if side not in {"front", "back"}:
        raise HTTPException(status_code=400, detail="side must be 'front' or 'back'")

    supabase = get_supabase_client()
    profile = _get_ba_profile(supabase, current_user.id)

    file_bytes = await file.read()
    try:
        dropbox_storage.validate_image(
            file_bytes, file.content_type or "", file.filename or "", max_size_mb=_DL_MAX_MB
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    ext = (file.filename or "front.jpg").rsplit(".", 1)[-1].lower()
    if ext not in {"jpg", "jpeg", "png", "webp", "heic", "heif"}:
        ext = "jpg"
    dropbox_path = f"/NMB-Portal/drivers-licenses/{profile['id']}/{side}.{ext}"

    url = dropbox_storage.upload_file(file_bytes, dropbox_path)

    update: dict = {f"dl_{side}_url": url}
    # Only mark uploaded_at when both sides are present
    other_side = "back" if side == "front" else "front"
    if profile.get(f"dl_{other_side}_url"):
        update["dl_uploaded_at"] = "now()"

    supabase.table("ba_profiles").update(update).eq("id", profile["id"]).execute()

    refreshed = _get_ba_profile(supabase, current_user.id)
    return DriversLicenseStatus(
        front_uploaded=bool(refreshed.get("dl_front_url")),
        back_uploaded=bool(refreshed.get("dl_back_url")),
        uploaded_at=refreshed.get("dl_uploaded_at"),
    )


# --- PayPal Log In OAuth (replaces typed-email submit) ---


def _paypal_login_redirect_uri() -> str:
    if settings.paypal_login_redirect_uri:
        return settings.paypal_login_redirect_uri
    base = settings.frontend_url.rstrip("/")
    return f"{base}/api/profile/paypal/callback"


@router.get("/paypal/connect")
async def paypal_connect_url(
    current_user: CurrentUser = Depends(get_current_user),
):
    """Returns the Log In with PayPal consent URL with an HMAC-signed state.

    State carries user_id + nonce + signature so we don't need cookies
    (which get rejected cross-site between staffing.nmbmedia.com and the
    backend's Railway URL).
    """
    if current_user.role != "ba":
        raise HTTPException(status_code=403, detail="Only BAs can connect PayPal")
    state = sign_oauth_state(current_user.id, purpose="paypal")
    url = paypal.get_login_oauth_url(
        state=state, redirect_uri=_paypal_login_redirect_uri()
    )
    return {"url": url}


@router.get("/paypal/callback")
async def paypal_callback(
    code: str,
    state: str,
):
    """Handle PayPal OAuth redirect: verify HMAC state, exchange code, persist verified email."""
    try:
        user_id = verify_oauth_state(state, purpose="paypal")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid OAuth state: {exc}") from exc

    try:
        info = paypal.exchange_login_code(code, redirect_uri=_paypal_login_redirect_uri())
    except Exception as exc:
        logger.error("PayPal Login exchange failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"PayPal exchange failed: {exc}") from exc

    email = info.get("email")
    if not email:
        raise HTTPException(status_code=502, detail="PayPal did not return a verified email")

    supabase = get_supabase_client()
    res = (
        supabase.table("ba_profiles")
        .select("id")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="BA profile not found")

    supabase.table("ba_profiles").update(
        {
            "payout_method": "paypal",
            "payout_paypal_email": email,
            "payout_info_submitted_at": "now()",
        }
    ).eq("id", res.data["id"]).execute()

    target = f"{settings.frontend_url.rstrip('/')}/dashboard/welcome?paypal=connected"
    return RedirectResponse(url=target, status_code=302)


@router.post("/paypal/disconnect", response_model=PayoutMethodStatus)
async def paypal_disconnect(
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.role != "ba":
        raise HTTPException(status_code=403, detail="Only BAs can disconnect their PayPal")
    supabase = get_supabase_client()
    profile = _get_ba_profile(supabase, current_user.id)
    supabase.table("ba_profiles").update(
        {
            "payout_method": None,
            "payout_paypal_email": None,
            "payout_info_submitted_at": None,
        }
    ).eq("id", profile["id"]).execute()
    return PayoutMethodStatus(submitted=False, method=None, paypal_email=None)


@router.get("/payout-method", response_model=PayoutMethodStatus)
async def get_payout_method(
    current_user: CurrentUser = Depends(get_current_user),
):
    if current_user.role != "ba":
        raise HTTPException(status_code=403, detail="Only BAs can view their own payout method")
    supabase = get_supabase_client()
    profile = _get_ba_profile(supabase, current_user.id)
    return PayoutMethodStatus(
        submitted=profile.get("payout_info_submitted_at") is not None,
        submitted_at=profile.get("payout_info_submitted_at"),
        method=profile.get("payout_method"),
        paypal_email=profile.get("payout_paypal_email"),
    )


# --- Combined onboarding status ---


class OnboardingStatus(BaseModel):
    w9_submitted: bool
    dl_uploaded: bool
    payout_submitted: bool
    onboarding_complete: bool


@router.get("/onboarding-status", response_model=OnboardingStatus)
async def get_onboarding_status(
    current_user: CurrentUser = Depends(get_current_user),
):
    """Used by the frontend to gate dashboard tabs and show the persistent banner."""
    if current_user.role != "ba":
        return OnboardingStatus(
            w9_submitted=True,
            dl_uploaded=True,
            payout_submitted=True,
            onboarding_complete=True,
        )
    supabase = get_supabase_client()
    profile = _get_ba_profile(supabase, current_user.id)
    w9 = profile.get("w9_submitted_at") is not None
    dl = profile.get("dl_uploaded_at") is not None
    payout = profile.get("payout_info_submitted_at") is not None
    return OnboardingStatus(
        w9_submitted=w9,
        dl_uploaded=dl,
        payout_submitted=payout,
        onboarding_complete=w9 and dl and payout,
    )

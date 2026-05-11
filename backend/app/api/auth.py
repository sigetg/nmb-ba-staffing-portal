import logging

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr, Field

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.core.supabase import get_supabase_client
from app.services.email import (
    send_password_reset_email,
    send_signup_confirmation_email,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class RegisterResponse(BaseModel):
    email_sent: bool


class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    profile: dict | None = None


@router.post("/login")
async def login(request: LoginRequest):
    """Login is handled client-side via Supabase Auth."""
    raise HTTPException(
        status_code=501,
        detail="Authentication is handled client-side via Supabase Auth. Use the Supabase JS client to sign in.",
    )


@router.post("/register", response_model=RegisterResponse)
def register(request: RegisterRequest) -> RegisterResponse:
    """Create a new BA user and email them a confirmation link via Resend.

    Uses supabase.auth.admin.generate_link(type=signup) which both creates the
    user (email_confirmed_at = null) and returns the confirmation action_link.
    We then send that link ourselves through Resend instead of letting Supabase
    deliver it. Always returns email_sent=True to prevent account enumeration.
    """
    supabase = get_supabase_client()
    try:
        link = supabase.auth.admin.generate_link(
            {
                "type": "signup",
                "email": request.email,
                "password": request.password,
                "options": {"data": {"role": "ba"}},
            }
        )
        confirm_url = (
            f"{settings.frontend_url}/auth/confirm"
            f"?token_hash={link.properties.hashed_token}"
            f"&type=signup"
            f"&next=/auth/setup"
        )
        send_signup_confirmation_email(request.email, confirm_url)
    except Exception as e:
        logger.warning("register failed for %s: %s", request.email, e)
    return RegisterResponse(email_sent=True)


@router.post("/forgot-password", status_code=204)
def forgot_password(request: ForgotPasswordRequest) -> Response:
    """Send a password recovery link via Resend.

    Uses supabase.auth.admin.generate_link(type=recovery) to mint a recovery
    link, then delivers it through Resend. Always returns 204 even on failure
    to prevent leaking which emails exist.
    """
    supabase = get_supabase_client()
    try:
        link = supabase.auth.admin.generate_link(
            {
                "type": "recovery",
                "email": request.email,
                "options": {},
            }
        )
        reset_url = (
            f"{settings.frontend_url}/auth/confirm"
            f"?token_hash={link.properties.hashed_token}"
            f"&type=recovery"
            f"&next=/auth/reset-password"
        )
        send_password_reset_email(request.email, reset_url)
    except Exception as e:
        logger.warning("forgot-password failed for %s: %s", request.email, e)
    return Response(status_code=204)


@router.post("/logout")
async def logout():
    """Logout is handled client-side via Supabase Auth."""
    raise HTTPException(
        status_code=501,
        detail="Logout is handled client-side via Supabase Auth. Use the Supabase JS client to sign out.",
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: CurrentUser = Depends(get_current_user),
):
    """Return the current authenticated user's id, email, role, and profile."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        profile=current_user.profile,
    )

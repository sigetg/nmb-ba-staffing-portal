from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.core.auth import get_current_user, CurrentUser

router = APIRouter()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    role: str = "ba"  # "ba" or "admin"


class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    profile: Optional[dict] = None


@router.post("/login")
async def login(request: LoginRequest):
    """Login endpoint - delegates to Supabase Auth.

    Note: Authentication is handled client-side via Supabase Auth.
    This endpoint exists for documentation purposes only.
    """
    raise HTTPException(
        status_code=501,
        detail="Authentication is handled client-side via Supabase Auth. Use the Supabase JS client to sign in.",
    )


@router.post("/register")
async def register(request: RegisterRequest):
    """Register endpoint - delegates to Supabase Auth.

    Note: Registration is handled client-side via Supabase Auth.
    This endpoint exists for documentation purposes only.
    """
    raise HTTPException(
        status_code=501,
        detail="Registration is handled client-side via Supabase Auth. Use the Supabase JS client to sign up.",
    )


@router.post("/logout")
async def logout():
    """Logout endpoint.

    Note: Logout is handled client-side via Supabase Auth.
    This endpoint exists for documentation purposes only.
    """
    raise HTTPException(
        status_code=501,
        detail="Logout is handled client-side via Supabase Auth. Use the Supabase JS client to sign out.",
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get current authenticated user information.

    Returns the user's ID, email, role, and profile (if available).
    Requires a valid JWT token in the Authorization header.
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        profile=current_user.profile,
    )

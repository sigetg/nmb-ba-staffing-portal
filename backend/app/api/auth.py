from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

router = APIRouter()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    role: str = "ba"  # "ba" or "admin"


@router.post("/login")
async def login(request: LoginRequest):
    """Login endpoint - delegates to Supabase Auth."""
    # TODO: Implement Supabase Auth integration
    raise HTTPException(status_code=501, detail="Not implemented - use Supabase Auth directly")


@router.post("/register")
async def register(request: RegisterRequest):
    """Register endpoint - delegates to Supabase Auth."""
    # TODO: Implement Supabase Auth integration
    raise HTTPException(status_code=501, detail="Not implemented - use Supabase Auth directly")


@router.post("/logout")
async def logout():
    """Logout endpoint."""
    # TODO: Implement Supabase Auth integration
    raise HTTPException(status_code=501, detail="Not implemented - use Supabase Auth directly")


@router.get("/me")
async def get_current_user():
    """Get current authenticated user."""
    # TODO: Implement with JWT verification
    raise HTTPException(status_code=501, detail="Not implemented")

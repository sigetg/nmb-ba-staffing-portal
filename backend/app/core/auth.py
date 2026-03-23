import logging
import time
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from typing import Optional
from pydantic import BaseModel
import httpx

from app.core.config import settings
from app.core.supabase import get_supabase_client

logger = logging.getLogger(__name__)

security = HTTPBearer()

# JWKS cache
_jwks_cache: dict | None = None
_jwks_cache_time: float = 0
_JWKS_CACHE_TTL = 300  # 5 minutes


class TokenData(BaseModel):
    user_id: str
    email: Optional[str] = None
    role: Optional[str] = None


class CurrentUser(BaseModel):
    id: str
    email: str
    role: str
    profile: Optional[dict] = None


def _get_jwks() -> dict:
    """Fetch and cache JWKS from Supabase auth endpoint."""
    global _jwks_cache, _jwks_cache_time

    now = time.time()
    if _jwks_cache and (now - _jwks_cache_time) < _JWKS_CACHE_TTL:
        return _jwks_cache

    jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    response = httpx.get(jwks_url, timeout=10)
    response.raise_for_status()
    _jwks_cache = response.json()
    _jwks_cache_time = now
    return _jwks_cache


def _decode_token_jwks(token: str) -> dict:
    """Decode a JWT using the JWKS endpoint (supports ES256 and HS256)."""
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    alg = header.get("alg", "HS256")

    jwks = _get_jwks()
    signing_key = None

    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            signing_key = key
            break

    if not signing_key:
        raise JWTError(f"No matching key found for kid={kid}")

    return jwt.decode(
        token,
        signing_key,
        algorithms=[alg],
        audience="authenticated",
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> CurrentUser:
    """
    Validate the JWT token from Supabase and return the current user.
    """
    token = credentials.credentials

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Primary: verify via JWKS (works with both ES256 and HS256)
        payload = _decode_token_jwks(token)

        user_id: str = payload.get("sub")
        email: str = payload.get("email")

        if user_id is None:
            raise credentials_exception

    except (JWTError, httpx.HTTPError) as e:
        logger.warning("JWKS token verification failed: %s", e)
        # Fallback: verify via Supabase Auth API
        try:
            supabase = get_supabase_client()
            user_response = supabase.auth.get_user(token)

            if not user_response or not user_response.user:
                raise credentials_exception

            user_id = user_response.user.id
            email = user_response.user.email or ""
        except Exception as e2:
            logger.error("Supabase auth fallback also failed: %s", e2)
            raise credentials_exception

    # Get user data from database
    supabase = get_supabase_client()

    user_data = supabase.table("users").select("*").eq("id", user_id).single().execute()

    if not user_data.data:
        raise credentials_exception

    role = user_data.data.get("role", "ba")

    # Get BA profile if user is a BA
    profile = None
    if role == "ba":
        profile_data = (
            supabase.table("ba_profiles")
            .select("*")
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        if profile_data.data:
            profile = profile_data.data

    return CurrentUser(
        id=user_id,
        email=email,
        role=role,
        profile=profile,
    )


async def get_current_admin(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    """
    Verify the current user is an admin.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def get_current_ba(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    """
    Verify the current user is a BA.
    """
    if current_user.role != "ba":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="BA access required",
        )
    return current_user


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    ),
) -> Optional[CurrentUser]:
    """
    Get the current user if authenticated, otherwise return None.
    Useful for endpoints that support both authenticated and anonymous access.
    """
    if not credentials:
        return None

    try:
        token = credentials.credentials

        # Try JWKS first
        try:
            payload = _decode_token_jwks(token)
            user_id = payload.get("sub")
            email = payload.get("email", "")
        except (JWTError, httpx.HTTPError):
            supabase = get_supabase_client()
            user_response = supabase.auth.get_user(token)

            if not user_response or not user_response.user:
                return None

            user_id = user_response.user.id
            email = user_response.user.email or ""

        supabase = get_supabase_client()
        user_data = (
            supabase.table("users").select("*").eq("id", user_id).single().execute()
        )

        if not user_data.data:
            return None

        role = user_data.data.get("role", "ba")

        return CurrentUser(id=user_id, email=email, role=role)
    except Exception:
        return None

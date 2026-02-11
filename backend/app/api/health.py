from fastapi import APIRouter
from datetime import datetime

router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint for monitoring and load balancers."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "nmb-ba-staffing-api",
    }


@router.get("/health/ready")
async def readiness_check():
    """Readiness check - verifies the service is ready to accept traffic."""
    # TODO: Add database connectivity check when Supabase is configured
    return {
        "status": "ready",
        "timestamp": datetime.utcnow().isoformat(),
    }

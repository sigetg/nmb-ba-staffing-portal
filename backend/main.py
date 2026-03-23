from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import health, auth, jobs, bas, admin
from app.core.config import settings

app = FastAPI(
    title="NMB BA Staffing Portal API",
    description="Backend API for Brand Ambassador staffing and job management",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Build CORS origins list, including frontend_url if set
cors_origins = list(settings.cors_origins)
if settings.frontend_url and settings.frontend_url not in cors_origins:
    cors_origins.append(settings.frontend_url)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(bas.router, prefix="/api/bas", tags=["Brand Ambassadors"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])


@app.get("/")
async def root():
    return {
        "message": "NMB BA Staffing Portal API",
        "docs": "/docs",
        "health": "/health",
    }

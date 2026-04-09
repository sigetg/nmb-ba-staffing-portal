from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel


class ApplicationStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class JobApplication(BaseModel):
    id: str
    job_id: str
    ba_id: str
    status: ApplicationStatus = ApplicationStatus.PENDING
    applied_at: datetime
    reviewed_at: datetime | None = None
    reviewed_by: str | None = None
    notes: str | None = None

    class Config:
        from_attributes = True

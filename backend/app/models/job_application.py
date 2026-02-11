from pydantic import BaseModel
from datetime import datetime
from enum import Enum
from typing import Optional


class ApplicationStatus(str, Enum):
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
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True

from pydantic import BaseModel
from datetime import datetime
from enum import Enum
from typing import Optional


class JobStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Job(BaseModel):
    id: str
    title: str
    brand: str
    description: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    date: datetime
    start_time: str
    end_time: str
    pay_rate: float
    slots: int
    slots_filled: int = 0
    status: JobStatus = JobStatus.DRAFT
    worksheet_url: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CheckIn(BaseModel):
    id: str
    job_id: str
    ba_id: str
    check_in_time: datetime
    check_out_time: Optional[datetime] = None
    check_in_latitude: float
    check_in_longitude: float
    check_out_latitude: Optional[float] = None
    check_out_longitude: Optional[float] = None

    class Config:
        from_attributes = True


class JobPhoto(BaseModel):
    id: str
    job_id: str
    ba_id: str
    url: str
    caption: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

from pydantic import BaseModel
from datetime import datetime, date, time
from enum import Enum
from typing import Optional, List


class JobStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ARCHIVED = "archived"


class Job(BaseModel):
    id: str
    title: str
    brand: str
    description: str
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    date: Optional[datetime] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    pay_rate: float
    slots: int
    slots_filled: int = 0
    status: JobStatus = JobStatus.DRAFT
    worksheet_url: Optional[str] = None
    timezone: str = "America/Chicago"
    job_type_id: Optional[str] = None
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
    job_day_location_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- Multi-day, multi-location models ---

class DayLocationCreate(BaseModel):
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    start_time: str  # HH:MM format
    end_time: str    # HH:MM format
    sort_order: int = 0


class JobDayCreate(BaseModel):
    date: str  # YYYY-MM-DD format
    sort_order: int = 0
    locations: List[DayLocationCreate]


class MultiDayJobCreate(BaseModel):
    title: str
    brand: str
    description: str
    pay_rate: float
    slots: int = 1
    status: str = "draft"
    timezone: Optional[str] = None
    worksheet_url: Optional[str] = None
    job_type_id: Optional[str] = None
    days: List[JobDayCreate]


class LocationCheckInRequest(BaseModel):
    job_day_location_id: str
    latitude: float
    longitude: float
    gps_override: bool = False
    gps_override_reason: Optional[str] = None


class CheckoutResponseValueCreate(BaseModel):
    kpi_id: Optional[str] = None
    question_id: Optional[str] = None
    numeric_value: Optional[float] = None
    text_value: Optional[str] = None
    option_id: Optional[str] = None


class LocationCheckOutRequest(BaseModel):
    job_day_location_id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_end_of_day: bool = False
    # Dynamic checkout responses
    checkout_responses: Optional[List[CheckoutResponseValueCreate]] = None


class SkipLocationRequest(BaseModel):
    job_day_location_id: str
    reason: str


# Response models
class JobDayLocationResponse(BaseModel):
    id: str
    job_day_id: str
    job_id: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    start_time: str
    end_time: str
    sort_order: int
    created_at: datetime

    class Config:
        from_attributes = True


class JobDayResponse(BaseModel):
    id: str
    job_id: str
    date: str
    sort_order: int
    created_at: datetime
    job_day_locations: List[JobDayLocationResponse] = []

    class Config:
        from_attributes = True


class LocationCheckInResponse(BaseModel):
    id: str
    job_day_location_id: str
    ba_id: str
    check_in_time: datetime
    check_in_latitude: float
    check_in_longitude: float
    check_in_gps_override: bool = False
    check_in_gps_override_explanation: Optional[str] = None
    check_out_time: Optional[datetime] = None
    check_out_latitude: Optional[float] = None
    check_out_longitude: Optional[float] = None
    is_end_of_day: bool = False
    skipped: bool = False
    skipped_reason: Optional[str] = None

    class Config:
        from_attributes = True


class TravelLogResponse(BaseModel):
    id: str
    ba_id: str
    from_location_check_in_id: str
    to_location_check_in_id: Optional[str] = None
    departure_time: datetime
    arrival_time: Optional[datetime] = None

    class Config:
        from_attributes = True

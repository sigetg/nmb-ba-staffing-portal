from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel


class JobStatus(StrEnum):
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
    pay_rate: float
    slots: int
    slots_filled: int = 0
    status: JobStatus = JobStatus.DRAFT
    worksheet_url: str | None = None
    timezone: str = "America/Chicago"
    job_type_id: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class JobPhoto(BaseModel):
    id: str
    job_id: str
    ba_id: str
    url: str
    caption: str | None = None
    job_day_location_id: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- Multi-day, multi-location models ---


class DayLocationCreate(BaseModel):
    location: str
    latitude: float | None = None
    longitude: float | None = None
    start_time: str  # HH:MM format
    end_time: str  # HH:MM format
    sort_order: int = 0


class JobDayCreate(BaseModel):
    date: str  # YYYY-MM-DD format
    sort_order: int = 0
    locations: list[DayLocationCreate]


class MultiDayJobCreate(BaseModel):
    title: str
    brand: str
    description: str
    pay_rate: float
    slots: int = 1
    status: str = "draft"
    timezone: str | None = None
    worksheet_url: str | None = None
    job_type_id: str | None = None
    days: list[JobDayCreate]


class LocationCheckInRequest(BaseModel):
    job_day_location_id: str
    latitude: float
    longitude: float
    gps_override: bool = False
    gps_override_reason: str | None = None


class CheckoutResponseValueCreate(BaseModel):
    kpi_id: str | None = None
    question_id: str | None = None
    numeric_value: float | None = None
    text_value: str | None = None
    option_id: str | None = None


class LocationCheckOutRequest(BaseModel):
    job_day_location_id: str
    latitude: float | None = None
    longitude: float | None = None
    is_end_of_day: bool = False
    # Dynamic checkout responses
    checkout_responses: list[CheckoutResponseValueCreate] | None = None


class SkipLocationRequest(BaseModel):
    job_day_location_id: str
    reason: str


# Response models
class JobDayLocationResponse(BaseModel):
    id: str
    job_day_id: str
    job_id: str
    location: str
    latitude: float | None = None
    longitude: float | None = None
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
    job_day_locations: list[JobDayLocationResponse] = []

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
    check_in_gps_override_explanation: str | None = None
    check_out_time: datetime | None = None
    check_out_latitude: float | None = None
    check_out_longitude: float | None = None
    is_end_of_day: bool = False
    skipped: bool = False
    skipped_reason: str | None = None

    class Config:
        from_attributes = True


class TravelLogResponse(BaseModel):
    id: str
    ba_id: str
    from_location_check_in_id: str
    to_location_check_in_id: str | None = None
    departure_time: datetime
    arrival_time: datetime | None = None

    class Config:
        from_attributes = True

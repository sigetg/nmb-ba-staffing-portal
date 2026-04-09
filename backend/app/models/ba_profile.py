from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel


class BAStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


class BAProfile(BaseModel):
    id: str
    user_id: str
    name: str
    phone: str
    zip_code: str
    status: BAStatus = BAStatus.PENDING
    availability: dict[str, Any] = {}
    stripe_account_id: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class BAPhoto(BaseModel):
    id: str
    ba_id: str
    photo_type: str  # "headshot", "full_body", etc.
    url: str
    created_at: datetime

    class Config:
        from_attributes = True

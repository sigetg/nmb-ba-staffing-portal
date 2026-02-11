from pydantic import BaseModel
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any


class BAStatus(str, Enum):
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
    availability: Dict[str, Any] = {}
    stripe_account_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

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

from pydantic import BaseModel, EmailStr
from datetime import datetime
from enum import Enum
from typing import Optional


class UserRole(str, Enum):
    BA = "ba"
    ADMIN = "admin"


class User(BaseModel):
    id: str
    email: EmailStr
    role: UserRole
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

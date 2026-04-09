from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, EmailStr


class UserRole(StrEnum):
    BA = "ba"
    ADMIN = "admin"


class User(BaseModel):
    id: str
    email: EmailStr
    role: UserRole
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True

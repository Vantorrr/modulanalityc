"""
User schemas for registration, profile, and responses.
"""

from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.base import BaseSchema, TimestampMixin
from app.models.user import Gender


class UserLogin(BaseModel):
    """User login request."""
    
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserCreate(BaseModel):
    """User registration request."""
    
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    birth_date: Optional[date] = None
    gender: Optional[Gender] = None
    external_user_id: Optional[str] = Field(
        None,
        description="ID пользователя во внешней системе",
    )
    
    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        # Remove spaces and dashes
        cleaned = "".join(c for c in v if c.isdigit() or c == "+")
        if len(cleaned) < 10:
            raise ValueError("Некорректный номер телефона")
        return cleaned


class UserUpdate(BaseModel):
    """User profile update request."""
    
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    birth_date: Optional[date] = None
    gender: Optional[Gender] = None


class UserResponse(BaseSchema, TimestampMixin):
    """User response model."""
    
    id: int
    email: EmailStr
    is_active: bool
    is_verified: bool
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[Gender] = None
    external_user_id: Optional[str] = None
    full_name: str
    age: Optional[int] = None


class UserHealthProfile(BaseSchema):
    """User health profile summary."""
    
    id: int
    full_name: str
    age: Optional[int] = None
    gender: Optional[Gender] = None
    total_analyses: int = 0
    last_analysis_date: Optional[datetime] = None
    biomarkers_out_of_range: int = 0
    upcoming_reminders: int = 0



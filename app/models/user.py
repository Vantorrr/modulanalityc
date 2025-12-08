"""
User model for authentication and profile data.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import String, Boolean, DateTime, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base
import enum

if TYPE_CHECKING:
    from app.models.analysis import Analysis
    from app.models.biomarker import UserBiomarker
    from app.models.reminder import HealthReminder
    from app.models.medical_document import MedicalDocument


class Gender(str, enum.Enum):
    """User gender for reference ranges."""
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class User(Base):
    """User account model."""
    
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    
    # Authentication
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Profile
    first_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    
    # Health profile (for accurate reference ranges)
    birth_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    gender: Mapped[Optional[Gender]] = mapped_column(SQLEnum(Gender), nullable=True)
    
    # External integration
    external_user_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, index=True,
        comment="ID пользователя во внешней системе заказчика"
    )
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    
    # Relationships
    analyses: Mapped[list["Analysis"]] = relationship(
        "Analysis",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    biomarkers: Mapped[list["UserBiomarker"]] = relationship(
        "UserBiomarker",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    reminders: Mapped[list["HealthReminder"]] = relationship(
        "HealthReminder",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    medical_documents: Mapped[list["MedicalDocument"]] = relationship(
        "MedicalDocument",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    
    @property
    def full_name(self) -> str:
        """Get user's full name."""
        parts = [self.first_name, self.last_name]
        return " ".join(p for p in parts if p) or self.email
    
    @property
    def age(self) -> Optional[int]:
        """Calculate user's age from birth date."""
        if not self.birth_date:
            return None
        today = datetime.now()
        return today.year - self.birth_date.year - (
            (today.month, today.day) < (self.birth_date.month, self.birth_date.day)
        )


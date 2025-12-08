"""
Health reminder models for calendar and checkup scheduling.
"""

from datetime import datetime, date, time
from typing import TYPE_CHECKING, Optional
import enum

from sqlalchemy import (
    String, Text, Date, Time, DateTime, ForeignKey, Integer, Boolean,
    Enum as SQLEnum
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class ReminderType(str, enum.Enum):
    """Type of health reminder."""
    CHECKUP = "checkup"              # Regular health checkup
    ANALYSIS = "analysis"            # Specific analysis to take
    SUPPLEMENT = "supplement"        # Take supplements
    MEDICATION = "medication"        # Take medication
    APPOINTMENT = "appointment"      # Doctor appointment
    CUSTOM = "custom"                # Custom reminder


class ReminderFrequency(str, enum.Enum):
    """Repeat frequency for reminders."""
    ONCE = "once"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"    # Every 3 months
    BIANNUALLY = "biannually"  # Every 6 months
    ANNUALLY = "annually"


class HealthReminder(Base):
    """
    Health reminder for checkups and analysis scheduling.
    """
    
    __tablename__ = "health_reminders"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    
    # Reminder content
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reminder_type: Mapped[ReminderType] = mapped_column(
        SQLEnum(ReminderType),
        default=ReminderType.CUSTOM,
    )
    
    # Scheduling
    scheduled_date: Mapped[date] = mapped_column(Date, index=True)
    scheduled_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    frequency: Mapped[ReminderFrequency] = mapped_column(
        SQLEnum(ReminderFrequency),
        default=ReminderFrequency.ONCE,
    )
    
    # For recurring reminders
    repeat_until: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    last_triggered: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    next_occurrence: Mapped[Optional[date]] = mapped_column(
        Date,
        nullable=True,
        index=True,
    )
    
    # Notification settings
    notify_days_before: Mapped[int] = mapped_column(
        Integer,
        default=1,
        comment="Send notification X days before",
    )
    notify_on_day: Mapped[bool] = mapped_column(Boolean, default=True)
    notification_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Related analysis info
    related_biomarkers: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Comma-separated biomarker codes to check",
    )
    
    # Status
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # External
    external_calendar_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="ID in external calendar (Google, Apple)",
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
    user: Mapped["User"] = relationship("User", back_populates="reminders")
    
    def mark_completed(self) -> None:
        """Mark reminder as completed and calculate next occurrence if recurring."""
        self.is_completed = True
        self.completed_at = datetime.now()
        
        if self.frequency != ReminderFrequency.ONCE:
            self._calculate_next_occurrence()
    
    def _calculate_next_occurrence(self) -> None:
        """Calculate the next occurrence for recurring reminders."""
        from dateutil.relativedelta import relativedelta
        
        current = self.scheduled_date
        
        if self.frequency == ReminderFrequency.DAILY:
            delta = relativedelta(days=1)
        elif self.frequency == ReminderFrequency.WEEKLY:
            delta = relativedelta(weeks=1)
        elif self.frequency == ReminderFrequency.MONTHLY:
            delta = relativedelta(months=1)
        elif self.frequency == ReminderFrequency.QUARTERLY:
            delta = relativedelta(months=3)
        elif self.frequency == ReminderFrequency.BIANNUALLY:
            delta = relativedelta(months=6)
        elif self.frequency == ReminderFrequency.ANNUALLY:
            delta = relativedelta(years=1)
        else:
            self.next_occurrence = None
            return
        
        next_date = current + delta
        
        # Check if we've passed the repeat_until date
        if self.repeat_until and next_date > self.repeat_until:
            self.next_occurrence = None
            self.is_active = False
        else:
            self.next_occurrence = next_date
            self.is_completed = False
            self.notification_sent = False



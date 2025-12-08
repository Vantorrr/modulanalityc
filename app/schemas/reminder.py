"""
Health reminder schemas for calendar functionality.
"""

from datetime import datetime, date, time
from typing import Optional, List

from pydantic import BaseModel, Field

from app.schemas.base import BaseSchema, PaginatedResponse
from app.models.reminder import ReminderType, ReminderFrequency


class ReminderCreate(BaseModel):
    """Create reminder request."""
    
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    reminder_type: ReminderType = ReminderType.CUSTOM
    
    # Scheduling
    scheduled_date: date
    scheduled_time: Optional[time] = None
    frequency: ReminderFrequency = ReminderFrequency.ONCE
    repeat_until: Optional[date] = None
    
    # Notifications
    notify_days_before: int = Field(1, ge=0, le=30)
    notify_on_day: bool = True
    
    # Related
    related_biomarkers: Optional[List[str]] = Field(
        None,
        description="Список кодов биомаркеров для проверки",
    )


class ReminderUpdate(BaseModel):
    """Update reminder request."""
    
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    reminder_type: Optional[ReminderType] = None
    
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[time] = None
    frequency: Optional[ReminderFrequency] = None
    repeat_until: Optional[date] = None
    
    notify_days_before: Optional[int] = Field(None, ge=0, le=30)
    notify_on_day: Optional[bool] = None
    
    related_biomarkers: Optional[List[str]] = None
    is_active: Optional[bool] = None


class ReminderResponse(BaseSchema):
    """Reminder response."""
    
    id: int
    user_id: int
    
    title: str
    description: Optional[str] = None
    reminder_type: ReminderType
    
    # Scheduling
    scheduled_date: date
    scheduled_time: Optional[time] = None
    frequency: ReminderFrequency
    repeat_until: Optional[date] = None
    next_occurrence: Optional[date] = None
    
    # Notifications
    notify_days_before: int
    notify_on_day: bool
    notification_sent: bool
    
    # Related
    related_biomarkers: Optional[List[str]] = None
    
    # Status
    is_completed: bool
    completed_at: Optional[datetime] = None
    is_active: bool
    
    # Computed
    is_overdue: bool = False
    days_until: Optional[int] = None
    
    created_at: datetime
    updated_at: datetime


class ReminderListResponse(PaginatedResponse):
    """Paginated reminder list."""
    
    items: List[ReminderResponse]


class CalendarDay(BaseModel):
    """Single day in calendar view."""
    
    date: date
    has_reminders: bool = False
    reminders_count: int = 0
    reminder_types: List[ReminderType] = []


class CalendarMonthResponse(BaseModel):
    """Monthly calendar view."""
    
    year: int
    month: int
    days: List[CalendarDay]
    total_reminders: int = 0


class UpcomingRemindersResponse(BaseModel):
    """Upcoming reminders summary."""
    
    today: List[ReminderResponse] = []
    tomorrow: List[ReminderResponse] = []
    this_week: List[ReminderResponse] = []
    overdue: List[ReminderResponse] = []
    
    total_upcoming: int = 0
    total_overdue: int = 0



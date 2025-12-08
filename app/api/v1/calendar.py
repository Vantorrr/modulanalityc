"""
Health Calendar API endpoints.
"""

from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, HTTPException, status, Depends, Query
from sqlalchemy import select, and_, func, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.security import CurrentUserID
from app.models.reminder import HealthReminder, ReminderType, ReminderFrequency
from app.schemas.reminder import (
    ReminderCreate,
    ReminderUpdate,
    ReminderResponse,
    ReminderListResponse,
    CalendarMonthResponse,
    CalendarDay,
    UpcomingRemindersResponse,
)

router = APIRouter()


def reminder_to_response(reminder: HealthReminder) -> ReminderResponse:
    """Convert reminder model to response schema."""
    today = date.today()
    
    # Calculate days until
    days_until = None
    is_overdue = False
    
    if not reminder.is_completed:
        delta = (reminder.scheduled_date - today).days
        days_until = delta
        is_overdue = delta < 0
    
    # Parse related biomarkers
    related_biomarkers = None
    if reminder.related_biomarkers:
        related_biomarkers = [
            b.strip() for b in reminder.related_biomarkers.split(",")
            if b.strip()
        ]
    
    return ReminderResponse(
        id=reminder.id,
        user_id=reminder.user_id,
        title=reminder.title,
        description=reminder.description,
        reminder_type=reminder.reminder_type,
        scheduled_date=reminder.scheduled_date,
        scheduled_time=reminder.scheduled_time,
        frequency=reminder.frequency,
        repeat_until=reminder.repeat_until,
        next_occurrence=reminder.next_occurrence,
        notify_days_before=reminder.notify_days_before,
        notify_on_day=reminder.notify_on_day,
        notification_sent=reminder.notification_sent,
        related_biomarkers=related_biomarkers,
        is_completed=reminder.is_completed,
        completed_at=reminder.completed_at,
        is_active=reminder.is_active,
        is_overdue=is_overdue,
        days_until=days_until,
        created_at=reminder.created_at,
        updated_at=reminder.updated_at,
    )


@router.post(
    "/reminders",
    response_model=ReminderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Создание напоминания",
)
async def create_reminder(
    reminder_data: ReminderCreate,
    user_id: int = Depends(CurrentUserID),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Создание нового напоминания о здоровье.
    
    Типы напоминаний:
    - **checkup**: Общий чекап здоровья
    - **analysis**: Сдача конкретных анализов
    - **supplement**: Прием добавок
    - **medication**: Прием лекарств
    - **appointment**: Визит к врачу
    - **custom**: Произвольное напоминание
    
    Частота повторения:
    - **once**: Однократно
    - **daily**: Ежедневно
    - **weekly**: Еженедельно
    - **monthly**: Ежемесячно
    - **quarterly**: Раз в 3 месяца
    - **biannually**: Раз в 6 месяцев
    - **annually**: Раз в год
    """
    # Format related biomarkers
    related_biomarkers = None
    if reminder_data.related_biomarkers:
        related_biomarkers = ",".join(reminder_data.related_biomarkers)
    
    reminder = HealthReminder(
        user_id=user_id,
        title=reminder_data.title,
        description=reminder_data.description,
        reminder_type=reminder_data.reminder_type,
        scheduled_date=reminder_data.scheduled_date,
        scheduled_time=reminder_data.scheduled_time,
        frequency=reminder_data.frequency,
        repeat_until=reminder_data.repeat_until,
        notify_days_before=reminder_data.notify_days_before,
        notify_on_day=reminder_data.notify_on_day,
        related_biomarkers=related_biomarkers,
    )
    
    # Set next occurrence for recurring reminders
    if reminder_data.frequency != ReminderFrequency.ONCE:
        reminder.next_occurrence = reminder_data.scheduled_date
    
    db.add(reminder)
    await db.flush()
    await db.refresh(reminder)
    
    return reminder_to_response(reminder)


@router.get(
    "/reminders",
    response_model=ReminderListResponse,
    summary="Список напоминаний",
)
async def list_reminders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    reminder_type: Optional[ReminderType] = None,
    include_completed: bool = Query(False, description="Включить выполненные"),
    user_id: int = Depends(CurrentUserID),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Получение списка напоминаний пользователя.
    """
    conditions = [
        HealthReminder.user_id == user_id,
        HealthReminder.is_active == True,
    ]
    
    if reminder_type:
        conditions.append(HealthReminder.reminder_type == reminder_type)
    
    if not include_completed:
        conditions.append(HealthReminder.is_completed == False)
    
    # Count total
    count_stmt = select(func.count(HealthReminder.id)).where(and_(*conditions))
    total = (await db.execute(count_stmt)).scalar() or 0
    
    # Get items
    stmt = (
        select(HealthReminder)
        .where(and_(*conditions))
        .order_by(HealthReminder.scheduled_date.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    reminders = result.scalars().all()
    
    return ReminderListResponse(
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
        items=[reminder_to_response(r) for r in reminders],
    )


@router.get(
    "/reminders/upcoming",
    response_model=UpcomingRemindersResponse,
    summary="Предстоящие напоминания",
)
async def get_upcoming_reminders(
    user_id: int = Depends(CurrentUserID),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Получение предстоящих напоминаний, сгруппированных по периодам:
    - Сегодня
    - Завтра
    - На этой неделе
    - Просроченные
    """
    today = date.today()
    tomorrow = today + timedelta(days=1)
    week_end = today + timedelta(days=7)
    
    base_conditions = [
        HealthReminder.user_id == user_id,
        HealthReminder.is_active == True,
        HealthReminder.is_completed == False,
    ]
    
    # Today
    today_stmt = (
        select(HealthReminder)
        .where(and_(
            *base_conditions,
            HealthReminder.scheduled_date == today,
        ))
        .order_by(HealthReminder.scheduled_time.asc().nullslast())
    )
    today_result = await db.execute(today_stmt)
    today_reminders = [reminder_to_response(r) for r in today_result.scalars().all()]
    
    # Tomorrow
    tomorrow_stmt = (
        select(HealthReminder)
        .where(and_(
            *base_conditions,
            HealthReminder.scheduled_date == tomorrow,
        ))
        .order_by(HealthReminder.scheduled_time.asc().nullslast())
    )
    tomorrow_result = await db.execute(tomorrow_stmt)
    tomorrow_reminders = [reminder_to_response(r) for r in tomorrow_result.scalars().all()]
    
    # This week (excluding today and tomorrow)
    week_stmt = (
        select(HealthReminder)
        .where(and_(
            *base_conditions,
            HealthReminder.scheduled_date > tomorrow,
            HealthReminder.scheduled_date <= week_end,
        ))
        .order_by(HealthReminder.scheduled_date.asc())
    )
    week_result = await db.execute(week_stmt)
    week_reminders = [reminder_to_response(r) for r in week_result.scalars().all()]
    
    # Overdue
    overdue_stmt = (
        select(HealthReminder)
        .where(and_(
            *base_conditions,
            HealthReminder.scheduled_date < today,
        ))
        .order_by(HealthReminder.scheduled_date.desc())
    )
    overdue_result = await db.execute(overdue_stmt)
    overdue_reminders = [reminder_to_response(r) for r in overdue_result.scalars().all()]
    
    return UpcomingRemindersResponse(
        today=today_reminders,
        tomorrow=tomorrow_reminders,
        this_week=week_reminders,
        overdue=overdue_reminders,
        total_upcoming=len(today_reminders) + len(tomorrow_reminders) + len(week_reminders),
        total_overdue=len(overdue_reminders),
    )


@router.get(
    "/month/{year}/{month}",
    response_model=CalendarMonthResponse,
    summary="Календарь на месяц",
)
async def get_month_calendar(
    year: int,
    month: int,
    user_id: int = Depends(CurrentUserID),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Получение календарной сетки на месяц с отметками о напоминаниях.
    """
    if month < 1 or month > 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректный месяц",
        )
    
    # Get all reminders for the month
    stmt = (
        select(HealthReminder)
        .where(and_(
            HealthReminder.user_id == user_id,
            HealthReminder.is_active == True,
            extract("year", HealthReminder.scheduled_date) == year,
            extract("month", HealthReminder.scheduled_date) == month,
        ))
    )
    result = await db.execute(stmt)
    reminders = result.scalars().all()
    
    # Group by date
    from calendar import monthrange
    from collections import defaultdict
    
    days_in_month = monthrange(year, month)[1]
    reminders_by_date = defaultdict(list)
    
    for r in reminders:
        reminders_by_date[r.scheduled_date].append(r)
    
    # Build calendar days
    days = []
    total_reminders = 0
    
    for day in range(1, days_in_month + 1):
        current_date = date(year, month, day)
        day_reminders = reminders_by_date.get(current_date, [])
        
        reminder_types = list(set(r.reminder_type for r in day_reminders))
        
        days.append(CalendarDay(
            date=current_date,
            has_reminders=len(day_reminders) > 0,
            reminders_count=len(day_reminders),
            reminder_types=reminder_types,
        ))
        
        total_reminders += len(day_reminders)
    
    return CalendarMonthResponse(
        year=year,
        month=month,
        days=days,
        total_reminders=total_reminders,
    )


@router.get(
    "/reminders/{reminder_id}",
    response_model=ReminderResponse,
    summary="Детали напоминания",
)
async def get_reminder(
    reminder_id: int,
    user_id: int = Depends(CurrentUserID),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Получение полной информации о напоминании.
    """
    stmt = select(HealthReminder).where(
        HealthReminder.id == reminder_id,
        HealthReminder.user_id == user_id,
    )
    result = await db.execute(stmt)
    reminder = result.scalar_one_or_none()
    
    if not reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Напоминание не найдено",
        )
    
    return reminder_to_response(reminder)


@router.patch(
    "/reminders/{reminder_id}",
    response_model=ReminderResponse,
    summary="Обновление напоминания",
)
async def update_reminder(
    reminder_id: int,
    update_data: ReminderUpdate,
    user_id: int = Depends(CurrentUserID),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Обновление напоминания.
    """
    stmt = select(HealthReminder).where(
        HealthReminder.id == reminder_id,
        HealthReminder.user_id == user_id,
    )
    result = await db.execute(stmt)
    reminder = result.scalar_one_or_none()
    
    if not reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Напоминание не найдено",
        )
    
    # Update fields
    update_dict = update_data.model_dump(exclude_unset=True)
    
    # Handle related_biomarkers specially
    if "related_biomarkers" in update_dict:
        biomarkers = update_dict.pop("related_biomarkers")
        if biomarkers:
            reminder.related_biomarkers = ",".join(biomarkers)
        else:
            reminder.related_biomarkers = None
    
    for field, value in update_dict.items():
        setattr(reminder, field, value)
    
    await db.flush()
    await db.refresh(reminder)
    
    return reminder_to_response(reminder)


@router.post(
    "/reminders/{reminder_id}/complete",
    response_model=ReminderResponse,
    summary="Отметить как выполненное",
)
async def complete_reminder(
    reminder_id: int,
    user_id: int = Depends(CurrentUserID),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Отметить напоминание как выполненное.
    
    Для повторяющихся напоминаний автоматически рассчитается следующая дата.
    """
    stmt = select(HealthReminder).where(
        HealthReminder.id == reminder_id,
        HealthReminder.user_id == user_id,
    )
    result = await db.execute(stmt)
    reminder = result.scalar_one_or_none()
    
    if not reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Напоминание не найдено",
        )
    
    reminder.mark_completed()
    
    await db.flush()
    await db.refresh(reminder)
    
    return reminder_to_response(reminder)


@router.delete(
    "/reminders/{reminder_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удаление напоминания",
)
async def delete_reminder(
    reminder_id: int,
    user_id: int = Depends(CurrentUserID),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Удаление напоминания.
    """
    stmt = select(HealthReminder).where(
        HealthReminder.id == reminder_id,
        HealthReminder.user_id == user_id,
    )
    result = await db.execute(stmt)
    reminder = result.scalar_one_or_none()
    
    if not reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Напоминание не найдено",
        )
    
    await db.delete(reminder)
    await db.commit()



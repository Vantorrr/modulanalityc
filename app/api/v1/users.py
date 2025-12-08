"""
User profile API endpoints.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.security import CurrentUserID, get_password_hash
from app.models.user import User
from app.models.analysis import Analysis
from app.models.biomarker import UserBiomarker, BiomarkerStatus
from app.models.reminder import HealthReminder
from app.schemas.user import UserUpdate, UserResponse, UserHealthProfile

router = APIRouter()


@router.get(
    "/profile",
    response_model=UserResponse,
    summary="Профиль пользователя",
)
async def get_profile(
    user_id: CurrentUserID,
    db: AsyncSession = Depends(get_async_session),
):
    """
    Получение профиля текущего пользователя.
    """
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )
    
    return user


@router.patch(
    "/profile",
    response_model=UserResponse,
    summary="Обновление профиля",
)
async def update_profile(
    update_data: UserUpdate,
    user_id: CurrentUserID,
    db: AsyncSession = Depends(get_async_session),
):
    """
    Обновление профиля пользователя.
    
    Можно обновить:
    - **first_name**: Имя
    - **last_name**: Фамилия
    - **phone**: Телефон
    - **birth_date**: Дата рождения
    - **gender**: Пол
    """
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )
    
    # Update fields
    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(user, field, value)
    
    await db.flush()
    await db.refresh(user)
    
    return user


@router.get(
    "/health-summary",
    response_model=UserHealthProfile,
    summary="Сводка по здоровью",
)
async def get_health_summary(
    user_id: CurrentUserID,
    db: AsyncSession = Depends(get_async_session),
):
    """
    Получение общей сводки по здоровью пользователя:
    - Общее количество анализов
    - Дата последнего анализа
    - Количество показателей вне нормы
    - Предстоящие напоминания
    """
    # Get user
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )
    
    # Count analyses
    analyses_count_stmt = (
        select(func.count(Analysis.id))
        .where(Analysis.user_id == user_id)
    )
    analyses_count = (await db.execute(analyses_count_stmt)).scalar() or 0
    
    # Get last analysis date
    last_analysis_stmt = (
        select(Analysis.created_at)
        .where(Analysis.user_id == user_id)
        .order_by(Analysis.created_at.desc())
        .limit(1)
    )
    last_analysis_result = await db.execute(last_analysis_stmt)
    last_analysis_date = last_analysis_result.scalar_one_or_none()
    
    # Count biomarkers out of range
    out_of_range_stmt = (
        select(func.count(UserBiomarker.id))
        .where(
            UserBiomarker.user_id == user_id,
            UserBiomarker.status.in_([
                BiomarkerStatus.LOW,
                BiomarkerStatus.HIGH,
                BiomarkerStatus.CRITICAL_LOW,
                BiomarkerStatus.CRITICAL_HIGH,
            ])
        )
    )
    out_of_range_count = (await db.execute(out_of_range_stmt)).scalar() or 0
    
    # Count upcoming reminders
    from datetime import date
    reminders_stmt = (
        select(func.count(HealthReminder.id))
        .where(
            HealthReminder.user_id == user_id,
            HealthReminder.is_active == True,
            HealthReminder.is_completed == False,
            HealthReminder.scheduled_date >= date.today(),
        )
    )
    upcoming_reminders = (await db.execute(reminders_stmt)).scalar() or 0
    
    return UserHealthProfile(
        id=user.id,
        full_name=user.full_name,
        age=user.age,
        gender=user.gender,
        total_analyses=analyses_count,
        last_analysis_date=last_analysis_date,
        biomarkers_out_of_range=out_of_range_count,
        upcoming_reminders=upcoming_reminders,
    )


@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
    summary="Смена пароля",
)
async def change_password(
    current_password: str,
    new_password: str,
    user_id: CurrentUserID,
    db: AsyncSession = Depends(get_async_session),
):
    """
    Смена пароля пользователя.
    
    Требуется текущий пароль для подтверждения.
    """
    from app.core.security import verify_password
    
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )
    
    if not verify_password(current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный текущий пароль",
        )
    
    if len(new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Новый пароль должен содержать минимум 6 символов",
        )
    
    user.hashed_password = get_password_hash(new_password)
    await db.flush()
    
    return {"message": "Пароль успешно изменен"}



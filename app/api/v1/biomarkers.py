"""
Biomarkers API endpoints for biomarker table view.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy import select, func, desc, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_async_session
from app.core.security import get_current_user_id
from app.models.biomarker import UserBiomarker, Biomarker, BiomarkerStatus, BiomarkerCategory
from app.models.analysis import Analysis
from app.models.user import User
from app.schemas.biomarker import (
    BiomarkerListResponse,
    BiomarkerListItem,
    BiomarkerDetailResponse,
    BiomarkerHistoryItem,
    BiomarkerValueCreate,
    BiomarkerValueUpdate,
    BiomarkerValueResponse,
)

router = APIRouter()


@router.get(
    "",
    response_model=BiomarkerListResponse,
    summary="Таблица анализов - список биомаркеров",
)
async def list_biomarkers(
    category: Optional[BiomarkerCategory] = None,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Получение списка всех уникальных биомаркеров пользователя.
    
    Для каждого биомаркера возвращается последнее значение и статистика.
    Группировка по категориям (Гематология, Витамины, Гормоны и т.д.)
    """
    # Get all unique biomarkers for user
    stmt = (
        select(Biomarker)
        .join(UserBiomarker, UserBiomarker.biomarker_id == Biomarker.id)
        .where(UserBiomarker.user_id == user_id)
        .distinct()
    )
    
    if category:
        stmt = stmt.where(Biomarker.category == category)
    
    stmt = stmt.order_by(Biomarker.category, Biomarker.name_ru)
    
    result = await db.execute(stmt)
    biomarkers = result.scalars().all()
    
    items = []
    for biomarker in biomarkers:
        # Get last value
        last_value_stmt = (
            select(UserBiomarker)
            .where(
                UserBiomarker.user_id == user_id,
                UserBiomarker.biomarker_id == biomarker.id,
            )
            .order_by(desc(UserBiomarker.measured_at))
            .limit(1)
        )
        last_value_result = await db.execute(last_value_stmt)
        last_value = last_value_result.scalar_one_or_none()
        
        # Get statistics
        stats_stmt = (
            select(
                func.count(UserBiomarker.id),
                func.min(UserBiomarker.measured_at),
            )
            .where(
                UserBiomarker.user_id == user_id,
                UserBiomarker.biomarker_id == biomarker.id,
            )
        )
        stats_result = await db.execute(stats_stmt)
        total_measurements, first_measured = stats_result.one()
        
        items.append(BiomarkerListItem(
            code=biomarker.code,
            name=biomarker.name_ru,
            category=biomarker.category,
            unit=biomarker.default_unit,
            last_value=last_value.value if last_value else None,
            last_status=last_value.status.value if last_value else None,
            last_measured_at=last_value.measured_at if last_value else None,
            last_ref_min=last_value.ref_min if last_value else None,
            last_ref_max=last_value.ref_max if last_value else None,
            total_measurements=total_measurements or 0,
            first_measured_at=first_measured,
        ))
    
    return BiomarkerListResponse(
        items=items,
        total=len(items),
    )


@router.get(
    "/{biomarker_code}",
    response_model=BiomarkerDetailResponse,
    summary="Детали биомаркера с историей",
)
async def get_biomarker_detail(
    biomarker_code: str,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Получение полной истории конкретного биомаркера.
    
    Возвращает все значения из всех анализов + статистику.
    """
    # Get biomarker
    biomarker_stmt = select(Biomarker).where(Biomarker.code == biomarker_code)
    biomarker_result = await db.execute(biomarker_stmt)
    biomarker = biomarker_result.scalar_one_or_none()
    
    if not biomarker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Биомаркер не найден",
        )
    
    # Get all user values with analysis info
    history_stmt = (
        select(UserBiomarker)
        .options(selectinload(UserBiomarker.analysis))
        .where(
            UserBiomarker.user_id == user_id,
            UserBiomarker.biomarker_id == biomarker.id,
        )
        .order_by(desc(UserBiomarker.measured_at))
    )
    history_result = await db.execute(history_stmt)
    user_values = history_result.scalars().all()
    
    if not user_values:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="У вас нет данных по этому показателю",
        )
    
    # Format history
    history = []
    for value in user_values:
        history.append(BiomarkerHistoryItem(
            id=value.id,
            value=value.value,
            unit=value.unit,
            status=value.status.value,
            ref_min=value.ref_min,
            ref_max=value.ref_max,
            measured_at=value.measured_at,
            analysis_id=value.analysis_id,
            analysis_title=value.analysis.title if value.analysis else None,
            lab_name=getattr(value, 'lab_name', None),  # Laboratory name
            created_at=value.created_at,
        ))
    
    # Calculate statistics
    values = [v.value for v in user_values]
    stats_stmt = (
        select(
            func.count(UserBiomarker.id),
            func.min(UserBiomarker.value),
            func.max(UserBiomarker.value),
            func.avg(UserBiomarker.value),
            func.min(UserBiomarker.measured_at),
            func.max(UserBiomarker.measured_at),
        )
        .where(
            UserBiomarker.user_id == user_id,
            UserBiomarker.biomarker_id == biomarker.id,
        )
    )
    stats_result = await db.execute(stats_stmt)
    total, min_val, max_val, avg_val, first_date, last_date = stats_result.one()
    
    return BiomarkerDetailResponse(
        code=biomarker.code,
        name=biomarker.name_ru,
        category=biomarker.category,
        description=biomarker.description,
        unit=biomarker.default_unit,
        history=history,
        total_measurements=total or 0,
        min_value=float(min_val) if min_val else None,
        max_value=float(max_val) if max_val else None,
        avg_value=float(avg_val) if avg_val else None,
        first_measured_at=first_date,
        last_measured_at=last_date,
    )


@router.post(
    "/{biomarker_code}/values",
    response_model=BiomarkerValueResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Добавить значение вручную",
)
async def create_biomarker_value(
    biomarker_code: str,
    value_data: BiomarkerValueCreate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Ручное добавление значения биомаркера.
    
    Используется когда пользователь хочет добавить показатель без загрузки анализа.
    """
    # Get biomarker or create if not exists
    biomarker_stmt = select(Biomarker).where(Biomarker.code == biomarker_code)
    biomarker_result = await db.execute(biomarker_stmt)
    biomarker = biomarker_result.scalar_one_or_none()
    
    if not biomarker:
        # Auto-create missing biomarker
        from app.api.v1.analyses import detect_biomarker_category
        
        # Use provided code as name initially (frontend sends generated code from name)
        # If the code is just upper case name (e.g. "КАЛИЙ"), use it as name_ru properly
        name_ru = biomarker_code.title() if biomarker_code.isupper() and len(biomarker_code) > 3 else biomarker_code
        
        category = detect_biomarker_category(name_ru, biomarker_code)
        
        # HOTFIX: Use only safe (old) categories until new enum values are added to PostgreSQL
        safe_categories = {
            BiomarkerCategory.HEMATOLOGY, BiomarkerCategory.BIOCHEMISTRY,
            BiomarkerCategory.HORMONES, BiomarkerCategory.VITAMINS,
            BiomarkerCategory.MINERALS, BiomarkerCategory.LIPIDS,
            BiomarkerCategory.LIVER, BiomarkerCategory.KIDNEY,
            BiomarkerCategory.THYROID, BiomarkerCategory.INFLAMMATION,
            BiomarkerCategory.OTHER,
        }
        if category not in safe_categories:
            category = BiomarkerCategory.OTHER
        
        biomarker = Biomarker(
            code=biomarker_code,
            name_ru=name_ru,
            default_unit=value_data.unit,
            category=category,
        )
        db.add(biomarker)
        await db.flush()
    
    # Determine status
    status_value = BiomarkerStatus.NORMAL
    if value_data.ref_min is not None and value_data.ref_max is not None:
        if value_data.value < value_data.ref_min:
            status_value = BiomarkerStatus.LOW
        elif value_data.value > value_data.ref_max:
            status_value = BiomarkerStatus.HIGH
    
    # Create user biomarker (without analysis_id)
    user_biomarker = UserBiomarker(
        user_id=user_id,
        analysis_id=None,  # Manual entry
        biomarker_id=biomarker.id,
        value=value_data.value,
        unit=value_data.unit,
        status=status_value,
        ref_min=value_data.ref_min,
        ref_max=value_data.ref_max,
        measured_at=datetime.combine(value_data.measured_at, datetime.min.time()),
        lab_name=value_data.lab_name,  # Laboratory name
    )
    
    db.add(user_biomarker)
    await db.flush()
    await db.refresh(user_biomarker)
    await db.commit()
    
    return BiomarkerValueResponse(
        id=user_biomarker.id,
        biomarker_code=biomarker.code,
        biomarker_name=biomarker.name_ru,
        value=user_biomarker.value,
        unit=user_biomarker.unit,
        status=user_biomarker.status.value,
        ref_min=user_biomarker.ref_min,
        ref_max=user_biomarker.ref_max,
        measured_at=user_biomarker.measured_at,
        created_at=user_biomarker.created_at,
    )


@router.put(
    "/values/{value_id}",
    response_model=BiomarkerValueResponse,
    summary="Редактировать значение",
)
async def update_biomarker_value(
    value_id: int,
    value_data: BiomarkerValueUpdate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Редактирование значения биомаркера.
    
    Можно редактировать только значения, добавленные вручную (не из анализов).
    """
    # Get user biomarker
    stmt = (
        select(UserBiomarker)
        .options(selectinload(UserBiomarker.biomarker))
        .where(
            UserBiomarker.id == value_id,
            UserBiomarker.user_id == user_id,
        )
    )
    result = await db.execute(stmt)
    user_biomarker = result.scalar_one_or_none()
    
    if not user_biomarker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Значение не найдено",
        )
    
    # Only allow editing manually added values
    if user_biomarker.analysis_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя редактировать значения из анализов",
        )
    
    # Update fields
    if value_data.value is not None:
        user_biomarker.value = value_data.value
    if value_data.unit is not None:
        user_biomarker.unit = value_data.unit
    if value_data.measured_at is not None:
        user_biomarker.measured_at = datetime.combine(
            value_data.measured_at,
            datetime.min.time(),
        )
    if value_data.ref_min is not None:
        user_biomarker.ref_min = value_data.ref_min
    if value_data.ref_max is not None:
        user_biomarker.ref_max = value_data.ref_max
    
    # Recalculate status
    if user_biomarker.ref_min is not None and user_biomarker.ref_max is not None:
        if user_biomarker.value < user_biomarker.ref_min:
            user_biomarker.status = BiomarkerStatus.LOW
        elif user_biomarker.value > user_biomarker.ref_max:
            user_biomarker.status = BiomarkerStatus.HIGH
        else:
            user_biomarker.status = BiomarkerStatus.NORMAL
    
    await db.commit()
    await db.refresh(user_biomarker)
    
    return BiomarkerValueResponse(
        id=user_biomarker.id,
        biomarker_code=user_biomarker.biomarker.code,
        biomarker_name=user_biomarker.biomarker.name_ru,
        value=user_biomarker.value,
        unit=user_biomarker.unit,
        status=user_biomarker.status.value,
        ref_min=user_biomarker.ref_min,
        ref_max=user_biomarker.ref_max,
        measured_at=user_biomarker.measured_at,
        created_at=user_biomarker.created_at,
    )


@router.delete(
    "/values/{value_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удалить значение",
)
async def delete_biomarker_value(
    value_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Удаление значения биомаркера.
    
    Можно удалять только значения, добавленные вручную (не из анализов).
    """
    # Get user biomarker
    stmt = select(UserBiomarker).where(
        UserBiomarker.id == value_id,
        UserBiomarker.user_id == user_id,
    )
    result = await db.execute(stmt)
    user_biomarker = result.scalar_one_or_none()
    
    if not user_biomarker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Значение не найдено",
        )
    
    # Only allow deleting manually added values
    if user_biomarker.analysis_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалять значения из анализов. Удалите весь анализ.",
        )
    
    await db.delete(user_biomarker)
    await db.commit()




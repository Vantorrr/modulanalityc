"""
Recommendations API endpoints.
"""

from typing import List, Optional

from fastapi import APIRouter, HTTPException, status, Depends, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_async_session
from app.core.security import CurrentUserID
from app.models.biomarker import UserBiomarker
from app.models.product import ProductRecommendation, Product
from app.schemas.product import RecommendationResponse, RecommendationListResponse, RecommendationAction
from app.services.recommendations import RecommendationService

router = APIRouter()


@router.get(
    "",
    response_model=RecommendationListResponse,
    summary="Список рекомендаций",
)
async def get_recommendations(
    include_dismissed: bool = Query(False, description="Включить скрытые рекомендации"),
    limit: int = Query(20, ge=1, le=100),
    user_id: int = Depends(CurrentUserID),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Получение списка рекомендаций товаров на основе анализов пользователя.
    
    Рекомендации сортируются по приоритету:
    1. Критические дефициты (наивысший приоритет)
    2. Отклонения от нормы
    3. Уверенность AI в рекомендации
    """
    recommendation_service = RecommendationService(db)
    
    recommendations = await recommendation_service.get_user_recommendations(
        user_id=user_id,
        include_dismissed=include_dismissed,
        limit=limit,
    )
    
    # Count stats
    high_priority = sum(1 for r in recommendations if r["priority"] <= 2)
    dismissed = sum(1 for r in recommendations if r["is_dismissed"])
    
    # Format response
    items = []
    for rec in recommendations:
        items.append(RecommendationResponse(
            id=rec["id"],
            product_id=rec["product"]["id"],
            product={
                "id": rec["product"]["id"],
                "name": rec["product"]["name"],
                "slug": rec["product"]["slug"],
                "price": rec["product"]["price"],
                "old_price": rec["product"]["old_price"],
                "image_url": rec["product"]["image_url"],
                "external_url": rec["product"]["external_url"],
                "brand": rec["product"]["brand"],
                "rating": rec["product"]["rating"],
            },
            biomarker_code=rec["biomarker"]["code"],
            biomarker_name=rec["biomarker"]["name"],
            biomarker_value=rec["biomarker"]["value"],
            biomarker_status=rec["biomarker"]["status"],
            reason=rec["reason"],
            priority=rec["priority"],
            confidence=rec["confidence"],
            is_dismissed=rec["is_dismissed"],
            is_purchased=rec["is_purchased"],
            created_at=rec["created_at"],
        ))
    
    return RecommendationListResponse(
        total=len(items),
        items=items,
        high_priority_count=high_priority,
        dismissed_count=dismissed,
    )


@router.get(
    "/by-biomarker/{biomarker_code}",
    response_model=List[RecommendationResponse],
    summary="Рекомендации по биомаркеру",
)
async def get_recommendations_by_biomarker(
    biomarker_code: str,
    user_id: int = Depends(CurrentUserID),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Получение рекомендаций для конкретного биомаркера.
    
    Например, для низкого железа (FE) покажет все добавки с железом.
    """
    from app.models.biomarker import Biomarker
    
    # Find biomarker
    stmt = select(Biomarker).where(Biomarker.code == biomarker_code.upper())
    result = await db.execute(stmt)
    biomarker = result.scalar_one_or_none()
    
    if not biomarker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Биомаркер {biomarker_code} не найден",
        )
    
    # Get user's biomarker values
    user_bio_stmt = (
        select(UserBiomarker)
        .where(
            UserBiomarker.user_id == user_id,
            UserBiomarker.biomarker_id == biomarker.id,
        )
        .order_by(UserBiomarker.created_at.desc())
        .limit(1)
    )
    user_bio_result = await db.execute(user_bio_stmt)
    user_biomarker = user_bio_result.scalar_one_or_none()
    
    # Get recommendations
    stmt = (
        select(ProductRecommendation)
        .join(UserBiomarker)
        .join(Product)
        .options(
            selectinload(ProductRecommendation.product),
            selectinload(ProductRecommendation.user_biomarker)
            .selectinload(UserBiomarker.biomarker),
        )
        .where(
            UserBiomarker.user_id == user_id,
            UserBiomarker.biomarker_id == biomarker.id,
            ProductRecommendation.is_dismissed == False,
        )
        .order_by(ProductRecommendation.priority.asc())
    )
    
    result = await db.execute(stmt)
    recommendations = result.scalars().all()
    
    return [
        RecommendationResponse(
            id=rec.id,
            product_id=rec.product.id,
            product={
                "id": rec.product.id,
                "name": rec.product.name,
                "slug": rec.product.slug,
                "price": rec.product.price,
                "old_price": rec.product.old_price,
                "image_url": rec.product.image_url,
                "external_url": rec.product.external_url,
                "brand": rec.product.brand,
                "rating": rec.product.rating,
            },
            biomarker_code=rec.user_biomarker.biomarker.code,
            biomarker_name=rec.user_biomarker.biomarker.name_ru,
            biomarker_value=rec.user_biomarker.value,
            biomarker_status=rec.user_biomarker.status.value,
            reason=rec.reason,
            priority=rec.priority,
            confidence=rec.confidence,
            is_dismissed=rec.is_dismissed,
            is_purchased=rec.is_purchased,
            created_at=rec.created_at,
        )
        for rec in recommendations
    ]


@router.post(
    "/{recommendation_id}/dismiss",
    status_code=status.HTTP_200_OK,
    summary="Скрыть рекомендацию",
)
async def dismiss_recommendation(
    recommendation_id: int,
    user_id: int = Depends(CurrentUserID),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Скрыть рекомендацию (пользователь не хочет видеть этот товар).
    """
    recommendation_service = RecommendationService(db)
    
    success = await recommendation_service.dismiss_recommendation(
        recommendation_id=recommendation_id,
        user_id=user_id,
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Рекомендация не найдена",
        )
    
    await db.commit()
    
    return {"message": "Рекомендация скрыта"}


@router.post(
    "/{recommendation_id}/purchase",
    status_code=status.HTTP_200_OK,
    summary="Отметить как купленное",
)
async def mark_as_purchased(
    recommendation_id: int,
    user_id: int = Depends(CurrentUserID),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Отметить, что пользователь приобрел рекомендованный товар.
    
    Это помогает улучшать качество рекомендаций.
    """
    recommendation_service = RecommendationService(db)
    
    success = await recommendation_service.mark_as_purchased(
        recommendation_id=recommendation_id,
        user_id=user_id,
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Рекомендация не найдена",
        )
    
    await db.commit()
    
    return {"message": "Отмечено как купленное"}


@router.post(
    "/regenerate",
    status_code=status.HTTP_200_OK,
    summary="Перегенерировать рекомендации",
)
async def regenerate_recommendations(
    analysis_id: Optional[int] = Query(None, description="ID анализа (если не указан, для всех)"),
    user_id: int = Depends(CurrentUserID),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Перегенерировать рекомендации на основе текущих анализов.
    
    Используйте после добавления новых товаров в каталог или
    обновления логики рекомендаций.
    """
    from app.models.analysis import Analysis, AnalysisStatus
    
    recommendation_service = RecommendationService(db)
    
    if analysis_id:
        # Check analysis ownership
        stmt = select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == user_id,
            Analysis.status == AnalysisStatus.COMPLETED,
        )
        result = await db.execute(stmt)
        analysis = result.scalar_one_or_none()
        
        if not analysis:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Анализ не найден или не обработан",
            )
        
        recommendations = await recommendation_service.generate_recommendations_for_analysis(
            analysis_id=analysis_id,
            user_id=user_id,
        )
        
        await db.commit()
        
        return {
            "message": f"Сгенерировано {len(recommendations)} рекомендаций",
            "count": len(recommendations),
        }
    
    else:
        # Regenerate for all completed analyses
        stmt = select(Analysis).where(
            Analysis.user_id == user_id,
            Analysis.status == AnalysisStatus.COMPLETED,
        )
        result = await db.execute(stmt)
        analyses = result.scalars().all()
        
        total_count = 0
        for analysis in analyses:
            recommendations = await recommendation_service.generate_recommendations_for_analysis(
                analysis_id=analysis.id,
                user_id=user_id,
            )
            total_count += len(recommendations)
        
        await db.commit()
        
        return {
            "message": f"Сгенерировано {total_count} рекомендаций для {len(analyses)} анализов",
            "count": total_count,
        }



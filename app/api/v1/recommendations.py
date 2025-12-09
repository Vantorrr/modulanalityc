"""
Recommendations API endpoints.
"""

from typing import List, Optional, Any, Dict

from fastapi import APIRouter, HTTPException, status, Depends, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.security import get_current_user_id
from app.services.recommendations import RecommendationService
from app.models.analysis import Analysis, AnalysisStatus

router = APIRouter()


@router.get(
    "/latest",
    summary="Последние рекомендации",
)
async def get_latest_recommendations(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_async_session),
) -> List[Dict[str, Any]]:
    """
    Получение рекомендаций из последнего обработанного анализа.
    """
    stmt = (
        select(Analysis)
        .where(
            Analysis.user_id == user_id,
            Analysis.status == AnalysisStatus.COMPLETED,
            Analysis.ai_recommendations.is_not(None)
        )
        .order_by(desc(Analysis.created_at))
        .limit(1)
    )
    result = await db.execute(stmt)
    analysis = result.scalar_one_or_none()
    
    if not analysis or not analysis.ai_recommendations:
        return []
        
    # Handle JSON structure
    recs = analysis.ai_recommendations
    if isinstance(recs, dict) and "items" in recs:
        return recs["items"]
    elif isinstance(recs, list):
        return recs
        
    return []


@router.post(
    "/regenerate",
    summary="Перегенерировать рекомендации",
)
async def regenerate_recommendations(
    analysis_id: Optional[int] = Query(None, description="ID анализа"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Перегенерировать рекомендации для конкретного анализа.
    """
    recommendation_service = RecommendationService(db)
    
    if analysis_id:
        # Check ownership
        stmt = select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == user_id,
        )
        result = await db.execute(stmt)
        analysis = result.scalar_one_or_none()
        
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")
            
        recommendations = await recommendation_service.generate_recommendations_for_analysis(
            analysis_id=analysis_id,
            user_id=user_id,
        )
        
        return {
            "message": "Recommendations regenerated",
            "count": len(recommendations),
            "items": recommendations
        }
        
    raise HTTPException(status_code=400, detail="analysis_id is required")

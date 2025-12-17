"""
Recommendation Service for matching biomarker deficiencies with products.
"""

import logging
import json
from typing import List, Optional, Dict, Any

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.biomarker import UserBiomarker, BiomarkerStatus
from app.models.product import Product
from app.models.analysis import Analysis
from app.models.patient_profile import PatientProfile
from app.services.ai_parser import AIParserService

logger = logging.getLogger(__name__)


class RecommendationService:
    """
    Service for generating product recommendations based on biomarker results and patient profile.
    """
    
    def __init__(self, db: AsyncSession):
        """Initialize the recommendation service."""
        self.db = db
        self.ai_parser = AIParserService()
    
    async def generate_recommendations_for_analysis(
        self,
        analysis_id: int,
        user_id: int,
    ) -> List[Dict[str, Any]]:
        """
        Generate product recommendations for an analysis.
        This updates the Analysis.ai_recommendations JSON field.
        """
        # Get analysis to update later
        analysis_stmt = select(Analysis).where(Analysis.id == analysis_id)
        analysis_result = await self.db.execute(analysis_stmt)
        analysis = analysis_result.scalar_one_or_none()
        
        if not analysis:
            return []

        # Get user biomarkers with issues
        stmt = (
            select(UserBiomarker)
            .options(selectinload(UserBiomarker.biomarker))
            .where(
                and_(
                    UserBiomarker.analysis_id == analysis_id,
                    UserBiomarker.user_id == user_id,
                    UserBiomarker.status.in_([
                        BiomarkerStatus.LOW,
                        BiomarkerStatus.HIGH,
                        BiomarkerStatus.CRITICAL_LOW,
                        BiomarkerStatus.CRITICAL_HIGH,
                    ])
                )
            )
        )
        result = await self.db.execute(stmt)
        problem_biomarkers = result.scalars().all()
        
        # If no problematic biomarkers, get ALL for general recommendations
        if not problem_biomarkers:
            logger.info(f"No problematic biomarkers, generating preventive recommendations for analysis {analysis_id}")
            stmt_all = (
                select(UserBiomarker)
                .options(selectinload(UserBiomarker.biomarker))
                .where(
                    and_(
                        UserBiomarker.analysis_id == analysis_id,
                        UserBiomarker.user_id == user_id,
                    )
                )
                .limit(5)  # Top 5 biomarkers for general recommendations
            )
            result_all = await self.db.execute(stmt_all)
            biomarkers_for_recs = result_all.scalars().all()
            recommendation_type = "preventive"
        else:
            biomarkers_for_recs = problem_biomarkers
            recommendation_type = "corrective"
        
        if not biomarkers_for_recs:
            logger.info(f"No biomarkers found for analysis {analysis_id}")
            return []
            
        # Get Patient Profile
        profile_stmt = select(PatientProfile).where(PatientProfile.user_id == user_id)
        profile_result = await self.db.execute(profile_stmt)
        profile = profile_result.scalar_one_or_none()
        
        profile_data = {}
        if profile:
            profile_data = {
                "allergies": profile.allergies,
                "chronic_diseases": profile.chronic_diseases,
                "gender_health": profile.gender_health,
                "body_parameters": profile.body_parameters
            }
        
        # Prepare data for AI to generate keywords
        biomarker_data = [
            {
                "code": ub.biomarker.code,
                "name": ub.biomarker.name_ru,
                "value": ub.value,
                "unit": ub.unit,
                "status": ub.status.value,
            }
            for ub in biomarkers_for_recs
        ]
        
        # Ask AI for keywords
        keywords_data = await self.ai_parser.generate_search_keywords(
            biomarker_data, 
            patient_profile=profile_data
        )
        
        recommendations = []
        
        # Process specific biomarker keywords
        biomarker_keywords = keywords_data.get("biomarker_keywords", {})
        
        for code, keywords in biomarker_keywords.items():
            if not keywords:
                continue
                
            # Search products for these keywords
            found_products = await self._search_products(keywords, limit=3)
            
            for product in found_products:
                recommendations.append({
                    "type": "biomarker_specific",
                    "biomarker_code": code,
                    "product": {
                        "id": product.id,
                        "name": product.name,
                        "price": product.price,
                        # "image_url": product.image_url # Removed in migration
                    },
                    "reason": f"Рекомендовано для коррекции показателя {code} (поиск: {', '.join(keywords)})"
                })

        # Process general keywords
        general_keywords = keywords_data.get("general_keywords", [])
        if general_keywords:
            found_products = await self._search_products(general_keywords, limit=3)
            for product in found_products:
                 recommendations.append({
                    "type": "general",
                    "product": {
                        "id": product.id,
                        "name": product.name,
                        "price": product.price,
                    },
                    "reason": f"Общая рекомендация для здоровья (поиск: {', '.join(general_keywords)})"
                })
        
        # Save to Analysis model
        analysis.ai_recommendations = {"items": recommendations}
        await self.db.commit()
        
        return recommendations
        
    async def _search_products(self, keywords: List[str], limit: int = 5) -> List[Product]:
        """Search products by multiple keywords."""
        if not keywords:
            return []
            
        # Construct OR condition for all keywords
        conditions = []
        for kw in keywords:
            term = f"%{kw}%"
            conditions.append(Product.name.ilike(term))
            conditions.append(Product.description.ilike(term))
            conditions.append(Product.composition.ilike(term))
            
        stmt = (
            select(Product)
            .where(or_(*conditions))
            .limit(limit)
        )
        
        result = await self.db.execute(stmt)
        return result.scalars().all()

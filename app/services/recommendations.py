"""
Recommendation Service for matching biomarker deficiencies with products.
"""

import logging
from typing import List, Optional, Dict, Any

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.biomarker import UserBiomarker, Biomarker, BiomarkerStatus
from app.models.product import Product, ProductRecommendation
from app.services.ai_parser import AIParserService

logger = logging.getLogger(__name__)


class RecommendationService:
    """
    Service for generating product recommendations based on biomarker results.
    """
    
    def __init__(self, db: AsyncSession):
        """Initialize the recommendation service."""
        self.db = db
        self.ai_parser = AIParserService()
    
    async def generate_recommendations_for_analysis(
        self,
        analysis_id: int,
        user_id: int,
    ) -> List[ProductRecommendation]:
        """
        Generate product recommendations for all biomarkers in an analysis.
        
        Args:
            analysis_id: ID of the analysis
            user_id: ID of the user
            
        Returns:
            List of created ProductRecommendation objects
        """
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
        
        if not problem_biomarkers:
            logger.info(f"No problematic biomarkers found for analysis {analysis_id}")
            return []
        
        # Get available products
        products_stmt = (
            select(Product)
            .where(
                and_(
                    Product.is_active == True,
                    Product.in_stock == True,
                )
            )
            .limit(100)
        )
        products_result = await self.db.execute(products_stmt)
        products = products_result.scalars().all()
        
        if not products:
            logger.warning("No products available for recommendations")
            return []
        
        # Prepare data for AI
        biomarker_data = [
            {
                "id": ub.id,
                "code": ub.biomarker.code,
                "name": ub.biomarker.name_ru,
                "value": ub.value,
                "unit": ub.unit,
                "status": ub.status.value,
                "ref_min": ub.ref_min,
                "ref_max": ub.ref_max,
            }
            for ub in problem_biomarkers
        ]
        
        product_data = [
            {
                "id": p.id,
                "name": p.name,
                "active_ingredients": p.active_ingredients,
                "health_benefits": p.health_benefits,
                "target_biomarkers": p.target_biomarkers,
            }
            for p in products
        ]
        
        # Get AI recommendations
        ai_recommendations = await self.ai_parser.generate_recommendations(
            biomarker_data,
            product_data,
        )
        
        # Create recommendation objects
        created_recommendations = []
        
        for rec in ai_recommendations:
            product_id = rec.get("product_id")
            biomarker_code = rec.get("biomarker_code")
            
            # Find matching user biomarker
            user_biomarker = next(
                (ub for ub in problem_biomarkers if ub.biomarker.code == biomarker_code),
                None
            )
            
            if not user_biomarker:
                continue
            
            # Check if product exists
            product = next((p for p in products if p.id == product_id), None)
            if not product:
                continue
            
            # Check for duplicate
            existing_stmt = select(ProductRecommendation).where(
                and_(
                    ProductRecommendation.user_biomarker_id == user_biomarker.id,
                    ProductRecommendation.product_id == product_id,
                )
            )
            existing_result = await self.db.execute(existing_stmt)
            if existing_result.scalar_one_or_none():
                continue
            
            # Create recommendation
            recommendation = ProductRecommendation(
                user_biomarker_id=user_biomarker.id,
                product_id=product_id,
                reason=rec.get("reason", "Рекомендовано на основе анализов"),
                priority=rec.get("priority", 3),
                confidence=rec.get("confidence", 0.5),
            )
            
            self.db.add(recommendation)
            created_recommendations.append(recommendation)
        
        await self.db.flush()
        
        logger.info(
            f"Created {len(created_recommendations)} recommendations "
            f"for analysis {analysis_id}"
        )
        
        return created_recommendations
    
    async def get_user_recommendations(
        self,
        user_id: int,
        include_dismissed: bool = False,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Get all active recommendations for a user.
        
        Args:
            user_id: User ID
            include_dismissed: Whether to include dismissed recommendations
            limit: Maximum number of recommendations to return
            
        Returns:
            List of recommendation data with product details
        """
        conditions = [UserBiomarker.user_id == user_id]
        
        if not include_dismissed:
            conditions.append(ProductRecommendation.is_dismissed == False)
        
        stmt = (
            select(ProductRecommendation)
            .join(UserBiomarker)
            .join(Product)
            .options(
                selectinload(ProductRecommendation.product),
                selectinload(ProductRecommendation.user_biomarker)
                .selectinload(UserBiomarker.biomarker),
            )
            .where(and_(*conditions))
            .order_by(
                ProductRecommendation.priority.asc(),
                ProductRecommendation.confidence.desc(),
            )
            .limit(limit)
        )
        
        result = await self.db.execute(stmt)
        recommendations = result.scalars().all()
        
        return [
            {
                "id": rec.id,
                "product": {
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
                "biomarker": {
                    "code": rec.user_biomarker.biomarker.code,
                    "name": rec.user_biomarker.biomarker.name_ru,
                    "value": rec.user_biomarker.value,
                    "unit": rec.user_biomarker.unit,
                    "status": rec.user_biomarker.status.value,
                },
                "reason": rec.reason,
                "priority": rec.priority,
                "confidence": rec.confidence,
                "is_dismissed": rec.is_dismissed,
                "is_purchased": rec.is_purchased,
                "created_at": rec.created_at.isoformat(),
            }
            for rec in recommendations
        ]
    
    async def dismiss_recommendation(
        self,
        recommendation_id: int,
        user_id: int,
    ) -> bool:
        """
        Mark a recommendation as dismissed.
        
        Args:
            recommendation_id: Recommendation ID
            user_id: User ID (for validation)
            
        Returns:
            True if successful, False if not found
        """
        stmt = (
            select(ProductRecommendation)
            .join(UserBiomarker)
            .where(
                and_(
                    ProductRecommendation.id == recommendation_id,
                    UserBiomarker.user_id == user_id,
                )
            )
        )
        result = await self.db.execute(stmt)
        recommendation = result.scalar_one_or_none()
        
        if not recommendation:
            return False
        
        recommendation.is_dismissed = True
        await self.db.flush()
        
        return True
    
    async def mark_as_purchased(
        self,
        recommendation_id: int,
        user_id: int,
    ) -> bool:
        """
        Mark a recommendation as purchased.
        
        Args:
            recommendation_id: Recommendation ID
            user_id: User ID (for validation)
            
        Returns:
            True if successful, False if not found
        """
        stmt = (
            select(ProductRecommendation)
            .join(UserBiomarker)
            .where(
                and_(
                    ProductRecommendation.id == recommendation_id,
                    UserBiomarker.user_id == user_id,
                )
            )
        )
        result = await self.db.execute(stmt)
        recommendation = result.scalar_one_or_none()
        
        if not recommendation:
            return False
        
        recommendation.is_purchased = True
        await self.db.flush()
        
        return True
    
    async def match_products_to_biomarker(
        self,
        biomarker_code: str,
        limit: int = 10,
    ) -> List[Product]:
        """
        Find products that target a specific biomarker.
        
        Args:
            biomarker_code: Biomarker code (e.g., "FE", "D3")
            limit: Maximum products to return
            
        Returns:
            List of matching products
        """
        # Search in target_biomarkers field
        stmt = (
            select(Product)
            .where(
                and_(
                    Product.is_active == True,
                    Product.in_stock == True,
                    Product.target_biomarkers.ilike(f"%{biomarker_code}%"),
                )
            )
            .order_by(Product.rating.desc().nullslast())
            .limit(limit)
        )
        
        result = await self.db.execute(stmt)
        return result.scalars().all()



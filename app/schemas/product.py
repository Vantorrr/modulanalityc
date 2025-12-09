"""
Product and recommendation schemas.
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel

from app.schemas.base import BaseSchema, PaginatedResponse


class ProductCategoryResponse(BaseSchema):
    """Product category response."""
    
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    icon: Optional[str] = None
    products_count: int = 0


class ProductResponse(BaseSchema):
    """Product response."""
    
    id: int
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    
    # Basic info
    name: str
    slug: str
    description: Optional[str] = None
    short_description: Optional[str] = None
    
    # Pricing
    price: float
    old_price: Optional[float] = None
    currency: str = "RUB"
    discount_percent: Optional[int] = None
    
    # Media
    image_url: Optional[str] = None
    images: Optional[List[str]] = None
    
    # Stock
    in_stock: bool = True
    
    # External
    external_id: Optional[str] = None
    external_url: Optional[str] = None
    
    # Metadata
    brand: Optional[str] = None
    rating: Optional[float] = None
    reviews_count: int = 0
    
    # Health
    active_ingredients: Optional[List[str]] = None
    health_benefits: Optional[List[str]] = None


class ProductListResponse(PaginatedResponse):
    """Paginated product list."""
    
    items: List[ProductResponse]


class RecommendationResponse(BaseSchema):
    """Product recommendation based on biomarker."""
    
    id: int
    product_id: int
    product: ProductResponse
    
    # Recommendation context
    biomarker_code: str
    biomarker_name: str
    biomarker_value: float
    biomarker_status: str
    
    # Recommendation details
    reason: str
    priority: int
    confidence: float
    
    # Status
    is_dismissed: bool = False
    is_purchased: bool = False
    
    created_at: datetime


class RecommendationListResponse(BaseModel):
    """List of recommendations for user."""
    
    total: int
    items: List[RecommendationResponse]
    
    # Summary
    high_priority_count: int = 0
    dismissed_count: int = 0


class RecommendationAction(BaseModel):
    """Action on recommendation (dismiss/purchase)."""
    
    action: str  # "dismiss" or "purchase"




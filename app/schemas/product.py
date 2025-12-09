"""
Product and recommendation schemas.
"""

from datetime import datetime
from typing import Optional, List, Any

from pydantic import BaseModel

from app.schemas.base import BaseSchema, PaginatedResponse


class ProductResponse(BaseSchema):
    """Product response."""
    
    id: int
    name: str
    description: Optional[str] = None
    
    price: Optional[float] = None
    
    # New fields
    composition: Optional[str] = None
    composition_table: Optional[str] = None
    quantity: Optional[int] = 0
    sale_count: Optional[int] = 0
    value: Optional[str] = None
    filter_stocks: Optional[str] = None


class ProductListResponse(PaginatedResponse):
    """Paginated product list."""
    
    items: List[ProductResponse]


class RecommendationResponse(BaseSchema):
    """Product recommendation based on biomarker."""
    
    id: Optional[int] = None # ID might be missing if generated on fly
    product: ProductResponse
    
    # Recommendation details
    type: str = "general" # general / biomarker_specific
    reason: str
    
    # Optional biomarker context
    biomarker_code: Optional[str] = None
    
    created_at: Optional[datetime] = None


class RecommendationListResponse(BaseModel):
    """List of recommendations for user."""
    
    total: int
    items: List[RecommendationResponse]

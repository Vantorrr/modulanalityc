"""
Base schema configuration for all Pydantic models.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class BaseSchema(BaseModel):
    """Base schema with common configuration."""
    
    model_config = ConfigDict(
        from_attributes=True,
        str_strip_whitespace=True,
    )


class TimestampMixin(BaseModel):
    """Mixin for adding timestamp fields."""
    
    created_at: datetime
    updated_at: Optional[datetime] = None


class PaginationParams(BaseModel):
    """Pagination parameters."""
    
    page: int = 1
    page_size: int = 20
    
    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size
    
    @property
    def limit(self) -> int:
        return self.page_size


class PaginatedResponse(BaseModel):
    """Base paginated response."""
    
    total: int
    page: int
    page_size: int
    pages: int
    
    @classmethod
    def calculate_pages(cls, total: int, page_size: int) -> int:
        return (total + page_size - 1) // page_size if page_size > 0 else 0




from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.core.database import get_async_session
from app.core.security import get_current_user
from app.models.user import User
from app.models.product import Product
from pydantic import BaseModel, ConfigDict

router = APIRouter()

class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str | None = None
    price: float | None = None
    quantity: int | None = None
    sale_count: int | None = None
    composition: str | None = None

@router.get("/", response_model=List[ProductResponse])
async def search_products(
    q: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Search products."""
    stmt = select(Product)
    
    if q:
        stmt = stmt.where(
            or_(
                Product.name.ilike(f"%{q}%"),
                Product.description.ilike(f"%{q}%"),
                Product.composition.ilike(f"%{q}%")
            )
        )
        
    stmt = stmt.limit(limit).offset(offset)
    result = await session.execute(stmt)
    products = result.scalars().all()
    
    return products

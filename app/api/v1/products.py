"""
Products Catalog API endpoints.
"""

from typing import List, Optional

from fastapi import APIRouter, HTTPException, status, Depends, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_async_session
from app.models.product import Product, ProductCategory
from app.schemas.product import ProductResponse, ProductCategoryResponse, ProductListResponse

router = APIRouter()


@router.get(
    "/categories",
    response_model=List[ProductCategoryResponse],
    summary="Список категорий",
)
async def list_categories(
    db: AsyncSession = Depends(get_async_session),
):
    """
    Получение списка категорий товаров.
    """
    stmt = (
        select(ProductCategory)
        .where(ProductCategory.is_active == True)
        .order_by(ProductCategory.sort_order.asc())
    )
    result = await db.execute(stmt)
    categories = result.scalars().all()
    
    # Count products in each category
    response = []
    for cat in categories:
        count_stmt = (
            select(func.count(Product.id))
            .where(
                Product.category_id == cat.id,
                Product.is_active == True,
            )
        )
        count = (await db.execute(count_stmt)).scalar() or 0
        
        response.append(ProductCategoryResponse(
            id=cat.id,
            name=cat.name,
            slug=cat.slug,
            description=cat.description,
            icon=cat.icon,
            products_count=count,
        ))
    
    return response


@router.get(
    "",
    response_model=ProductListResponse,
    summary="Список товаров",
)
async def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category_slug: Optional[str] = Query(None, description="Slug категории"),
    search: Optional[str] = Query(None, description="Поиск по названию"),
    in_stock_only: bool = Query(True, description="Только в наличии"),
    biomarker_code: Optional[str] = Query(None, description="Фильтр по целевому биомаркеру"),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Получение списка товаров с фильтрацией и пагинацией.
    
    Параметры фильтрации:
    - **category_slug**: Фильтр по категории
    - **search**: Поиск по названию
    - **in_stock_only**: Только товары в наличии
    - **biomarker_code**: Товары, помогающие с конкретным биомаркером
    """
    conditions = [Product.is_active == True]
    
    if in_stock_only:
        conditions.append(Product.in_stock == True)
    
    if category_slug:
        # Find category
        cat_stmt = select(ProductCategory).where(ProductCategory.slug == category_slug)
        cat_result = await db.execute(cat_stmt)
        category = cat_result.scalar_one_or_none()
        
        if category:
            conditions.append(Product.category_id == category.id)
    
    if search:
        conditions.append(Product.name.ilike(f"%{search}%"))
    
    if biomarker_code:
        conditions.append(Product.target_biomarkers.ilike(f"%{biomarker_code}%"))
    
    # Count total
    count_stmt = select(func.count(Product.id)).where(and_(*conditions))
    total = (await db.execute(count_stmt)).scalar() or 0
    
    # Get items
    stmt = (
        select(Product)
        .options(selectinload(Product.category))
        .where(and_(*conditions))
        .order_by(Product.is_featured.desc(), Product.rating.desc().nullslast())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    products = result.scalars().all()
    
    # Format response
    items = []
    for p in products:
        # Parse list fields
        images = None
        if p.images:
            images = p.images if isinstance(p.images, list) else []
        
        active_ingredients = None
        if p.active_ingredients:
            active_ingredients = [i.strip() for i in p.active_ingredients.split(",")]
        
        health_benefits = None
        if p.health_benefits:
            health_benefits = [b.strip() for b in p.health_benefits.split(",")]
        
        # Calculate discount
        discount_percent = None
        if p.old_price and p.old_price > p.price:
            discount_percent = int((1 - p.price / p.old_price) * 100)
        
        items.append(ProductResponse(
            id=p.id,
            category_id=p.category_id,
            category_name=p.category.name if p.category else None,
            name=p.name,
            slug=p.slug,
            description=p.description,
            short_description=p.short_description,
            price=p.price,
            old_price=p.old_price,
            currency=p.currency,
            discount_percent=discount_percent,
            image_url=p.image_url,
            images=images,
            in_stock=p.in_stock,
            external_id=p.external_id,
            external_url=p.external_url,
            brand=p.brand,
            rating=p.rating,
            reviews_count=p.reviews_count,
            active_ingredients=active_ingredients,
            health_benefits=health_benefits,
        ))
    
    return ProductListResponse(
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
        items=items,
    )


@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Детали товара",
)
async def get_product(
    product_id: int,
    db: AsyncSession = Depends(get_async_session),
):
    """
    Получение полной информации о товаре.
    """
    stmt = (
        select(Product)
        .options(selectinload(Product.category))
        .where(Product.id == product_id)
    )
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Товар не найден",
        )
    
    # Parse list fields
    images = None
    if product.images:
        images = product.images if isinstance(product.images, list) else []
    
    active_ingredients = None
    if product.active_ingredients:
        active_ingredients = [i.strip() for i in product.active_ingredients.split(",")]
    
    health_benefits = None
    if product.health_benefits:
        health_benefits = [b.strip() for b in product.health_benefits.split(",")]
    
    discount_percent = None
    if product.old_price and product.old_price > product.price:
        discount_percent = int((1 - product.price / product.old_price) * 100)
    
    return ProductResponse(
        id=product.id,
        category_id=product.category_id,
        category_name=product.category.name if product.category else None,
        name=product.name,
        slug=product.slug,
        description=product.description,
        short_description=product.short_description,
        price=product.price,
        old_price=product.old_price,
        currency=product.currency,
        discount_percent=discount_percent,
        image_url=product.image_url,
        images=images,
        in_stock=product.in_stock,
        external_id=product.external_id,
        external_url=product.external_url,
        brand=product.brand,
        rating=product.rating,
        reviews_count=product.reviews_count,
        active_ingredients=active_ingredients,
        health_benefits=health_benefits,
    )


@router.get(
    "/by-slug/{slug}",
    response_model=ProductResponse,
    summary="Товар по slug",
)
async def get_product_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_async_session),
):
    """
    Получение товара по его slug (для SEO-friendly URL).
    """
    stmt = (
        select(Product)
        .options(selectinload(Product.category))
        .where(Product.slug == slug)
    )
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Товар не найден",
        )
    
    # Same response formatting as get_product
    images = None
    if product.images:
        images = product.images if isinstance(product.images, list) else []
    
    active_ingredients = None
    if product.active_ingredients:
        active_ingredients = [i.strip() for i in product.active_ingredients.split(",")]
    
    health_benefits = None
    if product.health_benefits:
        health_benefits = [b.strip() for b in product.health_benefits.split(",")]
    
    discount_percent = None
    if product.old_price and product.old_price > product.price:
        discount_percent = int((1 - product.price / product.old_price) * 100)
    
    return ProductResponse(
        id=product.id,
        category_id=product.category_id,
        category_name=product.category.name if product.category else None,
        name=product.name,
        slug=product.slug,
        description=product.description,
        short_description=product.short_description,
        price=product.price,
        old_price=product.old_price,
        currency=product.currency,
        discount_percent=discount_percent,
        image_url=product.image_url,
        images=images,
        in_stock=product.in_stock,
        external_id=product.external_id,
        external_url=product.external_url,
        brand=product.brand,
        rating=product.rating,
        reviews_count=product.reviews_count,
        active_ingredients=active_ingredients,
        health_benefits=health_benefits,
    )



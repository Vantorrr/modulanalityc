"""
Product models for supplement catalog and recommendations.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    String, Text, Float, Integer, Boolean, DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.biomarker import UserBiomarker


class ProductCategory(Base):
    """
    Product category for organizing supplements.
    """
    
    __tablename__ = "product_categories"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    
    name: Mapped[str] = mapped_column(String(100), unique=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="Icon name or emoji",
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Relationships
    products: Mapped[list["Product"]] = relationship(
        "Product",
        back_populates="category",
    )


class Product(Base):
    """
    Supplement/product from the customer's catalog.
    """
    
    __tablename__ = "products"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    category_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("product_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    
    # Basic info
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    short_description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Pricing
    price: Mapped[float] = mapped_column(Float, default=0)
    old_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="RUB")
    
    # Media
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    images: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    
    # Stock
    in_stock: Mapped[bool] = mapped_column(Boolean, default=True)
    stock_quantity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # External integration
    external_id: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
        comment="ID в каталоге заказчика",
    )
    external_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Ссылка на товар в магазине заказчика",
    )
    
    # Health benefits (for AI matching)
    active_ingredients: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Comma-separated active ingredients",
    )
    health_benefits: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Comma-separated health benefits/tags",
    )
    target_biomarkers: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Comma-separated biomarker codes this product helps with",
    )
    
    # Metadata
    brand: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    rating: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    reviews_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    
    # Relationships
    category: Mapped[Optional["ProductCategory"]] = relationship(
        "ProductCategory",
        back_populates="products",
    )
    recommendations: Mapped[list["ProductRecommendation"]] = relationship(
        "ProductRecommendation",
        back_populates="product",
    )


class ProductRecommendation(Base):
    """
    Link between user's biomarker results and recommended products.
    """
    
    __tablename__ = "product_recommendations"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_biomarker_id: Mapped[int] = mapped_column(
        ForeignKey("user_biomarkers.id", ondelete="CASCADE"),
        index=True,
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"),
        index=True,
    )
    
    # Recommendation details
    reason: Mapped[str] = mapped_column(
        Text,
        comment="Why this product is recommended",
    )
    priority: Mapped[int] = mapped_column(
        Integer,
        default=1,
        comment="1 = highest priority",
    )
    confidence: Mapped[float] = mapped_column(
        Float,
        default=0.8,
        comment="AI confidence score 0-1",
    )
    
    # Status
    is_dismissed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        comment="User dismissed this recommendation",
    )
    is_purchased: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        comment="User purchased this product",
    )
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    
    # Relationships
    user_biomarker: Mapped["UserBiomarker"] = relationship(
        "UserBiomarker",
        back_populates="recommendations",
    )
    product: Mapped["Product"] = relationship(
        "Product",
        back_populates="recommendations",
    )



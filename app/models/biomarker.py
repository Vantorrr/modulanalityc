"""
Biomarker models for storing health indicators and reference ranges.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Optional
import enum

from sqlalchemy import (
    String, Text, Float, DateTime, ForeignKey,
    Enum as SQLEnum, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.analysis import Analysis


class BiomarkerCategory(str, enum.Enum):
    """Category of biomarker."""
    HEMATOLOGY = "hematology"           # Гематология
    BIOCHEMISTRY = "biochemistry"       # Биохимия
    HORMONES = "hormones"               # Гормоны
    VITAMINS = "vitamins"               # Витамины
    MINERALS = "minerals"               # Минералы
    LIPIDS = "lipids"                   # Липиды
    LIVER = "liver"                     # Печеночные показатели
    KIDNEY = "kidney"                   # Почечные показатели
    THYROID = "thyroid"                 # Щитовидная железа
    INFLAMMATION = "inflammation"       # Воспаление
    GASTROINTESTINAL = "gastrointestinal"  # ЖКТ
    BONE = "bone"                       # Костная система
    MUSCULOSKELETAL = "musculoskeletal"  # Костно-мышечная
    ADRENAL = "adrenal"                 # Надпочечники
    NERVOUS = "nervous"                 # Нервная система
    PANCREAS = "pancreas"               # Поджелудочная железа
    PARATHYROID = "parathyroid"         # Паращитовидная железа
    CARDIOVASCULAR = "cardiovascular"   # Сердечно-сосудистая
    REPRODUCTIVE = "reproductive"       # Репродуктивная система
    URINARY = "urinary"                 # Мочевыделительная
    IMMUNE = "immune"                   # Иммунная система
    COAGULATION = "coagulation"         # Свертываемость крови
    OTHER = "other"


class BiomarkerStatus(str, enum.Enum):
    """Status relative to reference range."""
    LOW = "low"           # Ниже нормы
    NORMAL = "normal"     # В норме
    HIGH = "high"         # Выше нормы
    CRITICAL_LOW = "critical_low"    # Критически низко
    CRITICAL_HIGH = "critical_high"  # Критически высоко


class Biomarker(Base):
    """
    Master list of biomarkers with standard names and aliases.
    This is our "dictionary" for normalizing different lab formats.
    """
    
    __tablename__ = "biomarkers"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    
    # Identification
    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        comment="Unique code (e.g., HGB, FE, TSH)",
    )
    name_ru: Mapped[str] = mapped_column(
        String(255),
        comment="Russian name",
    )
    name_en: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="English name",
    )
    
    # Aliases for OCR matching
    aliases: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Comma-separated aliases (HGB,Hb,Гемоглобин,Hemoglobin)",
    )
    
    # Classification
    category: Mapped[BiomarkerCategory] = mapped_column(
        SQLEnum(BiomarkerCategory),
        default=BiomarkerCategory.OTHER,
    )
    
    # Units
    default_unit: Mapped[str] = mapped_column(
        String(50),
        comment="Default measurement unit",
    )
    alternative_units: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Comma-separated alternative units with conversion factors",
    )
    
    # Description
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="What this biomarker indicates",
    )
    
    # For AI recommendations
    low_recommendations: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Recommendations when value is low",
    )
    high_recommendations: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Recommendations when value is high",
    )
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    
    # Relationships
    references: Mapped[list["BiomarkerReference"]] = relationship(
        "BiomarkerReference",
        back_populates="biomarker",
        cascade="all, delete-orphan",
    )
    user_values: Mapped[list["UserBiomarker"]] = relationship(
        "UserBiomarker",
        back_populates="biomarker",
    )


class BiomarkerReference(Base):
    """
    Reference ranges for biomarkers.
    Different ranges for age/gender groups.
    """
    
    __tablename__ = "biomarker_references"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    biomarker_id: Mapped[int] = mapped_column(
        ForeignKey("biomarkers.id", ondelete="CASCADE"),
        index=True,
    )
    
    # Demographic filters
    gender: Mapped[Optional[str]] = mapped_column(
        String(10),
        nullable=True,
        comment="male/female or null for both",
    )
    age_min: Mapped[Optional[int]] = mapped_column(nullable=True)
    age_max: Mapped[Optional[int]] = mapped_column(nullable=True)
    
    # Reference values
    ref_min: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ref_max: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    optimal_min: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        comment="Optimal range lower bound",
    )
    optimal_max: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        comment="Optimal range upper bound",
    )
    
    # Critical values
    critical_low: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    critical_high: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Unit for this reference
    unit: Mapped[str] = mapped_column(String(50))
    
    # Relationships
    biomarker: Mapped["Biomarker"] = relationship(
        "Biomarker",
        back_populates="references",
    )
    
    __table_args__ = (
        UniqueConstraint(
            "biomarker_id", "gender", "age_min", "age_max", "unit",
            name="uq_biomarker_reference",
        ),
    )


class UserBiomarker(Base):
    """
    User's actual biomarker values from analyses.
    This is where we store extracted data.
    """
    
    __tablename__ = "user_biomarkers"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    analysis_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("analyses.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
        comment="NULL for manually added values",
    )
    biomarker_id: Mapped[int] = mapped_column(
        ForeignKey("biomarkers.id", ondelete="RESTRICT"),
        index=True,
    )
    
    # Value
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(50))
    
    # Status (calculated from reference)
    status: Mapped[BiomarkerStatus] = mapped_column(
        SQLEnum(BiomarkerStatus),
        default=BiomarkerStatus.NORMAL,
    )
    
    # Reference used for comparison
    ref_min: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ref_max: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Raw extracted text (for debugging)
    raw_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Original name from OCR",
    )
    raw_value: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="Original value string from OCR",
    )
    
    # Date of measurement
    measured_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True,
    )
    
    # Laboratory name (for manual entries)
    lab_name: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="Laboratory where the test was performed",
    )
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="biomarkers")
    analysis: Mapped["Analysis"] = relationship("Analysis", back_populates="biomarkers")
    biomarker: Mapped["Biomarker"] = relationship("Biomarker", back_populates="user_values")
    # recommendations relationship removed as ProductRecommendation table is deleted




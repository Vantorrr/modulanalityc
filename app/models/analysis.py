"""
Analysis models for storing uploaded medical documents.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Optional
import enum

from sqlalchemy import (
    String, Text, DateTime, ForeignKey, Integer,
    Enum as SQLEnum, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.biomarker import UserBiomarker


class AnalysisStatus(str, enum.Enum):
    """Processing status of an analysis."""
    PENDING = "pending"          # Uploaded, awaiting processing
    PROCESSING = "processing"    # OCR/AI processing in progress
    COMPLETED = "completed"      # Successfully processed
    FAILED = "failed"            # Processing failed
    MANUAL_REVIEW = "manual_review"  # Needs manual data entry


class AnalysisType(str, enum.Enum):
    """Type of medical analysis."""
    BLOOD_GENERAL = "blood_general"      # Общий анализ крови
    BLOOD_BIOCHEMISTRY = "blood_biochemistry"  # Биохимия крови
    HORMONES = "hormones"                # Гормоны
    VITAMINS = "vitamins"                # Витамины и микроэлементы
    URINE = "urine"                      # Анализ мочи
    OTHER = "other"                      # Прочее


class LabProvider(str, enum.Enum):
    """Known laboratory providers for better parsing."""
    INVITRO = "invitro"
    KDL = "kdl"
    GEMOTEST = "gemotest"
    HELIX = "helix"
    CMD = "cmd"
    OTHER = "other"


class Analysis(Base):
    """
    Medical analysis record.
    One analysis can contain multiple biomarkers from a single lab visit.
    """
    
    __tablename__ = "analyses"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    
    # Analysis metadata
    title: Mapped[str] = mapped_column(
        String(255),
        default="Анализ",
        comment="User-friendly title",
    )
    analysis_type: Mapped[AnalysisType] = mapped_column(
        SQLEnum(AnalysisType),
        default=AnalysisType.OTHER,
    )
    lab_provider: Mapped[Optional[LabProvider]] = mapped_column(
        SQLEnum(LabProvider),
        nullable=True,
    )
    lab_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Custom lab name if not in enum",
    )
    
    # Dates
    analysis_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True,
        comment="Date when analysis was taken",
    )
    
    # Processing status
    status: Mapped[AnalysisStatus] = mapped_column(
        SQLEnum(AnalysisStatus),
        default=AnalysisStatus.PENDING,
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Error details if processing failed",
    )
    
    # Raw OCR output (for debugging)
    raw_text: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Raw OCR text output",
    )
    
    # AI interpretation
    ai_summary: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="AI-generated summary of results",
    )
    ai_recommendations: Mapped[Optional[dict]] = mapped_column(
        JSON,
        nullable=True,
        comment="AI-generated recommendations",
    )
    
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
    processed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="analyses")
    files: Mapped[list["AnalysisFile"]] = relationship(
        "AnalysisFile",
        back_populates="analysis",
        cascade="all, delete-orphan",
    )
    biomarkers: Mapped[list["UserBiomarker"]] = relationship(
        "UserBiomarker",
        back_populates="analysis",
        cascade="all, delete-orphan",
    )


class AnalysisFile(Base):
    """
    Uploaded file for an analysis.
    One analysis can have multiple files (e.g., multi-page PDF as images).
    """
    
    __tablename__ = "analysis_files"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    analysis_id: Mapped[int] = mapped_column(
        ForeignKey("analyses.id", ondelete="CASCADE"),
        index=True,
    )
    
    # File info
    filename: Mapped[str] = mapped_column(String(255))
    original_filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[int] = mapped_column(Integer)
    file_path: Mapped[str] = mapped_column(String(500))
    
    # Processing
    page_number: Mapped[int] = mapped_column(Integer, default=1)
    ocr_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    
    # Relationships
    analysis: Mapped["Analysis"] = relationship("Analysis", back_populates="files")



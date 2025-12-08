"""
Biomarker schemas for health indicators.
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel

from app.schemas.base import BaseSchema
from app.models.biomarker import BiomarkerCategory, BiomarkerStatus


class BiomarkerResponse(BaseSchema):
    """Biomarker dictionary entry."""
    
    id: int
    code: str
    name_ru: str
    name_en: Optional[str] = None
    category: BiomarkerCategory
    default_unit: str
    description: Optional[str] = None


class BiomarkerReferenceResponse(BaseSchema):
    """Reference range for a biomarker."""
    
    id: int
    gender: Optional[str] = None
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    ref_min: Optional[float] = None
    ref_max: Optional[float] = None
    optimal_min: Optional[float] = None
    optimal_max: Optional[float] = None
    unit: str


class UserBiomarkerResponse(BaseSchema):
    """User's biomarker value."""
    
    id: int
    user_id: int
    analysis_id: int
    biomarker_id: int
    
    # Biomarker info
    biomarker_code: str
    biomarker_name: str
    biomarker_category: BiomarkerCategory
    
    # Value
    value: float
    unit: str
    status: BiomarkerStatus
    ref_min: Optional[float] = None
    ref_max: Optional[float] = None
    
    # Metadata
    raw_name: Optional[str] = None
    measured_at: Optional[datetime] = None
    created_at: datetime


class BiomarkerHistoryPoint(BaseModel):
    """Single point in biomarker history."""
    
    date: datetime
    value: float
    status: BiomarkerStatus
    analysis_id: int


class BiomarkerHistoryResponse(BaseSchema):
    """Biomarker history with trend."""
    
    biomarker_code: str
    biomarker_name: str
    unit: str
    ref_min: Optional[float] = None
    ref_max: Optional[float] = None
    
    # Current value
    current_value: Optional[float] = None
    current_status: Optional[BiomarkerStatus] = None
    current_date: Optional[datetime] = None
    
    # Trend
    trend: str = "stable"  # "improving", "worsening", "stable"
    change_percent: Optional[float] = None
    
    # History
    history: List[BiomarkerHistoryPoint] = []


class BiomarkerSummary(BaseModel):
    """Summary of all user's biomarkers."""
    
    total_biomarkers: int = 0
    normal_count: int = 0
    low_count: int = 0
    high_count: int = 0
    critical_count: int = 0
    
    # Lists of biomarker codes
    low_biomarkers: List[str] = []
    high_biomarkers: List[str] = []
    critical_biomarkers: List[str] = []



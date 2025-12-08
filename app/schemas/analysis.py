"""
Analysis schemas for file upload and processing results.
"""

from datetime import datetime, date
from typing import Optional, List

from pydantic import BaseModel, Field

from app.schemas.base import BaseSchema, PaginatedResponse
from app.models.analysis import AnalysisStatus, AnalysisType, LabProvider


class AnalysisCreate(BaseModel):
    """Create analysis request (metadata only, files uploaded separately)."""
    
    title: Optional[str] = Field("Анализ", max_length=255)
    analysis_type: AnalysisType = AnalysisType.OTHER
    lab_provider: Optional[LabProvider] = None
    lab_name: Optional[str] = Field(None, max_length=255)
    analysis_date: Optional[date] = None


class AnalysisUpdate(BaseModel):
    """Update analysis metadata."""
    
    title: Optional[str] = Field(None, max_length=255)
    analysis_type: Optional[AnalysisType] = None
    lab_provider: Optional[LabProvider] = None
    lab_name: Optional[str] = Field(None, max_length=255)
    analysis_date: Optional[date] = None


class AnalysisFileResponse(BaseSchema):
    """Uploaded file info."""
    
    id: int
    filename: str
    original_filename: str
    content_type: str
    file_size: int
    page_number: int
    created_at: datetime


class AnalysisBiomarkerResponse(BaseSchema):
    """Biomarker result within analysis."""
    
    id: int
    biomarker_code: str
    biomarker_name: str
    value: float
    unit: str
    status: str
    ref_min: Optional[float] = None
    ref_max: Optional[float] = None
    raw_name: Optional[str] = None


class AnalysisResponse(BaseSchema):
    """Full analysis response with biomarkers."""
    
    id: int
    user_id: int
    title: str
    analysis_type: AnalysisType
    lab_provider: Optional[LabProvider] = None
    lab_name: Optional[str] = None
    analysis_date: Optional[datetime] = None
    status: AnalysisStatus
    error_message: Optional[str] = None
    ai_summary: Optional[str] = None
    ai_recommendations: Optional[dict] = None
    created_at: datetime
    updated_at: datetime
    processed_at: Optional[datetime] = None
    
    # Related data
    files: List[AnalysisFileResponse] = []
    biomarkers: List[AnalysisBiomarkerResponse] = []
    biomarkers_count: int = 0
    out_of_range_count: int = 0


class AnalysisListItem(BaseSchema):
    """Analysis list item (summary)."""
    
    id: int
    title: str
    analysis_type: AnalysisType
    lab_provider: Optional[LabProvider] = None
    analysis_date: Optional[datetime] = None
    status: AnalysisStatus
    biomarkers_count: int = 0
    out_of_range_count: int = 0
    created_at: datetime


class AnalysisListResponse(PaginatedResponse):
    """Paginated list of analyses."""
    
    items: List[AnalysisListItem]


class AnalysisUploadResponse(BaseModel):
    """Response after file upload."""
    
    analysis_id: int
    file_id: int
    filename: str
    status: str = "uploaded"
    message: str = "Файл загружен и поставлен в очередь на обработку"


class AnalysisProcessingStatus(BaseModel):
    """Processing status response."""
    
    analysis_id: int
    status: AnalysisStatus
    progress: int = Field(0, ge=0, le=100)
    message: Optional[str] = None
    biomarkers_found: int = 0



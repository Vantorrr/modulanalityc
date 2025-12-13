"""
Biomarker schemas for biomarker table view.
"""

from datetime import datetime, date
from typing import Optional, List

from pydantic import BaseModel, Field

from app.schemas.base import BaseSchema, PaginatedResponse
from app.models.biomarker import BiomarkerCategory, BiomarkerStatus


class BiomarkerValueCreate(BaseModel):
    """Ручное добавление значения биомаркера."""
    
    value: float = Field(..., description="Значение показателя")
    unit: str = Field(..., max_length=50, description="Единица измерения")
    measured_at: date = Field(..., description="Дата измерения")
    ref_min: Optional[float] = Field(None, description="Минимум референса")
    ref_max: Optional[float] = Field(None, description="Максимум референса")
    lab_name: Optional[str] = Field(None, max_length=100, description="Название лаборатории")


class BiomarkerValueUpdate(BaseModel):
    """Обновление значения биомаркера."""
    
    value: Optional[float] = None
    unit: Optional[str] = Field(None, max_length=50)
    measured_at: Optional[date] = None
    ref_min: Optional[float] = None
    ref_max: Optional[float] = None


class BiomarkerHistoryItem(BaseSchema):
    """История значений биомаркера."""
    
    id: int
    value: float
    unit: str
    status: str
    ref_min: Optional[float] = None
    ref_max: Optional[float] = None
    measured_at: Optional[datetime] = None
    analysis_id: Optional[int] = None  # None if manually added
    analysis_title: Optional[str] = None
    lab_name: Optional[str] = None  # Название лаборатории
    created_at: datetime


class BiomarkerListItem(BaseSchema):
    """Биомаркер в таблице анализов."""
    
    code: str
    name: str
    category: BiomarkerCategory
    unit: str
    
    # Последнее значение
    last_value: Optional[float] = None
    last_status: Optional[str] = None
    last_measured_at: Optional[datetime] = None
    last_ref_min: Optional[float] = None
    last_ref_max: Optional[float] = None
    
    # Статистика
    total_measurements: int = 0
    first_measured_at: Optional[datetime] = None


class BiomarkerListResponse(BaseSchema):
    """Список биомаркеров, сгруппированных по категориям."""
    
    items: List[BiomarkerListItem]
    total: int


class BiomarkerDetailResponse(BaseSchema):
    """Детальная информация о биомаркере."""
    
    code: str
    name: str
    category: BiomarkerCategory
    description: Optional[str] = None
    unit: str
    
    # История значений
    history: List[BiomarkerHistoryItem]
    
    # Статистика
    total_measurements: int = 0
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    avg_value: Optional[float] = None
    first_measured_at: Optional[datetime] = None
    last_measured_at: Optional[datetime] = None


class BiomarkerValueResponse(BaseSchema):
    """Ответ после добавления/обновления значения."""
    
    id: int
    biomarker_code: str
    biomarker_name: str
    value: float
    unit: str
    status: str
    ref_min: Optional[float] = None
    ref_max: Optional[float] = None
    measured_at: Optional[datetime] = None
    created_at: datetime



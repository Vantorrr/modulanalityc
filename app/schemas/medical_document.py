"""
Pydantic schemas for Medical Document (Medcard)
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

from app.models.medical_document import DocumentCategory


class MedicalDocumentBase(BaseModel):
    """Base schema for medical document"""
    title: str = Field(..., min_length=1, max_length=255, description="Название документа")
    description: Optional[str] = Field(None, max_length=2000, description="Краткое описание")
    tags: Optional[str] = Field(None, max_length=500, description="Теги через запятую")
    category: DocumentCategory = Field(..., description="Категория документа")
    visit_date: Optional[datetime] = Field(None, description="Дата визита/обследования")


class MedicalDocumentCreate(MedicalDocumentBase):
    """Schema for creating a medical document"""
    pass


class MedicalDocumentUpdate(BaseModel):
    """Schema for updating medical document metadata"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    tags: Optional[str] = Field(None, max_length=500)
    category: Optional[DocumentCategory] = None
    visit_date: Optional[datetime] = None


class MedicalDocumentResponse(MedicalDocumentBase):
    """Schema for medical document response"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    user_id: int
    file_name: str
    file_type: str
    file_size: int
    created_at: datetime
    updated_at: datetime


class MedicalDocumentList(BaseModel):
    """Schema for paginated list of documents"""
    total: int
    items: list[MedicalDocumentResponse]
    category_filter: Optional[DocumentCategory] = None




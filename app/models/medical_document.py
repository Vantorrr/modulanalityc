"""
Medical Document model - for storing arbitrary medical documents (медкарта)
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.core.database import Base


class DocumentCategory(str, Enum):
    """Categories of medical documents"""
    ANALYSIS = "analysis"  # Анализы
    CONSULTATION = "consultation"  # Консультации врачей
    EXAMINATION = "examination"  # Исследования (УЗИ, МРТ и т.д.)
    OTHER = "other"  # Прочие документы


class MedicalDocument(Base):
    """Medical document storage (medcard)"""
    __tablename__ = "medical_documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # File info
    category = Column(SQLEnum(DocumentCategory), nullable=False, default=DocumentCategory.OTHER)
    title = Column(String(255), nullable=False)  # Название документа
    description = Column(Text, nullable=True)  # Краткое описание от пользователя
    tags = Column(String(500), nullable=True)  # Теги через запятую
    
    file_path = Column(String(500), nullable=False)  # Путь к файлу
    file_name = Column(String(255), nullable=False)  # Оригинальное имя файла
    file_type = Column(String(50), nullable=False)  # MIME type (application/pdf, image/jpeg)
    file_size = Column(Integer, nullable=False)  # Размер в байтах
    
    # Dates
    visit_date = Column(DateTime, nullable=True)  # Дата визита/обследования
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="medical_documents")

    def __repr__(self):
        return f"<MedicalDocument(id={self.id}, category={self.category}, title={self.title})>"




from sqlalchemy import Column, Integer, String, ForeignKey, JSON, DateTime
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.sql import func
from app.core.database import Base
from typing import Optional
from datetime import datetime

class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)

    # Sections as JSON for flexibility
    body_parameters = Column(JSON, default={}, comment="Рост, вес, ИМТ и т.д.")
    gender_health = Column(JSON, default={}, comment="Мужское/Женское здоровье")
    medical_history = Column(JSON, default=[], comment="История болезней")
    allergies = Column(JSON, default=[], comment="Аллергические реакции")
    chronic_diseases = Column(JSON, default=[], comment="Хронические заболевания")
    hereditary_diseases = Column(JSON, default=[], comment="Наследственные заболевания")
    lifestyle = Column(JSON, default={}, comment="Образ жизни (спорт, курение, диета)")
    additional_info = Column(JSON, default={}, comment="Дополнительная информация")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # Relationship
    user = relationship("User", back_populates="profile")


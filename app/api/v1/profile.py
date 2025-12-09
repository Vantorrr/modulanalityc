from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_async_session
from app.core.security import get_current_user
from app.models.user import User
from app.models.patient_profile import PatientProfile
from pydantic import BaseModel, ConfigDict

router = APIRouter()

class ProfileUpdate(BaseModel):
    body_parameters: dict[str, Any] | None = None
    gender_health: dict[str, Any] | None = None
    medical_history: list[Any] | None = None
    allergies: list[Any] | None = None
    chronic_diseases: list[Any] | None = None
    hereditary_diseases: list[Any] | None = None
    lifestyle: dict[str, Any] | None = None
    additional_info: dict[str, Any] | None = None

class ProfileResponse(ProfileUpdate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int

@router.get("/", response_model=ProfileResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Get current user's medical profile."""
    stmt = select(PatientProfile).where(PatientProfile.user_id == current_user.id)
    result = await session.execute(stmt)
    profile = result.scalar_one_or_none()
    
    if not profile:
        # Create empty profile if not exists
        profile = PatientProfile(user_id=current_user.id)
        session.add(profile)
        await session.commit()
        await session.refresh(profile)
        
    return profile

@router.put("/", response_model=ProfileResponse)
async def update_my_profile(
    profile_data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Update medical profile."""
    stmt = select(PatientProfile).where(PatientProfile.user_id == current_user.id)
    result = await session.execute(stmt)
    profile = result.scalar_one_or_none()
    
    if not profile:
        profile = PatientProfile(user_id=current_user.id)
        session.add(profile)
    
    # Update fields
    for field, value in profile_data.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
        
    await session.commit()
    await session.refresh(profile)
    return profile


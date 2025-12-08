"""
Medical Card API - storage for arbitrary medical documents
"""

import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.medical_document import MedicalDocument, DocumentCategory
from app.schemas.medical_document import (
    MedicalDocumentCreate,
    MedicalDocumentUpdate,
    MedicalDocumentResponse,
    MedicalDocumentList,
)

router = APIRouter(prefix="/medcard", tags=["Медкарта"])

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/upload", response_model=MedicalDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(..., description="Файл документа (PDF, JPG, PNG)"),
    title: str = Form(..., description="Название документа"),
    category: DocumentCategory = Form(..., description="Категория документа"),
    description: Optional[str] = Form(None, description="Краткое описание"),
    tags: Optional[str] = Form(None, description="Теги через запятую"),
    visit_date: Optional[str] = Form(None, description="Дата визита (ISO format)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Загрузка произвольного медицинского документа.
    
    Поддерживаемые форматы: PDF, JPG, PNG
    Максимальный размер: 10 МБ
    """
    # Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Неподдерживаемый формат файла. Разрешены: {', '.join(ALLOWED_EXTENSIONS)}",
        )
    
    # Read file content
    content = await file.read()
    file_size = len(content)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Файл слишком большой. Максимум {MAX_FILE_SIZE // (1024*1024)} МБ",
        )
    
    # Generate unique filename
    timestamp = int(datetime.utcnow().timestamp())
    safe_filename = f"{current_user.id}_{timestamp}_{file.filename}"
    file_path = Path(settings.upload_dir) / "medcard" / safe_filename
    file_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Parse visit_date if provided
    parsed_visit_date = None
    if visit_date:
        from datetime import datetime as dt
        try:
            parsed_visit_date = dt.fromisoformat(visit_date.replace("Z", "+00:00"))
        except ValueError:
            pass
    
    # Create database record
    document = MedicalDocument(
        user_id=current_user.id,
        title=title,
        description=description,
        tags=tags,
        category=category,
        file_path=str(file_path),
        file_name=file.filename,
        file_type=file.content_type or "application/octet-stream",
        file_size=file_size,
        visit_date=parsed_visit_date,
    )
    
    db.add(document)
    await db.commit()
    await db.refresh(document)
    
    return document


@router.get("", response_model=MedicalDocumentList)
async def get_documents(
    category: Optional[DocumentCategory] = Query(None, description="Фильтр по категории"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Получить список документов пользователя.
    
    Поддерживается фильтрация по категории и пагинация.
    """
    # Build query
    query = select(MedicalDocument).where(MedicalDocument.user_id == current_user.id)
    
    if category:
        query = query.where(MedicalDocument.category == category)
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0
    
    # Get documents
    query = query.order_by(MedicalDocument.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    documents = result.scalars().all()
    
    return MedicalDocumentList(
        total=total,
        items=documents,
        category_filter=category,
    )


@router.get("/{document_id}", response_model=MedicalDocumentResponse)
async def get_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Получить информацию о документе по ID."""
    result = await db.execute(
        select(MedicalDocument).where(
            MedicalDocument.id == document_id,
            MedicalDocument.user_id == current_user.id,
        )
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Документ не найден",
        )
    
    return document


@router.put("/{document_id}", response_model=MedicalDocumentResponse)
async def update_document(
    document_id: int,
    data: MedicalDocumentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Обновить метаданные документа (название, описание, теги, категорию, дату визита)."""
    result = await db.execute(
        select(MedicalDocument).where(
            MedicalDocument.id == document_id,
            MedicalDocument.user_id == current_user.id,
        )
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Документ не найден",
        )
    
    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(document, field, value)
    
    await db.commit()
    await db.refresh(document)
    
    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Удалить документ (файл + запись в БД)."""
    result = await db.execute(
        select(MedicalDocument).where(
            MedicalDocument.id == document_id,
            MedicalDocument.user_id == current_user.id,
        )
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Документ не найден",
        )
    
    # Delete file from disk
    file_path = Path(document.file_path)
    if file_path.exists():
        file_path.unlink()
    
    # Delete from DB
    await db.delete(document)
    await db.commit()
    
    return None


@router.get("/{document_id}/download")
async def download_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Скачать файл документа."""
    result = await db.execute(
        select(MedicalDocument).where(
            MedicalDocument.id == document_id,
            MedicalDocument.user_id == current_user.id,
        )
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Документ не найден",
        )
    
    file_path = Path(document.file_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден на диске",
        )
    
    return FileResponse(
        path=str(file_path),
        filename=document.file_name,
        media_type=document.file_type,
    )


@router.get("/{document_id}/view")
async def view_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Просмотр документа (inline в браузере).
    
    Для PDF/изображений отображается встроенным просмотрщиком браузера.
    """
    result = await db.execute(
        select(MedicalDocument).where(
            MedicalDocument.id == document_id,
            MedicalDocument.user_id == current_user.id,
        )
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Документ не найден",
        )
    
    file_path = Path(document.file_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден на диске",
        )
    
    return FileResponse(
        path=str(file_path),
        media_type=document.file_type,
        headers={"Content-Disposition": f"inline; filename={document.file_name}"},
    )


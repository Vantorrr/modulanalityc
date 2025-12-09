"""
Analysis API endpoints for uploading and managing medical analyses.
"""

import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Query, BackgroundTasks
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_async_session
from app.core.security import CurrentUserID
from app.models.analysis import Analysis, AnalysisFile, AnalysisStatus, AnalysisType, LabProvider
from app.models.biomarker import UserBiomarker, Biomarker, BiomarkerReference, BiomarkerStatus
from app.models.user import User
from app.schemas.analysis import (
    AnalysisCreate,
    AnalysisUpdate,
    AnalysisResponse,
    AnalysisListResponse,
    AnalysisListItem,
    AnalysisUploadResponse,
    AnalysisProcessingStatus,
    AnalysisBiomarkerResponse,
    AnalysisFileResponse,
)
from app.services.ocr import OCRService, OCRError
from app.services.ai_parser import AIParserService
from app.services.recommendations import RecommendationService

router = APIRouter()


async def process_analysis_file(
    analysis_id: int,
    file_id: int,
    db: AsyncSession,
):
    """
    Background task to process uploaded file with OCR and AI.
    """
    ocr_service = OCRService()
    ai_parser = AIParserService()
    
    try:
        # Get analysis and file
        analysis = await db.get(Analysis, analysis_id)
        file_record = await db.get(AnalysisFile, file_id)
        
        if not analysis or not file_record:
            return
        
        # Update status
        analysis.status = AnalysisStatus.PROCESSING
        await db.flush()
        
        # Run OCR
        with open(file_record.file_path, "rb") as f:
            file_bytes = f.read()
        
        ocr_text, confidence = await ocr_service.extract_text_from_bytes(
            file_bytes,
            file_record.content_type,
        )
        
        # Save OCR result
        file_record.ocr_text = ocr_text
        analysis.raw_text = (analysis.raw_text or "") + f"\n\n{ocr_text}"
        await db.flush()
        
        # Parse with AI
        extracted_data = await ai_parser.extract_biomarkers(
            ocr_text,
            analysis.lab_provider,
        )
        
        # Update analysis metadata if found
        if extracted_data.get("lab_name") and not analysis.lab_name:
            analysis.lab_name = extracted_data["lab_name"]
        
        if extracted_data.get("analysis_date") and not analysis.analysis_date:
            try:
                analysis.analysis_date = datetime.strptime(
                    extracted_data["analysis_date"],
                    "%Y-%m-%d"
                )
            except ValueError:
                pass
        
        # Get user for reference ranges
        user = await db.get(User, analysis.user_id)
        
        # Process biomarkers
        for bio_data in extracted_data.get("biomarkers", []):
            # Find or skip unknown biomarker
            stmt = select(Biomarker).where(Biomarker.code == bio_data["code"])
            result = await db.execute(stmt)
            biomarker = result.scalar_one_or_none()
            
            if not biomarker:
                # Create new biomarker entry
                biomarker = Biomarker(
                    code=bio_data["code"],
                    name_ru=bio_data.get("raw_name", bio_data["code"]),
                    default_unit=bio_data.get("unit", ""),
                )
                db.add(biomarker)
                await db.flush()
            
            # Get reference range
            ref_min = bio_data.get("ref_min")
            ref_max = bio_data.get("ref_max")
            
            if not ref_min or not ref_max:
                # Try to get from database
                ref_stmt = (
                    select(BiomarkerReference)
                    .where(BiomarkerReference.biomarker_id == biomarker.id)
                )
                
                if user and user.gender:
                    ref_stmt = ref_stmt.where(
                        (BiomarkerReference.gender == user.gender.value) |
                        (BiomarkerReference.gender == None)
                    )
                
                if user and user.age:
                    ref_stmt = ref_stmt.where(
                        (BiomarkerReference.age_min <= user.age) |
                        (BiomarkerReference.age_min == None)
                    ).where(
                        (BiomarkerReference.age_max >= user.age) |
                        (BiomarkerReference.age_max == None)
                    )
                
                ref_result = await db.execute(ref_stmt)
                reference = ref_result.scalar_one_or_none()
                
                if reference:
                    ref_min = ref_min or reference.ref_min
                    ref_max = ref_max or reference.ref_max
            
            # Determine status
            value = bio_data["value"]
            status = BiomarkerStatus.NORMAL
            
            if ref_min is not None and ref_max is not None:
                if value < ref_min:
                    status = BiomarkerStatus.LOW
                elif value > ref_max:
                    status = BiomarkerStatus.HIGH
            
            # Create user biomarker
            user_biomarker = UserBiomarker(
                user_id=analysis.user_id,
                analysis_id=analysis_id,
                biomarker_id=biomarker.id,
                value=value,
                unit=bio_data.get("unit", biomarker.default_unit),
                status=status,
                ref_min=ref_min,
                ref_max=ref_max,
                raw_name=bio_data.get("raw_name"),
                raw_value=str(value),
                measured_at=analysis.analysis_date,
            )
            db.add(user_biomarker)
        
        await db.flush()
        
        # Generate AI summary
        biomarkers_data = []
        stmt = (
            select(UserBiomarker)
            .options(selectinload(UserBiomarker.biomarker))
            .where(UserBiomarker.analysis_id == analysis_id)
        )
        result = await db.execute(stmt)
        user_biomarkers = result.scalars().all()
        
        for ub in user_biomarkers:
            biomarkers_data.append({
                "code": ub.biomarker.code,
                "name": ub.biomarker.name_ru,
                "value": ub.value,
                "unit": ub.unit,
                "status": ub.status.value,
                "ref_min": ub.ref_min,
                "ref_max": ub.ref_max,
            })
        
        summary = await ai_parser.generate_summary(
            biomarkers_data,
            user.gender.value if user and user.gender else None,
            user.age if user else None,
        )
        
        analysis.ai_summary = summary
        analysis.status = AnalysisStatus.COMPLETED
        analysis.processed_at = datetime.utcnow()
        
        await db.flush()
        
        # Generate recommendations
        recommendation_service = RecommendationService(db)
        await recommendation_service.generate_recommendations_for_analysis(
            analysis_id,
            analysis.user_id,
        )
        
        await db.commit()
        
    except OCRError as e:
        analysis = await db.get(Analysis, analysis_id)
        if analysis:
            analysis.status = AnalysisStatus.FAILED
            analysis.error_message = str(e)
            await db.commit()
    except Exception as e:
        analysis = await db.get(Analysis, analysis_id)
        if analysis:
            analysis.status = AnalysisStatus.FAILED
            analysis.error_message = f"Ошибка обработки: {str(e)}"
            await db.commit()


@router.post(
    "/upload",
    response_model=AnalysisUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Загрузка анализа",
)
async def upload_analysis(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Query(None, description="Название анализа"),
    analysis_type: AnalysisType = Query(AnalysisType.OTHER, description="Тип анализа"),
    lab_provider: Optional[LabProvider] = Query(None, description="Лаборатория"),
    user_id: int = Depends(CurrentUserID),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Загрузка файла с результатами анализов.
    
    Поддерживаемые форматы:
    - **PDF**: Скан или электронный документ
    - **JPG/JPEG**: Фото бланка
    - **PNG**: Скриншот или фото
    
    После загрузки файл автоматически обрабатывается:
    1. OCR распознавание текста
    2. AI извлечение биомаркеров
    3. Генерация рекомендаций
    
    Статус обработки можно отслеживать через `/analyses/{id}/status`
    """
    # Validate file
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Файл не выбран",
        )
    
    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in settings.allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Неподдерживаемый формат файла. Разрешены: {', '.join(settings.allowed_extensions)}",
        )
    
    # Check file size
    content = await file.read()
    if len(content) > settings.max_upload_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Файл слишком большой. Максимум: {settings.max_upload_size // 1024 // 1024}MB",
        )
    
    # Create analysis record
    analysis = Analysis(
        user_id=user_id,
        title=title or f"Анализ от {datetime.now().strftime('%d.%m.%Y')}",
        analysis_type=analysis_type,
        lab_provider=lab_provider,
        status=AnalysisStatus.PENDING,
    )
    db.add(analysis)
    await db.flush()
    
    # Save file
    upload_dir = Path(settings.upload_dir) / str(user_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    filename = f"{uuid.uuid4()}.{ext}"
    file_path = upload_dir / filename
    
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Create file record
    analysis_file = AnalysisFile(
        analysis_id=analysis.id,
        filename=filename,
        original_filename=file.filename,
        content_type=file.content_type or f"image/{ext}",
        file_size=len(content),
        file_path=str(file_path),
    )
    db.add(analysis_file)
    await db.flush()
    
    await db.commit()
    
    # Start background processing
    background_tasks.add_task(
        process_analysis_file,
        analysis.id,
        analysis_file.id,
        db,
    )
    
    return AnalysisUploadResponse(
        analysis_id=analysis.id,
        file_id=analysis_file.id,
        filename=file.filename,
    )


@router.get(
    "",
    response_model=AnalysisListResponse,
    summary="Список анализов",
)
async def list_analyses(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    analysis_type: Optional[AnalysisType] = None,
    user_id: int = Depends(CurrentUserID),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Получение списка анализов пользователя с пагинацией.
    
    Можно фильтровать по типу анализа.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"Getting analyses for user_id={user_id}, page={page}")
        
        # Base query
        conditions = [Analysis.user_id == user_id]
        
        if analysis_type:
            conditions.append(Analysis.analysis_type == analysis_type)
        
        # Count total
        count_stmt = select(func.count(Analysis.id)).where(and_(*conditions))
        total = (await db.execute(count_stmt)).scalar() or 0
        logger.info(f"Total analyses: {total}")
        
        # Get items
        stmt = (
            select(Analysis)
            .where(and_(*conditions))
            .order_by(Analysis.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await db.execute(stmt)
        analyses = result.scalars().all()
        
        # Get biomarker counts
        items = []
        for analysis in analyses:
            bio_count_stmt = (
                select(func.count(UserBiomarker.id))
                .where(UserBiomarker.analysis_id == analysis.id)
            )
            bio_count = (await db.execute(bio_count_stmt)).scalar() or 0
            
            out_of_range_stmt = (
                select(func.count(UserBiomarker.id))
                .where(
                    UserBiomarker.analysis_id == analysis.id,
                    UserBiomarker.status.in_([
                        BiomarkerStatus.LOW,
                        BiomarkerStatus.HIGH,
                        BiomarkerStatus.CRITICAL_LOW,
                        BiomarkerStatus.CRITICAL_HIGH,
                    ])
                )
            )
            out_of_range = (await db.execute(out_of_range_stmt)).scalar() or 0
            
            items.append(AnalysisListItem(
                id=analysis.id,
                title=analysis.title,
                analysis_type=analysis.analysis_type,
                lab_provider=analysis.lab_provider,
                analysis_date=analysis.analysis_date,
                status=analysis.status,
                biomarkers_count=bio_count,
                out_of_range_count=out_of_range,
                created_at=analysis.created_at,
            ))
        
        logger.info(f"Returning {len(items)} analyses")
        return AnalysisListResponse(
            total=total,
            page=page,
            page_size=page_size,
            pages=(total + page_size - 1) // page_size if page_size > 0 else 0,
            items=items,
        )
    except Exception as e:
        logger.exception(f"Error getting analyses: {e}")
        raise


@router.get(
    "/{analysis_id}",
    response_model=AnalysisResponse,
    summary="Детали анализа",
)
async def get_analysis(
    analysis_id: int,
    user_id: int = Depends(CurrentUserID),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Получение полной информации об анализе, включая все биомаркеры.
    """
    stmt = (
        select(Analysis)
        .options(
            selectinload(Analysis.files),
            selectinload(Analysis.biomarkers).selectinload(UserBiomarker.biomarker),
        )
        .where(
            Analysis.id == analysis_id,
            Analysis.user_id == user_id,
        )
    )
    result = await db.execute(stmt)
    analysis = result.scalar_one_or_none()
    
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Анализ не найден",
        )
    
    # Format response
    biomarkers = [
        AnalysisBiomarkerResponse(
            id=ub.id,
            biomarker_code=ub.biomarker.code,
            biomarker_name=ub.biomarker.name_ru,
            value=ub.value,
            unit=ub.unit,
            status=ub.status.value,
            ref_min=ub.ref_min,
            ref_max=ub.ref_max,
            raw_name=ub.raw_name,
        )
        for ub in analysis.biomarkers
    ]
    
    out_of_range = sum(
        1 for b in biomarkers
        if b.status in ("low", "high", "critical_low", "critical_high")
    )
    
    files = [
        AnalysisFileResponse(
            id=f.id,
            filename=f.filename,
            original_filename=f.original_filename,
            content_type=f.content_type,
            file_size=f.file_size,
            page_number=f.page_number,
            created_at=f.created_at,
        )
        for f in analysis.files
    ]
    
    return AnalysisResponse(
        id=analysis.id,
        user_id=analysis.user_id,
        title=analysis.title,
        analysis_type=analysis.analysis_type,
        lab_provider=analysis.lab_provider,
        lab_name=analysis.lab_name,
        analysis_date=analysis.analysis_date,
        status=analysis.status,
        error_message=analysis.error_message,
        ai_summary=analysis.ai_summary,
        ai_recommendations=analysis.ai_recommendations,
        created_at=analysis.created_at,
        updated_at=analysis.updated_at,
        processed_at=analysis.processed_at,
        files=files,
        biomarkers=biomarkers,
        biomarkers_count=len(biomarkers),
        out_of_range_count=out_of_range,
    )


@router.get(
    "/{analysis_id}/status",
    response_model=AnalysisProcessingStatus,
    summary="Статус обработки",
)
async def get_analysis_status(
    analysis_id: int,
    user_id: int = Depends(CurrentUserID),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Получение текущего статуса обработки анализа.
    
    Используйте для polling после загрузки файла.
    """
    stmt = select(Analysis).where(
        Analysis.id == analysis_id,
        Analysis.user_id == user_id,
    )
    result = await db.execute(stmt)
    analysis = result.scalar_one_or_none()
    
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Анализ не найден",
        )
    
    # Calculate progress
    progress_map = {
        AnalysisStatus.PENDING: 0,
        AnalysisStatus.PROCESSING: 50,
        AnalysisStatus.COMPLETED: 100,
        AnalysisStatus.FAILED: 100,
        AnalysisStatus.MANUAL_REVIEW: 80,
    }
    
    # Count biomarkers
    bio_count_stmt = (
        select(func.count(UserBiomarker.id))
        .where(UserBiomarker.analysis_id == analysis_id)
    )
    biomarkers_found = (await db.execute(bio_count_stmt)).scalar() or 0
    
    return AnalysisProcessingStatus(
        analysis_id=analysis.id,
        status=analysis.status,
        progress=progress_map.get(analysis.status, 0),
        message=analysis.error_message,
        biomarkers_found=biomarkers_found,
    )


@router.delete(
    "/{analysis_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удаление анализа",
)
async def delete_analysis(
    analysis_id: int,
    user_id: int = Depends(CurrentUserID),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Удаление анализа и всех связанных данных (файлы, биомаркеры, рекомендации).
    """
    stmt = select(Analysis).where(
        Analysis.id == analysis_id,
        Analysis.user_id == user_id,
    )
    result = await db.execute(stmt)
    analysis = result.scalar_one_or_none()
    
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Анализ не найден",
        )
    
    # Delete files from disk
    files_stmt = select(AnalysisFile).where(AnalysisFile.analysis_id == analysis_id)
    files_result = await db.execute(files_stmt)
    files = files_result.scalars().all()
    
    for file_record in files:
        try:
            os.unlink(file_record.file_path)
        except OSError:
            pass
    
    # Delete analysis (cascade will delete files, biomarkers, recommendations)
    await db.delete(analysis)
    await db.commit()




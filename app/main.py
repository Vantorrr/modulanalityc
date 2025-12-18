"""
Medical Analysis API - Main Application Entry Point
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import engine
from app.api.v1 import api_router

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    logger.info(f"Starting {settings.app_name}")
    
    # Create upload directory
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"Upload directory: {upload_dir.absolute()}")
    
    # Create demo user if not exists
    await create_demo_user()
    
    # HOTFIX: Ensure DB schema is correct (Railway workaround)
    await ensure_db_schema()
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    await engine.dispose()


async def create_demo_user():
    """Create demo user for testing if not exists."""
    from app.core.database import async_session_maker, Base, engine
    from app.models.user import User
    from app.core.security import get_password_hash
    from sqlalchemy import select
    
    try:
        # Ensure tables exist (for fresh deployments)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        async with async_session_maker() as session:
            # Check if demo user exists
            result = await session.execute(select(User).where(User.id == 1))
            user = result.scalar_one_or_none()
            
            if not user:
                demo_user = User(
                    id=1,
                    email="demo@healthtracker.app",
                    hashed_password=get_password_hash("demo123"),
                    first_name="Демо",
                    last_name="Пользователь",
                    is_active=True,
                    is_verified=True,
                )
                session.add(demo_user)
                await session.commit()
                logger.info("Demo user created (id=1)")
            else:
                logger.info("Demo user already exists")
    except Exception as e:
        logger.warning(f"Could not create demo user: {e}")


async def ensure_db_schema():
    """Ensure database schema is up to date (HOTFIX for Railway)."""
    from app.core.database import engine
    from sqlalchemy import text
    
    try:
        async with engine.begin() as conn:
            logger.info("🔧 Checking DB schema...")
            # Try to make analysis_id nullable. This is idempotent in Postgres (mostly) 
            # or harmless if it fails due to other reasons.
            await conn.execute(text("ALTER TABLE user_biomarkers ALTER COLUMN analysis_id DROP NOT NULL"))
            logger.info("✅ HOTFIX APPLIED: user_biomarkers.analysis_id is now nullable")
            
            # Add lab_name column if not exists
            await conn.execute(text("""
                ALTER TABLE user_biomarkers 
                ADD COLUMN IF NOT EXISTS lab_name VARCHAR(100)
            """))
            logger.info("✅ Added lab_name column to user_biomarkers")
            
            # Make biomarkers.default_unit nullable (HOTFIX for AI extraction without units)
            await conn.execute(text("ALTER TABLE biomarkers ALTER COLUMN default_unit DROP NOT NULL"))
            logger.info("✅ HOTFIX APPLIED: biomarkers.default_unit is now nullable")
    except Exception as e:
        # It's okay if it fails (e.g. table doesn't exist yet, handled by migrations)
        logger.warning(f"Schema hotfix note: {e}")
    
    # Add new biomarker category enum values (HOTFIX for Railway migration issues)
    await add_biomarker_category_enums()
    
    # Update biomarker categories
    await update_biomarker_categories()


async def add_biomarker_category_enums():
    """Add new biomarker category enum values if they don't exist."""
    from app.core.database import engine
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine
    
    new_categories = [
        'gastrointestinal', 'bone', 'musculoskeletal', 'adrenal',
        'nervous', 'pancreas', 'parathyroid', 'cardiovascular',
        'reproductive', 'urinary', 'immune', 'coagulation'
    ]
    
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction!
    # Create a new engine with isolation_level AUTOCOMMIT
    try:
        autocommit_engine = create_async_engine(
            str(engine.url),
            isolation_level="AUTOCOMMIT"
        )
        
        async with autocommit_engine.connect() as conn:
            for category in new_categories:
                try:
                    await conn.execute(text(f"ALTER TYPE biomarkercategory ADD VALUE IF NOT EXISTS '{category}'"))
                    logger.info(f"  + Added enum value: {category}")
                except Exception as e:
                    # Value might already exist or other error - continue
                    if 'already exists' not in str(e).lower() and 'duplicate' not in str(e).lower():
                        logger.warning(f"  Could not add {category}: {e}")
            
        await autocommit_engine.dispose()
        logger.info(f"✅ Biomarker category enum values checked/added")
    except Exception as e:
        logger.warning(f"Could not add biomarker category enums: {e}")


async def update_biomarker_categories():
    """Update categories for existing biomarkers based on their names."""
    from app.core.database import async_session_maker
    from app.models.biomarker import Biomarker, BiomarkerCategory
    from app.api.v1.analyses import detect_biomarker_category
    from sqlalchemy import select, update
    
    try:
        async with async_session_maker() as session:
            # Get all biomarkers with OTHER category
            stmt = select(Biomarker).where(Biomarker.category == BiomarkerCategory.OTHER)
            result = await session.execute(stmt)
            biomarkers = result.scalars().all()
            
            updated = 0
            for bio in biomarkers:
                new_category = detect_biomarker_category(bio.name_ru, bio.code)
                if new_category != BiomarkerCategory.OTHER:
                    bio.category = new_category
                    updated += 1
            
            if updated > 0:
                await session.commit()
                logger.info(f"✅ Updated categories for {updated} biomarkers")
            else:
                logger.info("📋 All biomarker categories are up to date")
    except Exception as e:
        logger.warning(f"Could not update biomarker categories: {e}")


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="""
## 🏥 API для обработки медицинских анализов

Сервис автоматического распознавания и анализа результатов лабораторных исследований
с использованием технологий OCR и искусственного интеллекта.

### Основные возможности:

- 📄 **Загрузка анализов** — PDF, JPG, PNG файлы с результатами
- 🔍 **Автоматическое распознавание** — OCR + AI извлечение показателей
- 📊 **Аналитика** — История показателей, динамика изменений
- 💊 **Рекомендации** — Персональный подбор БАДов и витаминов
- 📅 **Календарь здоровья** — Напоминания о чекапах

### Авторизация:

Используйте Bearer-токен в заголовке `Authorization`.
Получить токен можно через `/api/v1/auth/login`.
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS middleware - allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Must be False when using wildcard origins
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    logger.exception(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Внутренняя ошибка сервера",
            "type": type(exc).__name__,
        },
    )


# Include API router
app.include_router(api_router, prefix=settings.api_v1_prefix)


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": "1.0.0",
    }


# Root redirect to docs
@app.get("/", include_in_schema=False)
async def root():
    """Redirect to API documentation."""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/docs")


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
    )




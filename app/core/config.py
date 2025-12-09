"""
Application configuration using Pydantic Settings.
All settings are loaded from environment variables.
"""

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )
    
    # Application
    app_name: str = "Medical Analysis API"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"
    
    # Security
    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30
    
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/medical_db"
    
    # Redis
    redis_url: str = "redis://localhost:6379/0"
    
    # OpenRouter (OpenAI-compatible API)
    openai_api_key: Optional[str] = None
    openai_base_url: str = "https://openrouter.ai/api/v1"
    openai_model: str = "openai/gpt-4o-mini"  # or "anthropic/claude-3-haiku"
    
    # File uploads
    upload_dir: str = "./uploads"
    max_upload_size: int = 10 * 1024 * 1024  # 10MB
    allowed_extensions: set = {"pdf", "png", "jpg", "jpeg"}
    
    # External services
    tesseract_cmd: Optional[str] = None  # Path to tesseract binary if not in PATH
    
    @property
    def async_database_url(self) -> str:
        """Ensure database URL uses async driver."""
        if self.database_url.startswith("postgresql://"):
            return self.database_url.replace("postgresql://", "postgresql+asyncpg://")
        return self.database_url
    
    @property
    def sync_database_url(self) -> str:
        """Get sync database URL for scripts and migrations."""
        url = self.database_url
        # Remove async driver suffixes
        url = url.replace("+asyncpg", "").replace("+aiosqlite", "")
        # Ensure postgresql:// prefix
        if url.startswith("postgresql+"):
            url = "postgresql://" + url.split("://", 1)[1]
        return url


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()


settings = get_settings()


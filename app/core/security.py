"""
Security utilities: password hashing, JWT tokens, authentication.
"""

from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_async_session
from app.models.user import User


# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Bearer token scheme
bearer_scheme = HTTPBearer(auto_error=False)


class TokenPayload(BaseModel):
    """JWT token payload structure."""
    sub: str  # user_id
    exp: datetime
    type: str  # "access" or "refresh"


class TokenPair(BaseModel):
    """Access and refresh token pair."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed one."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


def create_token(subject: str, token_type: str, expires_delta: timedelta) -> str:
    """Create a JWT token."""
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode = {
        "sub": str(subject),
        "exp": expire,
        "type": token_type,
    }
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def create_access_token(user_id: int) -> str:
    """Create an access token for a user."""
    return create_token(
        subject=str(user_id),
        token_type="access",
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(user_id: int) -> str:
    """Create a refresh token for a user."""
    return create_token(
        subject=str(user_id),
        token_type="refresh",
        expires_delta=timedelta(days=settings.refresh_token_expire_days),
    )


def create_token_pair(user_id: int) -> TokenPair:
    """Create both access and refresh tokens."""
    return TokenPair(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


def decode_token(token: str) -> Optional[TokenPayload]:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
        )
        return TokenPayload(**payload)
    except JWTError:
        return None


async def get_current_user_id(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)]
) -> int:
    """
    Dependency that extracts and validates the current user from JWT.
    Returns user_id.
    
    In demo mode (no token), returns demo user id = 1.
    """
    # Demo mode: if no credentials, use demo user
    if not credentials:
        # Return demo user id for testing/demo purposes
        return 1
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Невалидный токен авторизации",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token_data = decode_token(credentials.credentials)
    
    if not token_data:
        raise credentials_exception
    
    if token_data.type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Используйте access token для авторизации",
        )
    
    return int(token_data.sub)


async def get_current_user(
    user_id: Annotated[int, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_async_session)],
) -> User:
    """
    Dependency that returns the current authenticated user.
    """
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь неактивен",
        )
    return user


# Type alias for dependency injection
CurrentUserID = Annotated[int, Depends(get_current_user_id)]
CurrentUser = Annotated[User, Depends(get_current_user)]



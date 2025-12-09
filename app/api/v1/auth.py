"""
Authentication API endpoints.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.security import (
    verify_password,
    get_password_hash,
    create_token_pair,
    decode_token,
    get_current_user_id,
)
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse
from app.schemas.auth import Token, RefreshTokenRequest

router = APIRouter()


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Регистрация нового пользователя",
)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_async_session),
):
    """
    Регистрация нового пользователя.
    
    - **email**: Email пользователя (уникальный)
    - **password**: Пароль (минимум 6 символов)
    - **first_name**: Имя (опционально)
    - **last_name**: Фамилия (опционально)
    - **birth_date**: Дата рождения (опционально, для точных референсных значений)
    - **gender**: Пол (опционально, для точных референсных значений)
    """
    # Check if email already exists
    stmt = select(User).where(User.email == user_data.email)
    result = await db.execute(stmt)
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже существует",
        )
    
    # Create user
    user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        phone=user_data.phone,
        birth_date=user_data.birth_date,
        gender=user_data.gender,
        external_user_id=user_data.external_user_id,
    )
    
    db.add(user)
    await db.flush()
    await db.refresh(user)
    
    return user


@router.post(
    "/login",
    response_model=Token,
    summary="Авторизация пользователя",
)
async def login(
    credentials: UserLogin,
    db: AsyncSession = Depends(get_async_session),
):
    """
    Авторизация по email и паролю.
    
    Возвращает пару токенов:
    - **access_token**: Токен для доступа к API (время жизни: 60 минут)
    - **refresh_token**: Токен для обновления access_token (время жизни: 30 дней)
    """
    # Find user
    stmt = select(User).where(User.email == credentials.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт деактивирован",
        )
    
    # Create tokens
    return create_token_pair(user.id)


@router.post(
    "/refresh",
    response_model=Token,
    summary="Обновление токена",
)
async def refresh_token(
    request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_async_session),
):
    """
    Обновление access_token с помощью refresh_token.
    """
    token_data = decode_token(request.refresh_token)
    
    if not token_data or token_data.type != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный refresh token",
        )
    
    # Check if user still exists and is active
    stmt = select(User).where(User.id == int(token_data.sub))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден или деактивирован",
        )
    
    return create_token_pair(user.id)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Текущий пользователь",
)
async def get_current_user(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Получение информации о текущем авторизованном пользователе.
    """
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )
    
    return user




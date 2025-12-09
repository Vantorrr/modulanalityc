"""
API v1 router configuration.
"""

from fastapi import APIRouter

from app.api.v1 import auth, users, analyses, recommendations, calendar, products, medcard, profile

api_router = APIRouter()

api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Авторизация"],
)

api_router.include_router(
    users.router,
    prefix="/users",
    tags=["Пользователи"],
)

api_router.include_router(
    analyses.router,
    prefix="/analyses",
    tags=["Анализы"],
)

api_router.include_router(
    recommendations.router,
    prefix="/recommendations",
    tags=["Рекомендации"],
)

api_router.include_router(
    calendar.router,
    prefix="/calendar",
    tags=["Календарь здоровья"],
)

api_router.include_router(
    products.router,
    prefix="/products",
    tags=["Каталог товаров"],
)

api_router.include_router(
    medcard.router,
    tags=["Медицинская карта"],
)

api_router.include_router(
    profile.router,
    prefix="/profile",
    tags=["Профиль пациента"],
)

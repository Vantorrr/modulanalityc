"""
Authentication schemas.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class Token(BaseModel):
    """JWT token response."""
    
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    """JWT token payload."""
    
    sub: str
    exp: datetime
    type: str


class RefreshTokenRequest(BaseModel):
    """Request to refresh access token."""
    
    refresh_token: str




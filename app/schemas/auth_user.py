from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.enums import ActiveStatus, Role
from app.schemas.common import (
    ORMModel,
    normalize_username,
    validate_password_strength,
)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("username")
    @classmethod
    def _u(cls, v: str) -> str:
        return v.strip().lower()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Seconds until the token expires")


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _pw(cls, v: str) -> str:
        return validate_password_strength(v)


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str = Field(min_length=2, max_length=120)
    role: Role

    @field_validator("username")
    @classmethod
    def _u(cls, v: str) -> str:
        return normalize_username(v)

    @field_validator("password")
    @classmethod
    def _pw(cls, v: str) -> str:
        return validate_password_strength(v)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    role: Role | None = None
    status: ActiveStatus | None = None


class PasswordReset(BaseModel):
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _pw(cls, v: str) -> str:
        return validate_password_strength(v)


class UserRead(ORMModel):
    id: uuid.UUID
    username: str
    full_name: str
    role: Role
    status: ActiveStatus
    created_at: datetime

from __future__ import annotations

import re
from decimal import Decimal
from typing import Annotated, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")

# Money: non-negative, 2 decimal places. Serialised as strings in JSON to avoid float drift.
Money = Annotated[Decimal, Field(max_digits=12, decimal_places=2, ge=0)]
PositiveMoney = Annotated[Decimal, Field(max_digits=12, decimal_places=2, gt=0)]
Percent = Annotated[Decimal, Field(max_digits=5, decimal_places=2, ge=0, le=100)]

USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{2,49}$")
PHONE_RE = re.compile(r"^\+?[0-9]{7,15}$")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


class Message(BaseModel):
    detail: str


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody


def normalize_username(v: str) -> str:
    v = v.strip().lower()
    if not USERNAME_RE.match(v):
        raise ValueError("username must be 3-50 chars: lowercase letters, digits, '.', '_' or '-'")
    return v


def validate_password_strength(v: str) -> str:
    if len(v) < 10 or len(v) > 128:
        raise ValueError("password must be 10-128 characters")
    if not (re.search(r"[A-Za-z]", v) and re.search(r"[0-9]", v)):
        raise ValueError("password must contain at least one letter and one digit")
    return v


def normalize_phone(v: str) -> str:
    cleaned = re.sub(r"[\s-]", "", v.strip())
    if not PHONE_RE.match(cleaned):
        raise ValueError("phone must be 7-15 digits, optionally starting with '+'")
    return cleaned

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

from app.enums import ActiveStatus
from app.schemas.common import ORMModel, normalize_phone, normalize_username


class CustomerCreate(BaseModel):
    username: str
    full_name: str = Field(min_length=2, max_length=120)
    company_name: str = Field(min_length=2, max_length=160)
    phone: str

    @field_validator("username")
    @classmethod
    def _u(cls, v: str) -> str:
        return normalize_username(v)

    @field_validator("phone")
    @classmethod
    def _p(cls, v: str) -> str:
        return normalize_phone(v)

    @field_validator("full_name", "company_name")
    @classmethod
    def _strip(cls, v: str) -> str:
        return " ".join(v.split())


class CustomerUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    company_name: str | None = Field(default=None, min_length=2, max_length=160)
    phone: str | None = None
    status: ActiveStatus | None = None

    @field_validator("phone")
    @classmethod
    def _p(cls, v: str | None) -> str | None:
        return normalize_phone(v) if v is not None else v


class CustomerBasic(ORMModel):
    """All a cashier may see: enough to verify the customer is registered. No dues, no phone."""

    id: uuid.UUID
    chai_id: uuid.UUID
    full_name: str
    company_name: str
    status: ActiveStatus


class CustomerFull(CustomerBasic):
    username: str
    phone: str
    amount_due: Decimal
    created_at: datetime


class PreferredProduct(BaseModel):
    product_id: uuid.UUID
    product_name: str
    is_available: bool


class FrequentProduct(PreferredProduct):
    orders_with_product: int
    total_completed_orders: int
    share_pct: Decimal


class CustomerPreferences(BaseModel):
    customer_id: uuid.UUID
    saved_regular: PreferredProduct | None = Field(
        description="The single active regular drink stored for this customer"
    )
    most_frequent: FrequentProduct | None = Field(
        description="Computed on the fly from completed order history"
    )
    top_products: list[FrequentProduct]


class SetRegularRequest(BaseModel):
    product_id: uuid.UUID

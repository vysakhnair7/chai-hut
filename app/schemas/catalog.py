from __future__ import annotations

import uuid
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator

from app.enums import ActiveStatus, ProductStatus
from app.schemas.common import Money, ORMModel, Percent


class CategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: str | None = Field(default=None, max_length=500)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = Field(default=None, max_length=500)
    status: ActiveStatus | None = None


class CategoryRead(ORMModel):
    id: uuid.UUID
    name: str
    description: str | None
    status: ActiveStatus


class ProductCreate(BaseModel):
    category_id: uuid.UUID
    name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    mrp: Money
    cost_price: Money | None = None
    gst_rate: Percent | None = Field(default=None, description="Defaults to DEFAULT_GST_RATE")
    stock_quantity: int = Field(default=0, ge=0, le=1_000_000)


class ProductUpdate(BaseModel):
    category_id: uuid.UUID | None = None
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    gst_rate: Percent | None = None
    status: ProductStatus | None = None


class PriceUpdate(BaseModel):
    mrp: Money | None = None
    cost_price: Money | None = None

    @model_validator(mode="after")
    def _at_least_one(self):
        if self.mrp is None and self.cost_price is None:
            raise ValueError("provide mrp and/or cost_price")
        return self


class StockUpdate(BaseModel):
    stock_quantity: int = Field(ge=0, le=1_000_000)


class ProductPublic(ORMModel):
    """What every role (incl. cashiers) may see: price and stock, never cost."""

    id: uuid.UUID
    category_id: uuid.UUID
    name: str
    description: str | None
    mrp: Decimal
    gst_rate: Decimal
    stock_quantity: int
    status: ProductStatus


class ProductDetail(ProductPublic):
    """Manager/owner view: adds cost and margin."""

    cost_price: Decimal | None
    margin: Decimal | None = Field(default=None, description="mrp - cost_price, if cost is known")


class PopularProduct(BaseModel):
    product_id: uuid.UUID
    name: str
    orders_with_product: int
    quantity_sold: int
    is_available: bool

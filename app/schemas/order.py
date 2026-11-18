from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.enums import OrderPaymentState, OrderStatus, PaymentMethod, PaymentStatus
from app.schemas.common import Money, ORMModel
from app.schemas.customer import CustomerBasic


class OrderItemIn(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(ge=1, le=100)


class OrderCreate(BaseModel):
    customer_id: uuid.UUID | None = Field(
        default=None, description="Registered customer. Omit for a walk-in order."
    )
    walk_in_name: str | None = Field(
        default=None, max_length=80, description="Name to call out for walk-in orders"
    )
    items: list[OrderItemIn] = Field(min_length=1, max_length=50)
    discount_amount: Money = Field(
        default=Decimal("0.00"), description="Manager/owner only. Cashiers must leave this at 0."
    )

    @field_validator("walk_in_name")
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        v = " ".join(v.split()) if v else None
        return v or None

    @model_validator(mode="after")
    def _either_customer_or_walk_in(self):
        if self.customer_id and self.walk_in_name:
            raise ValueError("send either customer_id or walk_in_name, not both")
        return self


class OrderItemRead(ORMModel):
    product_id: uuid.UUID
    product_name: str
    quantity: int
    unit_price: Decimal
    gst_rate: Decimal
    total_price: Decimal


class OrderRead(BaseModel):
    id: uuid.UUID
    order_token: str
    invoice_number: str
    business_date: date
    status: OrderStatus
    customer: CustomerBasic | None
    walk_in_name: str | None
    items: list[OrderItemRead]
    subtotal_amount: Decimal
    discount_amount: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class CancelRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=255)


class TrackResponse(BaseModel):
    """Public, minimal: enough for a customer to watch their token on a screen."""

    order_token: str
    status: OrderStatus
    updated_at: datetime


class BillPayment(ORMModel):
    method: PaymentMethod
    amount: Decimal
    status: PaymentStatus
    created_at: datetime


class BillRead(BaseModel):
    """Generated from orders + order_items (no bills table). Payment fields are only filled
    for roles holding payments:read; for cashiers they are null."""

    invoice_number: str
    order_token: str
    business_date: date
    status: OrderStatus
    customer_name: str | None
    company_name: str | None
    items: list[OrderItemRead]
    subtotal_amount: Decimal
    discount_amount: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    payments: list[BillPayment] | None = None
    amount_paid: Decimal | None = None
    balance_due: Decimal | None = None
    payment_state: OrderPaymentState | None = None

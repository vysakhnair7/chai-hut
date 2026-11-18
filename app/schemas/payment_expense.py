from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.enums import (
    ActiveStatus,
    OrderPaymentState,
    PaymentMethod,
    PaymentStatus,
    SettlementMethod,
)
from app.schemas.common import ORMModel, PositiveMoney


def _clean_ref(v: str | None) -> str | None:
    v = v.strip() if v else None
    return v or None


# ---------------- payments ----------------
class PaymentCreate(BaseModel):
    method: PaymentMethod
    amount: PositiveMoney | None = Field(
        default=None, description="Defaults to the order's full remaining balance"
    )
    transaction_id: str | None = Field(default=None, max_length=100)

    @field_validator("transaction_id")
    @classmethod
    def _t(cls, v):
        return _clean_ref(v)

    @model_validator(mode="after")
    def _ref_required_for_electronic(self):
        if self.method in (PaymentMethod.UPI, PaymentMethod.CARD) and not self.transaction_id:
            raise ValueError("transaction_id is required for UPI and card payments")
        return self


class PaymentRead(ORMModel):
    id: uuid.UUID
    order_id: uuid.UUID
    amount: Decimal
    method: PaymentMethod
    status: PaymentStatus
    transaction_id: str | None
    received_by: uuid.UUID
    created_at: datetime


class OrderPayments(BaseModel):
    order_id: uuid.UUID
    order_total: Decimal
    amount_paid: Decimal
    balance_due: Decimal
    payment_state: OrderPaymentState
    payments: list[PaymentRead]


# ---------------- corporate credit ----------------
class SettlementCreate(BaseModel):
    customer_id: uuid.UUID
    amount: PositiveMoney
    method: SettlementMethod
    transaction_id: str | None = Field(default=None, max_length=100)
    note: str | None = Field(default=None, max_length=255)

    @field_validator("transaction_id", "note")
    @classmethod
    def _t(cls, v):
        return _clean_ref(v)

    @model_validator(mode="after")
    def _ref_required_for_electronic(self):
        if self.method in (SettlementMethod.UPI, SettlementMethod.CARD) and not self.transaction_id:
            raise ValueError("transaction_id is required for UPI and card settlements")
        return self


class SettlementRead(ORMModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    amount: Decimal
    method: SettlementMethod
    settlement_date: date
    transaction_id: str | None
    note: str | None
    received_by: uuid.UUID
    created_at: datetime


class SettlementResult(BaseModel):
    settlement: SettlementRead
    remaining_due: Decimal


class OutstandingCustomer(BaseModel):
    id: uuid.UUID
    chai_id: uuid.UUID
    full_name: str
    company_name: str
    phone: str
    amount_due: Decimal


class CompanyDue(BaseModel):
    company_name: str
    customers_with_dues: int
    amount_due: Decimal


class OutstandingSummary(BaseModel):
    total_outstanding: Decimal
    customers: list[OutstandingCustomer]
    by_company: list[CompanyDue]


class LedgerEntry(BaseModel):
    at: datetime
    kind: str = Field(description="credit_sale | credit_reversal | settlement")
    amount: Decimal = Field(description="Positive increases the due, negative reduces it")
    balance_after: Decimal
    reference: str | None = None


class CustomerLedger(BaseModel):
    customer_id: uuid.UUID
    current_due: Decimal
    entries: list[LedgerEntry]


# ---------------- expenses ----------------
class ExpenseCategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: str | None = Field(default=None, max_length=500)


class ExpenseCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = Field(default=None, max_length=500)
    status: ActiveStatus | None = None


class ExpenseCategoryRead(ORMModel):
    id: uuid.UUID
    name: str
    description: str | None
    status: ActiveStatus


class ExpenseCreate(BaseModel):
    category_id: uuid.UUID
    description: str = Field(min_length=2, max_length=255)
    amount: PositiveMoney
    expense_date: date | None = Field(default=None, description="Defaults to today (business timezone)")


class ExpenseUpdate(BaseModel):
    category_id: uuid.UUID | None = None
    description: str | None = Field(default=None, min_length=2, max_length=255)
    amount: PositiveMoney | None = None
    expense_date: date | None = None


class ExpenseRead(ORMModel):
    id: uuid.UUID
    category_id: uuid.UUID
    description: str
    amount: Decimal
    expense_date: date
    created_by: uuid.UUID
    created_at: datetime

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, Enum, ForeignKey, Index, Numeric, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.enums import PaymentMethod, PaymentStatus, SettlementMethod
from app.models.base import Base, Timestamps, UUIDPrimaryKey


def _enum(cls, length: int = 20):
    return Enum(cls, native_enum=False, length=length, values_callable=lambda e: [m.value for m in e])


class Payment(UUIDPrimaryKey, Timestamps, Base):
    """Money applied to an order. Several rows per order are allowed (split tender) but the
    successful ones can never add up to more than the order total (enforced under a row lock).

    ``transaction_id`` and ``idempotency_key`` are unique, so the same transaction or the
    same retried request can never be processed twice."""

    __tablename__ = "payments"

    order_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("orders.id", ondelete="RESTRICT"), index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    method: Mapped[PaymentMethod] = mapped_column(_enum(PaymentMethod))
    status: Mapped[PaymentStatus] = mapped_column(_enum(PaymentStatus), default=PaymentStatus.SUCCESS)
    transaction_id: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(80), unique=True, nullable=True)
    received_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT")
    )

    __table_args__ = (
        CheckConstraint("amount > 0", name="amount_positive"),
        Index("ix_payments_method_status", "method", "status"),
    )


class CreditSettlement(UUIDPrimaryKey, Timestamps, Base):
    """A customer paying off their corporate-credit dues (e.g. on salary day)."""

    __tablename__ = "credit_settlements"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("customers.id", ondelete="RESTRICT"), index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    method: Mapped[SettlementMethod] = mapped_column(_enum(SettlementMethod))
    settlement_date: Mapped[date] = mapped_column(Date, index=True)
    transaction_id: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(80), unique=True, nullable=True)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    received_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT")
    )

    __table_args__ = (CheckConstraint("amount > 0", name="settlement_amount_positive"),)

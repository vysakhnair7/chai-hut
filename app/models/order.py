from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import OrderStatus
from app.models.base import Base, Timestamps, UUIDPrimaryKey


def _enum(cls, length: int = 20):
    return Enum(cls, native_enum=False, length=length, values_callable=lambda e: [m.value for m in e])


class OrderTokenCounter(Base):
    """One row per business day; incremented atomically to hand out tokens T001, T002, ..."""

    __tablename__ = "order_token_counters"

    business_date: Mapped[date] = mapped_column(Date, primary_key=True)
    last_value: Mapped[int] = mapped_column(Integer, default=0)


class Order(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "orders"

    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("customers.id", ondelete="RESTRICT"), nullable=True, index=True
    )  # NULL => walk-in order
    walk_in_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    business_date: Mapped[date] = mapped_column(Date, index=True)
    token_number: Mapped[int] = mapped_column(Integer)
    order_token: Mapped[str] = mapped_column(String(12))
    status: Mapped[OrderStatus] = mapped_column(_enum(OrderStatus), default=OrderStatus.PLACED)

    subtotal_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    cgst_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    sgst_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    created_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="OrderItem.product_name"
    )

    __table_args__ = (
        UniqueConstraint("business_date", "token_number", name="uq_orders_business_date_token"),
        CheckConstraint("subtotal_amount >= 0 AND discount_amount >= 0 AND tax_amount >= 0", name="amounts_non_negative"),
        CheckConstraint("discount_amount <= subtotal_amount", name="discount_within_subtotal"),
        CheckConstraint("tax_amount = cgst_amount + sgst_amount", name="tax_split_consistent"),
        CheckConstraint(
            "total_amount = subtotal_amount - discount_amount + tax_amount", name="total_consistent"
        ),
        Index("ix_orders_date_status", "business_date", "status"),
        Index("ix_orders_token", "business_date", "order_token"),
    )


class OrderItem(UUIDPrimaryKey, Base):
    """Immutable snapshot of what was sold, at the price/cost/GST in force at that moment."""

    __tablename__ = "order_items"

    order_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("orders.id", ondelete="CASCADE"), index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("products.id", ondelete="RESTRICT"), index=True
    )
    product_name: Mapped[str] = mapped_column(String(120))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    unit_cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    gst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    total_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    order: Mapped[Order] = relationship(back_populates="items")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="quantity_positive"),
        CheckConstraint("total_price = quantity * unit_price", name="line_total_consistent"),
    )

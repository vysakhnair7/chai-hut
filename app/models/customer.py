from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import CheckConstraint, Enum, ForeignKey, Index, Numeric, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.enums import ActiveStatus
from app.models.base import Base, Timestamps, UUIDPrimaryKey


def _enum(cls, length: int = 20):
    return Enum(cls, native_enum=False, length=length, values_callable=lambda e: [m.value for m in e])


class Customer(UUIDPrimaryKey, Timestamps, Base):
    """A registered (usually corporate) customer, identified by ``chai_id`` + company."""

    __tablename__ = "customers"

    chai_id: Mapped[uuid.UUID] = mapped_column(Uuid, unique=True, default=uuid.uuid4, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120), index=True)
    company_name: Mapped[str] = mapped_column(String(160), index=True)
    phone: Mapped[str] = mapped_column(String(20), index=True)
    status: Mapped[ActiveStatus] = mapped_column(_enum(ActiveStatus), default=ActiveStatus.ACTIVE)
    # Running corporate-credit balance. 0 means nothing to pay.
    amount_due: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    __table_args__ = (
        CheckConstraint("amount_due >= 0", name="amount_due_non_negative"),
        Index("ix_customers_status_due", "status", "amount_due"),
    )

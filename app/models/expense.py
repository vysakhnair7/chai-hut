from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, Enum, ForeignKey, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.enums import ActiveStatus
from app.models.base import Base, Timestamps, UUIDPrimaryKey


class ExpenseCategory(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "expense_categories"

    name: Mapped[str] = mapped_column(String(80), unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ActiveStatus] = mapped_column(
        Enum(ActiveStatus, native_enum=False, length=20, values_callable=lambda e: [m.value for m in e]),
        default=ActiveStatus.ACTIVE,
    )


class Expense(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "expenses"

    category_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("expense_categories.id", ondelete="RESTRICT"), index=True
    )
    description: Mapped[str] = mapped_column(String(255))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    expense_date: Mapped[date] = mapped_column(Date, index=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT")
    )

    __table_args__ = (CheckConstraint("amount > 0", name="expense_amount_positive"),)

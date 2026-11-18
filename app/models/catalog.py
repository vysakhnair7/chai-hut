from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import CheckConstraint, Enum, ForeignKey, Index, Integer, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import ActiveStatus, ProductStatus
from app.models.base import Base, Timestamps, UUIDPrimaryKey


def _enum(cls, length: int = 20):
    return Enum(cls, native_enum=False, length=length, values_callable=lambda e: [m.value for m in e])


class ProductCategory(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "product_categories"

    name: Mapped[str] = mapped_column(String(80), unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ActiveStatus] = mapped_column(_enum(ActiveStatus), default=ActiveStatus.ACTIVE)

    products: Mapped[list["Product"]] = relationship(back_populates="category")


class Product(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "products"

    category_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("product_categories.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    mrp: Mapped[Decimal] = mapped_column(Numeric(10, 2))  # selling price, GST-exclusive
    # Nullable on purpose: unknown cost means profit must NOT be reported (see finance rules).
    cost_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    gst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("5.00"))
    stock_quantity: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[ProductStatus] = mapped_column(_enum(ProductStatus), default=ProductStatus.AVAILABLE)

    category: Mapped[ProductCategory] = relationship(back_populates="products")

    __table_args__ = (
        CheckConstraint("mrp >= 0", name="mrp_non_negative"),
        CheckConstraint("cost_price IS NULL OR cost_price >= 0", name="cost_non_negative"),
        CheckConstraint("gst_rate >= 0 AND gst_rate <= 100", name="gst_rate_range"),
        CheckConstraint("stock_quantity >= 0", name="stock_non_negative"),
        Index("ix_products_status", "status"),
    )

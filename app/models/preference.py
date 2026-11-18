from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, Index, UniqueConstraint, Uuid, false, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class CustomerPreference(UUIDPrimaryKey, Timestamps, Base):
    """Saved drink preference. At most ONE row per customer may have is_regular = true."""

    __tablename__ = "customer_preferences"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("customers.id", ondelete="CASCADE"), index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    is_regular: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())

    __table_args__ = (
        UniqueConstraint("customer_id", "product_id", name="uq_customer_preferences_customer_product"),
        Index(
            "uq_customer_preferences_one_regular",
            "customer_id",
            unique=True,
            postgresql_where=text("is_regular"),
            sqlite_where=text("is_regular"),
        ),
    )

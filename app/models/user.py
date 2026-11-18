from __future__ import annotations

from sqlalchemy import Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.enums import ActiveStatus, Role
from app.models.base import Base, Timestamps, UUIDPrimaryKey


class User(UUIDPrimaryKey, Timestamps, Base):
    """Employees only (owner / manager / cashier). Customers never log in."""

    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[Role] = mapped_column(
        Enum(Role, native_enum=False, length=20, values_callable=lambda e: [m.value for m in e])
    )
    status: Mapped[ActiveStatus] = mapped_column(
        Enum(ActiveStatus, native_enum=False, length=20, values_callable=lambda e: [m.value for m in e]),
        default=ActiveStatus.ACTIVE,
    )

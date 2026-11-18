"""Shared enums. Kept free of SQLAlchemy imports so schemas/utils can use them."""
from enum import Enum


class StrEnum(str, Enum):
    def __str__(self) -> str:  # pragma: no cover - trivial
        return self.value


class Role(StrEnum):
    OWNER = "owner"
    MANAGER = "manager"
    CASHIER = "cashier"


class ActiveStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class ProductStatus(StrEnum):
    AVAILABLE = "available"
    OUT_OF_STOCK = "out_of_stock"
    DISCONTINUED = "discontinued"


class OrderStatus(StrEnum):
    PLACED = "placed"
    PREPARING = "preparing"
    READY = "ready"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PaymentMethod(StrEnum):
    CASH = "cash"
    UPI = "upi"
    CARD = "card"
    CORPORATE_CREDIT = "corporate_credit"


class SettlementMethod(StrEnum):
    """How a customer pays off their corporate-credit dues (never credit itself)."""

    CASH = "cash"
    UPI = "upi"
    CARD = "card"


class PaymentStatus(StrEnum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    REFUNDED = "refunded"


class OrderPaymentState(StrEnum):
    """Derived, never stored: unpaid / partial / paid."""

    UNPAID = "unpaid"
    PARTIAL = "partial"
    PAID = "paid"

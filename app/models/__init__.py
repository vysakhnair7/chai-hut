"""Import every model so ``Base.metadata`` is complete (Alembic and create_all rely on this)."""
from app.models.base import Base
from app.models.catalog import Product, ProductCategory
from app.models.customer import Customer
from app.models.expense import Expense, ExpenseCategory
from app.models.order import Order, OrderItem, OrderTokenCounter
from app.models.payment import CreditSettlement, Payment
from app.models.preference import CustomerPreference
from app.models.user import User

__all__ = [
    "Base",
    "Customer",
    "CreditSettlement",
    "CustomerPreference",
    "Expense",
    "ExpenseCategory",
    "Order",
    "OrderItem",
    "OrderTokenCounter",
    "Payment",
    "Product",
    "ProductCategory",
    "User",
]

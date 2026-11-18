"""Load demo data so the API can be shown straight away.  Usage:

    python -m app.utils.seed_demo

Creates an owner, a manager and a cashier with RANDOM passwords printed once to the console
(nothing is hardcoded), a small menu with costs, expense categories and a few corporate
customers. Refuses to run if any user already exists.
"""
from __future__ import annotations

import secrets
from decimal import Decimal

from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.database import get_sessionmaker
from app.core.security import hash_password
from app.enums import ActiveStatus, ProductStatus, Role
from app.models import Customer, ExpenseCategory, Product, ProductCategory, User

MENU = {
    "Tea": [
        ("Masala Chai", "Ginger-cardamom milk tea", "20.00", "7.00", 200),
        ("Kadak Chai", "Strong cutting chai", "15.00", "5.00", 200),
        ("Green Tea", "Light and clean", "30.00", "9.00", 80),
    ],
    "Coffee": [
        ("Cappuccino", "Espresso with steamed milk foam", "120.00", "38.00", 100),
        ("Cold Coffee", "Chilled blended coffee", "140.00", "45.00", 60),
    ],
    "Snacks": [
        ("Samosa", "Crisp potato samosa", "25.00", "10.00", 80),
        ("Bun Maska", "Buttered bun", "35.00", None, 40),  # cost deliberately unknown (demo of profit rule)
    ],
}
EXPENSE_CATEGORIES = ["Milk & Dairy", "Tea & Coffee Supplies", "Rent", "Salaries", "Utilities", "Maintenance"]
CUSTOMERS = [
    ("anita.rao", "Anita Rao", "Infosys", "+919800000001"),
    ("vikram.s", "Vikram Shah", "Infosys", "+919800000002"),
    ("meera.k", "Meera Krishnan", "Wipro", "+919800000003"),
]


def main() -> None:
    settings = get_settings()
    with get_sessionmaker()() as db:
        if db.scalar(select(func.count(User.id))):
            raise SystemExit("Users already exist; refusing to seed.")

        creds: list[tuple[str, str, str]] = []
        for role in (Role.OWNER, Role.MANAGER, Role.CASHIER):
            username, password = f"demo.{role.value}", secrets.token_urlsafe(14) + "a1"
            db.add(
                User(
                    username=username, password_hash=hash_password(password),
                    full_name=f"Demo {role.value.title()}", role=role, status=ActiveStatus.ACTIVE,
                )
            )
            creds.append((role.value, username, password))

        for cat_name, products in MENU.items():
            cat = ProductCategory(name=cat_name, description=f"{cat_name} menu")
            db.add(cat)
            db.flush()
            for name, desc, mrp, cost, stock in products:
                db.add(
                    Product(
                        category_id=cat.id, name=name, description=desc, mrp=Decimal(mrp),
                        cost_price=Decimal(cost) if cost else None, gst_rate=settings.default_gst_rate,
                        stock_quantity=stock, status=ProductStatus.AVAILABLE,
                    )
                )
        for name in EXPENSE_CATEGORIES:
            db.add(ExpenseCategory(name=name))
        for username, full_name, company, phone in CUSTOMERS:
            db.add(Customer(username=username, full_name=full_name, company_name=company, phone=phone))
        db.commit()

    print("Demo data loaded. Credentials (shown once, store them now):")
    for role, username, password in creds:
        print(f"  {role:<8} {username:<16} {password}")


if __name__ == "__main__":
    main()

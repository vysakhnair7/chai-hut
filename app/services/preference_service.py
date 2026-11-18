from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleError
from app.enums import ActiveStatus, OrderStatus, ProductStatus
from app.models import Customer, CustomerPreference, Order, OrderItem, Product
from app.schemas.customer import CustomerPreferences, FrequentProduct, PreferredProduct
from app.services.common import get_or_404
from app.utils.analytics import pick_regular_product, rank_products


def _history_rows(db: Session, customer_id: uuid.UUID):
    """(order_id, product_id, when) for every line of the customer's COMPLETED orders."""
    when = func.coalesce(Order.completed_at, Order.created_at)
    return db.execute(
        select(Order.id, OrderItem.product_id, when)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(Order.customer_id == customer_id, Order.status == OrderStatus.COMPLETED)
    ).all()


def _is_available(p: Product) -> bool:
    return p.status == ProductStatus.AVAILABLE and p.stock_quantity > 0


def get_preferences(db: Session, customer_id: uuid.UUID, top_n: int = 5) -> CustomerPreferences:
    get_or_404(db, Customer, customer_id, "Customer")

    saved = db.execute(
        select(Product)
        .join(CustomerPreference, CustomerPreference.product_id == Product.id)
        .where(CustomerPreference.customer_id == customer_id, CustomerPreference.is_regular.is_(True))
    ).scalar_one_or_none()

    ranked, total_orders = rank_products(_history_rows(db, customer_id))
    top: list[FrequentProduct] = []
    if ranked:
        products = {
            p.id: p
            for p in db.scalars(select(Product).where(Product.id.in_([pid for pid, _ in ranked[:top_n]])))
        }
        for pid, n in ranked[:top_n]:
            p = products[pid]
            top.append(
                FrequentProduct(
                    product_id=p.id, product_name=p.name, is_available=_is_available(p),
                    orders_with_product=n, total_completed_orders=total_orders,
                    share_pct=(Decimal(n) * 100 / Decimal(total_orders)).quantize(Decimal("0.01")),
                )
            )
    return CustomerPreferences(
        customer_id=customer_id,
        saved_regular=(
            PreferredProduct(product_id=saved.id, product_name=saved.name, is_available=_is_available(saved))
            if saved else None
        ),
        most_frequent=top[0] if top else None,
        top_products=top,
    )


def _apply_regular(db: Session, customer_id: uuid.UUID, product_id: uuid.UUID) -> None:
    """Make product_id the customer's ONE regular drink. Caller commits.

    The previous regular is cleared and flushed first, so the partial unique index
    (one is_regular row per customer) is never violated mid-transaction."""
    db.execute(
        update(CustomerPreference)
        .where(
            CustomerPreference.customer_id == customer_id,
            CustomerPreference.is_regular.is_(True),
            CustomerPreference.product_id != product_id,
        )
        .values(is_regular=False)
    )
    pref = db.scalar(
        select(CustomerPreference).where(
            CustomerPreference.customer_id == customer_id, CustomerPreference.product_id == product_id
        )
    )
    if pref is None:
        db.add(CustomerPreference(customer_id=customer_id, product_id=product_id, is_regular=True))
    else:
        pref.is_regular = True
    db.flush()


def set_regular(db: Session, customer_id: uuid.UUID, product_id: uuid.UUID) -> CustomerPreferences:
    customer = get_or_404(db, Customer, customer_id, "Customer", lock=True)  # serialises concurrent edits
    product = get_or_404(db, Product, product_id, "Product")
    if product.status == ProductStatus.DISCONTINUED:
        raise BusinessRuleError("Discontinued products cannot be a regular drink")
    if customer.status != ActiveStatus.ACTIVE:
        raise BusinessRuleError("Customer is inactive")
    _apply_regular(db, customer_id, product_id)
    db.commit()
    return get_preferences(db, customer_id)


def clear_regular(db: Session, customer_id: uuid.UUID) -> CustomerPreferences:
    get_or_404(db, Customer, customer_id, "Customer", lock=True)
    db.execute(
        update(CustomerPreference)
        .where(CustomerPreference.customer_id == customer_id, CustomerPreference.is_regular.is_(True))
        .values(is_regular=False)
    )
    db.commit()
    return get_preferences(db, customer_id)


def refresh_regular_from_history(db: Session, customer_id: uuid.UUID, *, commit: bool = True) -> uuid.UUID | None:
    """Set the regular drink to the product appearing in the most completed bills.
    Called automatically when an order completes (inside that transaction, commit=False)."""
    picked = pick_regular_product(_history_rows(db, customer_id))
    if picked is None:
        return None
    product_id = picked[0]
    product = db.get(Product, product_id)
    if product is None or product.status == ProductStatus.DISCONTINUED:
        return None
    _apply_regular(db, customer_id, product_id)
    if commit:
        db.commit()
    return product_id

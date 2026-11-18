from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.config import Settings
from app.core.deps import PageParams
from app.core.exceptions import BusinessRuleError, NotFoundError, PermissionDeniedError
from app.core.rbac import Permission, has_permission
from app.enums import ActiveStatus, OrderPaymentState, OrderStatus, PaymentMethod, PaymentStatus, ProductStatus
from app.models import Customer, Order, OrderItem, OrderTokenCounter, Payment, Product, User
from app.schemas.customer import CustomerBasic
from app.schemas.order import (
    BillPayment,
    BillRead,
    OrderCreate,
    OrderItemRead,
    OrderRead,
    TrackResponse,
)
from app.services import catalog_service, preference_service
from app.services.common import get_or_404, paginate
from app.utils.analytics import business_today, format_invoice_number, format_token
from app.utils.money import ZERO, Line, calculate_order_totals

# Orders move strictly forward. Cancellation has its own endpoint (and stricter permission).
_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.PLACED: {OrderStatus.PREPARING},
    OrderStatus.PREPARING: {OrderStatus.READY},
    OrderStatus.READY: {OrderStatus.COMPLETED},
    OrderStatus.COMPLETED: set(),
    OrderStatus.CANCELLED: set(),
}
_CANCELLABLE = {OrderStatus.PLACED, OrderStatus.PREPARING, OrderStatus.READY}


# ---------------- helpers ----------------
def payment_state(total: Decimal, paid: Decimal) -> OrderPaymentState:
    if paid <= 0:
        return OrderPaymentState.UNPAID
    return OrderPaymentState.PAID if paid >= total else OrderPaymentState.PARTIAL


def amount_paid(db: Session, order_id: uuid.UUID) -> Decimal:
    rows = db.scalars(
        select(Payment.amount).where(Payment.order_id == order_id, Payment.status == PaymentStatus.SUCCESS)
    ).all()
    return sum(rows, ZERO)


def _next_token(db: Session, day: date) -> int:
    """Atomic per-day counter: the row lock serialises concurrent order creation."""
    stmt = select(OrderTokenCounter).where(OrderTokenCounter.business_date == day).with_for_update()
    row = db.scalar(stmt)
    if row is None:
        try:
            with db.begin_nested():
                db.add(OrderTokenCounter(business_date=day, last_value=0))
        except IntegrityError:
            pass  # another request created today's row first
        row = db.scalar(stmt.execution_options(populate_existing=True))
    row.last_value += 1
    db.flush()
    return row.last_value


def _serialize(order: Order, customer: Customer | None) -> OrderRead:
    return OrderRead(
        id=order.id,
        order_token=order.order_token,
        invoice_number=format_invoice_number(order.business_date, order.token_number),
        business_date=order.business_date,
        status=order.status,
        customer=CustomerBasic.model_validate(customer) if customer else None,
        walk_in_name=order.walk_in_name,
        items=[OrderItemRead.model_validate(i) for i in order.items],
        subtotal_amount=order.subtotal_amount,
        discount_amount=order.discount_amount,
        cgst_amount=order.cgst_amount,
        sgst_amount=order.sgst_amount,
        tax_amount=order.tax_amount,
        total_amount=order.total_amount,
        created_by=order.created_by,
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


def serialize_orders(db: Session, orders: list[Order]) -> list[OrderRead]:
    ids = {o.customer_id for o in orders if o.customer_id}
    customers = {c.id: c for c in db.scalars(select(Customer).where(Customer.id.in_(ids)))} if ids else {}
    return [_serialize(o, customers.get(o.customer_id)) for o in orders]


def _load(db: Session, order_id: uuid.UUID, *, lock: bool = False) -> Order:
    stmt = select(Order).where(Order.id == order_id).options(selectinload(Order.items))
    if lock:
        stmt = stmt.with_for_update(of=Order).execution_options(populate_existing=True)
    order = db.scalar(stmt)
    if order is None:
        raise NotFoundError("Order not found")
    return order


def _visible_or_404(db: Session, actor: User, settings: Settings, order: Order) -> Order:
    """Users without orders:read_all_days (cashiers) only see today's orders."""
    if not has_permission(actor.role, Permission.ORDERS_READ_ALL_DAYS):
        if order.business_date != business_today(settings.business_timezone):
            raise NotFoundError("Order not found")
    return order


# ---------------- create ----------------
def create_order(db: Session, actor: User, settings: Settings, data: OrderCreate) -> OrderRead:
    if data.discount_amount > 0 and not has_permission(actor.role, Permission.ORDERS_APPLY_DISCOUNT):
        raise PermissionDeniedError("Only managers and owners can apply discounts")

    customer: Customer | None = None
    if data.customer_id:
        customer = get_or_404(db, Customer, data.customer_id, "Customer")
        if customer.status != ActiveStatus.ACTIVE:
            raise BusinessRuleError("Customer is inactive and cannot place orders")

    wanted: dict[uuid.UUID, int] = defaultdict(int)
    for item in data.items:
        wanted[item.product_id] += item.quantity
    if any(qty > 100 for qty in wanted.values()):
        raise BusinessRuleError("Maximum 100 units of one product per order")

    # Lock products in a fixed order (no deadlocks) and check stock inside the same transaction.
    products = {
        p.id: p
        for p in db.scalars(
            select(Product).where(Product.id.in_(wanted)).order_by(Product.id).with_for_update()
            .execution_options(populate_existing=True)
        )
    }
    missing = set(wanted) - set(products)
    if missing:
        raise NotFoundError(f"Product not found: {', '.join(sorted(str(m) for m in missing))}")

    lines: list[Line] = []
    for pid, qty in wanted.items():
        p = products[pid]
        if p.status == ProductStatus.DISCONTINUED:
            raise BusinessRuleError(f"'{p.name}' is no longer sold")
        if p.stock_quantity < qty:
            raise BusinessRuleError(f"Only {p.stock_quantity} of '{p.name}' left in stock")
        lines.append(Line(unit_price=p.mrp, quantity=qty, gst_rate=p.gst_rate))

    try:
        totals = calculate_order_totals(lines, data.discount_amount)
    except ValueError as exc:
        raise BusinessRuleError(str(exc)) from exc

    today = business_today(settings.business_timezone)
    number = _next_token(db, today)
    order = Order(
        customer_id=customer.id if customer else None,
        walk_in_name=None if customer else data.walk_in_name,
        business_date=today,
        token_number=number,
        order_token=format_token(number),
        status=OrderStatus.PLACED,
        subtotal_amount=totals.subtotal,
        discount_amount=totals.discount,
        cgst_amount=totals.cgst,
        sgst_amount=totals.sgst,
        tax_amount=totals.tax,
        total_amount=totals.total,
        created_by=actor.id,
    )
    for (pid, qty), line in zip(wanted.items(), lines):
        p = products[pid]
        order.items.append(
            OrderItem(
                product_id=pid, product_name=p.name, quantity=qty, unit_price=p.mrp,
                unit_cost=p.cost_price, gst_rate=p.gst_rate, total_price=line.total,
            )
        )
        p.stock_quantity -= qty
        catalog_service.sync_stock_status(p)
    db.add(order)
    db.commit()
    return _serialize(_load(db, order.id), customer)


# ---------------- read ----------------
def list_orders(
    db: Session, actor: User, settings: Settings, params: PageParams, *,
    status: OrderStatus | None, business_date: date | None, token: str | None,
    customer_id: uuid.UUID | None,
):
    stmt = select(Order).options(selectinload(Order.items)).order_by(Order.created_at.desc(), Order.id)
    if not has_permission(actor.role, Permission.ORDERS_READ_ALL_DAYS):
        stmt = stmt.where(Order.business_date == business_today(settings.business_timezone))
    elif business_date:
        stmt = stmt.where(Order.business_date == business_date)
    if status:
        stmt = stmt.where(Order.status == status)
    if token:
        stmt = stmt.where(Order.order_token == token.strip().upper())
    if customer_id:
        stmt = stmt.where(Order.customer_id == customer_id)
    orders, total = paginate(db, stmt, params)
    return serialize_orders(db, orders), total


def get_order(db: Session, actor: User, settings: Settings, order_id: uuid.UUID) -> OrderRead:
    order = _visible_or_404(db, actor, settings, _load(db, order_id))
    return serialize_orders(db, [order])[0]


def track(db: Session, settings: Settings, token: str) -> TrackResponse:
    """Public: today's token -> status only. Nothing about who ordered or what they paid."""
    order = db.scalar(
        select(Order).where(
            Order.business_date == business_today(settings.business_timezone),
            Order.order_token == token.strip().upper(),
        )
    )
    if order is None:
        raise NotFoundError("No order with that token today")
    return TrackResponse(order_token=order.order_token, status=order.status, updated_at=order.updated_at)


def bill(db: Session, actor: User, settings: Settings, order_id: uuid.UUID) -> BillRead:
    order = _visible_or_404(db, actor, settings, _load(db, order_id))
    customer = db.get(Customer, order.customer_id) if order.customer_id else None
    out = BillRead(
        invoice_number=format_invoice_number(order.business_date, order.token_number),
        order_token=order.order_token,
        business_date=order.business_date,
        status=order.status,
        customer_name=customer.full_name if customer else order.walk_in_name,
        company_name=customer.company_name if customer else None,
        items=[OrderItemRead.model_validate(i) for i in order.items],
        subtotal_amount=order.subtotal_amount,
        discount_amount=order.discount_amount,
        cgst_amount=order.cgst_amount,
        sgst_amount=order.sgst_amount,
        tax_amount=order.tax_amount,
        total_amount=order.total_amount,
    )
    if has_permission(actor.role, Permission.PAYMENTS_READ):
        pays = db.scalars(
            select(Payment).where(Payment.order_id == order.id).order_by(Payment.created_at)
        ).all()
        paid = sum((p.amount for p in pays if p.status == PaymentStatus.SUCCESS), ZERO)
        out.payments = [BillPayment.model_validate(p) for p in pays]
        out.amount_paid = paid
        out.balance_due = order.total_amount - paid
        out.payment_state = payment_state(order.total_amount, paid)
    return out


# ---------------- status changes ----------------
def update_status(
    db: Session, actor: User, settings: Settings, order_id: uuid.UUID, new_status: OrderStatus
) -> OrderRead:
    order = _visible_or_404(db, actor, settings, _load(db, order_id, lock=True))
    if new_status == OrderStatus.CANCELLED:
        raise BusinessRuleError("Use POST /orders/{id}/cancel to cancel an order")
    if new_status not in _TRANSITIONS[order.status]:
        allowed = ", ".join(s.value for s in _TRANSITIONS[order.status]) or "none"
        raise BusinessRuleError(
            f"Cannot move an order from '{order.status.value}' to '{new_status.value}' (allowed: {allowed})"
        )
    order.status = new_status
    if new_status == OrderStatus.COMPLETED:
        order.completed_at = datetime.now(timezone.utc)
        db.flush()
        if order.customer_id:  # keep the customer's regular drink current
            preference_service.refresh_regular_from_history(db, order.customer_id, commit=False)
    db.commit()
    return serialize_orders(db, [_load(db, order.id)])[0]


def cancel_order(db: Session, order_id: uuid.UUID) -> OrderRead:
    """Cancel, restore stock, refund recorded payments and reverse any credit extended,
    all in one transaction."""
    order = _load(db, order_id, lock=True)
    if order.status not in _CANCELLABLE:
        raise BusinessRuleError(f"A '{order.status.value}' order cannot be cancelled")

    payments = db.scalars(
        select(Payment).where(Payment.order_id == order.id, Payment.status == PaymentStatus.SUCCESS)
        .with_for_update()
    ).all()
    credit_total = sum((p.amount for p in payments if p.method == PaymentMethod.CORPORATE_CREDIT), ZERO)
    if credit_total > 0:
        customer = get_or_404(db, Customer, order.customer_id, "Customer", lock=True)
        if customer.amount_due < credit_total:
            raise BusinessRuleError(
                "The customer has already settled this credit; an owner must reconcile it before cancelling"
            )
        customer.amount_due -= credit_total
    for p in payments:
        p.status = PaymentStatus.REFUNDED

    ids = sorted(i.product_id for i in order.items)
    locked = {
        p.id: p
        for p in db.scalars(
            select(Product).where(Product.id.in_(ids)).order_by(Product.id).with_for_update()
            .execution_options(populate_existing=True)
        )
    }
    for item in order.items:
        product = locked[item.product_id]
        product.stock_quantity += item.quantity
        catalog_service.sync_stock_status(product)

    order.status = OrderStatus.CANCELLED
    db.commit()
    return serialize_orders(db, [_load(db, order.id)])[0]

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import PageParams
from app.core.exceptions import BusinessRuleError, ConflictError
from app.enums import ActiveStatus, OrderStatus, PaymentMethod, PaymentStatus
from app.models import Customer, Order, Payment, User
from app.schemas.payment_expense import OrderPayments, PaymentCreate, PaymentRead
from app.services.common import get_or_404, paginate
from app.services.order_service import payment_state
from app.utils.money import ZERO


def _same_request(existing: Payment, order_id: uuid.UUID, data: PaymentCreate) -> bool:
    return (
        existing.order_id == order_id
        and existing.method == data.method
        and (data.amount is None or existing.amount == data.amount)
    )


def record_payment(
    db: Session, actor: User, order_id: uuid.UUID, data: PaymentCreate, idempotency_key: str | None
) -> tuple[Payment, bool]:
    """Record money against an order. Returns (payment, created).

    Duplicate protection, three layers:
      1. Idempotency-Key header: a retried request returns the original payment (created=False).
      2. Unique transaction_id: the same UPI/card reference can't be applied twice.
      3. Order row lock + balance check: successful payments can never exceed the order total,
         even with two cashiers/managers paying the same order at the same moment.
    """
    if idempotency_key:
        existing = db.scalar(select(Payment).where(Payment.idempotency_key == idempotency_key))
        if existing:
            if not _same_request(existing, order_id, data):
                raise ConflictError("Idempotency-Key was already used for a different payment")
            return existing, False

    order = get_or_404(db, Order, order_id, "Order", lock=True)
    if order.status == OrderStatus.CANCELLED:
        raise BusinessRuleError("Cannot take payment for a cancelled order")

    paid = sum(
        db.scalars(
            select(Payment.amount).where(Payment.order_id == order.id, Payment.status == PaymentStatus.SUCCESS)
        ).all(),
        ZERO,
    )
    remaining = order.total_amount - paid
    if remaining <= 0:
        raise ConflictError("Order is already fully paid")
    amount = data.amount if data.amount is not None else remaining
    if amount > remaining:
        raise BusinessRuleError(f"Amount exceeds the remaining balance of {remaining}")

    if data.method == PaymentMethod.CORPORATE_CREDIT:
        if order.customer_id is None:
            raise BusinessRuleError("Corporate credit needs a registered customer; walk-in orders cannot use it")
        customer = get_or_404(db, Customer, order.customer_id, "Customer", lock=True)
        if customer.status != ActiveStatus.ACTIVE:
            raise BusinessRuleError("Customer is inactive and cannot use corporate credit")
        customer.amount_due += amount

    txn_id = data.transaction_id or f"{data.method.value.upper()}-{uuid.uuid4().hex[:12].upper()}"
    if db.scalar(select(Payment.id).where(Payment.transaction_id == txn_id)):
        db.rollback()
        raise ConflictError("This transaction_id has already been recorded")

    payment = Payment(
        order_id=order.id, amount=amount, method=data.method, status=PaymentStatus.SUCCESS,
        transaction_id=txn_id, idempotency_key=idempotency_key, received_by=actor.id,
    )
    db.add(payment)
    try:
        db.commit()
    except IntegrityError as exc:  # lost a race on transaction_id / idempotency key
        db.rollback()
        if idempotency_key:
            existing = db.scalar(select(Payment).where(Payment.idempotency_key == idempotency_key))
            if existing and _same_request(existing, order_id, data):
                return existing, False
        raise ConflictError("Duplicate payment detected") from exc
    return payment, True


def order_payments(db: Session, order_id: uuid.UUID) -> OrderPayments:
    order = get_or_404(db, Order, order_id, "Order")
    pays = list(
        db.scalars(select(Payment).where(Payment.order_id == order.id).order_by(Payment.created_at, Payment.id))
    )
    paid = sum((p.amount for p in pays if p.status == PaymentStatus.SUCCESS), ZERO)
    return OrderPayments(
        order_id=order.id,
        order_total=order.total_amount,
        amount_paid=paid,
        balance_due=order.total_amount - paid,
        payment_state=payment_state(order.total_amount, paid),
        payments=[PaymentRead.model_validate(p) for p in pays],
    )


def list_payments(
    db: Session, params: PageParams, *, order_id: uuid.UUID | None, method: PaymentMethod | None,
    status: PaymentStatus | None, date_from: date | None, date_to: date | None,
):
    stmt = select(Payment).join(Order, Order.id == Payment.order_id).order_by(Payment.created_at.desc(), Payment.id)
    if order_id:
        stmt = stmt.where(Payment.order_id == order_id)
    if method:
        stmt = stmt.where(Payment.method == method)
    if status:
        stmt = stmt.where(Payment.status == status)
    if date_from:
        stmt = stmt.where(Order.business_date >= date_from)
    if date_to:
        stmt = stmt.where(Order.business_date <= date_to)
    return paginate(db, stmt, params)

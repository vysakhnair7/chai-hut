from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.deps import PageParams
from app.core.exceptions import BusinessRuleError, ConflictError
from app.enums import PaymentMethod, PaymentStatus
from app.models import CreditSettlement, Customer, Order, Payment, User
from app.schemas.payment_expense import (
    CompanyDue,
    CustomerLedger,
    LedgerEntry,
    OutstandingCustomer,
    OutstandingSummary,
    SettlementCreate,
    SettlementRead,
    SettlementResult,
)
from app.services.common import get_or_404, paginate
from app.utils.analytics import business_today
from app.utils.money import ZERO


def _same_request(s: CreditSettlement, data: SettlementCreate) -> bool:
    return s.customer_id == data.customer_id and s.amount == data.amount and s.method == data.method


def settle(
    db: Session, actor: User, settings: Settings, data: SettlementCreate, idempotency_key: str | None
) -> tuple[SettlementResult, bool]:
    """Customer pays off (part of) their corporate-credit dues. Returns (result, created).
    The customer row is locked, so two simultaneous settlements can't overdraw the balance."""
    if idempotency_key:
        existing = db.scalar(select(CreditSettlement).where(CreditSettlement.idempotency_key == idempotency_key))
        if existing:
            if not _same_request(existing, data):
                raise ConflictError("Idempotency-Key was already used for a different settlement")
            customer = db.get(Customer, existing.customer_id)
            return SettlementResult(settlement=SettlementRead.model_validate(existing),
                                    remaining_due=customer.amount_due), False

    customer = get_or_404(db, Customer, data.customer_id, "Customer", lock=True)
    if data.amount > customer.amount_due:
        raise BusinessRuleError(
            f"Settlement of {data.amount} exceeds the outstanding due of {customer.amount_due}"
        )
    if data.transaction_id and db.scalar(
        select(CreditSettlement.id).where(CreditSettlement.transaction_id == data.transaction_id)
    ):
        db.rollback()
        raise ConflictError("This transaction_id has already been recorded")

    customer.amount_due -= data.amount
    row = CreditSettlement(
        customer_id=customer.id, amount=data.amount, method=data.method,
        settlement_date=business_today(settings.business_timezone),
        transaction_id=data.transaction_id, idempotency_key=idempotency_key,
        note=data.note, received_by=actor.id,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("Duplicate settlement detected") from exc
    return SettlementResult(settlement=SettlementRead.model_validate(row), remaining_due=customer.amount_due), True


def outstanding(db: Session) -> OutstandingSummary:
    customers = db.scalars(
        select(Customer).where(Customer.amount_due > 0).order_by(Customer.amount_due.desc(), Customer.full_name)
    ).all()
    by_company: dict[str, list[Decimal]] = defaultdict(list)
    for c in customers:
        by_company[c.company_name].append(c.amount_due)
    return OutstandingSummary(
        total_outstanding=sum((c.amount_due for c in customers), ZERO),
        customers=[
            OutstandingCustomer(
                id=c.id, chai_id=c.chai_id, full_name=c.full_name, company_name=c.company_name,
                phone=c.phone, amount_due=c.amount_due,
            )
            for c in customers
        ],
        by_company=sorted(
            (CompanyDue(company_name=k, customers_with_dues=len(v), amount_due=sum(v, ZERO))
             for k, v in by_company.items()),
            key=lambda c: c.amount_due, reverse=True,
        ),
    )


def list_settlements(
    db: Session, params: PageParams, *, customer_id: uuid.UUID | None,
    date_from: date | None, date_to: date | None,
):
    stmt = select(CreditSettlement).order_by(CreditSettlement.created_at.desc(), CreditSettlement.id)
    if customer_id:
        stmt = stmt.where(CreditSettlement.customer_id == customer_id)
    if date_from:
        stmt = stmt.where(CreditSettlement.settlement_date >= date_from)
    if date_to:
        stmt = stmt.where(CreditSettlement.settlement_date <= date_to)
    return paginate(db, stmt, params)


def ledger(db: Session, customer_id: uuid.UUID) -> CustomerLedger:
    """Chronological credit statement: credit sales (+), reversals on cancellation (-),
    settlements (-), with a running balance."""
    customer = get_or_404(db, Customer, customer_id, "Customer")
    events: list[tuple] = []  # (timestamp, kind, signed amount, reference)
    credit_payments = db.execute(
        select(Payment, Order.order_token, Order.business_date)
        .join(Order, Order.id == Payment.order_id)
        .where(
            Order.customer_id == customer_id,
            Payment.method == PaymentMethod.CORPORATE_CREDIT,
            Payment.status.in_([PaymentStatus.SUCCESS, PaymentStatus.REFUNDED]),
        )
    ).all()
    for pay, token, day in credit_payments:
        ref = f"{token} on {day.isoformat()}"
        events.append((pay.created_at, "credit_sale", pay.amount, ref))
        if pay.status == PaymentStatus.REFUNDED:
            events.append((pay.updated_at, "credit_reversal", -pay.amount, ref))
    for s in db.scalars(select(CreditSettlement).where(CreditSettlement.customer_id == customer_id)):
        events.append((s.created_at, "settlement", -s.amount, s.transaction_id or s.note))

    entries, balance = [], ZERO
    for at, kind, amount, ref in sorted(events, key=lambda e: e[0]):
        balance += amount
        entries.append(LedgerEntry(at=at, kind=kind, amount=amount, balance_after=balance, reference=ref))
    return CustomerLedger(customer_id=customer.id, current_due=customer.amount_due, entries=entries)

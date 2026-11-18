from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.deps import PageParams
from app.core.exceptions import BusinessRuleError, ConflictError
from app.enums import ActiveStatus
from app.models import Customer, Order, User
from app.schemas.customer import CustomerCreate, CustomerUpdate
from app.services.common import conflict_on_integrity, get_or_404, like_pattern, paginate


def register(db: Session, actor: User, data: CustomerCreate) -> Customer:
    if db.scalar(select(Customer.id).where(Customer.username == data.username)):
        raise ConflictError("A customer with this username already exists")
    customer = Customer(
        chai_id=uuid.uuid4(),  # the corporate "Chai ID", generated here, never client-supplied
        username=data.username,
        full_name=data.full_name,
        company_name=data.company_name,
        phone=data.phone,
        status=ActiveStatus.ACTIVE,
        amount_due=Decimal("0.00"),
        created_by=actor.id,
    )
    with conflict_on_integrity(db, "A customer with this username already exists"):
        db.add(customer)
        db.commit()
    return customer


def _search_clause(term: str):
    pat = like_pattern(term)
    clauses = [
        Customer.full_name.ilike(pat, escape="\\"),
        Customer.company_name.ilike(pat, escape="\\"),
        Customer.username.ilike(pat, escape="\\"),
        Customer.phone.ilike(pat, escape="\\"),
    ]
    try:
        clauses.append(Customer.chai_id == uuid.UUID(term.strip()))
    except ValueError:
        pass
    return or_(*clauses)


def search(db: Session, term: str, limit: int = 20) -> list[Customer]:
    """Registration lookup for cashiers. Returned rows are mapped to the *basic* schema."""
    stmt = select(Customer).where(_search_clause(term)).order_by(Customer.full_name).limit(limit)
    return list(db.scalars(stmt).all())


def list_customers(
    db: Session,
    params: PageParams,
    q: str | None,
    company: str | None,
    status: ActiveStatus | None,
    has_due: bool | None,
):
    stmt = select(Customer).order_by(Customer.company_name, Customer.full_name, Customer.id)
    if q:
        stmt = stmt.where(_search_clause(q))
    if company:
        stmt = stmt.where(Customer.company_name.ilike(like_pattern(company), escape="\\"))
    if status:
        stmt = stmt.where(Customer.status == status)
    if has_due is True:
        stmt = stmt.where(Customer.amount_due > 0)
    elif has_due is False:
        stmt = stmt.where(Customer.amount_due == 0)
    return paginate(db, stmt, params)


def get_customer(db: Session, customer_id: uuid.UUID) -> Customer:
    return get_or_404(db, Customer, customer_id, "Customer")


def update_customer(db: Session, customer_id: uuid.UUID, data: CustomerUpdate) -> Customer:
    customer = get_or_404(db, Customer, customer_id, "Customer", lock=True)
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(customer, field, value)
    db.commit()
    return customer


def regenerate_chai_id(db: Session, customer_id: uuid.UUID) -> Customer:
    customer = get_or_404(db, Customer, customer_id, "Customer", lock=True)
    customer.chai_id = uuid.uuid4()
    with conflict_on_integrity(db, "Could not assign a unique Chai ID, please retry"):
        db.commit()
    return customer


def delete_customer(db: Session, customer_id: uuid.UUID) -> None:
    customer = get_or_404(db, Customer, customer_id, "Customer", lock=True)
    if customer.amount_due != 0:
        raise BusinessRuleError("Customer has outstanding dues; settle them first")
    if db.scalar(select(Order.id).where(Order.customer_id == customer.id).limit(1)):
        raise BusinessRuleError("Customer has order history; deactivate instead of deleting")
    with conflict_on_integrity(db, "Customer is referenced elsewhere; deactivate instead"):
        db.delete(customer)
        db.commit()

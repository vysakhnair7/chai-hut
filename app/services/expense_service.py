from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.deps import PageParams
from app.core.exceptions import BusinessRuleError
from app.enums import ActiveStatus
from app.models import Expense, ExpenseCategory, User
from app.schemas.payment_expense import (
    ExpenseCategoryCreate,
    ExpenseCategoryUpdate,
    ExpenseCreate,
    ExpenseUpdate,
)
from app.services.common import conflict_on_integrity, get_or_404, paginate
from app.utils.analytics import business_today


# ---------------- categories ----------------
def create_category(db: Session, data: ExpenseCategoryCreate) -> ExpenseCategory:
    cat = ExpenseCategory(name=data.name.strip(), description=data.description)
    with conflict_on_integrity(db, "An expense category with this name already exists"):
        db.add(cat)
        db.commit()
    return cat


def list_categories(db: Session, status: ActiveStatus | None) -> list[ExpenseCategory]:
    stmt = select(ExpenseCategory).order_by(ExpenseCategory.name)
    if status:
        stmt = stmt.where(ExpenseCategory.status == status)
    return list(db.scalars(stmt).all())


def update_category(db: Session, category_id: uuid.UUID, data: ExpenseCategoryUpdate) -> ExpenseCategory:
    cat = get_or_404(db, ExpenseCategory, category_id, "Expense category", lock=True)
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(cat, field, value.strip() if field == "name" else value)
    with conflict_on_integrity(db, "An expense category with this name already exists"):
        db.commit()
    return cat


# ---------------- expenses ----------------
def _active_category(db: Session, category_id: uuid.UUID) -> ExpenseCategory:
    cat = get_or_404(db, ExpenseCategory, category_id, "Expense category")
    if cat.status != ActiveStatus.ACTIVE:
        raise BusinessRuleError("Expense category is inactive")
    return cat


def _not_future(day: date, settings: Settings) -> None:
    if day > business_today(settings.business_timezone):
        raise BusinessRuleError("expense_date cannot be in the future")


def create_expense(db: Session, actor: User, settings: Settings, data: ExpenseCreate) -> Expense:
    _active_category(db, data.category_id)
    day = data.expense_date or business_today(settings.business_timezone)
    _not_future(day, settings)
    expense = Expense(
        category_id=data.category_id, description=data.description.strip(),
        amount=data.amount, expense_date=day, created_by=actor.id,
    )
    db.add(expense)
    db.commit()
    return expense


def list_expenses(
    db: Session, params: PageParams, *, category_id: uuid.UUID | None,
    date_from: date | None, date_to: date | None,
):
    stmt = select(Expense).order_by(Expense.expense_date.desc(), Expense.created_at.desc(), Expense.id)
    if category_id:
        stmt = stmt.where(Expense.category_id == category_id)
    if date_from:
        stmt = stmt.where(Expense.expense_date >= date_from)
    if date_to:
        stmt = stmt.where(Expense.expense_date <= date_to)
    return paginate(db, stmt, params)


def get_expense(db: Session, expense_id: uuid.UUID) -> Expense:
    return get_or_404(db, Expense, expense_id, "Expense")


def update_expense(db: Session, settings: Settings, expense_id: uuid.UUID, data: ExpenseUpdate) -> Expense:
    expense = get_or_404(db, Expense, expense_id, "Expense", lock=True)
    changes = data.model_dump(exclude_unset=True)
    if changes.get("category_id"):
        _active_category(db, changes["category_id"])
    if changes.get("expense_date"):
        _not_future(changes["expense_date"], settings)
    for field, value in changes.items():
        if value is not None:
            setattr(expense, field, value.strip() if field == "description" else value)
    db.commit()
    return expense


def delete_expense(db: Session, expense_id: uuid.UUID) -> None:
    expense = get_or_404(db, Expense, expense_id, "Expense", lock=True)
    db.delete(expense)
    db.commit()

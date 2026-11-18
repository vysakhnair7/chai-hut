from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.core.deps import PageParams, page_params, require_permissions
from app.core.rbac import Permission as P
from app.enums import ActiveStatus
from app.models import User
from app.routers.common import PROTECTED, make_page
from app.schemas.common import Page
from app.schemas.payment_expense import (
    ExpenseCategoryCreate,
    ExpenseCategoryRead,
    ExpenseCategoryUpdate,
    ExpenseCreate,
    ExpenseRead,
    ExpenseUpdate,
)
from app.services import expense_service

router = APIRouter(tags=["Expenses"], responses=PROTECTED)


@router.get(
    "/expense-categories",
    response_model=list[ExpenseCategoryRead],
    summary="List expense categories",
    dependencies=[Depends(require_permissions(P.EXPENSES_READ))],
)
def list_categories(status: ActiveStatus | None = None, db: Session = Depends(get_db)):
    return expense_service.list_categories(db, status)


@router.post(
    "/expense-categories",
    response_model=ExpenseCategoryRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create an expense category (owner)",
    dependencies=[Depends(require_permissions(P.EXPENSE_CATEGORIES_MANAGE))],
)
def create_category(body: ExpenseCategoryCreate, db: Session = Depends(get_db)):
    return expense_service.create_category(db, body)


@router.patch(
    "/expense-categories/{category_id}",
    response_model=ExpenseCategoryRead,
    summary="Update an expense category (owner)",
    dependencies=[Depends(require_permissions(P.EXPENSE_CATEGORIES_MANAGE))],
)
def update_category(category_id: uuid.UUID, body: ExpenseCategoryUpdate, db: Session = Depends(get_db)):
    return expense_service.update_category(db, category_id, body)


@router.post(
    "/expenses",
    response_model=ExpenseRead,
    status_code=status.HTTP_201_CREATED,
    summary="Record an expense",
)
def create_expense(
    body: ExpenseCreate,
    actor: User = Depends(require_permissions(P.EXPENSES_WRITE)),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    return expense_service.create_expense(db, actor, settings, body)


@router.get(
    "/expenses",
    response_model=Page[ExpenseRead],
    summary="List expenses",
    dependencies=[Depends(require_permissions(P.EXPENSES_READ))],
)
def list_expenses(
    category_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
):
    rows, total = expense_service.list_expenses(
        db, params, category_id=category_id, date_from=date_from, date_to=date_to
    )
    return make_page(rows, total, params)


@router.get(
    "/expenses/{expense_id}",
    response_model=ExpenseRead,
    summary="Get an expense",
    dependencies=[Depends(require_permissions(P.EXPENSES_READ))],
)
def get_expense(expense_id: uuid.UUID, db: Session = Depends(get_db)):
    return expense_service.get_expense(db, expense_id)


@router.patch(
    "/expenses/{expense_id}",
    response_model=ExpenseRead,
    summary="Edit an expense",
    dependencies=[Depends(require_permissions(P.EXPENSES_WRITE))],
)
def update_expense(
    expense_id: uuid.UUID,
    body: ExpenseUpdate,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    return expense_service.update_expense(db, settings, expense_id, body)


@router.delete(
    "/expenses/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an expense (owner)",
    dependencies=[Depends(require_permissions(P.EXPENSES_DELETE))],
)
def delete_expense(expense_id: uuid.UUID, db: Session = Depends(get_db)):
    expense_service.delete_expense(db, expense_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

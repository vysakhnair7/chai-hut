from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Header, Response, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.core.deps import PageParams, page_params, require_permissions
from app.core.rbac import Permission as P
from app.models import User
from app.routers.common import PROTECTED, make_page
from app.schemas.common import ErrorResponse, Page
from app.schemas.payment_expense import (
    CustomerLedger,
    OutstandingSummary,
    SettlementCreate,
    SettlementRead,
    SettlementResult,
)
from app.services import credit_service

router = APIRouter(prefix="/credit", tags=["Corporate Credit"], responses=PROTECTED)


@router.get(
    "/outstanding",
    response_model=OutstandingSummary,
    summary="Everyone who owes money, with totals per company",
    dependencies=[Depends(require_permissions(P.CREDIT_READ))],
)
def outstanding(db: Session = Depends(get_db)):
    return credit_service.outstanding(db)


@router.post(
    "/settlements",
    response_model=SettlementResult,
    status_code=status.HTTP_201_CREATED,
    summary="Record a customer paying off their corporate-credit dues",
    responses={
        200: {"model": SettlementResult, "description": "Replay of an earlier request with the same Idempotency-Key"},
        409: {"model": ErrorResponse, "description": "Duplicate transaction"},
        422: {"model": ErrorResponse, "description": "Amount exceeds the outstanding due"},
    },
)
def settle(
    body: SettlementCreate,
    response: Response,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", min_length=8, max_length=80),
    actor: User = Depends(require_permissions(P.CREDIT_SETTLE)),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """Typically at month end / salary day. Partial settlements are allowed; settling more
    than the due is rejected."""
    result, created = credit_service.settle(db, actor, settings, body, idempotency_key)
    if not created:
        response.status_code = status.HTTP_200_OK
    return result


@router.get(
    "/settlements",
    response_model=Page[SettlementRead],
    summary="Settlement history",
    dependencies=[Depends(require_permissions(P.CREDIT_READ))],
)
def list_settlements(
    customer_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
):
    rows, total = credit_service.list_settlements(
        db, params, customer_id=customer_id, date_from=date_from, date_to=date_to
    )
    return make_page(rows, total, params)


@router.get(
    "/customers/{customer_id}/ledger",
    response_model=CustomerLedger,
    summary="Credit statement for one customer with running balance",
    dependencies=[Depends(require_permissions(P.CREDIT_READ))],
)
def customer_ledger(customer_id: uuid.UUID, db: Session = Depends(get_db)):
    return credit_service.ledger(db, customer_id)

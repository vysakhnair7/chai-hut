from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Header, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import PageParams, page_params, require_permissions
from app.core.rbac import Permission as P
from app.enums import PaymentMethod, PaymentStatus
from app.models import User
from app.routers.common import PROTECTED, make_page
from app.schemas.common import ErrorResponse, Page
from app.schemas.payment_expense import OrderPayments, PaymentCreate, PaymentRead
from app.services import payment_service

router = APIRouter(tags=["Payments"], responses=PROTECTED)

IdempotencyKey = Header(
    default=None,
    alias="Idempotency-Key",
    min_length=8,
    max_length=80,
    description="Send the same key when retrying so the payment is never applied twice.",
)


@router.post(
    "/orders/{order_id}/payments",
    response_model=PaymentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Record a payment (cash / UPI / card / corporate credit)",
    responses={
        200: {"model": PaymentRead, "description": "Replay of an earlier request with the same Idempotency-Key"},
        409: {"model": ErrorResponse, "description": "Already paid, or duplicate transaction"},
    },
)
def record_payment(
    order_id: uuid.UUID,
    body: PaymentCreate,
    response: Response,
    idempotency_key: str | None = IdempotencyKey,
    actor: User = Depends(require_permissions(P.PAYMENTS_CREATE)),
    db: Session = Depends(get_db),
):
    """Omit `amount` to pay the full remaining balance. Corporate credit adds the amount to
    the customer's due; it is never counted as cash collected."""
    payment, created = payment_service.record_payment(db, actor, order_id, body, idempotency_key)
    if not created:
        response.status_code = status.HTTP_200_OK
    return payment


@router.get(
    "/orders/{order_id}/payments",
    response_model=OrderPayments,
    summary="Payments and balance for one order",
    dependencies=[Depends(require_permissions(P.PAYMENTS_READ))],
)
def order_payments(order_id: uuid.UUID, db: Session = Depends(get_db)):
    return payment_service.order_payments(db, order_id)


@router.get(
    "/payments",
    response_model=Page[PaymentRead],
    summary="Payment history",
    dependencies=[Depends(require_permissions(P.PAYMENTS_READ))],
)
def list_payments(
    order_id: uuid.UUID | None = None,
    method: PaymentMethod | None = None,
    status: PaymentStatus | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
):
    rows, total = payment_service.list_payments(
        db, params, order_id=order_id, method=method, status=status, date_from=date_from, date_to=date_to
    )
    return make_page(rows, total, params)

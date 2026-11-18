from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.core.deps import PageParams, page_params, require_permissions
from app.core.rbac import Permission as P
from app.enums import OrderStatus
from app.models import User
from app.routers.common import PROTECTED, make_page
from app.schemas.common import ErrorResponse, Page
from app.schemas.order import (
    BillRead,
    OrderCreate,
    OrderRead,
    OrderStatusUpdate,
    TrackResponse,
)
from app.services import order_service

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.get(
    "/track/{token}",
    response_model=TrackResponse,
    summary="Public order tracking by today's token",
    responses={404: {"model": ErrorResponse, "description": "No order with that token today"}},
)
def track_order(
    token: str = Path(min_length=2, max_length=12, pattern=r"^[A-Za-z0-9]+$"),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """No login needed: lets a customer watch a token on a screen. Exposes the status only,
    nothing about the customer, items or payment."""
    return order_service.track(db, settings, token)


@router.post(
    "",
    response_model=OrderRead,
    status_code=status.HTTP_201_CREATED,
    summary="Place an order (registered customer or walk-in) and generate its token",
    responses=PROTECTED,
)
def create_order(
    body: OrderCreate,
    actor: User = Depends(require_permissions(P.ORDERS_CREATE)),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """Stock is checked and decremented in the same transaction. Prices, cost and GST are
    snapshotted onto the order items. Only managers/owners may set `discount_amount`."""
    return order_service.create_order(db, actor, settings, body)


@router.get("", response_model=Page[OrderRead], summary="List orders", responses=PROTECTED)
def list_orders(
    status: OrderStatus | None = None,
    business_date: date | None = Query(None, description="Ignored for cashiers (they only see today)"),
    token: str | None = Query(None, max_length=12),
    customer_id: uuid.UUID | None = None,
    params: PageParams = Depends(page_params),
    actor: User = Depends(require_permissions(P.ORDERS_READ)),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    rows, total = order_service.list_orders(
        db, actor, settings, params, status=status, business_date=business_date, token=token, customer_id=customer_id
    )
    return make_page(rows, total, params)


@router.get("/{order_id}", response_model=OrderRead, summary="Get an order", responses=PROTECTED)
def get_order(
    order_id: uuid.UUID,
    actor: User = Depends(require_permissions(P.ORDERS_READ)),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    return order_service.get_order(db, actor, settings, order_id)


@router.get(
    "/{order_id}/bill",
    response_model=BillRead,
    summary="Generate the bill from the order and its items",
    responses=PROTECTED,
)
def get_bill(
    order_id: uuid.UUID,
    actor: User = Depends(require_permissions(P.ORDERS_READ)),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """There is no bills table. Payment fields are filled only for roles with `payments:read`
    (cashiers get them as null)."""
    return order_service.bill(db, actor, settings, order_id)


@router.patch(
    "/{order_id}/status",
    response_model=OrderRead,
    summary="Advance an order: placed -> preparing -> ready -> completed",
    responses=PROTECTED,
)
def update_status(
    order_id: uuid.UUID,
    body: OrderStatusUpdate,
    actor: User = Depends(require_permissions(P.ORDERS_UPDATE_STATUS)),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    return order_service.update_status(db, actor, settings, order_id, body.status)


@router.post(
    "/{order_id}/cancel",
    response_model=OrderRead,
    summary="Cancel an order (restores stock, refunds payments, reverses credit)",
    dependencies=[Depends(require_permissions(P.ORDERS_CANCEL))],
    responses=PROTECTED,
)
def cancel_order(order_id: uuid.UUID, db: Session = Depends(get_db)):
    return order_service.cancel_order(db, order_id)

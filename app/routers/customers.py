from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import PageParams, page_params, require_permissions
from app.core.rbac import Permission as P
from app.enums import ActiveStatus
from app.models import User
from app.routers.common import PROTECTED, make_page
from app.schemas.common import Page
from app.schemas.customer import (
    CustomerBasic,
    CustomerCreate,
    CustomerFull,
    CustomerPreferences,
    CustomerUpdate,
    SetRegularRequest,
)
from app.services import customer_service, preference_service

router = APIRouter(prefix="/customers", tags=["Customers"], responses=PROTECTED)


@router.get(
    "/search",
    response_model=list[CustomerBasic],
    summary="Look up registered customers (basic info only)",
    dependencies=[Depends(require_permissions(P.CUSTOMERS_SEARCH))],
)
def search_customers(
    q: str = Query(min_length=2, max_length=100, description="Name, company, username, phone or Chai ID"),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Cashier-safe: returns identity and registration status only (no phone, no dues)."""
    return customer_service.search(db, q, limit)


@router.post(
    "",
    response_model=CustomerFull,
    status_code=status.HTTP_201_CREATED,
    summary="Register a customer and assign a Chai ID",
)
def register_customer(
    body: CustomerCreate,
    actor: User = Depends(require_permissions(P.CUSTOMERS_REGISTER, P.CUSTOMERS_ASSIGN_CHAI_ID)),
    db: Session = Depends(get_db),
):
    return customer_service.register(db, actor, body)


@router.get(
    "",
    response_model=Page[CustomerFull],
    summary="List customers (includes phone and amount due)",
    dependencies=[Depends(require_permissions(P.CUSTOMERS_READ_FULL))],
)
def list_customers(
    q: str | None = Query(None, max_length=100),
    company: str | None = Query(None, max_length=160),
    status: ActiveStatus | None = None,
    has_due: bool | None = Query(None, description="true: owes money; false: nothing to pay"),
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
):
    rows, total = customer_service.list_customers(db, params, q, company, status, has_due)
    return make_page(rows, total, params)


@router.get(
    "/{customer_id}",
    response_model=CustomerFull,
    summary="Get a customer (full)",
    dependencies=[Depends(require_permissions(P.CUSTOMERS_READ_FULL))],
)
def get_customer(customer_id: uuid.UUID, db: Session = Depends(get_db)):
    return customer_service.get_customer(db, customer_id)


@router.get(
    "/{customer_id}/basic",
    response_model=CustomerBasic,
    summary="Verify a customer's registration (basic info only)",
    dependencies=[Depends(require_permissions(P.CUSTOMERS_SEARCH))],
)
def get_customer_basic(customer_id: uuid.UUID, db: Session = Depends(get_db)):
    return customer_service.get_customer(db, customer_id)


@router.patch(
    "/{customer_id}",
    response_model=CustomerFull,
    summary="Update customer details or status",
    dependencies=[Depends(require_permissions(P.CUSTOMERS_UPDATE))],
)
def update_customer(customer_id: uuid.UUID, body: CustomerUpdate, db: Session = Depends(get_db)):
    return customer_service.update_customer(db, customer_id, body)


@router.post(
    "/{customer_id}/chai-id/regenerate",
    response_model=CustomerFull,
    summary="Issue a new random Chai ID (UUID)",
    dependencies=[Depends(require_permissions(P.CUSTOMERS_ASSIGN_CHAI_ID))],
)
def regenerate_chai_id(customer_id: uuid.UUID, db: Session = Depends(get_db)):
    return customer_service.regenerate_chai_id(db, customer_id)


@router.delete(
    "/{customer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a customer (only if no dues and no order history)",
    dependencies=[Depends(require_permissions(P.CUSTOMERS_DELETE))],
)
def delete_customer(customer_id: uuid.UUID, db: Session = Depends(get_db)):
    customer_service.delete_customer(db, customer_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------- preferences ----------------
@router.get(
    "/{customer_id}/preferences",
    response_model=CustomerPreferences,
    tags=["Preferences"],
    summary="Saved regular drink + most frequently ordered products",
    dependencies=[Depends(require_permissions(P.PREFERENCES_READ))],
)
def get_preferences(customer_id: uuid.UUID, db: Session = Depends(get_db)):
    """`most_frequent` is computed live from the customer's completed bills: the product
    appearing in the most bills wins."""
    return preference_service.get_preferences(db, customer_id)


@router.put(
    "/{customer_id}/preferences/regular",
    response_model=CustomerPreferences,
    tags=["Preferences"],
    summary="Set the single active regular drink",
    dependencies=[Depends(require_permissions(P.PREFERENCES_MANAGE))],
)
def set_regular(customer_id: uuid.UUID, body: SetRegularRequest, db: Session = Depends(get_db)):
    return preference_service.set_regular(db, customer_id, body.product_id)


@router.delete(
    "/{customer_id}/preferences/regular",
    response_model=CustomerPreferences,
    tags=["Preferences"],
    summary="Clear the regular drink",
    dependencies=[Depends(require_permissions(P.PREFERENCES_MANAGE))],
)
def clear_regular(customer_id: uuid.UUID, db: Session = Depends(get_db)):
    return preference_service.clear_regular(db, customer_id)

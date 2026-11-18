from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.core.deps import PageParams, page_params, require_permissions
from app.core.rbac import Permission as P
from app.enums import ActiveStatus, ProductStatus
from app.routers.common import PROTECTED, make_page
from app.schemas.catalog import (
    CategoryCreate,
    CategoryRead,
    CategoryUpdate,
    PopularProduct,
    PriceUpdate,
    ProductCreate,
    ProductDetail,
    ProductPublic,
    ProductUpdate,
    StockUpdate,
)
from app.schemas.common import Page
from app.services import catalog_service

router = APIRouter(tags=["Menu"], responses=PROTECTED)


# ---------------- categories ----------------
@router.get(
    "/categories",
    response_model=list[CategoryRead],
    summary="List menu categories",
    dependencies=[Depends(require_permissions(P.CATALOG_READ))],
)
def list_categories(status: ActiveStatus | None = None, db: Session = Depends(get_db)):
    return catalog_service.list_categories(db, status)


@router.post(
    "/categories",
    response_model=CategoryRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a category",
    dependencies=[Depends(require_permissions(P.CATALOG_MANAGE))],
)
def create_category(body: CategoryCreate, db: Session = Depends(get_db)):
    return catalog_service.create_category(db, body)


@router.patch(
    "/categories/{category_id}",
    response_model=CategoryRead,
    summary="Update a category",
    dependencies=[Depends(require_permissions(P.CATALOG_MANAGE))],
)
def update_category(category_id: uuid.UUID, body: CategoryUpdate, db: Session = Depends(get_db)):
    return catalog_service.update_category(db, category_id, body)


@router.delete(
    "/categories/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an empty category",
    dependencies=[Depends(require_permissions(P.CATALOG_MANAGE))],
)
def delete_category(category_id: uuid.UUID, db: Session = Depends(get_db)):
    catalog_service.delete_category(db, category_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------- products ----------------
@router.get(
    "/products",
    response_model=Page[ProductPublic],
    summary="List products with price and stock left (no cost data)",
    dependencies=[Depends(require_permissions(P.CATALOG_READ))],
)
def list_products(
    q: str | None = Query(None, max_length=100),
    category_id: uuid.UUID | None = None,
    status: ProductStatus | None = None,
    in_stock_only: bool = False,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
):
    rows, total = catalog_service.list_products(db, params, q, category_id, status, in_stock_only)
    return make_page(rows, total, params)


@router.get(
    "/products/popular",
    response_model=list[PopularProduct],
    summary="Most frequently ordered products (completed orders)",
    dependencies=[Depends(require_permissions(P.CATALOG_READ))],
)
def popular_products(limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    return catalog_service.popular_products(db, limit)


@router.post(
    "/products",
    response_model=ProductDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a product",
    dependencies=[Depends(require_permissions(P.CATALOG_MANAGE))],
)
def create_product(body: ProductCreate, db: Session = Depends(get_db), settings: Settings = Depends(get_settings)):
    return catalog_service.to_detail(catalog_service.create_product(db, settings, body))


@router.get(
    "/products/{product_id}",
    response_model=ProductPublic,
    summary="Get a product (no cost data)",
    dependencies=[Depends(require_permissions(P.CATALOG_READ))],
)
def get_product(product_id: uuid.UUID, db: Session = Depends(get_db)):
    return catalog_service.get_product(db, product_id)


@router.get(
    "/products/{product_id}/detail",
    response_model=ProductDetail,
    summary="Get a product including cost price and margin",
    dependencies=[Depends(require_permissions(P.PRODUCTS_READ_COST))],
)
def get_product_detail(product_id: uuid.UUID, db: Session = Depends(get_db)):
    return catalog_service.to_detail(catalog_service.get_product(db, product_id))


@router.patch(
    "/products/{product_id}",
    response_model=ProductDetail,
    summary="Update product details or status",
    dependencies=[Depends(require_permissions(P.CATALOG_MANAGE))],
)
def update_product(product_id: uuid.UUID, body: ProductUpdate, db: Session = Depends(get_db)):
    return catalog_service.to_detail(catalog_service.update_product(db, product_id, body))


@router.patch(
    "/products/{product_id}/price",
    response_model=ProductDetail,
    summary="Change MRP and/or cost price (past orders keep their snapshot)",
    dependencies=[Depends(require_permissions(P.PRODUCTS_UPDATE_PRICE))],
)
def update_price(product_id: uuid.UUID, body: PriceUpdate, db: Session = Depends(get_db)):
    return catalog_service.to_detail(catalog_service.update_price(db, product_id, body))


@router.put(
    "/products/{product_id}/stock",
    response_model=ProductPublic,
    summary="Set stock quantity",
    dependencies=[Depends(require_permissions(P.PRODUCTS_UPDATE_STOCK))],
)
def update_stock(product_id: uuid.UUID, body: StockUpdate, db: Session = Depends(get_db)):
    return catalog_service.update_stock(db, product_id, body.stock_quantity)


@router.delete(
    "/products/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Discontinue a product (kept for order history)",
    dependencies=[Depends(require_permissions(P.CATALOG_MANAGE))],
)
def discontinue_product(product_id: uuid.UUID, db: Session = Depends(get_db)):
    catalog_service.discontinue_product(db, product_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

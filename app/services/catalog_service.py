from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.deps import PageParams
from app.core.exceptions import BusinessRuleError
from app.enums import ActiveStatus, OrderStatus, ProductStatus
from app.models import Order, OrderItem, Product, ProductCategory
from app.schemas.catalog import (
    CategoryCreate,
    CategoryUpdate,
    PopularProduct,
    PriceUpdate,
    ProductCreate,
    ProductDetail,
    ProductUpdate,
)
from app.services.common import conflict_on_integrity, get_or_404, like_pattern, paginate


# ---------------- categories ----------------
def create_category(db: Session, data: CategoryCreate) -> ProductCategory:
    cat = ProductCategory(name=data.name.strip(), description=data.description)
    with conflict_on_integrity(db, "A category with this name already exists"):
        db.add(cat)
        db.commit()
    return cat


def list_categories(db: Session, status: ActiveStatus | None) -> list[ProductCategory]:
    stmt = select(ProductCategory).order_by(ProductCategory.name)
    if status:
        stmt = stmt.where(ProductCategory.status == status)
    return list(db.scalars(stmt).all())


def update_category(db: Session, category_id: uuid.UUID, data: CategoryUpdate) -> ProductCategory:
    cat = get_or_404(db, ProductCategory, category_id, "Category", lock=True)
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(cat, field, value.strip() if field == "name" else value)
    with conflict_on_integrity(db, "A category with this name already exists"):
        db.commit()
    return cat


def delete_category(db: Session, category_id: uuid.UUID) -> None:
    cat = get_or_404(db, ProductCategory, category_id, "Category", lock=True)
    if db.scalar(select(Product.id).where(Product.category_id == cat.id).limit(1)):
        raise BusinessRuleError("Category still has products; deactivate it instead")
    db.delete(cat)
    db.commit()


# ---------------- products ----------------
def sync_stock_status(product: Product) -> None:
    """Keep status consistent with stock. DISCONTINUED is a manual decision and sticks."""
    if product.status == ProductStatus.DISCONTINUED:
        return
    product.status = ProductStatus.AVAILABLE if product.stock_quantity > 0 else ProductStatus.OUT_OF_STOCK


def to_detail(p: Product) -> ProductDetail:
    margin = (p.mrp - p.cost_price) if p.cost_price is not None else None
    return ProductDetail(
        id=p.id, category_id=p.category_id, name=p.name, description=p.description, mrp=p.mrp,
        gst_rate=p.gst_rate, stock_quantity=p.stock_quantity, status=p.status,
        cost_price=p.cost_price, margin=margin,
    )


def _active_category(db: Session, category_id: uuid.UUID) -> ProductCategory:
    cat = get_or_404(db, ProductCategory, category_id, "Category")
    if cat.status != ActiveStatus.ACTIVE:
        raise BusinessRuleError("Category is inactive")
    return cat


def create_product(db: Session, settings: Settings, data: ProductCreate) -> Product:
    _active_category(db, data.category_id)
    product = Product(
        category_id=data.category_id,
        name=data.name.strip(),
        description=data.description,
        mrp=data.mrp,
        cost_price=data.cost_price,
        gst_rate=data.gst_rate if data.gst_rate is not None else settings.default_gst_rate,
        stock_quantity=data.stock_quantity,
    )
    sync_stock_status(product)
    with conflict_on_integrity(db, "A product with this name already exists"):
        db.add(product)
        db.commit()
    return product


def list_products(
    db: Session,
    params: PageParams,
    q: str | None,
    category_id: uuid.UUID | None,
    status: ProductStatus | None,
    in_stock_only: bool,
):
    stmt = select(Product).order_by(Product.name, Product.id)
    if q:
        stmt = stmt.where(Product.name.ilike(like_pattern(q), escape="\\"))
    if category_id:
        stmt = stmt.where(Product.category_id == category_id)
    if status:
        stmt = stmt.where(Product.status == status)
    if in_stock_only:
        stmt = stmt.where(Product.stock_quantity > 0, Product.status == ProductStatus.AVAILABLE)
    return paginate(db, stmt, params)


def get_product(db: Session, product_id: uuid.UUID) -> Product:
    return get_or_404(db, Product, product_id, "Product")


def update_product(db: Session, product_id: uuid.UUID, data: ProductUpdate) -> Product:
    product = get_or_404(db, Product, product_id, "Product", lock=True)
    changes = data.model_dump(exclude_unset=True)
    if changes.get("category_id"):
        _active_category(db, changes["category_id"])
    for field, value in changes.items():
        if value is not None:
            setattr(product, field, value.strip() if field == "name" else value)
    if "status" in changes and changes["status"] != ProductStatus.DISCONTINUED:
        sync_stock_status(product)  # can't mark "available" with zero stock
    with conflict_on_integrity(db, "A product with this name already exists"):
        db.commit()
    return product


def update_price(db: Session, product_id: uuid.UUID, data: PriceUpdate) -> Product:
    """Historical orders are unaffected: order_items snapshot price, cost and GST."""
    product = get_or_404(db, Product, product_id, "Product", lock=True)
    if data.mrp is not None:
        product.mrp = data.mrp
    if data.cost_price is not None:
        product.cost_price = data.cost_price
    db.commit()
    return product


def update_stock(db: Session, product_id: uuid.UUID, quantity: int) -> Product:
    product = get_or_404(db, Product, product_id, "Product", lock=True)
    product.stock_quantity = quantity
    sync_stock_status(product)
    db.commit()
    return product


def discontinue_product(db: Session, product_id: uuid.UUID) -> None:
    """Products are never hard-deleted (order history references them)."""
    product = get_or_404(db, Product, product_id, "Product", lock=True)
    product.status = ProductStatus.DISCONTINUED
    db.commit()


def popular_products(db: Session, limit: int) -> list[PopularProduct]:
    """Most frequently ordered products overall, from COMPLETED orders."""
    orders_with = func.count(func.distinct(Order.id))
    qty = func.coalesce(func.sum(OrderItem.quantity), 0)
    rows = db.execute(
        select(Product.id, Product.name, orders_with, qty, Product.status, Product.stock_quantity)
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.status == OrderStatus.COMPLETED)
        .group_by(Product.id, Product.name, Product.status, Product.stock_quantity)
        .order_by(orders_with.desc(), qty.desc(), Product.name)
        .limit(limit)
    ).all()
    return [
        PopularProduct(
            product_id=r[0], name=r[1], orders_with_product=r[2], quantity_sold=int(r[3]),
            is_available=r[4] == ProductStatus.AVAILABLE and r[5] > 0,
        )
        for r in rows
    ]

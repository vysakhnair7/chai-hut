"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-11-18
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

# Constraint/index names are produced by the naming convention on Base.metadata
# (migrations/env.py passes it through target_metadata), matching the models exactly.


def _pk() -> sa.Column:
    return sa.Column("id", sa.Uuid(), nullable=False)


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def _status() -> sa.Column:
    return sa.Column("status", sa.String(20), nullable=False)


def upgrade() -> None:
    # ---------------- users ----------------
    op.create_table(
        "users",
        _pk(),
        sa.Column("username", sa.String(50), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        _status(),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
    )
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    # ---------------- customers ----------------
    op.create_table(
        "customers",
        _pk(),
        sa.Column("chai_id", sa.Uuid(), nullable=False),
        sa.Column("username", sa.String(50), nullable=False),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("company_name", sa.String(160), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        _status(),
        sa.Column("amount_due", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        *_timestamps(),
        sa.CheckConstraint("amount_due >= 0", name="amount_due_non_negative"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_customers")),
    )
    op.create_index(op.f("ix_customers_chai_id"), "customers", ["chai_id"], unique=True)
    op.create_index(op.f("ix_customers_username"), "customers", ["username"], unique=True)
    op.create_index(op.f("ix_customers_full_name"), "customers", ["full_name"])
    op.create_index(op.f("ix_customers_company_name"), "customers", ["company_name"])
    op.create_index(op.f("ix_customers_phone"), "customers", ["phone"])
    op.create_index("ix_customers_status_due", "customers", ["status", "amount_due"])

    # ---------------- product_categories ----------------
    op.create_table(
        "product_categories",
        _pk(),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        _status(),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_product_categories")),
        sa.UniqueConstraint("name"),
    )

    # ---------------- products ----------------
    op.create_table(
        "products",
        _pk(),
        sa.Column("category_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("mrp", sa.Numeric(10, 2), nullable=False),
        sa.Column("cost_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("gst_rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("stock_quantity", sa.Integer(), nullable=False),
        _status(),
        *_timestamps(),
        sa.CheckConstraint("mrp >= 0", name="mrp_non_negative"),
        sa.CheckConstraint("cost_price IS NULL OR cost_price >= 0", name="cost_non_negative"),
        sa.CheckConstraint("gst_rate >= 0 AND gst_rate <= 100", name="gst_rate_range"),
        sa.CheckConstraint("stock_quantity >= 0", name="stock_non_negative"),
        sa.ForeignKeyConstraint(["category_id"], ["product_categories.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_products")),
    )
    op.create_index(op.f("ix_products_category_id"), "products", ["category_id"])
    op.create_index(op.f("ix_products_name"), "products", ["name"], unique=True)
    op.create_index("ix_products_status", "products", ["status"])

    # ---------------- customer_preferences ----------------
    op.create_table(
        "customer_preferences",
        _pk(),
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("is_regular", sa.Boolean(), server_default=sa.false(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_customer_preferences")),
        sa.UniqueConstraint("customer_id", "product_id", name="uq_customer_preferences_customer_product"),
    )
    op.create_index(op.f("ix_customer_preferences_customer_id"), "customer_preferences", ["customer_id"])
    op.create_index(op.f("ix_customer_preferences_product_id"), "customer_preferences", ["product_id"])
    # Exactly one regular drink per customer, enforced by the database itself.
    op.create_index(
        "uq_customer_preferences_one_regular",
        "customer_preferences",
        ["customer_id"],
        unique=True,
        postgresql_where=sa.text("is_regular"),
    )

    # ---------------- orders ----------------
    op.create_table(
        "order_token_counters",
        sa.Column("business_date", sa.Date(), nullable=False),
        sa.Column("last_value", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("business_date", name=op.f("pk_order_token_counters")),
    )
    op.create_table(
        "orders",
        _pk(),
        sa.Column("customer_id", sa.Uuid(), nullable=True),
        sa.Column("walk_in_name", sa.String(80), nullable=True),
        sa.Column("business_date", sa.Date(), nullable=False),
        sa.Column("token_number", sa.Integer(), nullable=False),
        sa.Column("order_token", sa.String(12), nullable=False),
        _status(),
        sa.Column("subtotal_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("cgst_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("sgst_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("tax_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("discount_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.CheckConstraint(
            "subtotal_amount >= 0 AND discount_amount >= 0 AND tax_amount >= 0", name="amounts_non_negative"
        ),
        sa.CheckConstraint("discount_amount <= subtotal_amount", name="discount_within_subtotal"),
        sa.CheckConstraint("tax_amount = cgst_amount + sgst_amount", name="tax_split_consistent"),
        sa.CheckConstraint(
            "total_amount = subtotal_amount - discount_amount + tax_amount", name="total_consistent"
        ),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_orders")),
        sa.UniqueConstraint("business_date", "token_number", name="uq_orders_business_date_token"),
    )
    op.create_index(op.f("ix_orders_customer_id"), "orders", ["customer_id"])
    op.create_index(op.f("ix_orders_business_date"), "orders", ["business_date"])
    op.create_index(op.f("ix_orders_created_by"), "orders", ["created_by"])
    op.create_index("ix_orders_date_status", "orders", ["business_date", "status"])
    op.create_index("ix_orders_token", "orders", ["business_date", "order_token"])

    op.create_table(
        "order_items",
        _pk(),
        sa.Column("order_id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("product_name", sa.String(120), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("unit_cost", sa.Numeric(10, 2), nullable=True),
        sa.Column("gst_rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("total_price", sa.Numeric(12, 2), nullable=False),
        sa.CheckConstraint("quantity > 0", name="quantity_positive"),
        sa.CheckConstraint("total_price = quantity * unit_price", name="line_total_consistent"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_order_items")),
    )
    op.create_index(op.f("ix_order_items_order_id"), "order_items", ["order_id"])
    op.create_index(op.f("ix_order_items_product_id"), "order_items", ["product_id"])

    # ---------------- payments ----------------
    op.create_table(
        "payments",
        _pk(),
        sa.Column("order_id", sa.Uuid(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("method", sa.String(20), nullable=False),
        _status(),
        sa.Column("transaction_id", sa.String(100), nullable=True),
        sa.Column("idempotency_key", sa.String(80), nullable=True),
        sa.Column("received_by", sa.Uuid(), nullable=False),
        *_timestamps(),
        sa.CheckConstraint("amount > 0", name="amount_positive"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["received_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_payments")),
        sa.UniqueConstraint("transaction_id"),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index(op.f("ix_payments_order_id"), "payments", ["order_id"])
    op.create_index("ix_payments_method_status", "payments", ["method", "status"])

    op.create_table(
        "credit_settlements",
        _pk(),
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("method", sa.String(20), nullable=False),
        sa.Column("settlement_date", sa.Date(), nullable=False),
        sa.Column("transaction_id", sa.String(100), nullable=True),
        sa.Column("idempotency_key", sa.String(80), nullable=True),
        sa.Column("note", sa.String(255), nullable=True),
        sa.Column("received_by", sa.Uuid(), nullable=False),
        *_timestamps(),
        sa.CheckConstraint("amount > 0", name="settlement_amount_positive"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["received_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_credit_settlements")),
        sa.UniqueConstraint("transaction_id"),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index(op.f("ix_credit_settlements_customer_id"), "credit_settlements", ["customer_id"])
    op.create_index(op.f("ix_credit_settlements_settlement_date"), "credit_settlements", ["settlement_date"])

    # ---------------- expenses ----------------
    op.create_table(
        "expense_categories",
        _pk(),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        _status(),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_expense_categories")),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "expenses",
        _pk(),
        sa.Column("category_id", sa.Uuid(), nullable=False),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("expense_date", sa.Date(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        *_timestamps(),
        sa.CheckConstraint("amount > 0", name="expense_amount_positive"),
        sa.ForeignKeyConstraint(["category_id"], ["expense_categories.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_expenses")),
    )
    op.create_index(op.f("ix_expenses_category_id"), "expenses", ["category_id"])
    op.create_index(op.f("ix_expenses_expense_date"), "expenses", ["expense_date"])


def downgrade() -> None:
    for table in (
        "expenses",
        "expense_categories",
        "credit_settlements",
        "payments",
        "order_items",
        "orders",
        "order_token_counters",
        "customer_preferences",
        "products",
        "product_categories",
        "customers",
        "users",
    ):
        op.drop_table(table)

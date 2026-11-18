"""Role -> permission matrix. This is the single source of truth for access control.

Every router declares the permission it needs via ``require_permissions`` (see deps.py), so
enforcement happens at the API layer regardless of what any front end does.
"""
from __future__ import annotations

from app.enums import Role, StrEnum


class Permission(StrEnum):
    # employees
    USERS_MANAGE = "users:manage"
    # customers
    CUSTOMERS_SEARCH = "customers:search"            # basic, non-financial view
    CUSTOMERS_REGISTER = "customers:register"
    CUSTOMERS_READ_FULL = "customers:read_full"      # includes phone + amount due
    CUSTOMERS_UPDATE = "customers:update"
    CUSTOMERS_ASSIGN_CHAI_ID = "customers:assign_chai_id"
    CUSTOMERS_DELETE = "customers:delete"
    # preferences
    PREFERENCES_READ = "preferences:read"
    PREFERENCES_MANAGE = "preferences:manage"
    # catalogue
    CATALOG_READ = "catalog:read"
    CATALOG_MANAGE = "catalog:manage"                # categories + product create/edit/delete
    PRODUCTS_UPDATE_PRICE = "products:update_price"
    PRODUCTS_READ_COST = "products:read_cost"
    PRODUCTS_UPDATE_STOCK = "products:update_stock"
    # orders
    ORDERS_CREATE = "orders:create"
    ORDERS_READ = "orders:read"
    ORDERS_UPDATE_STATUS = "orders:update_status"
    ORDERS_CANCEL = "orders:cancel"
    ORDERS_APPLY_DISCOUNT = "orders:apply_discount"
    ORDERS_READ_ALL_DAYS = "orders:read_all_days"    # cashiers only see today's orders
    # payments & credit
    PAYMENTS_CREATE = "payments:create"
    PAYMENTS_READ = "payments:read"
    CREDIT_READ = "credit:read"
    CREDIT_SETTLE = "credit:settle"
    # expenses
    EXPENSES_READ = "expenses:read"
    EXPENSES_WRITE = "expenses:write"
    EXPENSES_DELETE = "expenses:delete"
    EXPENSE_CATEGORIES_MANAGE = "expense_categories:manage"
    # reporting
    REPORTS_SALES = "reports:sales"                  # limited sales view
    REPORTS_FINANCIAL = "reports:financial"
    REPORTS_ANALYTICS = "reports:analytics"


P = Permission

_CASHIER = frozenset(
    {
        P.CUSTOMERS_SEARCH,
        P.PREFERENCES_READ,
        P.CATALOG_READ,
        P.ORDERS_CREATE,
        P.ORDERS_READ,
        P.ORDERS_UPDATE_STATUS,
    }
)

_MANAGER = _CASHIER | frozenset(
    {
        P.CUSTOMERS_REGISTER,
        P.CUSTOMERS_READ_FULL,
        P.CUSTOMERS_UPDATE,
        P.CUSTOMERS_ASSIGN_CHAI_ID,
        P.PREFERENCES_MANAGE,
        P.PRODUCTS_UPDATE_PRICE,
        P.PRODUCTS_READ_COST,
        P.PRODUCTS_UPDATE_STOCK,
        P.ORDERS_CANCEL,
        P.ORDERS_APPLY_DISCOUNT,
        P.ORDERS_READ_ALL_DAYS,
        P.PAYMENTS_CREATE,
        P.PAYMENTS_READ,
        P.CREDIT_READ,
        P.CREDIT_SETTLE,
        P.EXPENSES_READ,
        P.EXPENSES_WRITE,
        P.REPORTS_SALES,
    }
)

# Owner is the supreme admin: every permission that exists.
_OWNER = frozenset(Permission)

ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    Role.OWNER: _OWNER,
    Role.MANAGER: _MANAGER,
    Role.CASHIER: _CASHIER,
}


def has_permission(role: Role | str, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS.get(Role(role), frozenset())

import uuid

import jwt
import pytest

from app.core.rbac import ROLE_PERMISSIONS, Permission, has_permission
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.enums import Role

SECRET = "x" * 40


# ---------- security ----------
def test_password_hash_roundtrip_and_salting():
    h1, h2 = hash_password("Correct-Horse-9"), hash_password("Correct-Horse-9")
    assert h1 != h2  # unique salt
    assert verify_password("Correct-Horse-9", h1)
    assert not verify_password("wrong", h1)
    assert not verify_password("x", "not-a-valid-hash")


def test_jwt_roundtrip_and_tamper_and_expiry():
    uid = uuid.uuid4()
    token, ttl = create_access_token(
        user_id=uid, role="manager", secret=SECRET, algorithm="HS256", expires_minutes=5
    )
    assert ttl == 300
    claims = decode_access_token(token, secret=SECRET, algorithm="HS256")
    assert claims["sub"] == str(uid)
    with pytest.raises(jwt.PyJWTError):
        decode_access_token(token, secret="y" * 40, algorithm="HS256")
    expired, _ = create_access_token(
        user_id=uid, role="manager", secret=SECRET, algorithm="HS256", expires_minutes=-1
    )
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(expired, secret=SECRET, algorithm="HS256")


def test_jwt_rejects_alg_none():
    forged = jwt.encode({"sub": "x", "exp": 9999999999, "iat": 1}, key="", algorithm="none")
    with pytest.raises(jwt.PyJWTError):
        decode_access_token(forged, secret=SECRET, algorithm="HS256")


# ---------- rbac ----------
def test_owner_has_every_permission():
    assert ROLE_PERMISSIONS[Role.OWNER] == frozenset(Permission)


def test_roles_are_strictly_nested():
    assert ROLE_PERMISSIONS[Role.CASHIER] < ROLE_PERMISSIONS[Role.MANAGER] < ROLE_PERMISSIONS[Role.OWNER]


FORBIDDEN_FOR_CASHIER = [
    Permission.USERS_MANAGE,
    Permission.CUSTOMERS_REGISTER,
    Permission.CUSTOMERS_READ_FULL,
    Permission.PAYMENTS_READ,
    Permission.PAYMENTS_CREATE,
    Permission.CREDIT_READ,
    Permission.CREDIT_SETTLE,
    Permission.EXPENSES_READ,
    Permission.EXPENSES_WRITE,
    Permission.REPORTS_SALES,
    Permission.REPORTS_FINANCIAL,
    Permission.REPORTS_ANALYTICS,
    Permission.PRODUCTS_READ_COST,
    Permission.ORDERS_APPLY_DISCOUNT,
    Permission.ORDERS_CANCEL,
]


@pytest.mark.parametrize("perm", FORBIDDEN_FOR_CASHIER)
def test_cashier_is_blocked_from_financial_and_admin(perm):
    assert not has_permission(Role.CASHIER, perm)


@pytest.mark.parametrize(
    "perm",
    [
        Permission.USERS_MANAGE,
        Permission.CATALOG_MANAGE,
        Permission.REPORTS_FINANCIAL,
        Permission.REPORTS_ANALYTICS,
        Permission.EXPENSES_DELETE,
        Permission.EXPENSE_CATEGORIES_MANAGE,
        Permission.CUSTOMERS_DELETE,
    ],
)
def test_owner_only_permissions(perm):
    assert has_permission(Role.OWNER, perm)
    assert not has_permission(Role.MANAGER, perm)
    assert not has_permission(Role.CASHIER, perm)


def test_manager_capabilities():
    for perm in (
        Permission.CUSTOMERS_REGISTER,
        Permission.CUSTOMERS_ASSIGN_CHAI_ID,
        Permission.CREDIT_SETTLE,
        Permission.PAYMENTS_CREATE,
        Permission.PRODUCTS_UPDATE_PRICE,
        Permission.EXPENSES_WRITE,
        Permission.REPORTS_SALES,
    ):
        assert has_permission(Role.MANAGER, perm)


def test_cashier_capabilities():
    for perm in (
        Permission.CUSTOMERS_SEARCH,
        Permission.PREFERENCES_READ,
        Permission.CATALOG_READ,
        Permission.ORDERS_CREATE,
        Permission.ORDERS_READ,
    ):
        assert has_permission(Role.CASHIER, perm)


# ---------- config ----------
def test_config_fails_fast_without_secrets(monkeypatch, tmp_path):
    from app.core import config

    monkeypatch.chdir(tmp_path)  # no .env here
    for k in ("DATABASE_URL", "JWT_SECRET_KEY"):
        monkeypatch.delenv(k, raising=False)
    with pytest.raises(RuntimeError, match="database_url|jwt_secret_key"):
        config.load_settings()


def test_config_rejects_short_secret(monkeypatch, tmp_path):
    from app.core import config

    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    monkeypatch.setenv("JWT_SECRET_KEY", "short")
    with pytest.raises(RuntimeError):
        config.load_settings()


def test_config_loads_from_env(monkeypatch, tmp_path):
    from app.core import config

    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    monkeypatch.setenv("JWT_SECRET_KEY", "k" * 32)
    monkeypatch.setenv("CORS_ORIGINS", "http://a.test, http://b.test")
    s = config.load_settings()
    assert s.cors_origins == ["http://a.test", "http://b.test"]
    assert s.business_timezone == "Asia/Kolkata"

"""Integration fixtures. They need PostgreSQL + the app's dependencies and are skipped otherwise.

    TEST_DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/chai_hut_test pytest

The schema is built by running the real Alembic migration, so the migration is tested too.
WARNING: the target database is wiped. Its name must contain "test" or the run aborts.
"""
from __future__ import annotations

import os
import secrets
import uuid
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
TEST_DB_URL = os.environ.get("TEST_DATABASE_URL")


class Actor:
    """An HTTP client bound to one set of credentials (or none)."""

    def __init__(self, client, headers: dict[str, str] | None = None, user_id: str | None = None):
        self._c, self._h, self.user_id = client, headers or {}, user_id

    def _call(self, method: str, url: str, **kw):
        headers = {**self._h, **kw.pop("headers", {})}
        return self._c.request(method, url, headers=headers, **kw)

    def get(self, url, **kw):
        return self._call("GET", url, **kw)

    def post(self, url, **kw):
        return self._call("POST", url, **kw)

    def patch(self, url, **kw):
        return self._call("PATCH", url, **kw)

    def put(self, url, **kw):
        return self._call("PUT", url, **kw)

    def delete(self, url, **kw):
        return self._call("DELETE", url, **kw)


@pytest.fixture(scope="session")
def stack():
    """Boot the app against the test database (migrated from scratch)."""
    if not TEST_DB_URL:
        pytest.skip("TEST_DATABASE_URL not set; integration tests need PostgreSQL")
    for mod in ("fastapi", "sqlalchemy", "alembic", "httpx", "psycopg"):
        pytest.importorskip(mod)
    from sqlalchemy import create_engine, text
    from sqlalchemy.engine import make_url

    name = make_url(TEST_DB_URL).database or ""
    if "test" not in name:
        pytest.fail(f"Refusing to wipe database '{name}': its name must contain 'test'")

    os.environ["DATABASE_URL"] = TEST_DB_URL
    os.environ["JWT_SECRET_KEY"] = secrets.token_urlsafe(48)

    engine = create_engine(TEST_DB_URL)
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    engine.dispose()

    from alembic import command
    from alembic.config import Config

    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "migrations"))
    command.upgrade(cfg, "head")

    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        yield client


@pytest.fixture(autouse=True)
def _clean_tables(request):
    """Empty every table before each integration test."""
    request.getfixturevalue("stack")  # boots the app/DB first (skips when unavailable)
    from sqlalchemy import text

    from app.core.database import get_engine
    from app.models import Base

    names = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    with get_engine().begin() as conn:
        conn.execute(text(f"TRUNCATE TABLE {names} RESTART IDENTITY CASCADE"))
    yield


@pytest.fixture
def db(stack):
    from app.core.database import get_sessionmaker

    with get_sessionmaker()() as session:
        yield session


@pytest.fixture
def anon(stack) -> Actor:
    return Actor(stack)


@pytest.fixture
def make_user(stack, db):
    """Create an employee directly in the DB with a random password; returns (username, password, id)."""
    from app.core.security import hash_password
    from app.enums import ActiveStatus, Role
    from app.models import User

    def _make(role: str, username: str | None = None):
        username = username or f"{role}.{uuid.uuid4().hex[:8]}"
        password = secrets.token_urlsafe(12) + "a1"
        user = User(
            username=username, password_hash=hash_password(password), full_name=f"Test {role}",
            role=Role(role), status=ActiveStatus.ACTIVE,
        )
        db.add(user)
        db.commit()
        return username, password, str(user.id)

    return _make


@pytest.fixture
def login(stack, make_user):
    def _login(role: str) -> Actor:
        username, password, user_id = make_user(role)
        r = stack.post("/auth/login", json={"username": username, "password": password})
        assert r.status_code == 200, r.text
        return Actor(stack, {"Authorization": f"Bearer {r.json()['access_token']}"}, user_id)

    return _login


@pytest.fixture
def owner(login) -> Actor:
    return login("owner")


@pytest.fixture
def manager(login) -> Actor:
    return login("manager")


@pytest.fixture
def cashier(login) -> Actor:
    return login("cashier")


@pytest.fixture
def menu(owner) -> dict[str, str]:
    """Tea category with: chai (20, cost 8), cappuccino (120, cost 40), bun (35, NO cost)."""
    cat = owner.post("/categories", json={"name": "Drinks", "description": "Hot drinks"})
    assert cat.status_code == 201, cat.text
    ids: dict[str, str] = {"category": cat.json()["id"]}
    specs = {
        "chai": ("Masala Chai", "20.00", "8.00", 50),
        "cappuccino": ("Cappuccino", "120.00", "40.00", 20),
        "bun": ("Bun Maska", "35.00", None, 10),
    }
    for key, (name, mrp, cost, stock) in specs.items():
        body = {"category_id": ids["category"], "name": name, "mrp": mrp, "stock_quantity": stock}
        if cost:
            body["cost_price"] = cost
        r = owner.post("/products", json=body)
        assert r.status_code == 201, r.text
        ids[key] = r.json()["id"]
    return ids


@pytest.fixture
def customer(manager) -> dict:
    r = manager.post(
        "/customers",
        json={"username": "anita.rao", "full_name": "Anita Rao", "company_name": "Infosys", "phone": "+919800000001"},
    )
    assert r.status_code == 201, r.text
    return r.json()

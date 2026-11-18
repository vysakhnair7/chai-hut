"""The migration must produce exactly the schema the models describe."""
import pytest


def test_migration_matches_models(stack):
    """After `alembic upgrade head` (run by the fixture), autogenerate must find nothing to change."""
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext

    from app.core.database import get_engine
    from app.models import Base

    with get_engine().connect() as conn:
        ctx = MigrationContext.configure(conn, opts={"compare_type": True})
        diff = compare_metadata(ctx, Base.metadata)
    assert diff == [], f"models and migration have drifted: {diff}"


def test_every_table_exists(stack):
    from sqlalchemy import inspect

    from app.core.database import get_engine
    from app.models import Base

    existing = set(inspect(get_engine()).get_table_names())
    assert {t.name for t in Base.metadata.sorted_tables} <= existing


def test_database_enforces_money_invariants(stack, owner, cashier, menu, db):
    """Even bypassing the API, the database refuses inconsistent order totals."""
    from sqlalchemy import text
    from sqlalchemy.exc import IntegrityError

    from tests.integration.helpers import place_order

    o = place_order(cashier, [(menu["chai"], 1)], walk_in="X")
    with pytest.raises(IntegrityError):
        db.execute(text("UPDATE orders SET total_amount = total_amount + 1 WHERE id = :i"), {"i": o["id"]})
        db.commit()
    db.rollback()
    with pytest.raises(IntegrityError):
        db.execute(text("UPDATE customers SET amount_due = -1"))
        db.commit()
    db.rollback()
    with pytest.raises(IntegrityError):
        db.execute(text("UPDATE products SET stock_quantity = -1 WHERE id = :i"), {"i": menu["chai"]})
        db.commit()
    db.rollback()

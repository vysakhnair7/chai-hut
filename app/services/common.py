from __future__ import annotations

import re
from contextlib import contextmanager
from typing import Any, Iterator, TypeVar

from sqlalchemy import Select, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import PageParams
from app.core.exceptions import ConflictError, NotFoundError

T = TypeVar("T")


@contextmanager
def conflict_on_integrity(db: Session, message: str) -> Iterator[None]:
    """Turn a unique/FK violation into a clean 409 and leave the session usable."""
    try:
        yield
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(message) from exc


def paginate(db: Session, stmt: Select[Any], params: PageParams) -> tuple[list[Any], int]:
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.scalars(stmt.limit(params.limit).offset(params.offset)).all()
    return list(rows), total


def get_or_404(db: Session, model: type[T], pk: Any, label: str, *, lock: bool = False) -> T:
    if lock:
        obj = db.scalar(
            select(model).where(model.id == pk).with_for_update().execution_options(populate_existing=True)  # type: ignore[attr-defined]
        )
    else:
        obj = db.get(model, pk)
    if obj is None:
        raise NotFoundError(f"{label} not found")
    return obj


def like_pattern(term: str) -> str:
    """Escape LIKE wildcards in user input, then wrap for a contains-search."""
    return "%" + re.sub(r"([\\%_])", r"\\\1", term.strip()) + "%"

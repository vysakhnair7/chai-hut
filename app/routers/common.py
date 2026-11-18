from __future__ import annotations

from typing import Any, Sequence

from app.core.deps import PageParams
from app.schemas.common import ErrorResponse

# Documented on every protected route so OpenAPI shows the error contract.
PROTECTED = {
    401: {"model": ErrorResponse, "description": "Missing, invalid or expired token"},
    403: {"model": ErrorResponse, "description": "Role is not allowed to perform this action"},
}


def make_page(items: Sequence[Any], total: int, params: PageParams) -> dict[str, Any]:
    """Returned as a dict; FastAPI validates it (ORM objects included) against Page[Schema]."""
    return {"items": list(items), "total": total, "limit": params.limit, "offset": params.offset}

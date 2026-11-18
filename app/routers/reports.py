from __future__ import annotations

from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.core.deps import require_permissions
from app.core.exceptions import PermissionDeniedError
from app.core.rbac import Permission as P
from app.core.rbac import has_permission
from app.models import User
from app.routers.common import PROTECTED
from app.schemas.report import (
    CorporateSales,
    FinancialReport,
    PeakHour,
    SalesReport,
    SalesTrend,
    TopProduct,
)
from app.services import report_service
from app.utils.analytics import business_today

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"], responses=PROTECTED)


def _range(date_from: date | None, date_to: date | None, settings: Settings, days: int = 30) -> tuple[date, date]:
    end = date_to or business_today(settings.business_timezone)
    start = date_from or end - timedelta(days=days - 1)
    return start, end


@router.get(
    "/sales",
    response_model=SalesReport,
    summary="Sales summary (managers: recent window only; owners: any range)",
)
def sales(
    date_from: date | None = None,
    date_to: date | None = None,
    actor: User = Depends(require_permissions(P.REPORTS_SALES)),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """Sales only: no collections, costs, profit or analytics. A manager can look back at most
    `MANAGER_SALES_WINDOW_DAYS` (default 7) days; the owner has no such limit."""
    window = settings.manager_sales_window_days
    start, end = _range(date_from, date_to, settings, days=window)
    if not has_permission(actor.role, P.REPORTS_FINANCIAL):
        today = business_today(settings.business_timezone)
        if start < today - timedelta(days=window - 1) or end > today:
            raise PermissionDeniedError(
                f"Your role can only view sales for the last {window} days (up to today)"
            )
    return report_service.sales_report(db, start, end)


@router.get(
    "/financial",
    response_model=FinancialReport,
    summary="Revenue, collections, receivables, COGS, gross and net profit (owner)",
    dependencies=[Depends(require_permissions(P.REPORTS_FINANCIAL))],
)
def financial(
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """Corporate-credit sales are never counted as collected cash. If any sold item has no
    cost price, `cogs`, `gross_profit` and `net_profit` are null rather than misleading."""
    start, end = _range(date_from, date_to, settings, days=1)
    return report_service.financial_report(db, start, end)


@router.get(
    "/trend",
    response_model=SalesTrend,
    summary="Sales trend by day / week / month (owner)",
    dependencies=[Depends(require_permissions(P.REPORTS_ANALYTICS))],
)
def trend(
    granularity: Literal["day", "week", "month"] = "day",
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    default_days = {"day": 30, "week": 84, "month": 365}[granularity]
    start, end = _range(date_from, date_to, settings, days=default_days)
    return report_service.sales_trend(db, start, end, granularity)


@router.get(
    "/top-products",
    response_model=list[TopProduct],
    summary="Best sellers in a period (owner)",
    dependencies=[Depends(require_permissions(P.REPORTS_ANALYTICS))],
)
def top_products(
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    start, end = _range(date_from, date_to, settings)
    return report_service.top_products(db, start, end, limit)


@router.get(
    "/peak-hours",
    response_model=list[PeakHour],
    summary="Orders by hour of day (owner)",
    dependencies=[Depends(require_permissions(P.REPORTS_ANALYTICS))],
)
def peak_hours(
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    start, end = _range(date_from, date_to, settings)
    return report_service.peak_hours(db, settings, start, end)


@router.get(
    "/corporate",
    response_model=list[CorporateSales],
    summary="Sales and outstanding dues per company (owner)",
    dependencies=[Depends(require_permissions(P.REPORTS_ANALYTICS))],
)
def corporate(
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    start, end = _range(date_from, date_to, settings)
    return report_service.corporate_sales(db, start, end)

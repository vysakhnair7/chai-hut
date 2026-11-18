"""Revenue, profit/loss and analytics. All figures are computed from orders, order items,
payments and expenses on demand (no stored revenue/profit tables). Cancelled orders are
excluded everywhere; business dates come from Order.business_date (business timezone)."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.exceptions import BusinessRuleError
from app.enums import OrderStatus, PaymentMethod, PaymentStatus
from app.models import CreditSettlement, Customer, Expense, Order, OrderItem, Payment
from app.schemas.report import (
    CorporateSales,
    DailySales,
    FinancialReport,
    FinancialSummaryOut,
    PeakHour,
    SalesReport,
    SalesTrend,
    TopProduct,
    TrendPoint,
    TrendSummary,
)
from app.utils.analytics import bucket_start, compute_trend
from app.utils.finance import FinancialInputs, compute_financials
from app.utils.money import ZERO, q

MAX_RANGE_DAYS = 366
_LIVE = Order.status != OrderStatus.CANCELLED


def validate_range(date_from: date, date_to: date) -> None:
    if date_to < date_from:
        raise BusinessRuleError("date_to must not be before date_from")
    if (date_to - date_from).days + 1 > MAX_RANGE_DAYS:
        raise BusinessRuleError(f"Date range cannot exceed {MAX_RANGE_DAYS} days")


def _daily(db: Session, date_from: date, date_to: date) -> list[DailySales]:
    rows = db.execute(
        select(
            Order.business_date,
            func.count(Order.id),
            func.coalesce(func.sum(Order.subtotal_amount - Order.discount_amount), 0),
            func.coalesce(func.sum(Order.total_amount), 0),
        )
        .where(_LIVE, Order.business_date.between(date_from, date_to))
        .group_by(Order.business_date)
        .order_by(Order.business_date)
    ).all()
    return [DailySales(business_date=r[0], order_count=r[1], net_sales=q(r[2]), billed_total=q(r[3])) for r in rows]


def sales_report(db: Session, date_from: date, date_to: date) -> SalesReport:
    """The manager's limited view: sales only."""
    validate_range(date_from, date_to)
    tot = db.execute(
        select(
            func.count(Order.id),
            func.coalesce(func.sum(Order.subtotal_amount), 0),
            func.coalesce(func.sum(Order.discount_amount), 0),
            func.coalesce(func.sum(Order.tax_amount), 0),
        ).where(_LIVE, Order.business_date.between(date_from, date_to))
    ).one()
    count, sales, disc, tax = tot[0], q(tot[1]), q(tot[2]), q(tot[3])
    return SalesReport(
        date_from=date_from, date_to=date_to, order_count=count, total_sales=sales,
        discounts=disc, net_sales=sales - disc, tax_collected=tax, billed_total=sales - disc + tax,
        daily=_daily(db, date_from, date_to),
    )


def financial_summary(db: Session, date_from: date, date_to: date) -> FinancialSummaryOut:
    in_range = Order.business_date.between(date_from, date_to)
    o = db.execute(
        select(
            func.count(Order.id),
            func.coalesce(func.sum(Order.subtotal_amount), 0),
            func.coalesce(func.sum(Order.discount_amount), 0),
            func.coalesce(func.sum(Order.tax_amount), 0),
        ).where(_LIVE, in_range)
    ).one()

    pay_by_method = dict(
        db.execute(
            select(Payment.method, func.coalesce(func.sum(Payment.amount), 0))
            .join(Order, Order.id == Payment.order_id)
            .where(_LIVE, in_range, Payment.status == PaymentStatus.SUCCESS)
            .group_by(Payment.method)
        ).all()
    )
    credit = q(pay_by_method.pop(PaymentMethod.CORPORATE_CREDIT, 0))
    collected = q(sum((Decimal(v) for v in pay_by_method.values()), ZERO))  # cash + UPI + card only

    cost = db.execute(
        select(
            func.coalesce(func.sum(OrderItem.quantity * OrderItem.unit_cost), 0),
            func.count(OrderItem.id).filter(OrderItem.unit_cost.is_(None)),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .where(_LIVE, in_range)
    ).one()

    expenses = db.scalar(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(Expense.expense_date.between(date_from, date_to))
    )

    s = compute_financials(
        FinancialInputs(
            total_sales=q(o[1]), discounts=q(o[2]), tax_collected=q(o[3]),
            collected_non_credit=collected, corporate_credit_sales=credit,
            cogs_known=q(cost[0]), items_missing_cost=int(cost[1]),
            expenses=q(expenses), order_count=int(o[0]),
        )
    )
    return FinancialSummaryOut.model_validate(s, from_attributes=True)


def financial_report(db: Session, date_from: date, date_to: date) -> FinancialReport:
    validate_range(date_from, date_to)
    settled = db.scalar(
        select(func.coalesce(func.sum(CreditSettlement.amount), 0)).where(
            CreditSettlement.settlement_date.between(date_from, date_to)
        )
    )
    return FinancialReport(
        date_from=date_from, date_to=date_to,
        summary=financial_summary(db, date_from, date_to),
        credit_settlements_received=q(settled),
        daily=_daily(db, date_from, date_to),
    )


def sales_trend(db: Session, date_from: date, date_to: date, granularity: str) -> SalesTrend:
    validate_range(date_from, date_to)
    buckets: dict[date, list] = defaultdict(lambda: [0, ZERO, ZERO])
    for d in _daily(db, date_from, date_to):
        b = buckets[bucket_start(d.business_date, granularity)]
        b[0] += d.order_count
        b[1] += d.net_sales
        b[2] += d.billed_total

    # Fill empty periods with zeros so the trend isn't distorted by gaps.
    step = {"day": timedelta(days=1), "week": timedelta(days=7)}.get(granularity)
    cursor, last = bucket_start(date_from, granularity), bucket_start(date_to, granularity)
    while cursor <= last:
        buckets[cursor]
        if step:
            cursor += step
        else:
            cursor = (cursor.replace(day=28) + timedelta(days=4)).replace(day=1)

    points, prev = [], None
    for start in sorted(buckets):
        n, net, billed = buckets[start]
        change = ((net - prev) / prev * 100).quantize(Decimal("0.01")) if prev else None
        points.append(TrendPoint(period_start=start, order_count=n, net_sales=net, billed_total=billed, change_pct=change))
        prev = net
    t = compute_trend([p.net_sales for p in points])
    return SalesTrend(
        granularity=granularity, date_from=date_from, date_to=date_to, points=points,
        trend=TrendSummary(direction=t.direction, slope_per_period=t.slope_per_period, last_vs_previous_pct=t.change_pct),
    )


def top_products(db: Session, date_from: date, date_to: date, limit: int) -> list[TopProduct]:
    validate_range(date_from, date_to)
    qty = func.sum(OrderItem.quantity)
    rows = db.execute(
        select(OrderItem.product_id, func.max(OrderItem.product_name), qty,
               func.sum(OrderItem.total_price), func.count(func.distinct(OrderItem.order_id)))
        .join(Order, Order.id == OrderItem.order_id)
        .where(_LIVE, Order.business_date.between(date_from, date_to))
        .group_by(OrderItem.product_id)
        .order_by(qty.desc(), func.max(OrderItem.product_name))
        .limit(limit)
    ).all()
    return [
        TopProduct(product_id=r[0], name=r[1], quantity_sold=int(r[2]), revenue=q(r[3]), orders_with_product=r[4])
        for r in rows
    ]


def peak_hours(db: Session, settings: Settings, date_from: date, date_to: date) -> list[PeakHour]:
    """Orders by hour of day in the business timezone (done in Python so it works on any DB)."""
    validate_range(date_from, date_to)
    tz = ZoneInfo(settings.business_timezone)
    rows = db.execute(
        select(Order.created_at, Order.subtotal_amount - Order.discount_amount)
        .where(_LIVE, Order.business_date.between(date_from, date_to))
    ).all()
    agg: dict[int, list] = {h: [0, ZERO] for h in range(24)}
    for created_at, net in rows:
        h = created_at.astimezone(tz).hour
        agg[h][0] += 1
        agg[h][1] += net
    return [PeakHour(hour=h, order_count=v[0], net_sales=q(v[1])) for h, v in agg.items() if v[0]]


def corporate_sales(db: Session, date_from: date, date_to: date) -> list[CorporateSales]:
    """Sales and outstanding dues by employer. Walk-ins are excluded (no company)."""
    validate_range(date_from, date_to)
    rows = db.execute(
        select(
            Customer.company_name,
            func.count(func.distinct(Customer.id)),
            func.count(Order.id),
            func.coalesce(func.sum(Order.total_amount), 0),
        )
        .join(Order, Order.customer_id == Customer.id)
        .where(_LIVE, Order.business_date.between(date_from, date_to))
        .group_by(Customer.company_name)
        .order_by(func.sum(Order.total_amount).desc())
    ).all()
    dues = dict(
        db.execute(select(Customer.company_name, func.sum(Customer.amount_due)).group_by(Customer.company_name)).all()
    )
    return [
        CorporateSales(
            company_name=r[0], customers=r[1], order_count=r[2], billed_total=q(r[3]),
            outstanding_due=q(dues.get(r[0]) or 0),
        )
        for r in rows
    ]

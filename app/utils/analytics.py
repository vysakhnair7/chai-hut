"""Pure helpers for preferences, tokens, time and trends."""
from __future__ import annotations

import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Iterable, Sequence
from zoneinfo import ZoneInfo


# ---------- customer regular drink ----------
def rank_products(
    rows: Iterable[tuple[uuid.UUID, uuid.UUID, datetime]],
) -> tuple[list[tuple[uuid.UUID, int]], int]:
    """rows = (order_id, product_id, completed_at) for a customer's COMPLETED orders.

    Frequency = number of distinct orders (bills) containing the product, so 5 cappuccino
    bills out of 10 beats a single bill with 9 cups. Ties go to the most recently ordered
    product. Returns ([(product_id, orders_with_product), ...] best first, total_orders).
    """
    orders_by_product: dict[uuid.UUID, set[uuid.UUID]] = defaultdict(set)
    last_seen: dict[uuid.UUID, datetime] = {}
    all_orders: set[uuid.UUID] = set()
    for order_id, product_id, when in rows:
        all_orders.add(order_id)
        orders_by_product[product_id].add(order_id)
        if product_id not in last_seen or when > last_seen[product_id]:
            last_seen[product_id] = when
    ranked = sorted(
        orders_by_product,
        key=lambda p: (len(orders_by_product[p]), last_seen[p], str(p)),
        reverse=True,
    )
    return [(p, len(orders_by_product[p])) for p in ranked], len(all_orders)


def pick_regular_product(
    rows: Iterable[tuple[uuid.UUID, uuid.UUID, datetime]],
) -> tuple[uuid.UUID, int, int] | None:
    """The customer's regular drink: (product_id, orders_with_product, total_orders) or None."""
    ranked, total = rank_products(rows)
    if not ranked:
        return None
    return ranked[0][0], ranked[0][1], total


# ---------- tokens / invoices ----------
def format_token(number: int) -> str:
    return f"T{number:03d}"


def format_invoice_number(business_date: date, token_number: int) -> str:
    return f"CH-{business_date:%Y%m%d}-{token_number:04d}"


# ---------- business time ----------
def business_today(tz_name: str, now: datetime | None = None) -> date:
    tz = ZoneInfo(tz_name)
    return (now.astimezone(tz) if now else datetime.now(tz)).date()


# ---------- trends ----------
@dataclass(frozen=True)
class Trend:
    direction: str            # "up" | "down" | "flat"
    slope_per_period: Decimal
    change_pct: Decimal | None  # last period vs previous period; None if previous is zero


def bucket_start(d: date, granularity: str) -> date:
    if granularity == "day":
        return d
    if granularity == "week":
        return d - timedelta(days=d.weekday())  # Monday
    if granularity == "month":
        return d.replace(day=1)
    raise ValueError(f"unknown granularity {granularity!r}")


def compute_trend(values: Sequence[Decimal], flat_threshold: Decimal = Decimal("0.02")) -> Trend:
    """Least-squares slope over the series; 'flat' if |slope| < 2% of the mean per period."""
    n = len(values)
    if n < 2:
        return Trend("flat", Decimal("0"), None)
    xs = [Decimal(i) for i in range(n)]
    mean_x = sum(xs) / n
    mean_y = sum(values) / n
    denom = sum((x - mean_x) ** 2 for x in xs)
    slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, values)) / denom
    if mean_y == 0 or abs(slope) < abs(mean_y) * flat_threshold:
        direction = "flat"
    else:
        direction = "up" if slope > 0 else "down"
    prev, last = values[-2], values[-1]
    change = ((last - prev) / prev * 100).quantize(Decimal("0.01")) if prev != 0 else None
    return Trend(direction, slope.quantize(Decimal("0.01")), change)

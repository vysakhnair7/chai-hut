from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class DailySales(BaseModel):
    business_date: date
    order_count: int
    net_sales: Decimal
    billed_total: Decimal


class SalesReport(BaseModel):
    """Manager-level view: sales only. No collections, costs, profit or analytics."""

    date_from: date
    date_to: date
    order_count: int
    total_sales: Decimal
    discounts: Decimal
    net_sales: Decimal
    tax_collected: Decimal
    billed_total: Decimal
    daily: list[DailySales]


class FinancialSummaryOut(ORMModel):
    order_count: int
    total_sales: Decimal
    discounts: Decimal
    net_sales: Decimal
    tax_collected: Decimal
    billed_total: Decimal
    total_collected: Decimal = Field(description="Cash + UPI + card actually received. Excludes corporate credit.")
    corporate_credit_sales: Decimal
    outstanding_receivable: Decimal = Field(description="billed_total - total_collected")
    cogs: Decimal | None = Field(description="null when any sold item has no known cost")
    cost_data_complete: bool
    items_missing_cost: int
    gross_profit: Decimal | None = Field(description="net_sales - cogs; null if costs are incomplete")
    expenses: Decimal
    net_profit: Decimal | None = Field(description="gross_profit - expenses; null if costs are incomplete")


class FinancialReport(BaseModel):
    date_from: date
    date_to: date
    summary: FinancialSummaryOut
    credit_settlements_received: Decimal = Field(
        description="Cash received in the period against OLD corporate dues. Reported separately; never added to total_collected."
    )
    daily: list[DailySales]


class TrendPoint(BaseModel):
    period_start: date
    order_count: int
    net_sales: Decimal
    billed_total: Decimal
    change_pct: Decimal | None = Field(description="vs previous period; null for the first or after a zero period")


class TrendSummary(BaseModel):
    direction: Literal["up", "down", "flat"]
    slope_per_period: Decimal
    last_vs_previous_pct: Decimal | None


class SalesTrend(BaseModel):
    granularity: Literal["day", "week", "month"]
    date_from: date
    date_to: date
    points: list[TrendPoint]
    trend: TrendSummary


class TopProduct(BaseModel):
    product_id: uuid.UUID
    name: str
    quantity_sold: int
    revenue: Decimal
    orders_with_product: int


class PeakHour(BaseModel):
    hour: int = Field(ge=0, le=23, description="Hour of day in the business timezone")
    order_count: int
    net_sales: Decimal


class CorporateSales(BaseModel):
    company_name: str
    customers: int
    order_count: int
    billed_total: Decimal
    outstanding_due: Decimal

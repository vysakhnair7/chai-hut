"""Financial rules, as pure functions so they can be tested without a database.

Definitions (all figures exclude cancelled orders; period = orders' business date):
  total_sales            sum of order subtotals (pre-discount, pre-GST)
  net_sales              total_sales - discounts
  tax_collected          GST charged (a liability to the government, NOT revenue)
  billed_total           net_sales + tax_collected
  total_collected        successful payments by cash / UPI / card only
  corporate_credit_sales successful corporate-credit payments (receivable, NOT cash in hand)
  outstanding_receivable billed_total - total_collected  (unpaid balances + credit extended)
  cogs                   sum(quantity * unit_cost) from the order-item snapshots
  gross_profit           net_sales - cogs        -> None if any sold item has no known cost
  net_profit             gross_profit - expenses -> None if any sold item has no known cost
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from app.utils.money import ZERO, q


@dataclass(frozen=True)
class FinancialInputs:
    total_sales: Decimal = ZERO
    discounts: Decimal = ZERO
    tax_collected: Decimal = ZERO
    collected_non_credit: Decimal = ZERO
    corporate_credit_sales: Decimal = ZERO
    cogs_known: Decimal = ZERO          # cost of items whose cost IS known
    items_missing_cost: int = 0         # sold line items with unit_cost IS NULL
    expenses: Decimal = ZERO
    order_count: int = 0


@dataclass(frozen=True)
class FinancialSummary:
    order_count: int
    total_sales: Decimal
    discounts: Decimal
    net_sales: Decimal
    tax_collected: Decimal
    billed_total: Decimal
    total_collected: Decimal
    corporate_credit_sales: Decimal
    outstanding_receivable: Decimal
    cogs: Decimal | None
    cost_data_complete: bool
    items_missing_cost: int
    gross_profit: Decimal | None
    expenses: Decimal
    net_profit: Decimal | None


def compute_financials(inp: FinancialInputs) -> FinancialSummary:
    net_sales = q(inp.total_sales - inp.discounts)
    billed = q(net_sales + inp.tax_collected)
    collected = q(inp.collected_non_credit)  # credit sales are deliberately excluded
    complete = inp.items_missing_cost == 0

    cogs = q(inp.cogs_known) if complete else None
    gross = q(net_sales - cogs) if cogs is not None else None
    net = q(gross - inp.expenses) if gross is not None else None

    return FinancialSummary(
        order_count=inp.order_count,
        total_sales=q(inp.total_sales),
        discounts=q(inp.discounts),
        net_sales=net_sales,
        tax_collected=q(inp.tax_collected),
        billed_total=billed,
        total_collected=collected,
        corporate_credit_sales=q(inp.corporate_credit_sales),
        outstanding_receivable=q(billed - collected),
        cogs=cogs,
        cost_data_complete=complete,
        items_missing_cost=inp.items_missing_cost,
        gross_profit=gross,
        expenses=q(inp.expenses),
        net_profit=net,
    )

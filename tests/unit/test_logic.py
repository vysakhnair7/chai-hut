import uuid
from datetime import date, datetime, timezone
from decimal import Decimal as D

import pytest

from app.utils.analytics import (
    bucket_start,
    business_today,
    compute_trend,
    format_invoice_number,
    format_token,
    pick_regular_product,
)
from app.utils.finance import FinancialInputs, compute_financials
from app.utils.money import Line, calculate_order_totals, q


# ---------- order totals ----------
def test_simple_totals_with_gst_split():
    t = calculate_order_totals([Line(D("100.00"), 2, D("5")), Line(D("50.00"), 1, D("5"))])
    assert t.subtotal == D("250.00")
    assert t.tax == D("12.50")
    assert t.cgst + t.sgst == t.tax
    assert t.total == D("262.50")


def test_odd_paisa_tax_split_never_loses_a_paisa():
    t = calculate_order_totals([Line(D("10.10"), 1, D("5"))])  # tax 0.505 -> 0.51
    assert t.cgst + t.sgst == t.tax
    assert t.total == t.subtotal - t.discount + t.tax


def test_discount_reduces_taxable_value():
    t = calculate_order_totals([Line(D("100.00"), 2, D("5"))], discount=D("20.00"))
    assert t.discount == D("20.00")
    assert t.tax == D("9.00")  # 5% of 180
    assert t.total == D("189.00")


def test_discount_split_across_mixed_gst_rates_is_exact():
    lines = [Line(D("33.33"), 3, D("5")), Line(D("17.77"), 2, D("12")), Line(D("9.99"), 7, D("18"))]
    for disc in (D("0"), D("1.01"), D("49.99"), D("100")):
        t = calculate_order_totals(lines, discount=disc)
        assert t.cgst + t.sgst == t.tax
        assert t.total == t.subtotal - t.discount + t.tax
        assert t.total >= 0


def test_discount_cannot_exceed_subtotal_or_be_negative():
    with pytest.raises(ValueError):
        calculate_order_totals([Line(D("10"), 1, D("5"))], discount=D("10.01"))
    with pytest.raises(ValueError):
        calculate_order_totals([Line(D("10"), 1, D("5"))], discount=D("-1"))


def test_empty_order_rejected():
    with pytest.raises(ValueError):
        calculate_order_totals([])


def test_q_rounds_half_up():
    assert q(D("0.005")) == D("0.01")
    assert q(D("2.675")) == D("2.68")


# ---------- financial rules ----------
def test_corporate_credit_is_not_collected_cash():
    s = compute_financials(
        FinancialInputs(
            total_sales=D("1000"), discounts=D("0"), tax_collected=D("50"),
            collected_non_credit=D("300"), corporate_credit_sales=D("500"),
            cogs_known=D("400"), expenses=D("100"), order_count=10,
        )
    )
    assert s.total_collected == D("300.00")           # credit NOT included
    assert s.corporate_credit_sales == D("500.00")
    assert s.billed_total == D("1050.00")
    assert s.outstanding_receivable == D("750.00")    # 500 credit + 250 unpaid
    assert s.gross_profit == D("600.00")              # net sales - cogs
    assert s.net_profit == D("500.00")                # gross - expenses


def test_profit_is_withheld_when_any_cost_is_missing():
    s = compute_financials(
        FinancialInputs(total_sales=D("1000"), cogs_known=D("100"), items_missing_cost=3, expenses=D("50"))
    )
    assert s.cost_data_complete is False
    assert s.cogs is None and s.gross_profit is None and s.net_profit is None
    assert s.expenses == D("50.00")  # expenses still reported; sales-minus-expenses is NOT shown


def test_no_sales_is_complete_and_zero():
    s = compute_financials(FinancialInputs())
    assert s.cost_data_complete and s.gross_profit == D("0.00") and s.net_profit == D("0.00")


def test_net_profit_can_be_negative():
    s = compute_financials(FinancialInputs(total_sales=D("100"), cogs_known=D("40"), expenses=D("200")))
    assert s.net_profit == D("-140.00")


# ---------- regular drink ----------
def _row(order, product, day):
    return (order, product, datetime(2026, 11, day, 9, tzinfo=timezone.utc))


def test_regular_is_most_frequent_by_bills_not_by_cups():
    cap, latte = uuid.uuid4(), uuid.uuid4()
    orders = [uuid.uuid4() for _ in range(10)]
    rows = [_row(o, cap, i + 1) for i, o in enumerate(orders[:5])]           # cappuccino in 5 bills
    rows += [_row(orders[5], latte, 10), _row(orders[5], latte, 10)]         # 9 lattes, 1 bill
    rows += [_row(o, latte, 11) for o in orders[6:7]]
    rows += [_row(o, uuid.uuid4(), 12) for o in orders[7:]]                  # one-offs
    pid, n, total = pick_regular_product(rows)
    assert pid == cap and n == 5 and total == 10


def test_regular_tie_goes_to_most_recent():
    a, b = uuid.uuid4(), uuid.uuid4()
    o1, o2 = uuid.uuid4(), uuid.uuid4()
    pid, n, _ = pick_regular_product([_row(o1, a, 1), _row(o2, b, 2)])
    assert pid == b and n == 1


def test_no_history_means_no_regular():
    assert pick_regular_product([]) is None


# ---------- tokens / time ----------
def test_token_and_invoice_format():
    assert format_token(7) == "T007" and format_token(1234) == "T1234"
    assert format_invoice_number(date(2026, 11, 17), 42) == "CH-20261117-0042"


def test_business_day_uses_ist_not_utc():
    late_utc = datetime(2026, 11, 16, 20, 0, tzinfo=timezone.utc)  # 01:30 IST on the 17th
    assert business_today("Asia/Kolkata", now=late_utc) == date(2026, 11, 17)
    assert business_today("UTC", now=late_utc) == date(2026, 11, 16)


# ---------- trends ----------
def test_buckets():
    d = date(2026, 11, 18)  # Wednesday
    assert bucket_start(d, "day") == d
    assert bucket_start(d, "week") == date(2026, 11, 16)
    assert bucket_start(d, "month") == date(2026, 11, 1)
    with pytest.raises(ValueError):
        bucket_start(d, "year")


def test_trend_directions():
    assert compute_trend([D(x) for x in (100, 120, 140, 160)]).direction == "up"
    assert compute_trend([D(x) for x in (160, 140, 120, 100)]).direction == "down"
    assert compute_trend([D(x) for x in (100, 101, 100, 101)]).direction == "flat"
    assert compute_trend([D(5)]).direction == "flat"


def test_trend_change_pct_and_zero_previous():
    assert compute_trend([D(100), D(150)]).change_pct == D("50.00")
    assert compute_trend([D(0), D(150)]).change_pct is None

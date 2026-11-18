"""Revenue / profit rules. Hand-calculated scenario (all prices GST-exclusive, GST 5%):

  A  walk-in   2 chai + 1 cappuccino   subtotal 160  tax 8  total 168   paid in CASH
  B  customer  1 cappuccino            subtotal 120  tax 6  total 126   put on CORPORATE CREDIT
  C  walk-in   1 chai                  subtotal  20  tax 1  total  21   UNPAID
  D  walk-in   1 chai                  CANCELLED (must be ignored everywhere)
  expense      30.00

  total_sales 300 | discounts 0 | net_sales 300 | tax 15 | billed 315
  collected 168 (credit excluded) | credit sales 126 | outstanding receivable 315-168 = 147
  COGS = (2*8 + 40) + 40 + 8 = 104 | gross 196 | net profit 196 - 30 = 166
"""
from datetime import timedelta

import pytest

from app.utils.analytics import business_today
from tests.integration.helpers import D, pay, place_order


def _today():
    return business_today("Asia/Kolkata")


@pytest.fixture
def scenario(owner, manager, cashier, menu, customer):
    a = place_order(cashier, [(menu["chai"], 2), (menu["cappuccino"], 1)], walk_in="A")
    assert pay(manager, a["id"], "cash").status_code == 201
    b = place_order(cashier, [(menu["cappuccino"], 1)], customer_id=customer["id"])
    assert pay(manager, b["id"], "corporate_credit").status_code == 201
    c = place_order(cashier, [(menu["chai"], 1)], walk_in="C")
    d = place_order(cashier, [(menu["chai"], 1)], walk_in="D")
    assert manager.post(f"/orders/{d['id']}/cancel").status_code == 200

    cat = owner.post("/expense-categories", json={"name": "Milk & Dairy"}).json()
    assert manager.post("/expenses", json={"category_id": cat["id"], "description": "Milk", "amount": "30.00"}).status_code == 201
    return {"A": a, "B": b, "C": c, "D": d}


def _fin(owner, **params):
    r = owner.get("/reports/financial", params=params)
    assert r.status_code == 200, r.text
    return r.json()["summary"], r.json()


def test_financial_summary_matches_hand_calculation(owner, scenario):
    s, _ = _fin(owner)
    assert s["order_count"] == 3                                   # cancelled order excluded
    assert D(s["total_sales"]) == D("300.00")
    assert D(s["discounts"]) == 0
    assert D(s["net_sales"]) == D("300.00")
    assert D(s["tax_collected"]) == D("15.00")
    assert D(s["billed_total"]) == D("315.00")
    assert D(s["total_collected"]) == D("168.00")                  # corporate credit is NOT collected cash
    assert D(s["corporate_credit_sales"]) == D("126.00")
    assert D(s["outstanding_receivable"]) == D("147.00")           # 126 on credit + 21 unpaid
    assert s["cost_data_complete"] is True and s["items_missing_cost"] == 0
    assert D(s["cogs"]) == D("104.00")
    assert D(s["gross_profit"]) == D("196.00")                     # net sales - COGS
    assert D(s["expenses"]) == D("30.00")
    assert D(s["net_profit"]) == D("166.00")                       # gross - expenses


def test_settlements_are_reported_separately_from_collections(owner, manager, scenario, customer):
    assert manager.post("/credit/settlements", json={"customer_id": customer["id"], "amount": "26.00", "method": "cash"}).status_code == 201
    s, full = _fin(owner)
    assert D(full["credit_settlements_received"]) == D("26.00")
    assert D(s["total_collected"]) == D("168.00")                  # unchanged: settlement is not a new sale


def test_discount_reduces_net_sales_and_profit(owner, manager, menu):
    o = manager.post("/orders", json={"walk_in_name": "X", "items": [{"product_id": menu["chai"], "quantity": 2}], "discount_amount": "10.00"})
    assert o.status_code == 201
    s, _ = _fin(owner)
    assert D(s["total_sales"]) == D("40.00") and D(s["discounts"]) == D("10.00") and D(s["net_sales"]) == D("30.00")
    assert D(s["tax_collected"]) == D("1.50") and D(s["billed_total"]) == D("31.50")
    assert D(s["cogs"]) == D("16.00") and D(s["gross_profit"]) == D("14.00") and D(s["net_profit"]) == D("14.00")


def test_profit_is_withheld_when_a_sold_item_has_no_cost(owner, cashier, menu, scenario):
    place_order(cashier, [(menu["bun"], 1)], walk_in="Bun buyer")           # bun has no cost price
    s, _ = _fin(owner)
    assert s["cost_data_complete"] is False and s["items_missing_cost"] == 1
    assert s["cogs"] is None and s["gross_profit"] is None and s["net_profit"] is None
    assert D(s["expenses"]) == D("30.00")                                   # still reported on its own
    assert D(s["total_sales"]) == D("335.00")


def test_adding_the_cost_later_does_not_rewrite_history(owner, manager, cashier, menu):
    place_order(cashier, [(menu["bun"], 1)], walk_in="Bun buyer")
    manager.patch(f"/products/{menu['bun']}/price", json={"cost_price": "12.00"})
    s, _ = _fin(owner)
    assert s["gross_profit"] is None                                        # that sale was snapshotted without a cost
    place_order(cashier, [(menu["bun"], 1)], walk_in="Later")
    s, _ = _fin(owner)
    assert s["items_missing_cost"] == 1                                     # only the first sale lacks a cost


def test_empty_day_is_all_zero_and_complete(owner):
    s, full = _fin(owner)
    assert s["order_count"] == 0 and D(s["net_profit"]) == 0 and s["cost_data_complete"] is True
    assert full["daily"] == []


def test_range_validation(owner):
    assert owner.get("/reports/financial", params={"date_from": "2026-02-01", "date_to": "2026-01-01"}).status_code == 422
    assert owner.get("/reports/financial", params={"date_from": "2024-01-01", "date_to": "2026-01-01"}).status_code == 422
    assert owner.get("/reports/financial", params={"date_from": "garbage"}).status_code == 422


# ---------------------------------------------------------------- manager's limited view
def test_manager_sees_sales_only(manager, scenario):
    r = manager.get("/reports/sales")
    assert r.status_code == 200
    body = r.json()
    assert D(body["total_sales"]) == D("300.00") and body["order_count"] == 3 and len(body["daily"]) == 1
    for hidden in ("total_collected", "cogs", "gross_profit", "net_profit", "expenses", "summary", "outstanding_receivable"):
        assert hidden not in body


def test_manager_is_limited_to_the_recent_window(manager, owner, scenario):
    today = _today()
    ok = manager.get("/reports/sales", params={"date_from": str(today - timedelta(days=6)), "date_to": str(today)})
    assert ok.status_code == 200
    too_old = manager.get("/reports/sales", params={"date_from": str(today - timedelta(days=7)), "date_to": str(today)})
    assert too_old.status_code == 403
    future = manager.get("/reports/sales", params={"date_to": str(today + timedelta(days=1))})
    assert future.status_code == 403
    assert owner.get("/reports/sales", params={"date_from": str(today - timedelta(days=90))}).status_code == 200


# ---------------------------------------------------------------- analytics (owner)
def test_trend_fills_gaps_and_detects_direction(owner, scenario):
    today = _today()
    r = owner.get("/reports/trend", params={"granularity": "day", "date_from": str(today - timedelta(days=3)), "date_to": str(today)})
    assert r.status_code == 200, r.text
    t = r.json()
    assert [D(p["net_sales"]) for p in t["points"]] == [0, 0, 0, D("300.00")]
    assert t["trend"]["direction"] == "up"
    assert t["points"][-1]["order_count"] == 3

    for g in ("week", "month"):
        r = owner.get("/reports/trend", params={"granularity": g})
        assert r.status_code == 200 and D(r.json()["points"][-1]["net_sales"]) == D("300.00")
    assert owner.get("/reports/trend", params={"granularity": "year"}).status_code == 422


def test_top_products_peak_hours_and_corporate(owner, scenario):
    top = owner.get("/reports/top-products").json()
    assert [(p["name"], p["quantity_sold"], D(p["revenue"])) for p in top] == [
        ("Masala Chai", 3, D("60.00")),
        ("Cappuccino", 2, D("240.00")),
    ]
    hours = owner.get("/reports/peak-hours").json()
    assert sum(h["order_count"] for h in hours) == 3 and all(0 <= h["hour"] <= 23 for h in hours)

    corp = owner.get("/reports/corporate").json()
    assert len(corp) == 1                                                  # walk-ins have no company
    assert corp[0]["company_name"] == "Infosys" and corp[0]["order_count"] == 1
    assert D(corp[0]["billed_total"]) == D("126.00") and D(corp[0]["outstanding_due"]) == D("126.00")

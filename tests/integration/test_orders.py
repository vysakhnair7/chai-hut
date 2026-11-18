import uuid
from datetime import date

from tests.integration.helpers import D, complete_order, pay, place_order


def _stock(actor, menu, key):
    return actor.get(f"/products/{menu[key]}").json()["stock_quantity"]


# ---------------------------------------------------------------- creation, tokens, totals
def test_walk_in_order_totals_token_and_snapshot(cashier, menu):
    o = place_order(cashier, [(menu["chai"], 2)], walk_in="Ravi")
    assert o["order_token"] == "T001" and o["status"] == "placed"
    assert o["customer"] is None and o["walk_in_name"] == "Ravi"
    assert D(o["subtotal_amount"]) == D("40.00")
    assert D(o["tax_amount"]) == D("2.00") and D(o["cgst_amount"]) == D("1.00") and D(o["sgst_amount"]) == D("1.00")
    assert D(o["discount_amount"]) == 0 and D(o["total_amount"]) == D("42.00")
    assert o["created_by"] == cashier.user_id
    assert o["invoice_number"].startswith("CH-") and o["invoice_number"].endswith("-0001")
    item = o["items"][0]
    assert item["product_name"] == "Masala Chai" and item["quantity"] == 2
    assert D(item["unit_price"]) == D("20.00") and D(item["total_price"]) == D("40.00")


def test_tokens_increment_per_day(cashier, menu):
    tokens = [place_order(cashier, [(menu["chai"], 1)], walk_in="X")["order_token"] for _ in range(3)]
    assert tokens == ["T001", "T002", "T003"]


def test_registered_customer_order(cashier, menu, customer):
    o = place_order(cashier, [(menu["chai"], 1)], customer_id=customer["id"])
    assert o["customer"]["id"] == customer["id"] and o["walk_in_name"] is None
    assert set(o["customer"]) == {"id", "chai_id", "full_name", "company_name", "status"}  # no dues leaked to cashier


def test_duplicate_lines_are_merged(cashier, menu):
    o = place_order(cashier, [(menu["chai"], 1), (menu["chai"], 2)], walk_in="X")
    assert len(o["items"]) == 1 and o["items"][0]["quantity"] == 3


def test_stock_is_decremented_and_checked(cashier, manager, menu):
    place_order(cashier, [(menu["cappuccino"], 5)], walk_in="X")
    assert _stock(cashier, menu, "cappuccino") == 15
    r = cashier.post("/orders", json={"walk_in_name": "Y", "items": [{"product_id": menu["cappuccino"], "quantity": 16}]})
    assert r.status_code == 422 and "Only 15" in r.json()["error"]["message"]
    assert _stock(cashier, menu, "cappuccino") == 15           # nothing changed on failure

    manager.put(f"/products/{menu['cappuccino']}/stock", json={"stock_quantity": 0})
    assert cashier.get(f"/products/{menu['cappuccino']}").json()["status"] == "out_of_stock"
    r = cashier.post("/orders", json={"walk_in_name": "Y", "items": [{"product_id": menu["cappuccino"], "quantity": 1}]})
    assert r.status_code == 422


def test_failed_order_does_not_burn_a_token_or_stock(cashier, menu):
    bad = cashier.post("/orders", json={"walk_in_name": "Y", "items": [{"product_id": menu["chai"], "quantity": 1}, {"product_id": menu["bun"], "quantity": 99}]})
    assert bad.status_code == 422
    assert _stock(cashier, menu, "chai") == 50
    assert place_order(cashier, [(menu["chai"], 1)], walk_in="Z")["order_token"] == "T001"


def test_invalid_orders_are_rejected(cashier, menu, customer, manager):
    cases = [
        ({"items": []}, 422),
        ({"items": [{"product_id": menu["chai"], "quantity": 0}]}, 422),
        ({"items": [{"product_id": menu["chai"], "quantity": 101}]}, 422),
        ({"customer_id": customer["id"], "walk_in_name": "Both", "items": [{"product_id": menu["chai"], "quantity": 1}]}, 422),
        ({"items": [{"product_id": str(uuid.uuid4()), "quantity": 1}]}, 404),
        ({"customer_id": str(uuid.uuid4()), "items": [{"product_id": menu["chai"], "quantity": 1}]}, 404),
    ]
    for body, expected in cases:
        assert cashier.post("/orders", json=body).status_code == expected, body
    manager.patch(f"/customers/{customer['id']}", json={"status": "inactive"})
    r = cashier.post("/orders", json={"customer_id": customer["id"], "items": [{"product_id": menu["chai"], "quantity": 1}]})
    assert r.status_code == 422


def test_only_manager_or_owner_can_discount(cashier, manager, menu):
    body = {"walk_in_name": "X", "items": [{"product_id": menu["chai"], "quantity": 2}], "discount_amount": "10.00"}
    assert cashier.post("/orders", json=body).status_code == 403
    r = manager.post("/orders", json=body)
    assert r.status_code == 201
    o = r.json()
    # 40 - 10 = 30 taxable; 5% GST = 1.50 (0.75 CGST + 0.75 SGST); total 31.50
    assert D(o["tax_amount"]) == D("1.50") and D(o["cgst_amount"]) == D("0.75") and D(o["total_amount"]) == D("31.50")
    too_much = {**body, "discount_amount": "40.01"}
    assert manager.post("/orders", json=too_much).status_code == 422


def test_price_change_does_not_alter_past_orders(cashier, manager, menu):
    o = place_order(cashier, [(menu["chai"], 1)], walk_in="X")
    assert manager.patch(f"/products/{menu['chai']}/price", json={"mrp": "25.00", "cost_price": "9.00"}).status_code == 200
    again = cashier.get(f"/orders/{o['id']}").json()
    assert D(again["items"][0]["unit_price"]) == D("20.00") and D(again["total_amount"]) == D("21.00")
    assert D(place_order(cashier, [(menu["chai"], 1)], walk_in="Y")["subtotal_amount"]) == D("25.00")


# ---------------------------------------------------------------- status workflow
def test_status_must_move_forward_one_step(cashier, menu):
    o = place_order(cashier, [(menu["chai"], 1)], walk_in="X")
    url = f"/orders/{o['id']}/status"
    assert cashier.patch(url, json={"status": "ready"}).status_code == 422           # skipping a step
    assert cashier.patch(url, json={"status": "completed"}).status_code == 422
    assert cashier.patch(url, json={"status": "cancelled"}).status_code == 422       # use the cancel endpoint
    assert cashier.patch(url, json={"status": "preparing"}).json()["status"] == "preparing"
    assert cashier.patch(url, json={"status": "placed"}).status_code == 422          # no going back
    assert cashier.patch(url, json={"status": "ready"}).json()["status"] == "ready"
    assert cashier.patch(url, json={"status": "completed"}).json()["status"] == "completed"
    assert cashier.patch(url, json={"status": "preparing"}).status_code == 422       # terminal


def test_cancel_restores_stock_and_is_manager_only(cashier, manager, menu):
    o = place_order(cashier, [(menu["chai"], 4)], walk_in="X")
    assert _stock(cashier, menu, "chai") == 46
    assert cashier.post(f"/orders/{o['id']}/cancel").status_code == 403
    r = manager.post(f"/orders/{o['id']}/cancel")
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    assert _stock(cashier, menu, "chai") == 50
    assert manager.post(f"/orders/{o['id']}/cancel").status_code == 422             # already cancelled


def test_completed_orders_cannot_be_cancelled(cashier, manager, menu):
    o = place_order(cashier, [(menu["chai"], 1)], walk_in="X")
    complete_order(cashier, o["id"])
    assert manager.post(f"/orders/{o['id']}/cancel").status_code == 422


def test_list_filter_by_status_and_token(cashier, menu):
    a = place_order(cashier, [(menu["chai"], 1)], walk_in="A")
    place_order(cashier, [(menu["chai"], 1)], walk_in="B")
    cashier.patch(f"/orders/{a['id']}/status", json={"status": "preparing"})
    assert cashier.get("/orders", params={"status": "preparing"}).json()["total"] == 1
    assert cashier.get("/orders", params={"token": "t002"}).json()["items"][0]["walk_in_name"] == "B"
    page = cashier.get("/orders", params={"limit": 1}).json()
    assert len(page["items"]) == 1 and page["total"] == 2 and page["limit"] == 1


# ---------------------------------------------------------------- tracking & bill
def test_public_tracking_exposes_status_only(anon, cashier, menu, customer):
    o = place_order(cashier, [(menu["chai"], 1)], customer_id=customer["id"])
    r = anon.get("/orders/track/T001")
    assert r.status_code == 200
    assert set(r.json()) == {"order_token", "status", "updated_at"}
    assert anon.get("/orders/track/t001").status_code == 200                        # case-insensitive
    cashier.patch(f"/orders/{o['id']}/status", json={"status": "preparing"})
    assert anon.get("/orders/track/T001").json()["status"] == "preparing"
    assert anon.get("/orders/track/T999").status_code == 404
    assert anon.get("/orders/track/bad token!").status_code == 422


def test_bill_hides_payments_from_cashier(cashier, manager, menu):
    o = place_order(cashier, [(menu["chai"], 2)], walk_in="X")
    assert pay(manager, o["id"], "cash", amount="10.00").status_code == 201

    b = cashier.get(f"/orders/{o['id']}/bill").json()
    assert D(b["total_amount"]) == D("42.00") and b["customer_name"] == "X"
    assert b["payments"] is None and b["amount_paid"] is None and b["balance_due"] is None

    m = manager.get(f"/orders/{o['id']}/bill").json()
    assert D(m["amount_paid"]) == D("10.00") and D(m["balance_due"]) == D("32.00")
    assert m["payment_state"] == "partial" and len(m["payments"]) == 1


def test_cashier_only_sees_todays_orders(cashier, manager, menu, db):
    from sqlalchemy import update

    from app.models import Order

    o = place_order(cashier, [(menu["chai"], 1)], walk_in="X")
    db.execute(update(Order).where(Order.id == uuid.UUID(o["id"])).values(business_date=date(2020, 1, 1)))
    db.commit()
    assert cashier.get(f"/orders/{o['id']}").status_code == 404
    assert cashier.get("/orders").json()["total"] == 0
    assert manager.get(f"/orders/{o['id']}").status_code == 200

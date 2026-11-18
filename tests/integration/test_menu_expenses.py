import uuid
from datetime import timedelta

from app.utils.analytics import business_today
from tests.integration.helpers import D, complete_order, place_order


# ---------------------------------------------------------------- menu
def test_cashier_sees_price_and_stock_but_never_cost(cashier, menu):
    r = cashier.get("/products")
    assert r.status_code == 200 and r.json()["total"] == 3
    for p in r.json()["items"]:
        assert "cost_price" not in p and "margin" not in p
        assert {"name", "mrp", "stock_quantity", "status"} <= set(p)
    assert "cost_price" not in cashier.get(f"/products/{menu['chai']}").json()
    assert cashier.get(f"/products/{menu['chai']}/detail").status_code == 403


def test_manager_sees_cost_and_margin(manager, menu):
    d = manager.get(f"/products/{menu['chai']}/detail").json()
    assert D(d["cost_price"]) == D("8.00") and D(d["margin"]) == D("12.00")
    assert manager.get(f"/products/{menu['bun']}/detail").json()["margin"] is None


def test_owner_manages_catalog_and_manager_only_prices(owner, manager, menu):
    r = owner.post("/products", json={"category_id": menu["category"], "name": "Samosa", "mrp": "25.00", "stock_quantity": 5})
    assert r.status_code == 201 and D(r.json()["gst_rate"]) == D("5.00") and r.json()["status"] == "available"
    pid = r.json()["id"]
    assert owner.post("/products", json={"category_id": menu["category"], "name": "Samosa", "mrp": "25.00"}).status_code == 409
    assert owner.post("/products", json={"category_id": menu["category"], "name": "Bad", "mrp": "-1"}).status_code == 422
    assert owner.post("/products", json={"category_id": str(uuid.uuid4()), "name": "Orphan", "mrp": "5"}).status_code == 404

    assert manager.patch(f"/products/{pid}/price", json={"mrp": "30.00"}).status_code == 200
    assert manager.patch(f"/products/{pid}/price", json={}).status_code == 422
    assert manager.patch(f"/products/{pid}", json={"name": "Renamed"}).status_code == 403   # catalogue edits are owner-only
    assert owner.patch(f"/products/{pid}", json={"name": "Aloo Samosa", "gst_rate": "12.00"}).json()["name"] == "Aloo Samosa"


def test_stock_status_stays_consistent(manager, cashier, menu):
    pid = menu["bun"]
    assert manager.put(f"/products/{pid}/stock", json={"stock_quantity": 0}).json()["status"] == "out_of_stock"
    assert manager.put(f"/products/{pid}/stock", json={"stock_quantity": 7}).json()["status"] == "available"
    assert manager.put(f"/products/{pid}/stock", json={"stock_quantity": -1}).status_code == 422
    in_stock = cashier.get("/products", params={"in_stock_only": "true"}).json()
    assert in_stock["total"] == 3
    manager.put(f"/products/{pid}/stock", json={"stock_quantity": 0})
    assert cashier.get("/products", params={"in_stock_only": "true"}).json()["total"] == 2


def test_discontinued_products_cannot_be_sold_but_history_survives(owner, cashier, menu):
    o = place_order(cashier, [(menu["chai"], 1)], walk_in="X")
    assert owner.delete(f"/products/{menu['chai']}").status_code == 204
    assert cashier.get(f"/products/{menu['chai']}").json()["status"] == "discontinued"
    r = cashier.post("/orders", json={"walk_in_name": "Y", "items": [{"product_id": menu["chai"], "quantity": 1}]})
    assert r.status_code == 422 and "no longer sold" in r.json()["error"]["message"]
    assert cashier.get(f"/orders/{o['id']}").status_code == 200


def test_categories(owner, menu):
    assert owner.post("/categories", json={"name": "Drinks"}).status_code == 409
    assert owner.delete(f"/categories/{menu['category']}").status_code == 422        # still has products
    empty = owner.post("/categories", json={"name": "Empty"}).json()
    assert owner.delete(f"/categories/{empty['id']}").status_code == 204
    owner.patch(f"/categories/{menu['category']}", json={"status": "inactive"})
    assert owner.post("/products", json={"category_id": menu["category"], "name": "Late", "mrp": "5"}).status_code == 422


def test_popular_products_use_completed_orders_only(cashier, menu):
    a = place_order(cashier, [(menu["cappuccino"], 1)], walk_in="A")
    b = place_order(cashier, [(menu["cappuccino"], 1)], walk_in="B")
    c = place_order(cashier, [(menu["chai"], 3)], walk_in="C")
    place_order(cashier, [(menu["chai"], 3)], walk_in="not finished")
    for o in (a, b, c):
        complete_order(cashier, o["id"])
    pop = cashier.get("/products/popular").json()
    assert [(p["name"], p["orders_with_product"], p["quantity_sold"]) for p in pop] == [
        ("Cappuccino", 2, 2), ("Masala Chai", 1, 3)
    ]


# ---------------------------------------------------------------- expenses
def test_expense_lifecycle_and_permissions(owner, manager, cashier):
    cat = owner.post("/expense-categories", json={"name": "Rent"})
    assert cat.status_code == 201
    cid = cat.json()["id"]
    assert owner.post("/expense-categories", json={"name": "Rent"}).status_code == 409

    today = business_today("Asia/Kolkata")
    r = manager.post("/expenses", json={"category_id": cid, "description": "October rent", "amount": "15000.00"})
    assert r.status_code == 201
    e = r.json()
    assert e["expense_date"] == str(today) and D(e["amount"]) == D("15000.00") and e["created_by"] == manager.user_id

    assert manager.post("/expenses", json={"category_id": cid, "description": "Future", "amount": "5", "expense_date": str(today + timedelta(days=1))}).status_code == 422
    assert manager.post("/expenses", json={"category_id": cid, "description": "Zero", "amount": "0"}).status_code == 422
    assert manager.post("/expenses", json={"category_id": str(uuid.uuid4()), "description": "Ghost", "amount": "5"}).status_code == 404

    assert manager.patch(f"/expenses/{e['id']}", json={"amount": "14000.00"}).json()["amount"] == "14000.00"
    assert manager.delete(f"/expenses/{e['id']}").status_code == 403
    assert cashier.get("/expenses").status_code == 403
    assert owner.delete(f"/expenses/{e['id']}").status_code == 204
    assert manager.get(f"/expenses/{e['id']}").status_code == 404


def test_expense_list_filters(owner, manager):
    rent = owner.post("/expense-categories", json={"name": "Rent"}).json()["id"]
    milk = owner.post("/expense-categories", json={"name": "Milk"}).json()["id"]
    today = business_today("Asia/Kolkata")
    for cat, day, amt in ((rent, today, "100"), (milk, today, "20"), (milk, today - timedelta(days=10), "30")):
        assert manager.post("/expenses", json={"category_id": cat, "description": "Entry", "amount": amt, "expense_date": str(day)}).status_code == 201
    assert manager.get("/expenses").json()["total"] == 3
    assert manager.get("/expenses", params={"category_id": milk}).json()["total"] == 2
    assert manager.get("/expenses", params={"date_from": str(today - timedelta(days=1))}).json()["total"] == 2

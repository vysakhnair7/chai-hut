import uuid

import pytest

from tests.integration.helpers import complete_order, place_order


# ---------------------------------------------------------------- registration & lookup
def test_manager_registers_customer_with_generated_chai_id(manager):
    r = manager.post(
        "/customers",
        json={"username": " Rahul.K ", "full_name": "Rahul   Kumar", "company_name": "Acme  Corp", "phone": "+91 98765-43210"},
    )
    assert r.status_code == 201, r.text
    c = r.json()
    uuid.UUID(c["chai_id"])                      # a real UUID, generated server side
    assert c["chai_id"] != c["id"]
    assert c["username"] == "rahul.k"
    assert c["full_name"] == "Rahul Kumar" and c["company_name"] == "Acme Corp"
    assert c["phone"] == "+919876543210"
    assert c["status"] == "active" and c["amount_due"] == "0.00"


def test_client_cannot_choose_the_chai_id(manager):
    chosen = str(uuid.uuid4())
    r = manager.post(
        "/customers",
        json={"username": "sneaky", "full_name": "Sneaky Pete", "company_name": "Acme", "phone": "+919800000009", "chai_id": chosen},
    )
    assert r.status_code == 201 and r.json()["chai_id"] != chosen


def test_duplicate_username_and_bad_input_rejected(manager, customer):
    dup = manager.post(
        "/customers",
        json={"username": "ANITA.RAO", "full_name": "Other Person", "company_name": "Wipro", "phone": "+919800000010"},
    )
    assert dup.status_code == 409
    for bad in (
        {"username": "ok.name", "full_name": "A", "company_name": "Acme", "phone": "+919800000011"},
        {"username": "ok.name", "full_name": "Valid Name", "company_name": "Acme", "phone": "12ab"},
        {"username": "Not Valid!", "full_name": "Valid Name", "company_name": "Acme", "phone": "+919800000011"},
    ):
        assert manager.post("/customers", json=bad).status_code == 422


def test_cashier_search_shows_basic_info_only(cashier, customer):
    for q in ("anita", "Infosys", "anita.rao", customer["chai_id"], "+91980000"):
        r = cashier.get("/customers/search", params={"q": q})
        assert r.status_code == 200, r.text
        rows = r.json()
        assert len(rows) == 1, q
        assert set(rows[0]) == {"id", "chai_id", "full_name", "company_name", "status"}  # no phone, no dues


def test_cashier_can_verify_but_not_read_full_customer(cashier, customer):
    basic = cashier.get(f"/customers/{customer['id']}/basic")
    assert basic.status_code == 200 and "amount_due" not in basic.json()
    assert cashier.get(f"/customers/{customer['id']}").status_code == 403
    assert cashier.get("/customers").status_code == 403


def test_search_treats_wildcards_literally(manager, cashier, customer):
    assert cashier.get("/customers/search", params={"q": "%%"}).json() == []
    assert cashier.get("/customers/search", params={"q": "a_i"}).json() == []


def test_manager_lists_filters_and_updates(manager, customer):
    manager.post("/customers", json={"username": "meera.k", "full_name": "Meera K", "company_name": "Wipro", "phone": "+919800000002"})
    assert manager.get("/customers").json()["total"] == 2
    assert manager.get("/customers", params={"company": "wipro"}).json()["total"] == 1
    assert manager.get("/customers", params={"has_due": "true"}).json()["total"] == 0
    r = manager.patch(f"/customers/{customer['id']}", json={"company_name": "TCS", "status": "inactive"})
    assert r.status_code == 200 and r.json()["company_name"] == "TCS" and r.json()["status"] == "inactive"


def test_regenerate_chai_id(manager, customer):
    r = manager.post(f"/customers/{customer['id']}/chai-id/regenerate")
    assert r.status_code == 200 and r.json()["chai_id"] != customer["chai_id"]


def test_owner_deletes_only_clean_customers(owner, manager, cashier, menu, customer):
    assert place_order(cashier, [(menu["chai"], 1)], customer_id=customer["id"])
    r = owner.delete(f"/customers/{customer['id']}")
    assert r.status_code == 422                      # has order history
    other = manager.post("/customers", json={"username": "clean.one", "full_name": "Clean One", "company_name": "Acme", "phone": "+919800000077"}).json()
    assert owner.delete(f"/customers/{other['id']}").status_code == 204
    assert owner.get(f"/customers/{other['id']}").status_code == 404


# ---------------------------------------------------------------- regular drink
def _bill(cashier, customer, menu, product_key, qty=1, *, complete=True):
    order = place_order(cashier, [(menu[product_key], qty)], customer_id=customer["id"])
    if complete:
        complete_order(cashier, order["id"])
    return order


def test_most_frequent_product_is_computed_from_completed_bills(cashier, manager, menu, customer):
    # 10 completed bills: cappuccino in 5, chai in 3, bun in 2.
    for _ in range(5):
        _bill(cashier, customer, menu, "cappuccino")
    for _ in range(3):
        _bill(cashier, customer, menu, "chai")
    for _ in range(2):
        _bill(cashier, customer, menu, "bun")
    # An unfinished bill must not count.
    _bill(cashier, customer, menu, "chai", complete=False)

    r = cashier.get(f"/customers/{customer['id']}/preferences")
    assert r.status_code == 200, r.text
    prefs = r.json()
    top = prefs["most_frequent"]
    assert top["product_name"] == "Cappuccino"
    assert top["orders_with_product"] == 5 and top["total_completed_orders"] == 10
    assert top["share_pct"] == "50.00"
    assert [p["product_name"] for p in prefs["top_products"]] == ["Cappuccino", "Masala Chai", "Bun Maska"]
    assert prefs["saved_regular"]["product_name"] == "Cappuccino"   # kept up to date on completion


def test_frequency_counts_bills_not_cups(cashier, menu, customer):
    _bill(cashier, customer, menu, "cappuccino", qty=9)             # one bill, nine cups
    _bill(cashier, customer, menu, "chai")
    _bill(cashier, customer, menu, "chai")
    prefs = cashier.get(f"/customers/{customer['id']}/preferences").json()
    assert prefs["most_frequent"]["product_name"] == "Masala Chai"


def test_customer_without_history_has_no_regular(cashier, customer):
    prefs = cashier.get(f"/customers/{customer['id']}/preferences").json()
    assert prefs["saved_regular"] is None and prefs["most_frequent"] is None and prefs["top_products"] == []


def test_manager_sets_one_regular_at_a_time(manager, cashier, menu, customer, db):
    url = f"/customers/{customer['id']}/preferences/regular"
    assert manager.put(url, json={"product_id": menu["chai"]}).json()["saved_regular"]["product_name"] == "Masala Chai"
    r = manager.put(url, json={"product_id": menu["cappuccino"]})
    assert r.status_code == 200 and r.json()["saved_regular"]["product_name"] == "Cappuccino"

    from sqlalchemy import func, select

    from app.models import CustomerPreference
    count = db.scalar(
        select(func.count()).select_from(CustomerPreference).where(
            CustomerPreference.customer_id == uuid.UUID(customer["id"]), CustomerPreference.is_regular.is_(True)
        )
    )
    assert count == 1

    assert cashier.put(url, json={"product_id": menu["chai"]}).status_code == 403
    assert manager.delete(url).json()["saved_regular"] is None


def test_database_itself_forbids_two_regulars(manager, menu, customer, db):
    from sqlalchemy.exc import IntegrityError

    from app.models import CustomerPreference
    cid = uuid.UUID(customer["id"])
    db.add(CustomerPreference(customer_id=cid, product_id=uuid.UUID(menu["chai"]), is_regular=True))
    db.commit()
    db.add(CustomerPreference(customer_id=cid, product_id=uuid.UUID(menu["cappuccino"]), is_regular=True))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_unknown_product_and_customer(manager, customer):
    assert manager.put(f"/customers/{customer['id']}/preferences/regular", json={"product_id": str(uuid.uuid4())}).status_code == 404
    assert manager.get(f"/customers/{uuid.uuid4()}/preferences").status_code == 404

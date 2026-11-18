import uuid

from tests.integration.helpers import D, complete_order, pay, place_order


def _due(manager, customer):
    return D(manager.get(f"/customers/{customer['id']}").json()["amount_due"])


def _order(cashier, menu, customer=None, qty=2):
    """2 chai = 40 + 2 GST = 42.00"""
    if customer:
        return place_order(cashier, [(menu["chai"], qty)], customer_id=customer["id"])
    return place_order(cashier, [(menu["chai"], qty)], walk_in="Walk In")


# ---------------------------------------------------------------- payments
def test_split_payments_until_fully_paid(cashier, manager, menu):
    o = _order(cashier, menu)
    r = pay(manager, o["id"], "cash", amount="20.00")
    assert r.status_code == 201 and D(r.json()["amount"]) == D("20.00") and r.json()["status"] == "success"

    state = manager.get(f"/orders/{o['id']}/payments").json()
    assert D(state["balance_due"]) == D("22.00") and state["payment_state"] == "partial"

    r = pay(manager, o["id"], "upi", txn="UPI-REF-001")           # no amount => the whole remaining balance
    assert r.status_code == 201 and D(r.json()["amount"]) == D("22.00")
    state = manager.get(f"/orders/{o['id']}/payments").json()
    assert D(state["balance_due"]) == 0 and state["payment_state"] == "paid" and len(state["payments"]) == 2

    again = pay(manager, o["id"], "cash", amount="1.00")
    assert again.status_code == 409                               # already fully paid


def test_cannot_overpay(cashier, manager, menu):
    o = _order(cashier, menu)
    r = pay(manager, o["id"], "cash", amount="42.01")
    assert r.status_code == 422 and "remaining balance" in r.json()["error"]["message"]
    assert pay(manager, o["id"], "cash", amount="0").status_code == 422
    assert pay(manager, o["id"], "cash", amount="-5").status_code == 422
    assert manager.get(f"/orders/{o['id']}/payments").json()["payments"] == []


def test_electronic_payments_require_a_reference(cashier, manager, menu):
    o = _order(cashier, menu)
    assert pay(manager, o["id"], "upi").status_code == 422
    assert pay(manager, o["id"], "card").status_code == 422
    assert pay(manager, o["id"], "bitcoin").status_code == 422


def test_same_transaction_id_cannot_be_used_twice(cashier, manager, menu):
    a, b = _order(cashier, menu), _order(cashier, menu)
    assert pay(manager, a["id"], "upi", amount="10.00", txn="TXN-777").status_code == 201
    r = pay(manager, b["id"], "upi", amount="10.00", txn="TXN-777")
    assert r.status_code == 409
    assert manager.get(f"/orders/{b['id']}/payments").json()["payments"] == []


def test_idempotency_key_makes_retries_safe(cashier, manager, menu):
    o = _order(cashier, menu)
    first = pay(manager, o["id"], "cash", amount="15.00", key="retry-key-0001")
    retry = pay(manager, o["id"], "cash", amount="15.00", key="retry-key-0001")
    assert first.status_code == 201 and retry.status_code == 200
    assert first.json()["id"] == retry.json()["id"]
    state = manager.get(f"/orders/{o['id']}/payments").json()
    assert len(state["payments"]) == 1 and D(state["amount_paid"]) == D("15.00")

    clash = pay(manager, o["id"], "cash", amount="16.00", key="retry-key-0001")
    assert clash.status_code == 409                               # same key, different request
    assert pay(manager, o["id"], "cash", amount="5.00", key="short").status_code == 422


def test_cannot_pay_cancelled_or_unknown_orders(cashier, manager, menu):
    o = _order(cashier, menu)
    manager.post(f"/orders/{o['id']}/cancel")
    assert pay(manager, o["id"], "cash").status_code == 422
    assert pay(manager, str(uuid.uuid4()), "cash").status_code == 404


def test_payment_history_filters(cashier, manager, menu):
    a, b = _order(cashier, menu), _order(cashier, menu)
    pay(manager, a["id"], "cash")
    pay(manager, b["id"], "upi", txn="T-1")
    assert manager.get("/payments").json()["total"] == 2
    assert manager.get("/payments", params={"method": "upi"}).json()["total"] == 1
    assert manager.get("/payments", params={"order_id": a["id"]}).json()["items"][0]["method"] == "cash"


# ---------------------------------------------------------------- corporate credit
def test_credit_payment_increases_due_and_is_listed_as_outstanding(cashier, manager, menu, customer):
    o = _order(cashier, menu, customer)
    assert pay(manager, o["id"], "corporate_credit").status_code == 201
    assert _due(manager, customer) == D("42.00")

    out = manager.get("/credit/outstanding").json()
    assert D(out["total_outstanding"]) == D("42.00")
    assert out["customers"][0]["full_name"] == "Anita Rao"
    assert out["by_company"] == [{"company_name": "Infosys", "customers_with_dues": 1, "amount_due": "42.00"}]
    assert manager.get("/customers", params={"has_due": "true"}).json()["total"] == 1


def test_walk_in_cannot_use_credit(cashier, manager, menu):
    o = _order(cashier, menu)
    r = pay(manager, o["id"], "corporate_credit")
    assert r.status_code == 422 and "registered customer" in r.json()["error"]["message"]


def test_inactive_customer_cannot_use_credit(cashier, manager, menu, customer):
    o = _order(cashier, menu, customer)
    manager.patch(f"/customers/{customer['id']}", json={"status": "inactive"})
    assert pay(manager, o["id"], "corporate_credit").status_code == 422
    assert _due(manager, customer) == 0


def test_partial_and_full_settlement_at_month_end(cashier, manager, menu, customer):
    o = _order(cashier, menu, customer)
    pay(manager, o["id"], "corporate_credit")

    r = manager.post("/credit/settlements", json={"customer_id": customer["id"], "amount": "20.00", "method": "cash"})
    assert r.status_code == 201 and D(r.json()["remaining_due"]) == D("22.00")

    r = manager.post("/credit/settlements", json={"customer_id": customer["id"], "amount": "22.01", "method": "cash"})
    assert r.status_code == 422                                   # more than is owed
    assert _due(manager, customer) == D("22.00")

    r = manager.post("/credit/settlements", json={"customer_id": customer["id"], "amount": "22.00", "method": "upi", "transaction_id": "SAL-1"})
    assert r.status_code == 201 and D(r.json()["remaining_due"]) == 0
    assert manager.get("/credit/outstanding").json()["customers"] == []
    assert manager.get("/credit/settlements", params={"customer_id": customer["id"]}).json()["total"] == 2


def test_settlement_validation_and_duplicates(cashier, manager, menu, customer):
    o = _order(cashier, menu, customer)
    pay(manager, o["id"], "corporate_credit")
    base = {"customer_id": customer["id"], "amount": "10.00", "method": "upi"}
    assert manager.post("/credit/settlements", json=base).status_code == 422                       # needs txn id
    assert manager.post("/credit/settlements", json={**base, "method": "corporate_credit"}).status_code == 422
    assert manager.post("/credit/settlements", json={**base, "amount": "0", "transaction_id": "X1"}).status_code == 422
    assert manager.post("/credit/settlements", json={**base, "customer_id": str(uuid.uuid4()), "transaction_id": "X2"}).status_code == 404

    ok = manager.post("/credit/settlements", json={**base, "transaction_id": "SAL-9"})
    assert ok.status_code == 201
    assert manager.post("/credit/settlements", json={**base, "transaction_id": "SAL-9"}).status_code == 409
    assert _due(manager, customer) == D("32.00")


def test_settlement_idempotency(cashier, manager, menu, customer):
    o = _order(cashier, menu, customer)
    pay(manager, o["id"], "corporate_credit")
    body = {"customer_id": customer["id"], "amount": "10.00", "method": "cash"}
    h = {"Idempotency-Key": "settle-key-0001"}
    first = manager.post("/credit/settlements", json=body, headers=h)
    retry = manager.post("/credit/settlements", json=body, headers=h)
    assert first.status_code == 201 and retry.status_code == 200
    assert first.json()["settlement"]["id"] == retry.json()["settlement"]["id"]
    assert _due(manager, customer) == D("32.00")                  # applied once
    clash = manager.post("/credit/settlements", json={**body, "amount": "11.00"}, headers=h)
    assert clash.status_code == 409


def test_ledger_shows_running_balance(cashier, manager, menu, customer):
    o1, o2 = _order(cashier, menu, customer), _order(cashier, menu, customer, qty=1)   # 42.00 and 21.00
    pay(manager, o1["id"], "corporate_credit")
    pay(manager, o2["id"], "corporate_credit")
    manager.post("/credit/settlements", json={"customer_id": customer["id"], "amount": "30.00", "method": "cash"})
    ledger = manager.get(f"/credit/customers/{customer['id']}/ledger").json()
    assert [e["kind"] for e in ledger["entries"]] == ["credit_sale", "credit_sale", "settlement"]
    assert [D(e["balance_after"]) for e in ledger["entries"]] == [D("42.00"), D("63.00"), D("33.00")]
    assert D(ledger["current_due"]) == D("33.00")


def test_cancelling_a_credit_order_reverses_the_due(cashier, manager, menu, customer):
    o = _order(cashier, menu, customer)
    pay(manager, o["id"], "corporate_credit")
    assert manager.post(f"/orders/{o['id']}/cancel").status_code == 200
    assert _due(manager, customer) == 0
    pays = manager.get(f"/orders/{o['id']}/payments").json()["payments"]
    assert pays[0]["status"] == "refunded"
    ledger = manager.get(f"/credit/customers/{customer['id']}/ledger").json()
    assert [e["kind"] for e in ledger["entries"]] == ["credit_sale", "credit_reversal"]
    assert D(ledger["entries"][-1]["balance_after"]) == 0


def test_cannot_cancel_when_the_credit_was_already_settled(cashier, manager, menu, customer):
    o = _order(cashier, menu, customer)
    pay(manager, o["id"], "corporate_credit")
    manager.post("/credit/settlements", json={"customer_id": customer["id"], "amount": "42.00", "method": "cash"})
    r = manager.post(f"/orders/{o['id']}/cancel")
    assert r.status_code == 422 and "already settled" in r.json()["error"]["message"]
    assert manager.get(f"/orders/{o['id']}").json()["status"] == "placed"      # untouched
    assert manager.get(f"/orders/{o['id']}/payments").json()["payments"][0]["status"] == "success"


def test_cancelling_a_cash_paid_order_refunds_the_payment(cashier, manager, menu):
    o = _order(cashier, menu)
    pay(manager, o["id"], "cash")
    manager.post(f"/orders/{o['id']}/cancel")
    state = manager.get(f"/orders/{o['id']}/payments").json()
    assert state["payments"][0]["status"] == "refunded"
    assert D(state["amount_paid"]) == 0


def test_customer_with_dues_cannot_be_deleted(owner, cashier, manager, menu, customer):
    o = _order(cashier, menu, customer)
    pay(manager, o["id"], "corporate_credit")
    complete_order(cashier, o["id"])
    r = owner.delete(f"/customers/{customer['id']}")
    assert r.status_code == 422 and "outstanding" in r.json()["error"]["message"]

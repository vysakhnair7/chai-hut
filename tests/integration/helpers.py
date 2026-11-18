"""Plain helper functions shared by the integration tests."""
from __future__ import annotations

from decimal import Decimal


def D(value) -> Decimal:
    return Decimal(str(value))


def place_order(actor, items: list[tuple[str, int]], *, customer_id: str | None = None,
                walk_in: str | None = None, discount: str | None = None) -> dict:
    body: dict = {"items": [{"product_id": pid, "quantity": q} for pid, q in items]}
    if customer_id:
        body["customer_id"] = customer_id
    elif walk_in:
        body["walk_in_name"] = walk_in
    if discount:
        body["discount_amount"] = discount
    r = actor.post("/orders", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def complete_order(actor, order_id: str) -> dict:
    last = {}
    for status in ("preparing", "ready", "completed"):
        r = actor.patch(f"/orders/{order_id}/status", json={"status": status})
        assert r.status_code == 200, r.text
        last = r.json()
    return last


def pay(actor, order_id: str, method: str = "cash", amount: str | None = None,
        txn: str | None = None, key: str | None = None):
    body: dict = {"method": method}
    if amount:
        body["amount"] = amount
    if txn:
        body["transaction_id"] = txn
    return actor.post(f"/orders/{order_id}/payments", json=body, headers={"Idempotency-Key": key} if key else {})

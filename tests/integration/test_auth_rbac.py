"""Authentication and role-based access control, enforced at the API."""
import secrets
import uuid

import pytest

ANY = str(uuid.uuid4())
NEW_CUSTOMER = {"username": "new.cust", "full_name": "New Customer", "company_name": "Acme", "phone": "+919811111111"}

# (method, path, json body) – every one must be refused for the cashier
CASHIER_FORBIDDEN = [
    ("GET", "/users", None),
    ("POST", "/users", {"username": "x.user", "password": "Passw0rd123", "full_name": "X User", "role": "cashier"}),
    ("POST", "/customers", NEW_CUSTOMER),
    ("GET", "/customers", None),
    ("GET", f"/customers/{ANY}", None),
    ("PATCH", f"/customers/{ANY}", {"full_name": "Changed Name"}),
    ("DELETE", f"/customers/{ANY}", None),
    ("PUT", f"/customers/{ANY}/preferences/regular", {"product_id": ANY}),
    ("GET", "/credit/outstanding", None),
    ("GET", "/credit/settlements", None),
    ("POST", "/credit/settlements", {"customer_id": ANY, "amount": "10.00", "method": "cash"}),
    ("GET", f"/credit/customers/{ANY}/ledger", None),
    ("GET", "/payments", None),
    ("GET", f"/orders/{ANY}/payments", None),
    ("POST", f"/orders/{ANY}/payments", {"method": "cash"}),
    ("POST", f"/orders/{ANY}/cancel", None),
    ("GET", "/expenses", None),
    ("POST", "/expenses", {"category_id": ANY, "description": "Milk", "amount": "50.00"}),
    ("GET", "/expense-categories", None),
    ("GET", "/reports/sales", None),
    ("GET", "/reports/financial", None),
    ("GET", "/reports/trend", None),
    ("GET", "/reports/top-products", None),
    ("GET", f"/products/{ANY}/detail", None),
    ("PATCH", f"/products/{ANY}/price", {"mrp": "25.00"}),
    ("PUT", f"/products/{ANY}/stock", {"stock_quantity": 5}),
    ("POST", "/categories", {"name": "Snacks"}),
    ("POST", "/products", {"category_id": ANY, "name": "Tea", "mrp": "10.00"}),
]

# Things the manager must NOT be able to do (owner-only)
MANAGER_FORBIDDEN = [
    ("GET", "/users", None),
    ("POST", "/users", {"username": "x.user", "password": "Passw0rd123", "full_name": "X User", "role": "cashier"}),
    ("PATCH", f"/users/{ANY}", {"role": "owner"}),
    ("DELETE", f"/customers/{ANY}", None),
    ("POST", "/categories", {"name": "Snacks"}),
    ("POST", "/products", {"category_id": ANY, "name": "Tea", "mrp": "10.00"}),
    ("DELETE", f"/products/{ANY}", None),
    ("POST", "/expense-categories", {"name": "Rent"}),
    ("DELETE", f"/expenses/{ANY}", None),
    ("GET", "/reports/financial", None),
    ("GET", "/reports/trend", None),
    ("GET", "/reports/top-products", None),
    ("GET", "/reports/peak-hours", None),
    ("GET", "/reports/corporate", None),
]

NEEDS_LOGIN = [
    ("GET", "/auth/me"),
    ("GET", "/users"),
    ("GET", "/customers/search?q=ab"),
    ("GET", "/products"),
    ("GET", "/orders"),
    ("POST", "/orders"),
    ("GET", "/reports/sales"),
    ("GET", "/credit/outstanding"),
]


# ---------------------------------------------------------------- authentication
@pytest.mark.parametrize("method,path", NEEDS_LOGIN)
def test_protected_endpoints_reject_anonymous(anon, method, path):
    r = anon._call(method, path)
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "authentication_failed"


def test_garbage_and_forged_tokens_rejected(anon, stack):
    assert anon.get("/auth/me", headers={"Authorization": "Bearer not.a.jwt"}).status_code == 401
    import jwt

    forged = jwt.encode(
        {"sub": str(uuid.uuid4()), "role": "owner", "iat": 1, "exp": 9999999999},
        secrets.token_urlsafe(48), algorithm="HS256",
    )
    assert anon.get("/auth/me", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_login_success_and_me(stack, make_user):
    username, password, user_id = make_user("manager")
    r = stack.post("/auth/login", json={"username": username.upper(), "password": password})  # case-insensitive
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer" and body["expires_in"] > 0
    me = stack.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"}).json()
    assert me["id"] == user_id and me["role"] == "manager"
    assert "password_hash" not in me and "password" not in me


def test_login_failures_are_indistinguishable(stack, make_user):
    username, _, _ = make_user("cashier")
    wrong_pw = stack.post("/auth/login", json={"username": username, "password": "definitely-wrong1"})
    no_user = stack.post("/auth/login", json={"username": "ghost.user", "password": "definitely-wrong1"})
    assert wrong_pw.status_code == no_user.status_code == 401
    assert wrong_pw.json() == no_user.json()


def test_inactive_employee_cannot_login_or_use_existing_token(owner, stack, make_user):
    username, password, user_id = make_user("cashier")
    token = stack.post("/auth/login", json={"username": username, "password": password}).json()["access_token"]
    hdr = {"Authorization": f"Bearer {token}"}
    assert stack.get("/auth/me", headers=hdr).status_code == 200

    assert owner.patch(f"/users/{user_id}", json={"status": "inactive"}).status_code == 200
    assert stack.get("/auth/me", headers=hdr).status_code == 401  # immediately, token not yet expired
    assert stack.post("/auth/login", json={"username": username, "password": password}).status_code == 401


def test_role_comes_from_database_not_from_token_claim(stack, make_user):
    """A token claiming role=owner for a cashier's user id must still be treated as a cashier."""
    from app.core.config import get_settings
    from app.core.security import create_access_token

    _, _, cashier_id = make_user("cashier")
    s = get_settings()
    token, _ = create_access_token(
        user_id=uuid.UUID(cashier_id), role="owner", secret=s.jwt_secret_key,
        algorithm=s.jwt_algorithm, expires_minutes=5,
    )
    r = stack.get("/users", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403


def test_change_password(stack, make_user, login):
    username, password, _ = make_user("manager")
    token = stack.post("/auth/login", json={"username": username, "password": password}).json()["access_token"]
    hdr = {"Authorization": f"Bearer {token}"}
    new_pw = secrets.token_urlsafe(12) + "z9"

    bad = stack.post("/auth/change-password", headers=hdr, json={"current_password": "nope", "new_password": new_pw})
    assert bad.status_code == 401
    weak = stack.post("/auth/change-password", headers=hdr, json={"current_password": password, "new_password": "short"})
    assert weak.status_code == 422
    ok = stack.post("/auth/change-password", headers=hdr, json={"current_password": password, "new_password": new_pw})
    assert ok.status_code == 200
    assert stack.post("/auth/login", json={"username": username, "password": password}).status_code == 401
    assert stack.post("/auth/login", json={"username": username, "password": new_pw}).status_code == 200


# ---------------------------------------------------------------- authorisation
@pytest.mark.parametrize("method,path,body", CASHIER_FORBIDDEN)
def test_cashier_is_refused(cashier, method, path, body):
    r = cashier._call(method, path, json=body) if body is not None else cashier._call(method, path)
    assert r.status_code == 403, f"{method} {path} -> {r.status_code} {r.text}"
    assert r.json()["error"]["code"] == "permission_denied"


@pytest.mark.parametrize("method,path,body", MANAGER_FORBIDDEN)
def test_manager_is_refused_owner_only_actions(manager, method, path, body):
    r = manager._call(method, path, json=body) if body is not None else manager._call(method, path)
    assert r.status_code == 403, f"{method} {path} -> {r.status_code} {r.text}"


def test_cashier_allowed_actions(cashier, menu):
    assert cashier.get("/products").status_code == 200
    assert cashier.get(f"/products/{menu['chai']}").status_code == 200
    assert cashier.get("/products/popular").status_code == 200
    assert cashier.get("/categories").status_code == 200
    assert cashier.get("/customers/search?q=an").status_code == 200
    assert cashier.get("/orders").status_code == 200
    assert cashier.post("/orders", json={"walk_in_name": "Ravi", "items": [{"product_id": menu["chai"], "quantity": 1}]}).status_code == 201


def test_manager_allowed_actions(manager, owner):
    assert manager.get("/credit/outstanding").status_code == 200
    assert manager.get("/expenses").status_code == 200
    assert manager.get("/expense-categories").status_code == 200
    assert manager.get("/reports/sales").status_code == 200
    assert manager.get("/customers").status_code == 200
    assert manager.post("/customers", json=NEW_CUSTOMER).status_code == 201


def test_owner_can_do_everything_read_side(owner):
    for path in ("/users", "/customers", "/payments", "/expenses", "/credit/outstanding",
                 "/reports/sales", "/reports/financial", "/reports/trend", "/reports/top-products",
                 "/reports/peak-hours", "/reports/corporate"):
        r = owner.get(path)
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text}"


# ---------------------------------------------------------------- employee management rules
def test_owner_manages_employees(owner, stack):
    pw = secrets.token_urlsafe(12) + "a1"
    r = owner.post("/users", json={"username": "Priya.S", "password": pw, "full_name": "Priya S", "role": "cashier"})
    assert r.status_code == 201
    assert r.json()["username"] == "priya.s" and r.json()["role"] == "cashier"
    assert "password" not in r.json() and "password_hash" not in r.json()
    uid = r.json()["id"]

    assert owner.post("/users", json={"username": "priya.s", "password": pw, "full_name": "Dup", "role": "cashier"}).status_code == 409
    assert owner.post("/users", json={"username": "weak.pw", "password": "short", "full_name": "Weak", "role": "cashier"}).status_code == 422
    assert owner.post("/users", json={"username": "bad role", "password": pw, "full_name": "Bad", "role": "cashier"}).status_code == 422

    assert owner.patch(f"/users/{uid}", json={"role": "manager"}).json()["role"] == "manager"
    assert owner.get("/users?role=manager").json()["total"] == 1

    new_pw = secrets.token_urlsafe(12) + "b2"
    assert owner.post(f"/users/{uid}/reset-password", json={"new_password": new_pw}).status_code == 200
    assert stack.post("/auth/login", json={"username": "priya.s", "password": new_pw}).status_code == 200


def test_cannot_remove_the_last_owner_or_deactivate_self(owner):
    me = owner.get("/auth/me").json()["id"]
    r = owner.patch(f"/users/{me}", json={"role": "manager"})
    assert r.status_code == 422 and "at least one active owner" in r.json()["error"]["message"]
    r = owner.patch(f"/users/{me}", json={"status": "inactive"})
    assert r.status_code == 422


def test_validation_errors_have_a_uniform_shape(owner):
    r = owner.post("/users", json={"username": "x"})
    assert r.status_code == 422
    err = r.json()["error"]
    assert err["code"] == "validation_error" and isinstance(err["details"], list) and err["details"]


def test_unknown_resource_is_404_not_500(manager):
    r = manager.get(f"/customers/{uuid.uuid4()}")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"
    assert manager.get("/customers/not-a-uuid").status_code == 422

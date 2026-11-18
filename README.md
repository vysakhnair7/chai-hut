# Chai Hut

`app/` is the FastAPI backend, `frontend/` is the React web app. Sections 1–6 below document the backend; start with *Run the full stack*.

FastAPI + PostgreSQL + SQLAlchemy 2 + Pydantic v2 + JWT. Employee-only authentication with
owner / manager / cashier roles enforced **on the server**, corporate customers identified by a
Chai ID (UUID), orders with daily tokens, split payments, corporate credit with month-end
settlement, expenses, and revenue / profit reports.

Interactive API docs (OpenAPI/Swagger): `http://localhost:8000/docs` · ReDoc: `/redoc` · schema: `/openapi.json`

---------------------------------------------------------------------------------------------

## Run the full stack (backend + web app)

1. **Backend** – follow section 1 below, and in the backend `.env` also set the web app's origin so the browser is allowed to call the API:

   ```bash
   CORS_ORIGINS=http://localhost:5173
   ```

   then `docker compose up --build` (or `uvicorn app.main:app --reload`). API docs: <http://localhost:8000/docs>.
   Optionally load demo data: `docker compose exec api python -m app.utils.seed_demo` (prints random passwords once).

2. **Frontend** – needs Node 20+:

   ```bash
   cd frontend
   cp .env.example .env        # VITE_API_BASE_URL=http://localhost:8000 by default
   npm install
   npm run dev                 # http://localhost:5173
   ```

3. Sign in with the owner from `OWNER_USERNAME` / `OWNER_PASSWORD` (or a demo account). The owner can then add managers and cashiers under *Employee Management*.

Frontend details, scripts, tests and an honest account of what has and has not been verified: [`frontend/README.md`](frontend/README.md).
Developer conventions for both halves: [`CLAUDE.md`](CLAUDE.md).

---------------------------------------------------------------------------------------------

## 1. Run it

### Option A – Docker (recommended, nothing else to install)

```bash
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD, OWNER_USERNAME, OWNER_PASSWORD (min 10 chars, letters+digits)
python -c "import secrets; print(secrets.token_urlsafe(48))"      # paste into JWT_SECRET_KEY
docker compose up --build
```

On start the container applies the migrations, creates the first owner from `OWNER_USERNAME` /
`OWNER_PASSWORD` (skipped if an owner already exists) and serves on port 8000.

Load demo data (menu, expense categories, three corporate customers, one user per role with
**random passwords printed once**):

```bash
docker compose exec api python -m app.utils.seed_demo      # only works on an empty users table
```

### Option B – local Python

Needs Python 3.11+ and a PostgreSQL server.

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
createdb chai_hut                                   # or any name; put it in DATABASE_URL
cp .env.example .env                                # fill DATABASE_URL, JWT_SECRET_KEY, OWNER_*
alembic upgrade head                                # create tables
python -m app.utils.bootstrap_owner                 # first owner from OWNER_USERNAME/OWNER_PASSWORD
uvicorn app.main:app --reload
```

No secret lives in the source tree: `DATABASE_URL` and `JWT_SECRET_KEY` (≥ 32 chars) are required
and the app refuses to start without them.

### Try it (curl)

```bash
BASE=http://localhost:8000
TOKEN=$(curl -s $BASE/auth/login -H 'content-type: application/json' \
        -d '{"username":"<owner username>","password":"<owner password>"}' | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s $BASE/products -H "Authorization: Bearer $TOKEN"
```

In Swagger UI click **Authorize** and paste the token.

---------------------------------------------------------------------------------------------

## 2. Tests

```bash
pytest                       # unit tests always run; integration tests need PostgreSQL (below)
```

Integration tests run the real Alembic migration and then drive the API end to end. They
**wipe** the target database, so its name must contain `test` or they abort.

```bash
# against your own Postgres
TEST_DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/chai_hut_test pytest

# or fully containerised, throwaway database
docker compose --profile test run --rm tests
```

| Suite | What it proves |
|---|---|
| `tests/unit` | password hashing, JWT (tamper / expiry / `alg=none`), the role→permission matrix, GST maths, the finance rules, regular-drink selection, trends, config fail-fast |
| `test_auth_rbac` | every cashier/manager-forbidden endpoint answers 403, anonymous 401, forged tokens, role re-read from DB, deactivation takes effect immediately, last-owner protection |
| `test_customers_preferences` | registration, server-generated Chai ID, cashier sees basic info only, 5-of-10-bills → regular drink, one regular per customer (also at DB level) |
| `test_orders` | tokens, totals + CGST/SGST split, stock, discount permission, status workflow, cancel, public tracking, bill |
| `test_payments_credit` | split payments, no overpay, duplicate transaction / idempotency, credit, settlement, ledger, reversal |
| `test_finance_reports` | a hand-calculated day: sales, collected, receivable, COGS, gross & net profit, missing-cost rule, manager's limited view, trends |
| `test_menu_expenses` | cost hidden from cashiers, stock/status consistency, discontinue, expenses |
| `test_migrations` | migration == models (no drift) and DB-level money constraints |

---------------------------------------------------------------------------------------------

## 3. Who can do what

Defined once in `app/core/rbac.py` and enforced per route with `require_permissions(...)`.

| Capability | Owner | Manager | Cashier |
|---|:--:|:--:|:--:|
| Employees & roles | ✅ | – | – |
| Register / update customers, assign Chai ID | ✅ | ✅ | – |
| Delete customer (no dues, no history) | ✅ | – | – |
| Search customers (name/company/phone/Chai ID) – basic info only | ✅ | ✅ | ✅ |
| Full customer record (phone, amount due) | ✅ | ✅ | – |
| View regular drink / most-ordered products | ✅ | ✅ | ✅ |
| Set / clear regular drink | ✅ | ✅ | – |
| View menu, price and stock left | ✅ | ✅ | ✅ |
| See cost price & margin | ✅ | ✅ | – |
| Change price / stock | ✅ | ✅ | – |
| Create / edit / discontinue products & categories | ✅ | – | – |
| Place orders (registered or walk-in), generate token, move status | ✅ | ✅ | ✅ |
| Apply discount · cancel order | ✅ | ✅ | – |
| See orders from previous days | ✅ | ✅ | today only |
| Record payments · settle corporate credit · view dues/ledger | ✅ | ✅ | – |
| Payment history | ✅ | ✅ | – |
| Record / edit expenses | ✅ | ✅ | – |
| Delete expenses · manage expense categories | ✅ | – | – |
| Sales summary | ✅ any range | ✅ last 7 days | – |
| Revenue, collections, COGS, gross/net profit, analytics, trends | ✅ | – | – |

Customers never authenticate. Staff identify a customer by username, phone, company or Chai ID.

---------------------------------------------------------------------------------------------

## 4. Business rules worth knowing

**Money.** Every amount is `NUMERIC(12,2)` / `Decimal`, never float. Prices are **GST-exclusive**;
GST is charged on the post-discount value and split equally into CGST and SGST.
`total = subtotal − discount + tax`, `tax = CGST + SGST` – also enforced by database CHECK constraints.

**Order flow.** `placed → preparing → ready → completed`; no skipping or going back. `cancelled`
is only reachable from the first three via `POST /orders/{id}/cancel`, which in one transaction
restores stock, refunds recorded payments and reverses any credit extended. Each business day has
its own token counter (`T001`, `T002`, …) allocated under a row lock. `GET /orders/track/{token}` is
public and returns only token + status. Order items snapshot price, cost and GST, so later price
changes never rewrite history. There is no `bills` table: `GET /orders/{id}/bill` builds it from
`orders` + `order_items` (+ payments, for roles allowed to see them).

**Preferences.** `most_frequent` is computed live from the customer's completed orders and counts
*bills containing the product* (5 of 10 bills → 50%), not cups. When an order completes, the stored
regular drink is refreshed to that result. A manager can override it by hand; the next completed
order recomputes it. A partial unique index guarantees one regular per customer.

**Payments never double-apply.** (1) `Idempotency-Key` header: a retry returns the original
(`200` instead of `201`); the same key with a different body is `409`. (2) `transaction_id` is
unique. (3) The order row is locked while the remaining balance is checked, so concurrent payments
can't exceed the total. UPI/card require a `transaction_id`.

**Corporate credit.** Paying with `corporate_credit` needs a registered customer and adds to
`amount_due`. `POST /credit/settlements` (salary day) reduces it; partial settlement is allowed,
over-settlement is rejected. `GET /credit/outstanding` totals by customer and by company;
`GET /credit/customers/{id}/ledger` gives a statement with running balance.

**Financial report** (`GET /reports/financial`, owner; cancelled orders excluded):

| Figure | Definition |
|---|---|
| total_sales | Σ order subtotals |
| net_sales | total_sales − discounts |
| total_collected | successful **cash + UPI + card** payments. **Corporate credit is never included** |
| outstanding_receivable | net_sales + GST − total_collected (unpaid + credit extended) |
| cogs | Σ quantity × unit_cost snapshot |
| gross_profit | net_sales − cogs |
| net_profit | gross_profit − expenses |

If any sold item has no cost price, `cogs`, `gross_profit` and `net_profit` are returned as **null**
(with `cost_data_complete: false` and a count) instead of a misleading "sales minus expenses".
Settlement receipts for old dues are reported separately as `credit_settlements_received` – they are
not new sales. Business days use `BUSINESS_TIMEZONE` (default Asia/Kolkata).

---------------------------------------------------------------------------------------------

## 5. Project layout

```
app/
  main.py            app factory, router wiring, health
  enums.py           roles, statuses, payment methods
  core/              config (env), database, security (scrypt + JWT), rbac, deps, exceptions
  models/            SQLAlchemy tables (users, customers, catalog, preference, order, payment, expense)
  schemas/           Pydantic request/response models
  routers/           thin HTTP layer: permission + validation, no business logic
  services/          business logic and transactions
  utils/             pure functions (money/GST, finance, analytics) + bootstrap_owner, seed_demo
migrations/          Alembic (0001_initial_schema.py)
tests/               unit/ and integration/
Dockerfile · docker-compose.yml · .env.example
```

Errors always look like `{"error": {"code": "...", "message": "..."}}` (validation errors add `details`).

---------------------------------------------------------------------------------------------

## 6. Assumptions and known limits

* **MRP is treated as the GST-exclusive selling price.** In India an MRP is normally GST-inclusive; if
  yours is, change `calculate_order_totals` to back the tax out of the price.
* Access tokens only (60 min default); there is no refresh token. Deactivating or demoting an
  employee takes effect on their next request because role/status are re-read from the database.
* No login rate limiting and no rate limit on the public tracking endpoint – put both behind your
  gateway / reverse proxy.
* Cashiers cannot record payments (per the brief: payments are a manager/owner function). To let
  cashiers take cash at the counter, add `Permission.PAYMENTS_CREATE` to `_CASHIER` in `app/core/rbac.py`.
* Stock is decremented when an order is placed and restored on cancellation.
* Single currency (INR), single outlet.

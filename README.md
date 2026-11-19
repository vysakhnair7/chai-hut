# Chai Hut

A café management system for a corporate-café business: staff sign in (owner / manager / cashier), take orders with
daily tokens, record payments, run corporate credit with month-end settlement, track expenses, and see revenue / profit reports.

* `app/` – backend API (FastAPI + PostgreSQL + JWT). Interactive API docs at `/docs`.
* `frontend/` – web app (React + TypeScript + Tailwind). Different screens for each role.

| Role | Can do |
|---|---|
| **Owner** | everything: dashboard, analytics and profit, products and categories, customers, orders, payments, dues, expenses, employees |
| **Manager** | today's operations, customers, prices and stock, orders (cancel, discount), payments, dues, expenses. No profit, analytics or employees |
| **Cashier** | place orders, print the token, move orders along, look customers up. No money screens |

---------------------------------------------------------------------------------------------

## Quick start (about 15 minutes, no coding needed)

This runs everything on **your own computer**. Nothing is uploaded anywhere.

### What you need first

| Program | Why | Get it |
|---|---|---|
| **Docker Desktop** (Windows / Mac) or Docker Engine + Compose (Linux) | runs the database and backend | <https://www.docker.com/products/docker-desktop> |
| **Node.js 20 or newer** (the "LTS" version) | runs the website | <https://nodejs.org> |

* Start Docker Desktop and wait until it says **Engine running** before you continue.
* You need a few GB of free disk space (Docker downloads images). You do **not** need Python or PostgreSQL.
* Check Node: open a terminal and run `node -v`. It should print `v20` or higher.

### Step 1 – Get the code

* **Easiest:** on the GitHub page click the green **Code** button → **Download ZIP**, then unzip it
  (Windows: right-click → *Extract All*). You get a folder such as `chai-hut-main`.
* Or with git: `git clone <the repo URL>`

### Step 2 – Open a terminal inside that folder

* **Windows:** open the folder in File Explorer, click the address bar, type `powershell`, press Enter.
* **Mac:** right-click the folder → *New Terminal at Folder* (or `cd` into it).
* **Linux:** open a terminal in the folder.

Everything below is typed into that terminal. The folder you are in must contain `docker-compose.yml`.

### Step 3 – Create your settings file (`.env`)

Copy the template:

```bash
# Windows PowerShell
copy .env.example .env
# Mac / Linux
cp .env.example .env
```

Open `.env` in a text editor (`notepad .env` on Windows, `open -e .env` on Mac, `nano .env` on Linux) and fill in these four lines.
No spaces around `=`, no quotes:

| Line | What to put |
|---|---|
| `POSTGRES_PASSWORD=` | a password for the database, **letters and digits only**, e.g. `Tea2026dbpass` |
| `OWNER_USERNAME=` | the login name of the first user, **lowercase, no spaces**, e.g. `owner` |
| `OWNER_PASSWORD=` | that user's password: **10+ characters with letters and digits**, e.g. `ChaiBoss2026` |
| `JWT_SECRET_KEY=` | a long random string, **at least 32 characters** (generate one below) |

Generate the `JWT_SECRET_KEY` value, copy the output, and paste it after the `=`:

```bash
# Windows PowerShell
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b | ForEach-Object { $_.ToString("x2") }) -join ""
# Mac / Linux
openssl rand -hex 32
```

Leave every other line as it is. `CORS_ORIGINS=http://localhost:5173` is already set; it lets the website talk to the backend.
**Never share or commit your `.env`** (it is already in `.gitignore`).

### Step 4 – Start the backend

Choose **one**:

**A. Empty system** (you add your own menu and staff):

```bash
docker compose up --build
```

**B. With demo data** (sample menu, customers, and three demo users). Run this **once, before the first `up`**:

```bash
docker compose run --rm api sh -c "alembic upgrade head && python -m app.utils.seed_demo"
```

It prints three logins (`demo.owner`, `demo.manager`, `demo.cashier`) with random passwords. **They are shown only once. Copy them now.**
Then start the backend:

```bash
docker compose up
```

(With B you sign in as `demo.owner`; the `OWNER_USERNAME` account is not created because an owner already exists.)

The first run takes a few minutes. It is ready when you see `Uvicorn running on http://0.0.0.0:8000`.
**Leave this window open.** Check it by opening <http://localhost:8000/docs>; you should see the API page.

### Step 5 – Start the website

Open a **second** terminal in the same folder:

```bash
cd frontend
npm install
npm run dev
```

`npm install` takes a minute or two (yellow warnings are normal). When it prints `Local: http://localhost:5173/`, open
**<http://localhost:5173>** in your browser.

> **Windows PowerShell says "running scripts is disabled"?** Run this once, answer `Y`, then repeat Step 5:
> `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`
> (or use *Command Prompt* instead of PowerShell).

### Step 6 – Sign in and try it

Sign in with the owner account (from Step 3, or `demo.owner` if you used the demo data). Suggested tour:

1. **Owner:** *Dashboard*, then *Employee Management* → add a manager and a cashier (skip this if you loaded the demo users).
2. **Cashier** (log out, log in as the cashier): *New Order* → tap items → *Place order* → a token appears with a *Print token* button.
   *Active Orders* → move the order Placed → Preparing → Ready → Completed.
3. **Manager:** *Orders* → open an order → *Record payment*. Try a corporate customer: pay by **Corporate credit**, then settle it in *Outstanding Dues*.
4. **Owner:** *Analytics & Reports*. Profit shows "—" if any sold item has no cost price (set it in *Products & Menu*).

Without demo data the menu is empty: as owner go to *Products & Menu* → *Categories* → add one, then *Add product*.

---------------------------------------------------------------------------------------------

## Day-to-day

| I want to… | Do this |
|---|---|
| Start again later | Docker Desktop running → `docker compose up` in the project folder; then `npm run dev` in `frontend/`. Your data is kept |
| Stop | `Ctrl + C` in each terminal, then `docker compose down` (data is kept) |
| **Wipe everything** and start fresh | `docker compose down -v` (deletes the database), then Step 4 again |
| Change a setting in `.env` | stop with `Ctrl + C`, edit `.env`, run `docker compose up` again |

## Troubleshooting

| What you see | Fix |
|---|---|
| `docker` is not recognized / cannot connect to the Docker daemon | Docker Desktop is not installed or not running. Start it and wait for **Engine running** |
| `set JWT_SECRET_KEY in .env` (or `OWNER_USERNAME`, `POSTGRES_PASSWORD`…) | that line in `.env` is empty. Fill it in |
| `String should have at least 32 characters` / `jwt_secret_key` | the secret is too short. Generate a new one (Step 3) |
| Website says **"Cannot reach the Chai Hut server"** | backend not running (Step 4), or `CORS_ORIGINS=http://localhost:5173` is missing/changed in `.env`. Fix, then restart with `docker compose up` |
| Login says wrong username or password | usernames are lowercase. Use exactly the `OWNER_USERNAME`/`OWNER_PASSWORD` in your `.env`. **Changing `.env` later does not change an existing user**: reset with `docker compose down -v` |
| `Users already exist; refusing to seed` | demo data only loads into a database with no users. Run `docker compose down -v`, then Step 4B |
| `port is already allocated` (8000, 5173 or 5432) | another program uses that port. Close it, or stop other Docker projects |
| `npm` is not recognized | close and reopen the terminal; if it persists, reinstall Node.js |
| PowerShell: "running scripts is disabled" | see the note under Step 5 |

## Run the tests

```bash
# backend (starts a throwaway test database, your data is untouched)
docker compose --profile test run --rm tests

# frontend
cd frontend
npm run typecheck && npm run lint && npm test && npm run build
```

**Status:** the frontend was written without being able to run `npm install`, lint, the tests or the production build in the author's
environment; see "Verification status" in [`frontend/README.md`](frontend/README.md). If one of those fails on your machine, that is useful
information, so please report it.

## More documentation

* [`frontend/README.md`](frontend/README.md) – the web app: scripts, configuration, structure, known gaps
* [`frontend/docs/`](frontend/docs/) – API mapping (and where the spec and backend differ), architecture, plan
* [`docs/DEPLOY.md`](docs/DEPLOY.md) – *optional, not needed to run locally*: putting it online (Supabase database + Render + Netlify)
* [`CLAUDE.md`](CLAUDE.md) – conventions for working on the code (also useful for AI coding assistants)
* Backend reference (permissions, business rules, layout): sections 1–6 below

---------------------------------------------------------------------------------------------

## 1. Backend run options (reference)

### Option A – Docker (recommended, nothing else to install)

```bash
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD, OWNER_USERNAME, OWNER_PASSWORD (min 10 chars, letters+digits)
python -c "import secrets; print(secrets.token_urlsafe(48))"      # paste into JWT_SECRET_KEY
docker compose up --build
```

On start the container applies the migrations, creates the first owner from `OWNER_USERNAME` /
`OWNER_PASSWORD` (skipped if an owner already exists) and serves on port 8000.

Demo data (menu, expense categories, three corporate customers, and demo.owner / demo.manager / demo.cashier users
with **random passwords printed once**) can only be loaded into a database that has **no users yet**. The container creates
the owner on every start, so load the demo data *before* the first `docker compose up` (see "Quick start → Demo data" at the top).

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

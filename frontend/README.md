# Chai Hut – Frontend

React 18 + TypeScript (strict) + Vite + Tailwind CSS single-page app for the Chai Hut café backend
(`../app`, FastAPI). Staff sign in and see a different app depending on their role:

| Role | Lands on | Can use |
|---|---|---|
| **Owner** | Dashboard | everything: revenue, collections, profit, analytics, products and categories, customers, orders, payments, dues, expenses, employees |
| **Manager** | Dashboard | today's operations, customers, prices and stock, orders (cancel, discount), payments, dues, expenses. No profit, no analytics, no employees |
| **Cashier** | New Order (POS) | place orders, print the token, move orders along, look customers up. No money screens at all |

The buttons and menus a role does not need are hidden, but that is only convenience: **the backend
enforces every permission**, and the app is written to cope with a `403` anywhere.

---

## Run it

You need Node 20+ and the backend running (see the [root README](../README.md)).

```bash
cd frontend
cp .env.example .env          # defaults point at http://localhost:8000
npm install
npm run dev                   # http://localhost:5173
```

The backend must allow the browser origin. In the **backend's** `.env` set
`CORS_ORIGINS=http://localhost:5173` and restart it. No backend code change is needed.

Sign in with an employee account: the owner you created with `OWNER_USERNAME` / `OWNER_PASSWORD`, or the
accounts printed once by `python -m app.utils.seed_demo` (they have random passwords; nothing is hardcoded).

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | dev server with hot reload |
| `npm run build` | type-check, then production build into `dist/` |
| `npm run preview` | serve the production build locally |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (typescript-eslint, react-hooks) |
| `npm run format` / `format:check` | Prettier |
| `npm test` / `npm run test:watch` | Vitest + React Testing Library |

### Configuration (`.env`)

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend URL, no trailing slash |
| `VITE_BUSINESS_TIMEZONE` | `Asia/Kolkata` | Used for "today", "last 7 days" etc. Must match the backend's `BUSINESS_TIMEZONE` |
| `VITE_API_TIMEOUT_MS` | `15000` | Per-request timeout |

Everything under `VITE_` is public (it ends up in the browser bundle). There are no secrets in this app.

For production, serve `dist/` from any static host and set `CORS_ORIGINS` on the backend to that site's origin.

---

## Verification status (read this)

This code was written in a sandbox **without access to the npm registry**, so the normal toolchain could not run there.

**Done in the sandbox**

* `tsc` type-check, strict mode (`noUncheckedIndexedAccess`, `noUnusedLocals`…), over **all** source files **and all test files**,
  with third-party packages replaced by hand-written type declarations (`zod`, `clsx`, `tailwind-merge` and
  `class-variance-authority` used their real types). Result: no errors.
* Every bare import in `src/` is listed in `package.json`.
* Every endpoint, request field and response field the app uses was checked by hand against the backend's
  routers and Pydantic schemas (see `docs/FRONTEND_API_MAPPING.md`).

**Not done, so not verified**

* `npm install` (there is no `package-lock.json`; `npm install` will create one: commit it).
* `npm run build` / `vite build`, `npm run lint`, `npm run format:check`.
* **`npm test`: the Vitest tests were written and type-checked but have never been run.** Expect to fix a few
  assertions or selectors on the first run.
* The app has not been opened in a browser or run against the live backend, and no visual/responsive check was made.
* Because third-party types were stubs, a mismatch with the *real* library types (React Hook Form, Recharts,
  TanStack Query, Radix) would only show up in your first `npm run typecheck`.

**First thing to do on your machine**

```bash
npm install && npm run typecheck && npm run lint && npm test && npm run build
```

then click through the flows below with the three demo roles.

### Manual smoke test (≈10 minutes)

1. **Cashier**: sign in → lands on New Order. Add two items, place an order → token slip, no prices on it → *Print token*.
   *Active Orders* → move it Placed → Preparing → Ready → Completed. Try opening `/payments` by URL: you are sent back to the POS.
2. **Manager**: sign in → dashboard. *Orders* → open an order → *Record payment* (cash). Try UPI without a reference (blocked).
   Cancel an order (asks to confirm). Open `/analytics` by URL: you are sent back to the dashboard.
3. **Owner**: register a customer (Customers → Register). Set a Saved Regular on the customer page. *Dues*: settle part of a
   customer's credit. *Dashboard*: change the date range; remove a product's cost price in *Products* and see profit become "—".
4. Stop the backend and click around: you get "Cannot reach the Chai Hut server" with a *Try again* button, never a blank page.

---

## How it is organised

```
src/
  lib/ utils/        cn(), env, money/date formatting, error messages, zod helpers, idempotency keys
  constants/         navigation per role, labels, TanStack Query keys
  types/             TypeScript types mirroring the backend schemas
  services/          apiClient (the ONLY code that calls fetch) + one service per backend area
  contexts/          AuthContext (token + current user)
  hooks/             useApiMutation, useDateRange, useDebounce, useRole
  routes/            router, ProtectedRoute / RoleRoute guards, lazy page loading
  components/        ui/ (button, input, dialog…), common/ (tables, forms, states), layout/, charts/
  features/<area>/   pages, dialogs, hooks and zod schemas: auth, dashboard, customers, products,
                     orders (POS), payments (payments + dues), expenses, analytics, users, settings
  test/              test setup, render helpers, factories
docs/                FRONTEND_API_MAPPING.md · FRONTEND_ARCHITECTURE.md · FRONTEND_IMPLEMENTATION_PLAN.md
```

### Rules the code follows

* **Backend is the source of truth.** Totals, GST, profit, "most frequent product", dues and balances are never
  calculated in React. The one piece of arithmetic is the POS cart's *quantity × price* **estimate**, labelled as such,
  computed in whole paise.
* **One door to the backend.** Pages never call `fetch`; they use hooks → `services/*` → `apiClient`.
* **Sessions.** The backend returns a 60-minute bearer token (no cookie, no refresh token), so the token is kept in
  `sessionStorage` (gone when the tab closes, never `localStorage`). The role is always re-read from `/auth/me`; a 401
  anywhere signs the user out and clears every cached query.
* **Money safety.** Recording a payment or a settlement sends an `Idempotency-Key`: one per attempt, reused if the same
  request is retried after a dropped connection, replaced as soon as the user changes anything.
* **Profit honesty.** When any sold item has no cost price the backend returns `null` profit; the UI shows "—" and links
  to Products instead of showing a misleading number. Corporate credit is never added to "Collected".
* **Cashiers see no financial data**: no totals on the order list or token slip, no payments, dues or reports; they
  do not even request bills.
* Every page has loading, error (with retry), empty and success states; destructive actions ask for confirmation.

### Known gaps

The spec asked for a few things the current backend cannot provide. Nothing was faked and the backend was not changed;
the full list with suggested backend additions is in `docs/FRONTEND_API_MAPPING.md`. The main ones: no customer email
or order notes fields; no pre-submit price quote endpoint (hence the labelled estimate); no payment-method breakdown or
profit-over-time data; no idempotency key on order creation (so a failed network call tells the cashier to check
Active Orders before retrying); managers cannot add menu items (owner-only in the backend).

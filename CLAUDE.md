# CLAUDE.md – working notes for Chai Hut

Two parts in one repo: `app/` (FastAPI + PostgreSQL backend, finished and tested) and `frontend/` (React + TypeScript web app).
Read the part you are changing; do not change the other one without being asked.

## Ground rules

* **The backend is the authority** on permissions, totals, GST, profit, dues and "most frequent product". The frontend displays
  those; it never recomputes them. The only frontend arithmetic is the POS cart *estimate* (`features/orders/cart.ts`, whole paise).
* **Do not modify the backend to suit the frontend** without explicit approval. If the UI needs something the API lacks, write it
  in `frontend/docs/FRONTEND_API_MAPPING.md` ("Discrepancies") and build the closest honest UI. Never invent endpoints or fields,
  and never use mock data in a production screen.
* **No secrets in code**: no passwords, JWT secrets, or default credentials anywhere. Configuration comes from `.env` files
  (`.env.example` documents them). Frontend `VITE_*` values are public by definition.
* Role checks in the UI are convenience only. Every restriction must also exist in `app/core/rbac.py`.
* Cashiers must never see financial data (totals on lists/slips, payments, dues, reports).
* Do not claim something works because it looks right. Run it, or say clearly that it was not run.

## Backend (`app/`)

* Layers: `routers/` (HTTP + `require_permissions`) → `services/` (business rules, transactions) → `models/`; pure money/GST/analytics helpers in `utils/`.
* Permissions: one table in `app/core/rbac.py`. Errors: `{"error": {"code", "message", "details?"}}`.
* Money-moving endpoints (`POST /orders/{id}/payments`, `POST /credit/settlements`) require an `Idempotency-Key`.
* Migrations: Alembic (`migrations/`). Tests: `pytest` (needs PostgreSQL; see README). Lint: `ruff`.

## Frontend (`frontend/`)

* Stack: React 18, TypeScript strict, Vite, Tailwind (HSL tokens in `src/index.css`), Radix Dialog + CVA, React Router 6,
  TanStack Query 5, React Hook Form + zod, Recharts, lucide-react, sonner, Vitest + React Testing Library.
* Layout: `services/` (only `apiClient.ts` calls `fetch`) → `features/<area>/hooks.ts` → pages. Shared pieces in `components/`.
  Query keys live in `constants/queryKeys.ts`; menu/labels/role navigation in `constants/`.
* Roles: `constants/navigation.ts` is the single table for sidebar *and* route guards (`canAccess`). `useRole()` for UI flags.
* Auth: bearer token in `sessionStorage` only, role from `/auth/me`, 401 → sign out + clear query cache.
* Forms: one zod schema per form in `schemas.ts`, **form value types are plain strings** (`z.infer`, no input/output divergence;
  convert when building the payload). Avoid `z.union` for optional values (poor error messages); use `optionalMoney`.
  Show backend field errors with `applyServerFieldErrors`; keep a form-level error for the rest.
* Mutations: `useApiMutation` (toast + invalidation). Set `toastError: false` when the form shows the error itself.
* Payments/settlements: one `Idempotency-Key` per attempt (`newIdempotencyKey`), reused on retry, rotated when the form changes.
* Every list/page needs loading, error (with retry), empty and success states; destructive actions use `ConfirmDialog`.
* Money and dates: `formatMoney` / `formatDate*` from `utils/format.ts`; "today" comes from `todayIso()` (business timezone).
* Tests: colocated `*.test.ts(x)`; use `renderAs(role, ui)` from `src/test/utils.tsx` and spy on **services** (never on `fetch`,
  except in `apiClient.test.ts`). Test behaviour a user sees, including the role restrictions.

### Commands

```bash
cd frontend && npm install
npm run typecheck && npm run lint && npm test && npm run build
```

### Status

The frontend was authored in a sandbox without npm access: it is type-checked (against stubbed third-party types) but
`npm install`, `lint`, `vitest` and `vite build` have **not** been run. See "Verification status" in `frontend/README.md`.
Update that section whenever you actually run them.

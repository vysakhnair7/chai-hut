# Implementation plan

1. **Inspect backend** – done; see `FRONTEND_API_MAPPING.md` (contract, roles, 15 documented gaps).
2. **Foundation** – Vite/TS strict/Tailwind, design tokens, UI kit, `apiClient`, env.
3. **Auth** – login, session, `/auth/me`, role routing, logout, route guards.
4. **Business modules** in this order: dashboards shell → customers → products → preferences →
   POS + token → orders → payments & dues → expenses → owner analytics → employees → settings.
5. **Verification** – type-check, lint, unit/component tests (Vitest + RTL), production build,
   then manual run against the real backend with the three seeded demo users.

## Status of verification in the authoring environment

The authoring sandbox had no npm registry access, so `npm install`, `vitest`, `eslint` and
`vite build` could not be executed there. See `frontend/README.md` → *Verification status* for what was
checked (type-check of first-party code against stubbed third-party modules, syntax transpile) and the
exact commands to run on a developer machine.

## Status

| Step | State |
|---|---|
| Backend inspection, API mapping, architecture | done |
| Foundation, UI kit, API client | done |
| Auth, role routing, layout | done |
| Customers, preferences, products | done |
| POS + printable token, orders | done |
| Payments, dues, expenses | done |
| Dashboards, analytics, employees, settings | done |
| Unit/component tests (written, type-checked) | written, **not yet run** |
| `npm install`, lint, vitest, build, browser run | **not run in the authoring sandbox**: run on a developer machine |

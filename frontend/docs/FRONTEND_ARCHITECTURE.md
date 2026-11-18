# Frontend architecture

React 18 + TypeScript (strict) + Vite + Tailwind 3 + shadcn-style components (Radix Dialog, CVA)
+ React Router 6 + TanStack Query 5 + React Hook Form + Zod + Recharts + lucide-react + sonner.
No Redux, no animation library, no paid service. Everything runs locally against the FastAPI backend.

```
src/
  lib/          cn(), env
  utils/        money/date formatting, error messages (pure, unit-tested)
  constants/    roles, navigation per role, status labels, query keys
  types/        API entity types (one file per backend area)
  services/     apiClient (the ONLY place that calls fetch) + one service per backend area
  contexts/     AuthContext (token + current user)
  hooks/        useDebounce, useDateRange, useApiMutation, useRole
  routes/       router, ProtectedRoute / RoleRoute, lazy page loading
  components/
    ui/         button, input, card, badge, dialog, skeleton, table, select …  (shadcn-style)
    common/     PageHeader, StatCard, DataTable, Pagination, EmptyState, ErrorState,
                ConfirmDialog, FormField, DateRangeFilter, StatusBadge, Money
    layout/     AppLayout (collapsible sidebar, header, breadcrumbs, profile)
    charts/     small Recharts wrappers (line, bar)
  features/<area>/   pages + components + hooks for that area
```

## Rules the code follows

* **One door to the backend.** Components never call `fetch`; they use hooks from `features/*/hooks`
  that call `services/*`, which use `apiClient`. Endpoint paths live only in `services/`.
* **Server is the source of truth.** No totals, GST, profit or "most frequent product" are calculated
  in React. The only arithmetic is the POS cart's quantity × unit price *estimate* (labelled as such).
* **Auth.** `apiClient` attaches `Authorization: Bearer`. A 401 anywhere clears the session and
  returns to `/login?expired=1`. Token lives in `sessionStorage`; the current user is re-fetched from
  `/auth/me` on load so role changes take effect.
* **Roles are UX only.** `constants/navigation.ts` decides which menu items and routes exist per role;
  the backend independently enforces permissions (and the tests assume a 403 is possible anywhere).
* **Server state** via TanStack Query (cache, loading/error states, invalidation after mutations).
  Local UI state stays in components; context is used only for auth.
* **Idempotency.** Payment and settlement forms create one `Idempotency-Key` per form attempt and reuse
  it on retry, so a double click or retry cannot apply money twice.
* **Every page** handles loading (skeleton), error (retry), empty and success (toast) states.
* **Theming** via CSS variables in `index.css` mapped into `tailwind.config.ts`; components use
  semantic tokens (`bg-primary`, `text-muted-foreground`…), never raw hex values.

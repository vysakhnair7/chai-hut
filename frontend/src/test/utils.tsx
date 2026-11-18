import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { useState, type ReactElement, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/routes/guards";
import { authService } from "@/services/authService";
import { session } from "@/services/session";
import type { Role, User } from "@/types/auth";
import type { Page } from "@/types/common";

export function makeUser(role: Role, overrides: Partial<User> = {}): User {
  return {
    id: `user-${role}`,
    username: role,
    full_name: `Test ${role}`,
    role,
    status: "active",
    created_at: "2026-11-01T09:00:00Z",
    ...overrides,
  };
}

export function page<T>(items: T[]): Page<T> {
  return { items, total: items.length, limit: 20, offset: 0 };
}

/** Queries and mutations never retry in tests, so failures show up immediately. */
export function makeQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

export function QueryWrapper({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient); // one client for the wrapper's whole life
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/**
 * Renders `ui` as a signed-in user of the given role, through the real AuthProvider and ProtectedRoute.
 * Only the network edge (services) is faked, never the auth or routing logic.
 */
export function renderAs(role: Role, ui: ReactElement, options: { route?: string } = {}) {
  session.setToken("test-token");
  vi.spyOn(authService, "me").mockResolvedValue(makeUser(role));
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <AuthProvider>
        <MemoryRouter initialEntries={[options.route ?? "/"]}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="*" element={ui} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

import { render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/contexts/AuthContext";
import { authService } from "@/services/authService";
import { session } from "@/services/session";
import type { Role } from "@/types/auth";
import { makeQueryClient, makeUser } from "@/test/utils";
import { ProtectedRoute, RoleRoute } from "./guards";

function renderRoutes(initialPath: string, role: Role | null) {
  if (role) {
    session.setToken("test-token");
    vi.spyOn(authService, "me").mockResolvedValue(makeUser(role));
  }
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <AuthProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/login" element={<p>LOGIN PAGE</p>} />
            <Route element={<ProtectedRoute />}>
              <Route element={<RoleRoute />}>
                <Route path="/dashboard" element={<p>DASHBOARD PAGE</p>} />
                <Route path="/pos" element={<p>POS PAGE</p>} />
                <Route path="/payments" element={<p>PAYMENTS PAGE</p>} />
                <Route path="/analytics" element={<p>ANALYTICS PAGE</p>} />
                <Route path="/employees" element={<p>EMPLOYEES PAGE</p>} />
              </Route>
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("route guards", () => {
  it("sends anonymous visitors to the login page", async () => {
    renderRoutes("/payments", null);
    expect(await screen.findByText("LOGIN PAGE")).toBeInTheDocument();
  });

  it("keeps cashiers out of financial pages and sends them to the POS", async () => {
    renderRoutes("/payments", "cashier");
    expect(await screen.findByText("POS PAGE")).toBeInTheDocument();
    expect(screen.queryByText("PAYMENTS PAGE")).not.toBeInTheDocument();
  });

  it("keeps cashiers out of the dashboard", async () => {
    renderRoutes("/dashboard", "cashier");
    expect(await screen.findByText("POS PAGE")).toBeInTheDocument();
  });

  it("lets managers see payments but not owner analytics or employees", async () => {
    renderRoutes("/payments", "manager");
    expect(await screen.findByText("PAYMENTS PAGE")).toBeInTheDocument();
  });

  it("sends managers away from analytics", async () => {
    renderRoutes("/analytics", "manager");
    expect(await screen.findByText("DASHBOARD PAGE")).toBeInTheDocument();
    expect(screen.queryByText("ANALYTICS PAGE")).not.toBeInTheDocument();
  });

  it("sends managers away from employee management", async () => {
    renderRoutes("/employees", "manager");
    expect(await screen.findByText("DASHBOARD PAGE")).toBeInTheDocument();
  });

  it("lets owners open analytics and employees", async () => {
    renderRoutes("/analytics", "owner");
    expect(await screen.findByText("ANALYTICS PAGE")).toBeInTheDocument();
  });

  it("uses the role from the backend, not from anything stored in the browser", async () => {
    // A tampered value in storage must not grant access: the role comes from /auth/me.
    sessionStorage.setItem("role", "owner");
    renderRoutes("/analytics", "cashier");
    expect(await screen.findByText("POS PAGE")).toBeInTheDocument();
  });

  it("signs out and returns to login when the stored token is rejected", async () => {
    session.setToken("expired-token");
    vi.spyOn(authService, "me").mockRejectedValue(new Error("401"));
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/dashboard"]}>
            <Routes>
              <Route path="/login" element={<p>LOGIN PAGE</p>} />
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<p>DASHBOARD PAGE</p>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("LOGIN PAGE")).toBeInTheDocument();
    expect(session.getToken()).toBeNull();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/contexts/AuthContext";
import { authService } from "@/services/authService";
import { session } from "@/services/session";
import type { Role } from "@/types/auth";
import { makeQueryClient, makeUser } from "@/test/utils";
import { ApiError } from "@/utils/errors";
import LoginPage from "./LoginPage";

function renderLogin() {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<p>DASHBOARD PAGE</p>} />
            <Route path="/pos" element={<p>POS PAGE</p>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

async function signIn(username: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Username"), username);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("LoginPage", () => {
  it("validates required fields before calling the API", async () => {
    const login = vi.spyOn(authService, "login");
    renderLogin();
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter your username")).toBeInTheDocument();
    expect(screen.getByText("Enter your password")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it.each([
    ["owner", "DASHBOARD PAGE"],
    ["manager", "DASHBOARD PAGE"],
    ["cashier", "POS PAGE"],
  ] as [Role, string][])("signs in a %s and opens %s", async (role, expectedPage) => {
    vi.spyOn(authService, "login").mockResolvedValue({ access_token: "jwt-token", token_type: "bearer", expires_in: 3600 });
    vi.spyOn(authService, "me").mockResolvedValue(makeUser(role));
    renderLogin();
    await signIn(role, "a-valid-password1");
    expect(await screen.findByText(expectedPage)).toBeInTheDocument();
  });

  it("keeps the token in sessionStorage only", async () => {
    vi.spyOn(authService, "login").mockResolvedValue({ access_token: "jwt-token", token_type: "bearer", expires_in: 3600 });
    vi.spyOn(authService, "me").mockResolvedValue(makeUser("owner"));
    renderLogin();
    await signIn("owner", "a-valid-password1");
    await screen.findByText("DASHBOARD PAGE");
    expect(session.getToken()).toBe("jwt-token");
    expect(localStorage.length).toBe(0);
  });

  it("shows the backend's message for wrong credentials and stays on the page", async () => {
    vi.spyOn(authService, "login").mockRejectedValue(new ApiError(401, "invalid_credentials", "Incorrect username or password"));
    renderLogin();
    await signIn("owner", "wrong-password1");
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect username or password");
    expect(session.getToken()).toBeNull();
  });

  it("explains when the server is unreachable", async () => {
    vi.spyOn(authService, "login").mockRejectedValue(new ApiError(0, "network_error", "Cannot reach the Chai Hut server. Check your connection and try again."));
    renderLogin();
    await signIn("owner", "a-valid-password1");
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot reach the Chai Hut server");
  });

  it("can show and hide the password", async () => {
    renderLogin();
    const user = userEvent.setup();
    const field = screen.getByLabelText("Password");
    expect(field).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(field).toHaveAttribute("type", "text");
  });
});

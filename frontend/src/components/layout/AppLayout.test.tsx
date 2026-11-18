import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { session } from "@/services/session";
import { renderAs } from "@/test/utils";
import { AppLayout } from "./AppLayout";

const nav = (name: string) => screen.queryByRole("link", { name });

describe("navigation per role", () => {
  it("cashier sees only New Order, Customers and Active Orders", async () => {
    renderAs("cashier", <AppLayout />);
    expect(await screen.findByRole("link", { name: "New Order" })).toBeInTheDocument();
    expect(nav("Customers")).toBeInTheDocument();
    expect(nav("Active Orders")).toBeInTheDocument();
    for (const hidden of ["Dashboard", "Payments", "Outstanding Dues", "Expenses", "Analytics & Reports", "Employee Management", "Products & Menu"]) {
      expect(nav(hidden)).not.toBeInTheDocument();
    }
  });

  it("manager sees operations and money handling but not analytics or employees", async () => {
    renderAs("manager", <AppLayout />);
    expect(await screen.findByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    for (const shown of ["Customers", "Products & Menu", "Orders", "Payments", "Outstanding Dues", "Expenses"]) {
      expect(nav(shown)).toBeInTheDocument();
    }
    expect(nav("Analytics & Reports")).not.toBeInTheDocument();
    expect(nav("Employee Management")).not.toBeInTheDocument();
  });

  it("owner sees everything", async () => {
    renderAs("owner", <AppLayout />);
    expect(await screen.findByRole("link", { name: "Analytics & Reports" })).toBeInTheDocument();
    expect(nav("Employee Management")).toBeInTheDocument();
    expect(nav("Settings")).toBeInTheDocument();
  });

  it("shows who is signed in and their role", async () => {
    renderAs("manager", <AppLayout />);
    expect(await screen.findByText("Test manager")).toBeInTheDocument();
    expect(screen.getAllByText("Manager").length).toBeGreaterThan(0);
  });

  it("logging out clears the session", async () => {
    renderAs("owner", <AppLayout />);
    await userEvent.setup().click(await screen.findByRole("button", { name: /log out/i }));
    await waitFor(() => expect(session.getToken()).toBeNull());
  });
});

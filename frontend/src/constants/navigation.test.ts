import { describe, expect, it } from "vitest";
import { canAccess, HOME_BY_ROLE, NAV_BY_ROLE } from "./navigation";

const FINANCIAL_PATHS = ["/dashboard", "/payments", "/dues", "/expenses", "/analytics", "/employees"];

describe("role navigation", () => {
  it("cashiers only get New Order, Customers and Active Orders", () => {
    expect(NAV_BY_ROLE.cashier.map((i) => i.label)).toEqual(["New Order", "Customers", "Active Orders"]);
  });

  it("cashiers cannot open any financial or admin page", () => {
    for (const path of FINANCIAL_PATHS) expect(canAccess("cashier", path)).toBe(false);
  });

  it("managers cannot open analytics or employee management", () => {
    expect(canAccess("manager", "/analytics")).toBe(false);
    expect(canAccess("manager", "/employees")).toBe(false);
  });

  it("managers can open the operational and money-handling pages", () => {
    for (const path of ["/dashboard", "/customers", "/products", "/orders", "/payments", "/dues", "/expenses"]) {
      expect(canAccess("manager", path)).toBe(true);
    }
  });

  it("owners can open everything in their menu", () => {
    for (const item of NAV_BY_ROLE.owner) expect(canAccess("owner", item.path)).toBe(true);
    expect(canAccess("owner", "/analytics")).toBe(true);
    expect(canAccess("owner", "/employees")).toBe(true);
  });

  it("nested pages follow their parent (customer profiles)", () => {
    expect(canAccess("cashier", "/customers/abc-123")).toBe(true);
    expect(canAccess("cashier", "/paymentsX")).toBe(false);
  });

  it("every role may open its own settings page", () => {
    for (const role of ["owner", "manager", "cashier"] as const) expect(canAccess(role, "/settings")).toBe(true);
  });

  it("each role lands on a page it can open", () => {
    for (const role of ["owner", "manager", "cashier"] as const) expect(canAccess(role, HOME_BY_ROLE[role])).toBe(true);
    expect(HOME_BY_ROLE.cashier).toBe("/pos");
  });
});

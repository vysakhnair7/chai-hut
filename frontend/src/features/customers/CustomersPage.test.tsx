import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { customerService } from "@/services/customerService";
import { page, renderAs } from "@/test/utils";
import type { Customer, CustomerBasic } from "@/types/customer";
import { ApiError } from "@/utils/errors";
import CustomersPage from "./CustomersPage";

const ana: CustomerBasic = {
  id: "c1",
  chai_id: "11111111-2222-3333-4444-555555555555",
  full_name: "Ana Kapoor",
  company_name: "Acme Corp",
  status: "active",
};

const anaFull: Customer = { ...ana, username: "ana.k", phone: "+919876543210", amount_due: "250.00", created_at: "2026-11-01T09:00:00Z" };

describe("CustomersPage as a cashier", () => {
  it("searches by name and shows basic details only (no phone, no dues)", async () => {
    const search = vi.spyOn(customerService, "search").mockResolvedValue([ana]);
    renderAs("cashier", <CustomersPage />);
    await userEvent.setup().type(await screen.findByLabelText("Search customers"), "ana");

    expect(await screen.findByText("Ana Kapoor")).toBeInTheDocument();
    expect(search).toHaveBeenLastCalledWith("ana");
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.queryByText(/9876543210/)).not.toBeInTheDocument();
    expect(screen.queryByText(/250/)).not.toBeInTheDocument();
  });

  it("does not offer customer registration", async () => {
    renderAs("cashier", <CustomersPage />);
    await screen.findByLabelText("Search customers");
    expect(screen.queryByRole("button", { name: /register customer/i })).not.toBeInTheDocument();
  });

  it("does not search until at least 2 characters are typed", async () => {
    const search = vi.spyOn(customerService, "search").mockResolvedValue([]);
    renderAs("cashier", <CustomersPage />);
    await userEvent.setup().type(await screen.findByLabelText("Search customers"), "a");
    expect(await screen.findByText("Search for a customer")).toBeInTheDocument();
    expect(search).not.toHaveBeenCalled();
  });

  it("explains when nobody matches", async () => {
    vi.spyOn(customerService, "search").mockResolvedValue([]);
    renderAs("cashier", <CustomersPage />);
    await userEvent.setup().type(await screen.findByLabelText("Search customers"), "zzz");
    expect(await screen.findByText("No matching customer")).toBeInTheDocument();
  });

  it("shows a readable error when the search fails", async () => {
    vi.spyOn(customerService, "search").mockRejectedValue(new ApiError(500, "internal_error", "boom"));
    renderAs("cashier", <CustomersPage />);
    await userEvent.setup().type(await screen.findByLabelText("Search customers"), "ana");
    expect(await screen.findByRole("alert")).toHaveTextContent("The server had a problem");
  });
});

describe("CustomersPage as a manager", () => {
  it("lists customers with their dues", async () => {
    vi.spyOn(customerService, "list").mockResolvedValue(page([anaFull]));
    renderAs("manager", <CustomersPage />);
    expect(await screen.findByText("Ana Kapoor")).toBeInTheDocument();
    expect(screen.getByText("₹250.00")).toBeInTheDocument();
  });

  it("validates the registration form before calling the API", async () => {
    vi.spyOn(customerService, "list").mockResolvedValue(page([]));
    const create = vi.spyOn(customerService, "create");
    renderAs("manager", <CustomersPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /register customer/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Register" }));

    expect(await within(dialog).findByText("Name must be at least 2 characters")).toBeInTheDocument();
    expect(within(dialog).getByText("Company must be at least 2 characters")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("alert").length).toBeGreaterThanOrEqual(3);
    expect(create).not.toHaveBeenCalled();
  });

  it("registers a customer and sends normalised values", async () => {
    vi.spyOn(customerService, "list").mockResolvedValue(page([]));
    const create = vi.spyOn(customerService, "create").mockResolvedValue(anaFull);
    renderAs("manager", <CustomersPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /register customer/i }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("Full name"), "Ana Kapoor");
    await user.type(within(dialog).getByLabelText("Company"), "Acme Corp");
    await user.type(within(dialog).getByLabelText("Phone"), "+91 98765-43210");
    await user.type(within(dialog).getByLabelText("Username"), "Ana.K");
    await user.click(within(dialog).getByRole("button", { name: "Register" }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith({
      username: "ana.k",
      full_name: "Ana Kapoor",
      company_name: "Acme Corp",
      phone: "+919876543210",
    });
  });

  it("shows a backend rejection (duplicate username) inside the form", async () => {
    vi.spyOn(customerService, "list").mockResolvedValue(page([]));
    vi.spyOn(customerService, "create").mockRejectedValue(
      new ApiError(409, "conflict", "A customer with this username already exists", [
        { field: "body.username", message: "Username already taken" },
      ]),
    );
    renderAs("manager", <CustomersPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /register customer/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Full name"), "Ana Kapoor");
    await user.type(within(dialog).getByLabelText("Company"), "Acme Corp");
    await user.type(within(dialog).getByLabelText("Phone"), "9876543210");
    await user.type(within(dialog).getByLabelText("Username"), "ana.k");
    await user.click(within(dialog).getByRole("button", { name: "Register" }));

    expect(await within(dialog).findByText("Username already taken")).toBeInTheDocument();
  });
});

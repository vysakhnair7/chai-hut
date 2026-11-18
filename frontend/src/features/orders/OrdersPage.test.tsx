import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { orderService } from "@/services/orderService";
import { makeOrder } from "@/test/factories";
import { page, renderAs } from "@/test/utils";
import OrdersPage from "./OrdersPage";

const placed = makeOrder({ id: "o1", order_token: "17", status: "placed", walk_in_name: "Ravi" });
const done = makeOrder({ id: "o2", order_token: "12", status: "completed" });

describe("OrdersPage as a cashier", () => {
  it("shows today's in-progress orders without any amounts", async () => {
    vi.spyOn(orderService, "list").mockResolvedValue(page([placed, done]));
    renderAs("cashier", <OrdersPage />);
    expect(await screen.findByText("17")).toBeInTheDocument();
    expect(screen.queryByText("12")).not.toBeInTheDocument(); // completed is on another tab
    expect(screen.getByText("Ravi")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("₹");
    expect(screen.queryByText("Total")).not.toBeInTheDocument();
  });

  it("asks only for today's orders", async () => {
    const list = vi.spyOn(orderService, "list").mockResolvedValue(page([]));
    renderAs("cashier", <OrdersPage />);
    await screen.findByText("No orders in progress");
    const query = list.mock.calls[0]?.[0];
    expect(query?.business_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("moves an order to the next step", async () => {
    vi.spyOn(orderService, "list").mockResolvedValue(page([placed]));
    const update = vi.spyOn(orderService, "updateStatus").mockResolvedValue({ ...placed, status: "preparing" });
    renderAs("cashier", <OrdersPage />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "Preparing" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith("o1", "preparing"));
  });

  it("does not offer cancellation (managers and owners only)", async () => {
    vi.spyOn(orderService, "list").mockResolvedValue(page([placed]));
    renderAs("cashier", <OrdersPage />);
    await userEvent.setup().click(await screen.findByText("17"));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel order/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /record payment/i })).not.toBeInTheDocument();
  });

  it("switches tabs to see completed orders", async () => {
    vi.spyOn(orderService, "list").mockResolvedValue(page([placed, done]));
    renderAs("cashier", <OrdersPage />);
    const user = userEvent.setup();
    await screen.findByText("17");
    await user.click(screen.getByRole("button", { name: "Completed" }));
    expect(await screen.findByText("12")).toBeInTheDocument();
    expect(screen.queryByText("17")).not.toBeInTheDocument();
  });

  it("shows a retryable error when orders cannot be loaded", async () => {
    vi.spyOn(orderService, "list").mockRejectedValue(new Error("down"));
    renderAs("cashier", <OrdersPage />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("OrdersPage as a manager", () => {
  it("shows totals and lets the manager open an order's bill with payments", async () => {
    vi.spyOn(orderService, "list").mockResolvedValue(page([placed]));
    vi.spyOn(orderService, "bill").mockResolvedValue({
      invoice_number: "INV-0001",
      order_token: "17",
      business_date: "2026-11-18",
      status: "placed",
      customer_name: null,
      company_name: null,
      items: placed.items,
      subtotal_amount: "40.00",
      discount_amount: "0.00",
      cgst_amount: "1.00",
      sgst_amount: "1.00",
      tax_amount: "2.00",
      total_amount: "42.00",
      payments: [],
      amount_paid: "0.00",
      balance_due: "42.00",
      payment_state: "unpaid",
    });
    renderAs("manager", <OrdersPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByText("17"));
    expect(await screen.findByRole("button", { name: /record payment/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel order/i })).toBeInTheDocument();
    expect(screen.getByText("Unpaid")).toBeInTheDocument();
  });

  it("asks for confirmation before cancelling", async () => {
    vi.spyOn(orderService, "list").mockResolvedValue(page([placed]));
    vi.spyOn(orderService, "bill").mockResolvedValue({
      invoice_number: "INV-0001", order_token: "17", business_date: "2026-11-18", status: "placed", customer_name: null, company_name: null,
      items: placed.items, subtotal_amount: "40.00", discount_amount: "0.00", cgst_amount: "1.00", sgst_amount: "1.00", tax_amount: "2.00",
      total_amount: "42.00", payments: [], amount_paid: "0.00", balance_due: "42.00", payment_state: "unpaid",
    });
    const cancel = vi.spyOn(orderService, "cancel").mockResolvedValue({ ...placed, status: "cancelled" });
    renderAs("manager", <OrdersPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByText("17"));
    await user.click(await screen.findByRole("button", { name: /cancel order/i }));
    expect(cancel).not.toHaveBeenCalled(); // not until confirmed
    expect(await screen.findByText(/Cancel order 17\?/)).toBeInTheDocument();
  });
});

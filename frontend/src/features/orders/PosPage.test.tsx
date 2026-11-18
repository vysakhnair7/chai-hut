import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { customerService } from "@/services/customerService";
import { orderService } from "@/services/orderService";
import { productService } from "@/services/productService";
import { makeOrder, makeProduct } from "@/test/factories";
import { page, renderAs } from "@/test/utils";
import type { Order } from "@/types/order";
import { ApiError } from "@/utils/errors";
import PosPage from "./PosPage";

const chai = makeProduct();
const samosa = makeProduct({ id: "p-samosa", name: "Samosa", mrp: "15.00", stock_quantity: 0, status: "out_of_stock" });
const order = makeOrder;

function mockMenu(popular: { product_id: string; name: string; orders_with_product: number; quantity_sold: number; is_available: boolean }[] = []) {
  vi.spyOn(productService, "popular").mockResolvedValue(popular);
  vi.spyOn(productService, "list").mockResolvedValue(page([chai, samosa]));
  vi.spyOn(productService, "categories").mockResolvedValue([{ id: "cat1", name: "Drinks", description: null, status: "active" }]);
}

async function addChai(times: number) {
  const user = userEvent.setup();
  const tile = await screen.findByRole("button", { name: /Masala Chai/ });
  for (let i = 0; i < times; i++) await user.click(tile);
  return user;
}

describe("POS", () => {
  it("shows the menu and disables out-of-stock items", async () => {
    mockMenu();
    renderAs("cashier", <PosPage />);
    expect(await screen.findByRole("button", { name: /Masala Chai/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Samosa/ })).toBeDisabled();
  });

  it("adds products to the order and shows a labelled estimate", async () => {
    mockMenu();
    renderAs("cashier", <PosPage />);
    await addChai(2);
    const cart = screen.getByRole("complementary", { name: "Current order" });
    expect(within(cart).getByLabelText("Masala Chai quantity")).toHaveTextContent("2");
    expect(screen.getByTestId("estimate")).toHaveTextContent("₹40.00");
    expect(within(cart).getByText(/Estimate before GST/)).toBeInTheDocument();
  });

  it("offers popular items as one-tap shortcuts", async () => {
    mockMenu([{ product_id: "p-chai", name: "Masala Chai", orders_with_product: 9, quantity_sold: 14, is_available: true }]);
    renderAs("cashier", <PosPage />);
    const user = userEvent.setup();
    const chip = await screen.findByRole("button", { name: "Add Masala Chai, popular" });
    await waitFor(() => expect(chip).toBeEnabled()); // enabled once the menu has loaded
    await user.click(chip);
    expect(screen.getByLabelText("Masala Chai quantity")).toHaveTextContent("1");
  });

  it("changes and removes lines", async () => {
    mockMenu();
    renderAs("cashier", <PosPage />);
    const user = await addChai(2);
    await user.click(screen.getByRole("button", { name: "Decrease Masala Chai" }));
    expect(screen.getByLabelText("Masala Chai quantity")).toHaveTextContent("1");
    await user.click(screen.getByRole("button", { name: "Remove Masala Chai" }));
    expect(screen.getByText(/Tap items on the menu/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Place order" })).toBeDisabled();
  });

  it("places a walk-in order, then shows the token slip without prices or totals for a cashier", async () => {
    mockMenu();
    const create = vi.spyOn(orderService, "create").mockResolvedValue(order({ walk_in_name: "Ravi" }));
    renderAs("cashier", <PosPage />);
    const user = await addChai(2);
    await user.type(screen.getByLabelText(/Name to call out/), "Ravi");
    await user.click(screen.getByRole("button", { name: "Place order" }));

    const slip = await screen.findByTestId("token-slip");
    expect(within(slip).getByLabelText("Token 17")).toBeInTheDocument();
    expect(within(slip).getByText("Ravi")).toBeInTheDocument();
    expect(within(slip).getByText("Masala Chai")).toBeInTheDocument();
    expect(slip).not.toHaveTextContent("₹");
    expect(screen.queryByText(/Bill total/)).not.toBeInTheDocument();

    expect(create).toHaveBeenCalledWith({ walk_in_name: "Ravi", items: [{ product_id: "p-chai", quantity: 2 }] });
  });

  it("never sends a discount for a cashier, and offers the field to managers", async () => {
    mockMenu();
    renderAs("cashier", <PosPage />);
    await screen.findByRole("button", { name: /Masala Chai/ });
    expect(screen.queryByLabelText(/Discount/)).not.toBeInTheDocument();
  });

  it("lets a manager apply a discount and see the server total", async () => {
    mockMenu();
    const create = vi.spyOn(orderService, "create").mockResolvedValue(order());
    renderAs("manager", <PosPage />);
    const user = await addChai(1);
    await user.type(screen.getByLabelText(/Discount/), "5");
    await user.click(screen.getByRole("button", { name: "Place order" }));
    expect(await screen.findByText(/Bill total/)).toHaveTextContent("₹42.00");
    expect(create).toHaveBeenCalledWith({ items: [{ product_id: "p-chai", quantity: 1 }], discount_amount: "5" });
  });

  it("keeps the order and shows the backend message when placing fails", async () => {
    mockMenu();
    vi.spyOn(orderService, "create").mockRejectedValue(new ApiError(409, "insufficient_stock", "Only 1 Masala Chai left"));
    renderAs("cashier", <PosPage />);
    const user = await addChai(2);
    await user.click(screen.getByRole("button", { name: "Place order" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Only 1 Masala Chai left");
    expect(screen.getByLabelText("Masala Chai quantity")).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "Place order" })).toBeEnabled();
  });

  it("warns that the order may exist after a dropped connection", async () => {
    mockMenu();
    vi.spyOn(orderService, "create").mockRejectedValue(new ApiError(0, "network_error", "Cannot reach the Chai Hut server."));
    renderAs("cashier", <PosPage />);
    const user = await addChai(1);
    await user.click(screen.getByRole("button", { name: "Place order" }));
    expect(await screen.findByText(/may already exist/)).toBeInTheDocument();
  });

  it("does not submit twice on a double click", async () => {
    mockMenu();
    let resolveOrder: (o: Order) => void = () => undefined;
    const create = vi.spyOn(orderService, "create").mockReturnValue(new Promise<Order>((resolve) => (resolveOrder = resolve)));
    renderAs("cashier", <PosPage />);
    const user = await addChai(1);
    const button = screen.getByRole("button", { name: "Place order" });
    await user.dblClick(button);
    expect(create).toHaveBeenCalledTimes(1);
    resolveOrder(order());
    await screen.findByTestId("token-slip");
  });

  it("starts a fresh order after the token is shown", async () => {
    mockMenu();
    vi.spyOn(orderService, "create").mockResolvedValue(order());
    renderAs("cashier", <PosPage />);
    const user = await addChai(1);
    await user.click(screen.getByRole("button", { name: "Place order" }));
    await screen.findByTestId("token-slip");
    await user.click(screen.getByRole("button", { name: "New order" }));
    expect(await screen.findByText(/Tap items on the menu/)).toBeInTheDocument();
  });
});

describe("POS with a registered customer", () => {
  const ana = { id: "c1", chai_id: "11111111-2222-3333-4444-555555555555", full_name: "Ana Kapoor", company_name: "Acme Corp", status: "active" as const };

  it("needs a customer to be selected before the order can be placed", async () => {
    mockMenu();
    renderAs("cashier", <PosPage />);
    const user = await addChai(1);
    await user.click(screen.getByRole("button", { name: /Registered customer/ }));
    expect(screen.getByRole("button", { name: "Place order" })).toBeDisabled();
    expect(screen.getByText(/Select a registered customer/)).toBeInTheDocument();
  });

  it("shows Saved Regular and Most Frequent separately and adds one with a tap", async () => {
    mockMenu();
    vi.spyOn(customerService, "search").mockResolvedValue([ana]);
    vi.spyOn(customerService, "preferences").mockResolvedValue({
      customer_id: "c1",
      saved_regular: { product_id: "p-chai", product_name: "Masala Chai", is_available: true },
      most_frequent: { product_id: "p-samosa", product_name: "Samosa", is_available: false, orders_with_product: 4, total_completed_orders: 5, share_pct: "80.00" },
      top_products: [],
    });
    const create = vi.spyOn(orderService, "create").mockResolvedValue(order({ customer: ana }));
    renderAs("cashier", <PosPage />);
    const user = userEvent.setup();
    await screen.findByRole("button", { name: /Masala Chai/ });
    await user.click(screen.getByRole("button", { name: /Registered customer/ }));
    await user.type(screen.getByLabelText(/Search by name/), "ana");
    await user.click(await screen.findByRole("button", { name: /Ana Kapoor/ }));

    const regular = (await screen.findByText("Saved regular")).closest("div") as HTMLElement;
    expect(regular).toHaveTextContent("Masala Chai");
    expect(screen.getByText("Most frequent")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unavailable" })).toBeDisabled();

    await user.click(within(regular.parentElement as HTMLElement).getByRole("button", { name: "Add" }));
    await user.click(screen.getByRole("button", { name: "Place order" }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith({ customer_id: "c1", items: [{ product_id: "p-chai", quantity: 1 }] });
  });

  it("blocks inactive customers", async () => {
    mockMenu();
    vi.spyOn(customerService, "search").mockResolvedValue([{ ...ana, status: "inactive" }]);
    vi.spyOn(customerService, "preferences").mockResolvedValue({ customer_id: "c1", saved_regular: null, most_frequent: null, top_products: [] });
    renderAs("cashier", <PosPage />);
    const user = await addChai(1);
    await user.click(screen.getByRole("button", { name: /Registered customer/ }));
    await user.type(screen.getByLabelText(/Search by name/), "ana");
    await user.click(await screen.findByRole("button", { name: /Ana Kapoor/ }));
    expect(await screen.findByText(/inactive and cannot place orders/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Place order" })).toBeDisabled();
  });
});

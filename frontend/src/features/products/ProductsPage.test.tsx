import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { productService } from "@/services/productService";
import { makeProduct } from "@/test/factories";
import { page, renderAs } from "@/test/utils";
import ProductsPage from "./ProductsPage";

function mockCatalog() {
  vi.spyOn(productService, "list").mockResolvedValue(page([makeProduct()]));
  vi.spyOn(productService, "categories").mockResolvedValue([{ id: "cat1", name: "Drinks", description: null, status: "active" }]);
}

describe("ProductsPage permissions in the UI", () => {
  it("owner can add, edit, price, restock and discontinue", async () => {
    mockCatalog();
    renderAs("owner", <ProductsPage />);
    expect(await screen.findByText("Masala Chai")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add product/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Categories" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Masala Chai" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change price of Masala Chai" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change stock of Masala Chai" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discontinue Masala Chai" })).toBeInTheDocument();
  });

  it("manager can only change price and stock", async () => {
    mockCatalog();
    renderAs("manager", <ProductsPage />);
    expect(await screen.findByText("Masala Chai")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change price of Masala Chai" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change stock of Masala Chai" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add product/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Masala Chai" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discontinue Masala Chai" })).not.toBeInTheDocument();
  });

  it("cashier sees the menu and stock but no action buttons", async () => {
    mockCatalog();
    renderAs("cashier", <ProductsPage />);
    expect(await screen.findByText("Masala Chai")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /change price/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add product/i })).not.toBeInTheDocument();
  });

  it("never asks the backend for cost prices on the list", async () => {
    mockCatalog();
    const detail = vi.spyOn(productService, "detail");
    renderAs("manager", <ProductsPage />);
    await screen.findByText("Masala Chai");
    expect(detail).not.toHaveBeenCalled(); // cost/margin is fetched only when the price dialog opens
  });
});

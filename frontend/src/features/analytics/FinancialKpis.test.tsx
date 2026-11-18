import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { FinancialSummary } from "@/types/finance";
import { FinancialKpis } from "./FinancialKpis";

const base: FinancialSummary = {
  order_count: 12,
  total_sales: "1200.00",
  discounts: "0.00",
  net_sales: "1200.00",
  tax_collected: "60.00",
  billed_total: "1260.00",
  total_collected: "800.00",
  corporate_credit_sales: "460.00",
  outstanding_receivable: "900.00",
  cogs: "500.00",
  cost_data_complete: true,
  items_missing_cost: 0,
  gross_profit: "700.00",
  expenses: "200.00",
  net_profit: "500.00",
};

function renderKpis(summary: FinancialSummary) {
  return render(
    <MemoryRouter>
      <FinancialKpis summary={summary} />
    </MemoryRouter>,
  );
}

function card(label: string): HTMLElement {
  return screen.getByText(label).closest("[class~='p-4']") as HTMLElement;
}

describe("FinancialKpis", () => {
  it("shows backend figures as given, with collected and credit separate", () => {
    renderKpis(base);
    expect(card("Collected")).toHaveTextContent("₹800.00");
    expect(card("Sold on credit")).toHaveTextContent("₹460.00");
    expect(card("Net profit")).toHaveTextContent("₹500.00");
  });

  it("shows a dash and explains why when item costs are missing", () => {
    renderKpis({ ...base, cost_data_complete: false, items_missing_cost: 3, cogs: null, gross_profit: null, net_profit: null });
    expect(card("Gross profit")).toHaveTextContent("—");
    expect(card("Net profit")).toHaveTextContent("—");
    expect(screen.getAllByText(/Cost price missing for 3 sold items/).length).toBeGreaterThan(0);
    expect(screen.queryByText("₹0.00", { selector: "p" })).not.toBeInTheDocument();
  });

  it("links profit to Products when costs are missing so they can be fixed", () => {
    renderKpis({ ...base, cost_data_complete: false, items_missing_cost: 1, cogs: null, gross_profit: null, net_profit: null });
    const link = screen.getByText("Gross profit").closest("a");
    expect(link).toHaveAttribute("href", "/products");
  });

  it("links the headline numbers to their underlying records", () => {
    renderKpis(base);
    expect(screen.getByText("Orders").closest("a")).toHaveAttribute("href", "/orders");
    expect(screen.getByText("Collected").closest("a")).toHaveAttribute("href", "/payments");
    expect(screen.getByText("Outstanding receivable").closest("a")).toHaveAttribute("href", "/dues");
    expect(screen.getByText("Expenses").closest("a")).toHaveAttribute("href", "/expenses");
  });

  it("shows a loss as negative, in the danger colour", () => {
    renderKpis({ ...base, net_profit: "-50.00" });
    expect(card("Net profit")).toHaveTextContent("-₹50.00");
  });
});

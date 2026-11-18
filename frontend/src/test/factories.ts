import type { Product } from "@/types/catalog";
import type { Order } from "@/types/order";

export function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "o1",
    order_token: "17",
    invoice_number: "INV-0001",
    business_date: "2026-11-18",
    status: "placed",
    customer: null,
    walk_in_name: null,
    items: [{ product_id: "p-chai", product_name: "Masala Chai", quantity: 2, unit_price: "20.00", gst_rate: "5.00", total_price: "40.00" }],
    subtotal_amount: "40.00",
    discount_amount: "0.00",
    cgst_amount: "1.00",
    sgst_amount: "1.00",
    tax_amount: "2.00",
    total_amount: "42.00",
    created_by: "user-cashier",
    created_at: "2026-11-18T05:00:00Z",
    updated_at: "2026-11-18T05:00:00Z",
    ...overrides,
  };
}

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p-chai",
    category_id: "cat1",
    name: "Masala Chai",
    description: null,
    mrp: "20.00",
    gst_rate: "5.00",
    stock_quantity: 50,
    status: "available",
    ...overrides,
  };
}

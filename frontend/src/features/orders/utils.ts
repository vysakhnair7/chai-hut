import type { OrderItem } from "@/types/order";

/** "2× Masala Chai, 1× Samosa" for table cells. */
export function itemsSummary(items: Pick<OrderItem, "product_name" | "quantity">[]): string {
  return items.map((i) => `${i.quantity}× ${i.product_name}`).join(", ");
}

/** Total number of units on an order (display only). */
export function totalQuantity(items: Pick<OrderItem, "quantity">[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

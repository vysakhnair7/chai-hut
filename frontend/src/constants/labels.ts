import type { ActiveStatus } from "@/types/common";
import type { ProductStatus } from "@/types/catalog";
import type { OrderPaymentState, OrderStatus, PaymentMethod, PaymentStatus } from "@/types/order";
import type { Role } from "@/types/auth";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  placed: "Placed",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Statuses an order passes through while the café is still working on it. */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = ["placed", "preparing", "ready"];

/** UI convenience for the "advance" button. The backend enforces the real workflow. */
export const NEXT_ORDER_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  placed: "preparing",
  preparing: "ready",
  ready: "completed",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  corporate_credit: "Corporate credit",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pending",
  success: "Received",
  failed: "Failed",
  refunded: "Refunded",
};

export const PAYMENT_STATE_LABELS: Record<OrderPaymentState, string> = {
  unpaid: "Unpaid",
  partial: "Part paid",
  paid: "Paid",
};

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  available: "Available",
  out_of_stock: "Out of stock",
  discontinued: "Discontinued",
};

export const ACTIVE_STATUS_LABELS: Record<ActiveStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};

export const LEDGER_KIND_LABELS = {
  credit_sale: "Sold on credit",
  credit_reversal: "Credit reversed",
  settlement: "Settlement received",
} as const;

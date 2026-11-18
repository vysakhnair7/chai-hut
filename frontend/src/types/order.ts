import type { IsoDate, IsoDateTime, Money } from "./common";
import type { CustomerBasic } from "./customer";

export type OrderStatus = "placed" | "preparing" | "ready" | "completed" | "cancelled";
export type PaymentMethod = "cash" | "upi" | "card" | "corporate_credit";
export type PaymentStatus = "pending" | "success" | "failed" | "refunded";
export type OrderPaymentState = "unpaid" | "partial" | "paid";

export interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: Money;
  gst_rate: Money;
  total_price: Money;
}

export interface Order {
  id: string;
  order_token: string;
  invoice_number: string;
  business_date: IsoDate;
  status: OrderStatus;
  customer: CustomerBasic | null;
  walk_in_name: string | null;
  items: OrderItem[];
  subtotal_amount: Money;
  discount_amount: Money;
  cgst_amount: Money;
  sgst_amount: Money;
  tax_amount: Money;
  total_amount: Money;
  created_by: string;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface OrderCreate {
  customer_id?: string;
  walk_in_name?: string;
  items: { product_id: string; quantity: number }[];
  discount_amount?: Money;
}

export interface OrderListQuery {
  status?: OrderStatus;
  business_date?: IsoDate;
  token?: string;
  customer_id?: string;
  limit?: number;
  offset?: number;
}

export interface BillPayment {
  method: PaymentMethod;
  amount: Money;
  status: PaymentStatus;
  created_at: IsoDateTime;
}

/** The invoice. Payment fields are null for roles without payment access (cashier). */
export interface Bill {
  invoice_number: string;
  order_token: string;
  business_date: IsoDate;
  status: OrderStatus;
  customer_name: string | null;
  company_name: string | null;
  items: OrderItem[];
  subtotal_amount: Money;
  discount_amount: Money;
  cgst_amount: Money;
  sgst_amount: Money;
  tax_amount: Money;
  total_amount: Money;
  payments: BillPayment[] | null;
  amount_paid: Money | null;
  balance_due: Money | null;
  payment_state: OrderPaymentState | null;
}

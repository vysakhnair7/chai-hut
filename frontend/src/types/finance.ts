import type { ActiveStatus, IsoDate, IsoDateTime, Money } from "./common";
import type { PaymentMethod, PaymentStatus, OrderPaymentState } from "./order";

// ---------- payments ----------
export interface Payment {
  id: string;
  order_id: string;
  amount: Money;
  method: PaymentMethod;
  status: PaymentStatus;
  transaction_id: string | null;
  received_by: string;
  created_at: IsoDateTime;
}

export interface PaymentCreate {
  method: PaymentMethod;
  amount?: Money;
  transaction_id?: string;
}

export interface PaymentListQuery {
  order_id?: string;
  method?: PaymentMethod;
  status?: PaymentStatus;
  date_from?: IsoDate;
  date_to?: IsoDate;
  limit?: number;
  offset?: number;
}

export interface OrderPayments {
  order_id: string;
  order_total: Money;
  amount_paid: Money;
  balance_due: Money;
  payment_state: OrderPaymentState;
  payments: Payment[];
}

// ---------- corporate credit ----------
export type SettlementMethod = "cash" | "upi" | "card";

export interface OutstandingCustomer {
  id: string;
  chai_id: string;
  full_name: string;
  company_name: string;
  phone: string;
  amount_due: Money;
}

export interface CompanyDue {
  company_name: string;
  customers_with_dues: number;
  amount_due: Money;
}

export interface OutstandingSummary {
  total_outstanding: Money;
  customers: OutstandingCustomer[];
  by_company: CompanyDue[];
}

export interface SettlementCreate {
  customer_id: string;
  amount: Money;
  method: SettlementMethod;
  transaction_id?: string;
  note?: string;
}

export interface Settlement {
  id: string;
  customer_id: string;
  amount: Money;
  method: SettlementMethod;
  settlement_date: IsoDate;
  transaction_id: string | null;
  note: string | null;
  received_by: string;
  created_at: IsoDateTime;
}

export interface SettlementResult {
  settlement: Settlement;
  remaining_due: Money;
}

export interface LedgerEntry {
  at: IsoDateTime;
  kind: "credit_sale" | "credit_reversal" | "settlement";
  amount: Money;
  balance_after: Money;
  reference: string | null;
}

export interface CustomerLedger {
  customer_id: string;
  current_due: Money;
  entries: LedgerEntry[];
}

// ---------- expenses ----------
export interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  status: ActiveStatus;
}

export interface ExpenseCategoryInput {
  name: string;
  description?: string | null;
}

export interface Expense {
  id: string;
  category_id: string;
  description: string;
  amount: Money;
  expense_date: IsoDate;
  created_by: string;
  created_at: IsoDateTime;
}

export interface ExpenseInput {
  category_id: string;
  description: string;
  amount: Money;
  expense_date?: IsoDate;
}

export interface ExpenseListQuery {
  category_id?: string;
  date_from?: IsoDate;
  date_to?: IsoDate;
  limit?: number;
  offset?: number;
}

// ---------- reports ----------
export interface DateRange {
  date_from?: IsoDate;
  date_to?: IsoDate;
}

export interface DailySales {
  business_date: IsoDate;
  order_count: number;
  net_sales: Money;
  billed_total: Money;
}

export interface SalesReport {
  date_from: IsoDate;
  date_to: IsoDate;
  order_count: number;
  total_sales: Money;
  discounts: Money;
  net_sales: Money;
  tax_collected: Money;
  billed_total: Money;
  daily: DailySales[];
}

export interface FinancialSummary {
  order_count: number;
  total_sales: Money;
  discounts: Money;
  net_sales: Money;
  tax_collected: Money;
  billed_total: Money;
  total_collected: Money;
  corporate_credit_sales: Money;
  outstanding_receivable: Money;
  cogs: Money | null;
  cost_data_complete: boolean;
  items_missing_cost: number;
  gross_profit: Money | null;
  expenses: Money;
  net_profit: Money | null;
}

export interface FinancialReport {
  date_from: IsoDate;
  date_to: IsoDate;
  summary: FinancialSummary;
  credit_settlements_received: Money;
  daily: DailySales[];
}

export type Granularity = "day" | "week" | "month";

export interface TrendPoint {
  period_start: IsoDate;
  order_count: number;
  net_sales: Money;
  billed_total: Money;
  change_pct: Money | null;
}

export interface SalesTrend {
  granularity: Granularity;
  date_from: IsoDate;
  date_to: IsoDate;
  points: TrendPoint[];
  trend: {
    direction: "up" | "down" | "flat";
    slope_per_period: Money;
    last_vs_previous_pct: Money | null;
  };
}

export interface TopProduct {
  product_id: string;
  name: string;
  quantity_sold: number;
  revenue: Money;
  orders_with_product: number;
}

export interface PeakHour {
  hour: number;
  order_count: number;
  net_sales: Money;
}

export interface CorporateSales {
  company_name: string;
  customers: number;
  order_count: number;
  billed_total: Money;
  outstanding_due: Money;
}

export type { OrderPaymentState };

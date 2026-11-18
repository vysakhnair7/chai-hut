import type { ActiveStatus, IsoDateTime, Money } from "./common";

export interface CustomerBasic {
  id: string;
  chai_id: string;
  full_name: string;
  company_name: string;
  status: ActiveStatus;
}

export interface Customer extends CustomerBasic {
  username: string;
  phone: string;
  amount_due: Money;
  created_at: IsoDateTime;
}

export interface CustomerCreate {
  username: string;
  full_name: string;
  company_name: string;
  phone: string;
}

export interface CustomerUpdate {
  full_name?: string;
  company_name?: string;
  phone?: string;
  status?: ActiveStatus;
}

export interface CustomerListQuery {
  q?: string;
  company?: string;
  status?: ActiveStatus;
  has_due?: boolean;
  limit?: number;
  offset?: number;
}

export interface PreferredProduct {
  product_id: string;
  product_name: string;
  is_available: boolean;
}

export interface FrequentProduct extends PreferredProduct {
  orders_with_product: number;
  total_completed_orders: number;
  share_pct: string;
}

export interface CustomerPreferences {
  customer_id: string;
  saved_regular: PreferredProduct | null;
  most_frequent: FrequentProduct | null;
  top_products: FrequentProduct[];
}

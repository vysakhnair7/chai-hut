import type { ActiveStatus, Money } from "./common";

export type ProductStatus = "available" | "out_of_stock" | "discontinued";

export interface Category {
  id: string;
  name: string;
  description: string | null;
  status: ActiveStatus;
}

export interface CategoryInput {
  name: string;
  description?: string | null;
}

export interface CategoryUpdate extends Partial<CategoryInput> {
  status?: ActiveStatus;
}

/** What every role sees: price and stock, never cost. */
export interface Product {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  mrp: Money;
  gst_rate: Money;
  stock_quantity: number;
  status: ProductStatus;
}

/** Manager/owner view. */
export interface ProductDetail extends Product {
  cost_price: Money | null;
  margin: Money | null;
}

export interface ProductCreate {
  category_id: string;
  name: string;
  description?: string | null;
  mrp: Money;
  cost_price?: Money | null;
  gst_rate?: Money | null;
  stock_quantity: number;
}

export interface ProductUpdate {
  category_id?: string;
  name?: string;
  description?: string | null;
  gst_rate?: Money;
  status?: ProductStatus;
}

export interface PriceUpdate {
  mrp?: Money;
  cost_price?: Money;
}

export interface ProductListQuery {
  q?: string;
  category_id?: string;
  status?: ProductStatus;
  in_stock_only?: boolean;
  limit?: number;
  offset?: number;
}

export interface PopularProduct {
  product_id: string;
  name: string;
  orders_with_product: number;
  quantity_sold: number;
  is_available: boolean;
}

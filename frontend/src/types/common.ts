/** Decimal amounts are strings in the API (e.g. "42.00"). Format them, never calculate with them. */
export type Money = string;
/** ISO date, YYYY-MM-DD */
export type IsoDate = string;
/** ISO timestamp */
export type IsoDateTime = string;

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface PageQuery {
  limit?: number;
  offset?: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
}

export interface Message {
  detail: string;
}

export type ActiveStatus = "active" | "inactive";

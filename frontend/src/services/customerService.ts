import type { Page } from "@/types/common";
import type {
  Customer,
  CustomerBasic,
  CustomerCreate,
  CustomerListQuery,
  CustomerPreferences,
  CustomerUpdate,
} from "@/types/customer";
import { apiClient } from "./apiClient";

export const customerService = {
  /** Cashier-safe lookup: basic fields only. */
  search: (q: string, limit = 20) =>
    apiClient.get<CustomerBasic[]>("/customers/search", { query: { q, limit } }),
  basic: (id: string) => apiClient.get<CustomerBasic>(`/customers/${id}/basic`),
  list: (query?: CustomerListQuery) => apiClient.get<Page<Customer>>("/customers", { query }),
  get: (id: string) => apiClient.get<Customer>(`/customers/${id}`),
  create: (body: CustomerCreate) => apiClient.post<Customer>("/customers", body),
  update: (id: string, body: CustomerUpdate) => apiClient.patch<Customer>(`/customers/${id}`, body),
  regenerateChaiId: (id: string) => apiClient.post<Customer>(`/customers/${id}/chai-id/regenerate`),
  remove: (id: string) => apiClient.delete(`/customers/${id}`),
  preferences: (id: string) => apiClient.get<CustomerPreferences>(`/customers/${id}/preferences`),
  setRegular: (id: string, product_id: string) =>
    apiClient.put<CustomerPreferences>(`/customers/${id}/preferences/regular`, { product_id }),
  clearRegular: (id: string) =>
    apiClient.delete<CustomerPreferences>(`/customers/${id}/preferences/regular`),
};

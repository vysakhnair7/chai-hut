import type { Page } from "@/types/common";
import type { Bill, Order, OrderCreate, OrderListQuery, OrderStatus } from "@/types/order";
import { apiClient } from "./apiClient";

export const orderService = {
  create: (body: OrderCreate) => apiClient.post<Order>("/orders", body),
  list: (query?: OrderListQuery) => apiClient.get<Page<Order>>("/orders", { query }),
  get: (id: string) => apiClient.get<Order>(`/orders/${id}`),
  bill: (id: string) => apiClient.get<Bill>(`/orders/${id}/bill`),
  updateStatus: (id: string, status: OrderStatus) =>
    apiClient.patch<Order>(`/orders/${id}/status`, { status }),
  cancel: (id: string) => apiClient.post<Order>(`/orders/${id}/cancel`),
};

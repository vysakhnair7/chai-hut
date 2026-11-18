import type { Page } from "@/types/common";
import type {
  CustomerLedger,
  OrderPayments,
  OutstandingSummary,
  Payment,
  PaymentCreate,
  PaymentListQuery,
  Settlement,
  SettlementCreate,
  SettlementResult,
} from "@/types/finance";
import { apiClient } from "./apiClient";

/** Payments and corporate credit. Money-moving calls always carry an Idempotency-Key. */
export const paymentService = {
  record: (orderId: string, body: PaymentCreate, idempotencyKey: string) =>
    apiClient.post<Payment>(`/orders/${orderId}/payments`, body, {
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  forOrder: (orderId: string) => apiClient.get<OrderPayments>(`/orders/${orderId}/payments`),
  list: (query?: PaymentListQuery) => apiClient.get<Page<Payment>>("/payments", { query }),

  outstanding: () => apiClient.get<OutstandingSummary>("/credit/outstanding"),
  ledger: (customerId: string) => apiClient.get<CustomerLedger>(`/credit/customers/${customerId}/ledger`),
  settle: (body: SettlementCreate, idempotencyKey: string) =>
    apiClient.post<SettlementResult>("/credit/settlements", body, {
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  settlements: (query?: { customer_id?: string; date_from?: string; date_to?: string; limit?: number; offset?: number }) =>
    apiClient.get<Page<Settlement>>("/credit/settlements", { query }),
};

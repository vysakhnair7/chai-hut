import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { useApiMutation } from "@/hooks/useApiMutation";
import { paymentService } from "@/services/paymentService";
import { formatMoney } from "@/utils/format";
import type { PaymentCreate, PaymentListQuery, SettlementCreate } from "@/types/finance";

export function usePayments(query: PaymentListQuery) {
  return useQuery({
    queryKey: queryKeys.payments(query),
    queryFn: () => paymentService.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useOrderPayments(orderId: string | null) {
  return useQuery({
    queryKey: queryKeys.orderPayments(orderId ?? "none"),
    queryFn: () => paymentService.forOrder(orderId as string),
    enabled: orderId !== null,
  });
}

export function useOutstanding() {
  return useQuery({ queryKey: queryKeys.outstanding, queryFn: paymentService.outstanding });
}

export function useLedger(customerId: string | null) {
  return useQuery({
    queryKey: queryKeys.ledger(customerId ?? "none"),
    queryFn: () => paymentService.ledger(customerId as string),
    enabled: customerId !== null,
  });
}

const MONEY_KEYS = [
  ["orders"],
  ["order"],
  ["bill"],
  ["order-payments"],
  ["payments"],
  ["outstanding"],
  ["ledger"],
  ["customers"],
  ["customer"],
  ["settlements"],
  ["report-financial"],
  ["report-corporate"],
];

/** The idempotency key is supplied by the form, one per attempt, and reused on retry. */
export function useRecordPayment(orderId: string, onDone?: () => void) {
  return useApiMutation(
    ({ body, idempotencyKey }: { body: PaymentCreate; idempotencyKey: string }) =>
      paymentService.record(orderId, body, idempotencyKey),
    { success: "Payment recorded", invalidate: MONEY_KEYS, toastError: false, onSuccess: onDone },
  );
}

export function useSettle(onDone?: () => void) {
  return useApiMutation(
    ({ body, idempotencyKey }: { body: SettlementCreate; idempotencyKey: string }) =>
      paymentService.settle(body, idempotencyKey),
    {
      success: (r) => `Settlement recorded. Remaining due: ${formatMoney(r.remaining_due)}`,
      invalidate: MONEY_KEYS,
      toastError: false,
      onSuccess: onDone,
    },
  );
}

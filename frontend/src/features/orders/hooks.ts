import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { useApiMutation } from "@/hooks/useApiMutation";
import { orderService } from "@/services/orderService";
import type { Order, OrderCreate, OrderListQuery, OrderStatus } from "@/types/order";

const ORDER_KEYS = [["orders"], ["order"], ["bill"], ["order-payments"], ["report-sales"], ["report-financial"]];

export function useOrders(query: OrderListQuery, refetchMs?: number) {
  return useQuery({
    queryKey: queryKeys.orders(query),
    queryFn: () => orderService.list(query),
    placeholderData: keepPreviousData,
    refetchInterval: refetchMs,
  });
}

export function useBill(orderId: string | null) {
  return useQuery({
    queryKey: queryKeys.bill(orderId ?? "none"),
    queryFn: () => orderService.bill(orderId as string),
    enabled: orderId !== null,
  });
}

export function useCreateOrder(onDone?: (order: Order) => void) {
  return useApiMutation((body: OrderCreate) => orderService.create(body), {
    invalidate: [["orders"], ["products"], ["preferences"]],
    toastError: false, // the POS shows the backend's message inline and keeps the cart
    onSuccess: onDone,
  });
}

export function useAdvanceOrder() {
  return useApiMutation(({ id, status }: { id: string; status: OrderStatus }) => orderService.updateStatus(id, status), {
    success: (o) => `Order ${o.order_token} is now ${o.status}`,
    invalidate: ORDER_KEYS,
  });
}

export function useCancelOrder(onDone?: () => void) {
  return useApiMutation((id: string) => orderService.cancel(id), {
    success: (o) => `Order ${o.order_token} cancelled`,
    invalidate: [...ORDER_KEYS, ["products"], ["outstanding"], ["customers"]],
    onSuccess: onDone,
  });
}

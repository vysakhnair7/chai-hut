import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { useApiMutation } from "@/hooks/useApiMutation";
import { customerService } from "@/services/customerService";
import type { Customer, CustomerCreate, CustomerListQuery, CustomerUpdate } from "@/types/customer";

export function useCustomerList(query: CustomerListQuery) {
  return useQuery({
    queryKey: queryKeys.customers(query),
    queryFn: () => customerService.list(query),
    placeholderData: keepPreviousData,
  });
}

/** Cashier-safe search. Only runs once there is something to search for. */
export function useCustomerSearch(q: string, enabled = true) {
  const term = q.trim();
  return useQuery({
    queryKey: queryKeys.customerSearch(term),
    queryFn: () => customerService.search(term),
    enabled: enabled && term.length >= 2,
  });
}

export function useCustomer(id: string, full: boolean) {
  return useQuery({
    queryKey: [...queryKeys.customer(id), full ? "full" : "basic"],
    queryFn: () => (full ? customerService.get(id) : customerService.basic(id)),
  });
}

export function useCustomerPreferences(id: string) {
  return useQuery({
    queryKey: queryKeys.preferences(id),
    queryFn: () => customerService.preferences(id),
  });
}

export function useCreateCustomer(onDone?: (customer: Customer) => void) {
  return useApiMutation((body: CustomerCreate) => customerService.create(body), {
    success: (c) => `Registered ${c.full_name}`,
    invalidate: [["customers"], ["customer-search"]],
    toastError: false, // the form shows the backend's message inline
    onSuccess: onDone,
  });
}

export function useUpdateCustomer(id: string, onDone?: (customer: Customer) => void) {
  return useApiMutation((body: CustomerUpdate) => customerService.update(id, body), {
    success: "Customer updated",
    invalidate: [["customers"], ["customer-search"], queryKeys.customer(id)],
    toastError: false,
    onSuccess: onDone,
  });
}

export function useRegenerateChaiId(id: string) {
  return useApiMutation(() => customerService.regenerateChaiId(id), {
    success: "New Chai ID issued. The old one no longer works.",
    invalidate: [["customers"], ["customer-search"], queryKeys.customer(id)],
  });
}

export function useSetRegular(id: string) {
  return useApiMutation((productId: string) => customerService.setRegular(id, productId), {
    success: "Saved regular updated",
    invalidate: [queryKeys.preferences(id)],
  });
}

export function useClearRegular(id: string) {
  return useApiMutation(() => customerService.clearRegular(id), {
    success: "Saved regular cleared",
    invalidate: [queryKeys.preferences(id)],
  });
}

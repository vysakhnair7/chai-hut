import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { analyticsService } from "@/services/analyticsService";
import type { DateRange, Granularity } from "@/types/finance";

/** Every report hook is disabled until the date range is valid (a half-typed custom range). */
export function useFinancialReport(range: DateRange | null) {
  return useQuery({
    queryKey: queryKeys.financialReport(range ?? {}),
    queryFn: () => analyticsService.financial(range ?? undefined),
    enabled: range !== null,
    placeholderData: keepPreviousData,
  });
}

export function useSalesReport(range: DateRange | null) {
  return useQuery({
    queryKey: queryKeys.salesReport(range ?? {}),
    queryFn: () => analyticsService.sales(range ?? undefined),
    enabled: range !== null,
    placeholderData: keepPreviousData,
  });
}

export function useTrend(granularity: Granularity, range: DateRange | null) {
  return useQuery({
    queryKey: queryKeys.trend({ granularity, ...range }),
    queryFn: () => analyticsService.trend(granularity, range ?? undefined),
    enabled: range !== null,
    placeholderData: keepPreviousData,
  });
}

export function useTopProducts(range: DateRange | null, limit = 10) {
  return useQuery({
    queryKey: queryKeys.topProducts({ limit, ...range }),
    queryFn: () => analyticsService.topProducts(range ?? undefined, limit),
    enabled: range !== null,
    placeholderData: keepPreviousData,
  });
}

export function usePeakHours(range: DateRange | null) {
  return useQuery({
    queryKey: queryKeys.peakHours(range ?? {}),
    queryFn: () => analyticsService.peakHours(range ?? undefined),
    enabled: range !== null,
    placeholderData: keepPreviousData,
  });
}

export function useCorporateSales(range: DateRange | null) {
  return useQuery({
    queryKey: queryKeys.corporate(range ?? {}),
    queryFn: () => analyticsService.corporate(range ?? undefined),
    enabled: range !== null,
    placeholderData: keepPreviousData,
  });
}

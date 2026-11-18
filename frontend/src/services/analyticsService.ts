import type {
  CorporateSales,
  DateRange,
  FinancialReport,
  Granularity,
  PeakHour,
  SalesReport,
  SalesTrend,
  TopProduct,
} from "@/types/finance";
import { apiClient } from "./apiClient";

export const analyticsService = {
  /** Sales only. Managers are limited by the backend to the last 7 days. */
  sales: (range?: DateRange) => apiClient.get<SalesReport>("/reports/sales", { query: range }),
  /** Owner only: revenue, collections, COGS, gross and net profit. */
  financial: (range?: DateRange) =>
    apiClient.get<FinancialReport>("/reports/financial", { query: range }),
  trend: (granularity: Granularity, range?: DateRange) =>
    apiClient.get<SalesTrend>("/reports/trend", { query: { granularity, ...range } }),
  topProducts: (range?: DateRange, limit = 10) =>
    apiClient.get<TopProduct[]>("/reports/top-products", { query: { limit, ...range } }),
  peakHours: (range?: DateRange) => apiClient.get<PeakHour[]>("/reports/peak-hours", { query: range }),
  corporate: (range?: DateRange) =>
    apiClient.get<CorporateSales[]>("/reports/corporate", { query: range }),
};

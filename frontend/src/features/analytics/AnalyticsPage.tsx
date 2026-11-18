import { useState } from "react";
import { BarsChart } from "@/components/charts/BarsChart";
import { TrendChart } from "@/components/charts/TrendChart";
import { DataTable, type Column } from "@/components/common/DataTable";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { useDateRange } from "@/hooks/useDateRange";
import type { CorporateSales, DailySales, Granularity, TopProduct, TrendPoint } from "@/types/finance";
import { formatDate, formatDateShort, formatMoney, formatPercent, toChartNumber } from "@/utils/format";
import { FinancialKpis } from "./FinancialKpis";
import { useCorporateSales, useFinancialReport, usePeakHours, useTopProducts, useTrend } from "./hooks";

const GRANULARITY_LABELS: Record<Granularity, string> = { day: "Daily", week: "Weekly", month: "Monthly" };

const trendColumns: Column<TrendPoint>[] = [
  { header: "Period starting", cell: (p) => formatDate(p.period_start) },
  { header: "Orders", cell: (p) => p.order_count, className: "text-right" },
  { header: "Net sales", cell: (p) => <span className="tabular-nums">{formatMoney(p.net_sales)}</span>, className: "text-right" },
  { header: "Change", cell: (p) => (p.change_pct === null ? "—" : formatPercent(p.change_pct)), className: "text-right" },
];

const productColumns: Column<TopProduct>[] = [
  { header: "Product", cell: (p) => p.name },
  { header: "Units", cell: (p) => p.quantity_sold, className: "text-right" },
  { header: "Revenue", cell: (p) => <span className="tabular-nums">{formatMoney(p.revenue)}</span>, className: "text-right" },
];

const corporateColumns: Column<CorporateSales>[] = [
  { header: "Company", cell: (c) => c.company_name },
  { header: "Customers", cell: (c) => c.customers, className: "text-right", hideOnSmall: true },
  { header: "Orders", cell: (c) => c.order_count, className: "text-right" },
  { header: "Billed", cell: (c) => <span className="tabular-nums">{formatMoney(c.billed_total)}</span>, className: "text-right" },
  { header: "Still owed", cell: (c) => <span className="tabular-nums">{formatMoney(c.outstanding_due)}</span>, className: "text-right" },
];

const dailyColumns: Column<DailySales>[] = [
  { header: "Date", cell: (d) => formatDate(d.business_date) },
  { header: "Orders", cell: (d) => d.order_count, className: "text-right" },
  { header: "Net sales", cell: (d) => <span className="tabular-nums">{formatMoney(d.net_sales)}</span>, className: "text-right" },
  { header: "Billed total", cell: (d) => <span className="tabular-nums">{formatMoney(d.billed_total)}</span>, className: "text-right" },
];

export default function AnalyticsPage() {
  const dateRange = useDateRange("last30");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const range = dateRange.range;

  const financial = useFinancialReport(range);
  const trend = useTrend(granularity, range);
  const top = useTopProducts(range, 10);
  const peak = usePeakHours(range);
  const corporate = useCorporateSales(range);

  return (
    <>
      <PageHeader title="Analytics & reports" description="Owner view of revenue, collections and profit." actions={<DateRangeFilter state={dateRange} />} />
      {range === null ? (
        <EmptyState title="Choose a valid date range" />
      ) : (
        <div className="space-y-5">
          <QueryBoundary query={financial}>
            {(report) => (
              <>
                <FinancialKpis summary={report.summary} settlementsReceived={report.credit_settlements_received} />
                <Card>
                  <CardHeader>
                    <CardTitle>Daily sales</CardTitle>
                  </CardHeader>
                  {report.daily.length === 0 ? <EmptyState title="No sales in this period" /> : <DataTable columns={dailyColumns} rows={report.daily} rowKey={(d) => d.business_date} />}
                </Card>
              </>
            )}
          </QueryBoundary>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-2">
              <div>
                <CardTitle>Sales trend</CardTitle>
                <CardDescription>Net sales per period.</CardDescription>
              </div>
              <Select aria-label="Trend granularity" className="w-32" value={granularity} onChange={(e) => setGranularity(e.target.value as Granularity)}>
                {(Object.keys(GRANULARITY_LABELS) as Granularity[]).map((g) => (
                  <option key={g} value={g}>
                    {GRANULARITY_LABELS[g]}
                  </option>
                ))}
              </Select>
            </CardHeader>
            <CardContent>
              <QueryBoundary query={trend} isEmpty={(t) => t.points.length === 0} empty={<EmptyState title="No sales in this period" />}>
                {(t) => (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Direction: <strong className="text-foreground">{t.trend.direction}</strong>
                      {t.trend.last_vs_previous_pct !== null && <> · latest period vs previous {formatPercent(t.trend.last_vs_previous_pct)}</>}
                    </p>
                    <TrendChart data={t.points.map((p) => ({ label: formatDateShort(p.period_start), value: toChartNumber(p.net_sales) }))} seriesName="Net sales" />
                    <DataTable columns={trendColumns} rows={t.points} rowKey={(p) => p.period_start} />
                  </div>
                )}
              </QueryBoundary>
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top products</CardTitle>
              </CardHeader>
              <CardContent>
                <QueryBoundary query={top} isEmpty={(t) => t.length === 0} empty={<EmptyState title="No sales in this period" />}>
                  {(items) => (
                    <div className="space-y-4">
                      <BarsChart horizontal height={Math.max(200, items.length * 34)} seriesName="Revenue" data={items.map((p) => ({ label: p.name, value: toChartNumber(p.revenue) }))} />
                      <DataTable columns={productColumns} rows={items} rowKey={(p) => p.product_id} />
                    </div>
                  )}
                </QueryBoundary>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Peak hours</CardTitle>
                <CardDescription>Orders by hour of the day.</CardDescription>
              </CardHeader>
              <CardContent>
                <QueryBoundary query={peak} isEmpty={(p) => p.length === 0} empty={<EmptyState title="No orders in this period" />}>
                  {(hours) => (
                    <BarsChart unit="count" color="accent" seriesName="Orders" data={hours.map((h) => ({ label: `${String(h.hour).padStart(2, "0")}:00`, value: h.order_count }))} />
                  )}
                </QueryBoundary>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Corporate customers</CardTitle>
              <CardDescription>Billed amounts include credit sales. "Still owed" is the company's outstanding balance now.</CardDescription>
            </CardHeader>
            <QueryBoundary query={corporate} isEmpty={(c) => c.length === 0} empty={<EmptyState title="No corporate sales in this period" />}>
              {(rows) => <DataTable columns={corporateColumns} rows={rows} rowKey={(c) => c.company_name} />}
            </QueryBoundary>
          </Card>
        </div>
      )}
    </>
  );
}

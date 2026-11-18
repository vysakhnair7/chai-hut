import { AlertTriangle, ClipboardList, Receipt, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { TrendChart } from "@/components/charts/TrendChart";
import { BarsChart } from "@/components/charts/BarsChart";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { StatCard } from "@/components/common/StatCard";
import { OrderStatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUser } from "@/contexts/AuthContext";
import { useDateRange } from "@/hooks/useDateRange";
import { FinancialKpis } from "@/features/analytics/FinancialKpis";
import { useFinancialReport, useSalesReport, useTopProducts, useTrend } from "@/features/analytics/hooks";
import { useOrders } from "@/features/orders/hooks";
import { itemsSummary } from "@/features/orders/utils";
import { useOutstanding } from "@/features/payments/hooks";
import { useProducts } from "@/features/products/hooks";
import { todayIso } from "@/utils/dates";
import { formatDateShort, formatMoney, formatTime, toChartNumber } from "@/utils/format";

export default function DashboardPage() {
  const user = useCurrentUser();
  return user.role === "owner" ? <OwnerDashboard name={user.full_name} /> : <ManagerDashboard name={user.full_name} />;
}

/** Owner: money, profit and trends for a chosen period. All figures are computed by the backend. */
function OwnerDashboard({ name }: { name: string }) {
  const dateRange = useDateRange("last7");
  const range = dateRange.range;
  const financial = useFinancialReport(range);
  const trend = useTrend("day", range);
  const top = useTopProducts(range, 5);

  return (
    <>
      <PageHeader title={`Welcome, ${name}`} description="How the café is doing." actions={<DateRangeFilter state={dateRange} />} />
      {range === null ? (
        <EmptyState title="Choose a valid date range" />
      ) : (
        <div className="space-y-5">
          <QueryBoundary query={financial}>{(report) => <FinancialKpis summary={report.summary} settlementsReceived={report.credit_settlements_received} />}</QueryBoundary>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Net sales per day</CardTitle>
              </CardHeader>
              <CardContent>
                <QueryBoundary query={trend} isEmpty={(t) => t.points.length === 0} empty={<EmptyState title="No sales in this period" />}>
                  {(t) => <TrendChart seriesName="Net sales" data={t.points.map((p) => ({ label: formatDateShort(p.period_start), value: toChartNumber(p.net_sales) }))} />}
                </QueryBoundary>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top products</CardTitle>
                <CardDescription>
                  By revenue. <Link to="/analytics" className="underline">Full analytics</Link>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <QueryBoundary query={top} isEmpty={(t) => t.length === 0} empty={<EmptyState title="No sales in this period" />}>
                  {(items) => <BarsChart horizontal seriesName="Revenue" data={items.map((p) => ({ label: p.name, value: toChartNumber(p.revenue) }))} />}
                </QueryBoundary>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

/** Manager: running the shift. Today's orders, short-term sales, dues and stock problems. No profit or cost figures. */
function ManagerDashboard({ name }: { name: string }) {
  const today = todayIso();
  const todayRange = { date_from: today, date_to: today };
  const dateRange = useDateRange("last7");

  const placed = useOrders({ status: "placed", business_date: today, limit: 1 });
  const preparing = useOrders({ status: "preparing", business_date: today, limit: 1 });
  const ready = useOrders({ status: "ready", business_date: today, limit: 1 });
  const recent = useOrders({ business_date: today, limit: 8 }, 30_000);
  const sales = useSalesReport(todayRange);
  const weekly = useSalesReport(dateRange.range);
  const dues = useOutstanding();
  const outOfStock = useProducts({ status: "out_of_stock", limit: 10 });

  return (
    <>
      <PageHeader title={`Welcome, ${name}`} description="Today at the café." />
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Placed" value={placed.data ? String(placed.data.total) : "…"} icon={ClipboardList} to="/orders" />
          <StatCard label="Preparing" value={preparing.data ? String(preparing.data.total) : "…"} icon={ClipboardList} to="/orders" />
          <StatCard label="Ready" value={ready.data ? String(ready.data.total) : "…"} icon={ClipboardList} tone="success" to="/orders" />
          <StatCard label="Sales today" value={sales.data ? formatMoney(sales.data.net_sales) : "…"} hint={sales.data ? `${sales.data.order_count} orders` : undefined} icon={Receipt} to="/orders" />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Latest orders today</CardTitle>
            </CardHeader>
            <CardContent>
              <QueryBoundary query={recent} isEmpty={(d) => d.items.length === 0} empty={<EmptyState title="No orders yet today" />}>
                {(page) => (
                  <ul className="divide-y">
                    {page.items.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0">
                          <span className="font-bold tabular-nums">{o.order_token}</span>{" "}
                          <span className="text-muted-foreground">{formatTime(o.created_at)}</span>
                          <span className="block truncate text-muted-foreground">{itemsSummary(o.items)}</span>
                        </span>
                        <OrderStatusBadge status={o.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </QueryBoundary>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <StatCard
              label="Outstanding dues"
              value={dues.data ? formatMoney(dues.data.total_outstanding) : "…"}
              hint={dues.data ? `${dues.data.customers.length} customers owe money` : undefined}
              icon={Wallet}
              tone="warning"
              to="/dues"
            />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" aria-hidden /> Out of stock
                </CardTitle>
              </CardHeader>
              <CardContent>
                <QueryBoundary query={outOfStock} isEmpty={(d) => d.items.length === 0} empty={<p className="text-sm text-muted-foreground">Everything on the menu is in stock.</p>}>
                  {(page) => (
                    <ul className="space-y-1 text-sm">
                      {page.items.map((p) => (
                        <li key={p.id}>
                          <Link className="hover:underline" to="/products">
                            {p.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </QueryBoundary>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>Sales, last 7 days</CardTitle>
              <CardDescription>Managers see sales only for the past week.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <QueryBoundary query={weekly} isEmpty={(r) => r.daily.length === 0} empty={<EmptyState title="No sales in this period" />}>
              {(r) => <TrendChart seriesName="Net sales" data={r.daily.map((d) => ({ label: formatDateShort(d.business_date), value: toChartNumber(d.net_sales) }))} />}
            </QueryBoundary>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

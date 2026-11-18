import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/common/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { DefaultSkeleton } from "@/components/common/QueryBoundary";
import { OrderStatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { ACTIVE_ORDER_STATUSES, NEXT_ORDER_STATUS, ORDER_STATUS_LABELS } from "@/constants/labels";
import { useDebounce } from "@/hooks/useDebounce";
import { useRole } from "@/hooks/useRole";
import type { Order, OrderStatus } from "@/types/order";
import { todayIso } from "@/utils/dates";
import { formatMoney, formatTime, formatDateTime } from "@/utils/format";
import { OrderDetailDialog } from "./OrderDetailDialog";
import { TokenSlip } from "./TokenSlip";
import { useAdvanceOrder, useOrders } from "./hooks";
import { itemsSummary, totalQuantity } from "./utils";

const PAGE_SIZE = 20;
const POLL_MS = 15_000;

export default function OrdersPage() {
  const { isManagerUp } = useRole();
  const [selected, setSelected] = useState<Order | null>(null);
  const [printing, setPrinting] = useState<Order | null>(null);

  // Print after the hidden slip has rendered. The slip only exists to be printed.
  useEffect(() => {
    if (printing) {
      window.print();
      setPrinting(null);
    }
  }, [printing]);

  return (
    <>
      {isManagerUp ? <ManagerOrders onOpen={setSelected} /> : <CashierOrders onOpen={setSelected} />}
      <OrderDetailDialog order={selected} onClose={() => setSelected(null)} onPrint={setPrinting} />
      {printing && (
        <div className="hidden print:block">
          <TokenSlip
            token={printing.order_token}
            customerLabel={printing.customer?.full_name ?? printing.walk_in_name}
            items={printing.items}
            createdAt={printing.created_at}
          />
        </div>
      )}
    </>
  );
}

function customerCell(o: Order) {
  return o.customer ? (
    <div>
      <p className="font-medium">{o.customer.full_name}</p>
      <p className="text-xs text-muted-foreground">{o.customer.company_name}</p>
    </div>
  ) : (
    <span className="text-muted-foreground">{o.walk_in_name ?? "Walk-in"}</span>
  );
}

function AdvanceButton({ order }: { order: Order }) {
  const advance = useAdvanceOrder();
  const next = NEXT_ORDER_STATUS[order.status];
  if (!next) return null;
  return (
    <Button
      size="sm"
      variant="outline"
      loading={advance.isPending}
      onClick={(e) => {
        e.stopPropagation(); // do not also open the order
        advance.mutate({ id: order.id, status: next });
      }}
    >
      <ArrowRight className="h-4 w-4" aria-hidden /> {ORDER_STATUS_LABELS[next]}
    </Button>
  );
}

const baseColumns: Column<Order>[] = [
  { header: "Token", cell: (o) => <span className="text-lg font-bold tabular-nums">{o.order_token}</span> },
  { header: "Customer", cell: customerCell },
  { header: "Items", cell: (o) => <span className="line-clamp-2 text-sm">{itemsSummary(o.items)}</span>, hideOnSmall: true },
  { header: "Qty", cell: (o) => totalQuantity(o.items), className: "text-right" },
  { header: "Status", cell: (o) => <OrderStatusBadge status={o.status} /> },
];

/** Cashier: today's orders only (the backend enforces this too), refreshed automatically, no amounts. */
function CashierOrders({ onOpen }: { onOpen: (o: Order) => void }) {
  const [tab, setTab] = useState<"active" | "completed" | "cancelled">("active");
  const query = useOrders({ business_date: todayIso(), limit: 200 }, POLL_MS);

  const rows = useMemo(() => {
    const all = query.data?.items ?? [];
    if (tab === "active") return all.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status));
    return all.filter((o) => o.status === tab);
  }, [query.data, tab]);

  const columns: Column<Order>[] = [
    ...baseColumns,
    { header: "Time", cell: (o) => formatTime(o.created_at), hideOnSmall: true },
    { header: "", cell: (o) => <AdvanceButton order={o} />, className: "text-right" },
  ];

  return (
    <>
      <PageHeader title="Active orders" description="Today's orders. This list refreshes every few seconds." />
      <Card>
        <div className="flex gap-2 border-b p-3" role="group" aria-label="Order filter">
          {(["active", "completed", "cancelled"] as const).map((t) => (
            <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t === "active" ? "In progress" : t === "completed" ? "Completed" : "Cancelled"}
            </Button>
          ))}
        </div>
        {query.isLoading ? (
          <DefaultSkeleton />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title={tab === "active" ? "No orders in progress" : "Nothing here"} description="New orders appear here automatically." />
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(o) => o.id} onRowClick={onOpen} />
        )}
      </Card>
    </>
  );
}

/** Owner / manager: every day, filters, totals, payments and cancellation through the detail dialog. */
function ManagerOrders({ onOpen }: { onOpen: (o: Order) => void }) {
  const [status, setStatus] = useState<"" | OrderStatus>("");
  const [date, setDate] = useState("");
  const [token, setToken] = useState("");
  const [offset, setOffset] = useState(0);
  const debouncedToken = useDebounce(token.trim());

  const query = useOrders(
    {
      status: status || undefined,
      business_date: date || undefined,
      token: debouncedToken || undefined,
      limit: PAGE_SIZE,
      offset,
    },
    POLL_MS * 2,
  );

  const columns: Column<Order>[] = [
    ...baseColumns,
    { header: "Total", cell: (o) => <span className="tabular-nums">{formatMoney(o.total_amount)}</span>, className: "text-right" },
    { header: "Placed", cell: (o) => formatDateTime(o.created_at), hideOnSmall: true },
    { header: "", cell: (o) => <AdvanceButton order={o} />, className: "text-right" },
  ];

  return (
    <>
      <PageHeader title="Orders" description="Open an order for its bill, payments and cancellation." />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Select
            aria-label="Filter by status"
            className="w-40"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as "" | OrderStatus);
              setOffset(0);
            }}
          >
            <option value="">All statuses</option>
            {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            aria-label="Business date"
            className="w-44"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setOffset(0);
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDate(todayIso());
              setOffset(0);
            }}
          >
            Today
          </Button>
          {date && (
            <Button size="sm" variant="ghost" onClick={() => setDate("")}>
              All dates
            </Button>
          )}
          <Input
            aria-label="Find by token"
            placeholder="Token" maxLength={12}
            className="w-28"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              setOffset(0);
            }}
          />
        </div>
        {query.isLoading ? (
          <DefaultSkeleton />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data && query.data.items.length === 0 ? (
          <EmptyState title="No orders found" description="Try a different filter." />
        ) : query.data ? (
          <>
            <DataTable columns={columns} rows={query.data.items} rowKey={(o) => o.id} onRowClick={onOpen} />
            <Pagination total={query.data.total} limit={query.data.limit} offset={query.data.offset} onChange={setOffset} />
          </>
        ) : null}
      </Card>
    </>
  );
}

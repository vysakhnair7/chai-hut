import { useState } from "react";
import { DataTable, type Column } from "@/components/common/DataTable";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { DefaultSkeleton, QueryBoundary } from "@/components/common/QueryBoundary";
import { PaymentStateBadge, PaymentStatusBadge } from "@/components/common/StatusBadge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select } from "@/components/ui/input";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/constants/labels";
import { useDateRange } from "@/hooks/useDateRange";
import { BillView } from "@/features/orders/BillView";
import { useBill } from "@/features/orders/hooks";
import type { Payment } from "@/types/finance";
import type { PaymentMethod, PaymentStatus } from "@/types/order";
import { formatDateTime, formatMoney } from "@/utils/format";
import { useOrderPayments, usePayments } from "./hooks";

const PAGE_SIZE = 25;

export default function PaymentsPage() {
  const dateRange = useDateRange("last7");
  const [method, setMethod] = useState<"" | PaymentMethod>("");
  const [status, setStatus] = useState<"" | PaymentStatus>("");
  const [offset, setOffset] = useState(0);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  const range = dateRange.range;
  const query = usePayments({
    method: method || undefined,
    status: status || undefined,
    date_from: range?.date_from,
    date_to: range?.date_to,
    limit: PAGE_SIZE,
    offset,
  });

  const columns: Column<Payment>[] = [
    { header: "When", cell: (p) => formatDateTime(p.created_at) },
    { header: "Method", cell: (p) => PAYMENT_METHOD_LABELS[p.method] },
    { header: "Amount", cell: (p) => <span className="tabular-nums">{formatMoney(p.amount)}</span>, className: "text-right" },
    { header: "Status", cell: (p) => <PaymentStatusBadge status={p.status} /> },
    { header: "Reference", cell: (p) => p.transaction_id ?? "—", hideOnSmall: true },
  ];

  return (
    <>
      <PageHeader title="Payments" description="Every payment taken against an order. Corporate credit is a promise to pay, not cash collected." />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <DateRangeFilter
            state={{
              ...dateRange,
              setPreset: (p) => {
                dateRange.setPreset(p);
                setOffset(0);
              },
            }}
          />
          <Select aria-label="Filter by method" className="w-44" value={method} onChange={(e) => { setMethod(e.target.value as "" | PaymentMethod); setOffset(0); }}>
            <option value="">All methods</option>
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </Select>
          <Select aria-label="Filter by status" className="w-40" value={status} onChange={(e) => { setStatus(e.target.value as "" | PaymentStatus); setOffset(0); }}>
            <option value="">All statuses</option>
            {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((s) => (
              <option key={s} value={s}>
                {PAYMENT_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        {range === null ? (
          <EmptyState title="Choose a valid date range" />
        ) : query.isLoading ? (
          <DefaultSkeleton />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data && query.data.items.length === 0 ? (
          <EmptyState title="No payments in this period" />
        ) : query.data ? (
          <>
            <DataTable columns={columns} rows={query.data.items} rowKey={(p) => p.id} onRowClick={(p) => setOpenOrderId(p.order_id)} />
            <Pagination total={query.data.total} limit={query.data.limit} offset={query.data.offset} onChange={setOffset} />
          </>
        ) : null}
      </Card>
      <PaymentOrderDialog orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </>
  );
}

/** The bill and payment position of the order a payment belongs to. */
function PaymentOrderDialog({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const bill = useBill(orderId);
  const payments = useOrderPayments(orderId);
  return (
    <Dialog open={orderId !== null} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <QueryBoundary query={bill}>
          {(b) => (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  Token {b.order_token} {b.payment_state && <PaymentStateBadge state={b.payment_state} />}
                </DialogTitle>
                <DialogDescription>
                  Invoice {b.invoice_number} · {b.customer_name ?? "Walk-in"}
                  {b.company_name ? ` · ${b.company_name}` : ""}
                </DialogDescription>
              </DialogHeader>
              <BillView bill={b} />
              <QueryBoundary query={payments}>
                {(p) => (
                  <p className="text-sm text-muted-foreground">
                    Paid {formatMoney(p.amount_paid)} of {formatMoney(p.order_total)} · Balance due{" "}
                    <strong className="text-foreground">{formatMoney(p.balance_due)}</strong>
                  </p>
                )}
              </QueryBoundary>
            </>
          )}
        </QueryBoundary>
      </DialogContent>
    </Dialog>
  );
}

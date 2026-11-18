import { Printer, Wallet, XCircle, ArrowRight } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable, type Column } from "@/components/common/DataTable";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { OrderStatusBadge, PaymentStateBadge, PaymentStatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ACTIVE_ORDER_STATUSES, NEXT_ORDER_STATUS, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/constants/labels";
import { useRole } from "@/hooks/useRole";
import { RecordPaymentDialog } from "@/features/payments/RecordPaymentDialog";
import type { Bill, BillPayment, Order, OrderItem } from "@/types/order";
import { formatDateTime, formatMoney } from "@/utils/format";
import { BillView } from "./BillView";
import { useAdvanceOrder, useBill, useCancelOrder } from "./hooks";

interface Props {
  order: Order | null;
  onClose: () => void;
  onPrint: (order: Order) => void;
}

const itemColumnsBasic: Column<OrderItem>[] = [
  { header: "Item", cell: (i) => i.product_name },
  { header: "Qty", cell: (i) => i.quantity, className: "text-right" },
];

const paymentColumns: Column<BillPayment>[] = [
  { header: "When", cell: (p) => formatDateTime(p.created_at) },
  { header: "Method", cell: (p) => PAYMENT_METHOD_LABELS[p.method] },
  { header: "Amount", cell: (p) => <span className="tabular-nums">{formatMoney(p.amount)}</span>, className: "text-right" },
  { header: "Status", cell: (p) => <PaymentStatusBadge status={p.status} /> },
];

export function OrderDetailDialog({ order, onClose, onPrint }: Props) {
  return (
    <Dialog open={order !== null} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-w-2xl">{order && <OrderDetailBody order={order} onClose={onClose} onPrint={onPrint} />}</DialogContent>
    </Dialog>
  );
}

function OrderDetailBody({ order, onClose, onPrint }: { order: Order; onClose: () => void; onPrint: (o: Order) => void }) {
  const { isManagerUp } = useRole();
  // Cashiers never see bills or payments, so do not even ask for them.
  const bill = useBill(isManagerUp ? order.id : null);
  const advance = useAdvanceOrder();
  const cancel = useCancelOrder(onClose);
  const [paying, setPaying] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const next = NEXT_ORDER_STATUS[order.status];
  const isActive = ACTIVE_ORDER_STATUSES.includes(order.status);
  const customerLabel = order.customer ? `${order.customer.full_name} · ${order.customer.company_name}` : (order.walk_in_name ?? "Walk-in");

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          Token {order.order_token} <OrderStatusBadge status={order.status} />
        </DialogTitle>
        <DialogDescription>
          {customerLabel} · {formatDateTime(order.created_at)} · Invoice {order.invoice_number}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap gap-2">
        {next && (
          <Button size="sm" loading={advance.isPending} onClick={() => advance.mutate({ id: order.id, status: next }, { onSuccess: onClose })}>
            <ArrowRight className="h-4 w-4" aria-hidden /> Mark {ORDER_STATUS_LABELS[next].toLowerCase()}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => onPrint(order)}>
          <Printer className="h-4 w-4" aria-hidden /> Print token
        </Button>
        {isManagerUp && isActive && (
          <Button size="sm" variant="outline" onClick={() => setConfirmCancel(true)}>
            <XCircle className="h-4 w-4" aria-hidden /> Cancel order
          </Button>
        )}
      </div>

      {isManagerUp ? (
        <QueryBoundary query={bill}>
          {(b: Bill) => (
            <div className="space-y-4">
              <BillView bill={b} />

              <section aria-label="Payments" className="space-y-2 border-t pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    Payments {b.payment_state && <PaymentStateBadge state={b.payment_state} />}
                  </h3>
                  {b.balance_due !== null && Number(b.balance_due) > 0 && order.status !== "cancelled" && (
                    <Button size="sm" onClick={() => setPaying(true)}>
                      <Wallet className="h-4 w-4" aria-hidden /> Record payment
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Paid {formatMoney(b.amount_paid)} · Balance due <strong className="text-foreground">{formatMoney(b.balance_due)}</strong>
                </p>
                {b.payments && b.payments.length > 0 && <DataTable columns={paymentColumns} rows={b.payments} rowKey={(p) => `${p.created_at}-${p.method}-${p.amount}`} />}
              </section>
            </div>
          )}
        </QueryBoundary>
      ) : (
        <DataTable columns={itemColumnsBasic} rows={order.items} rowKey={(i) => i.product_id} />
      )}

      {isManagerUp && bill.data && (
        <RecordPaymentDialog
          open={paying}
          onOpenChange={setPaying}
          orderId={order.id}
          orderToken={order.order_token}
          balanceDue={bill.data.balance_due ?? "0"}
          hasCustomer={order.customer !== null}
        />
      )}
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={`Cancel order ${order.order_token}?`}
        description="Stock is returned and any corporate credit on this order is reversed. This cannot be undone."
        confirmLabel="Cancel order"
        destructive
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate(order.id, { onSettled: () => setConfirmCancel(false) })}
      />
    </>
  );
}

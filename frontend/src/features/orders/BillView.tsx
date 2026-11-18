import { DataTable, type Column } from "@/components/common/DataTable";
import type { Bill, OrderItem } from "@/types/order";
import { formatMoney, formatPercent } from "@/utils/format";

const itemColumns: Column<OrderItem>[] = [
  { header: "Item", cell: (i) => i.product_name },
  { header: "Qty", cell: (i) => i.quantity, className: "text-right" },
  { header: "Price", cell: (i) => <span className="tabular-nums">{formatMoney(i.unit_price)}</span>, className: "text-right", hideOnSmall: true },
  { header: "GST", cell: (i) => formatPercent(i.gst_rate), className: "text-right", hideOnSmall: true },
  { header: "Total", cell: (i) => <span className="tabular-nums">{formatMoney(i.total_price)}</span>, className: "text-right" },
];

/** Items and totals exactly as the backend computed them. Nothing is recalculated here. */
export function BillView({ bill }: { bill: Bill }) {
  return (
    <div className="space-y-3">
      <DataTable columns={itemColumns} rows={bill.items} rowKey={(i) => i.product_id} />
      <dl className="ml-auto grid max-w-xs grid-cols-2 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="text-right tabular-nums">{formatMoney(bill.subtotal_amount)}</dd>
        <dt className="text-muted-foreground">Discount</dt>
        <dd className="text-right tabular-nums">{formatMoney(bill.discount_amount)}</dd>
        <dt className="text-muted-foreground">CGST</dt>
        <dd className="text-right tabular-nums">{formatMoney(bill.cgst_amount)}</dd>
        <dt className="text-muted-foreground">SGST</dt>
        <dd className="text-right tabular-nums">{formatMoney(bill.sgst_amount)}</dd>
        <dt className="font-semibold">Total</dt>
        <dd className="text-right font-semibold tabular-nums">{formatMoney(bill.total_amount)}</dd>
      </dl>
    </div>
  );
}

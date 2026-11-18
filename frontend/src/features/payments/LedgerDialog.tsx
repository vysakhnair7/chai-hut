import { QueryBoundary } from "@/components/common/QueryBoundary";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LEDGER_KIND_LABELS } from "@/constants/labels";
import type { LedgerEntry } from "@/types/finance";
import { formatDateTime, formatMoney } from "@/utils/format";
import { useLedger } from "./hooks";

interface LedgerDialogProps {
  customerId: string | null;
  customerName?: string;
  onClose: () => void;
}

const columns: Column<LedgerEntry>[] = [
  { header: "When", cell: (e) => formatDateTime(e.at) },
  { header: "What", cell: (e) => LEDGER_KIND_LABELS[e.kind] },
  { header: "Amount", cell: (e) => <span className="tabular-nums">{formatMoney(e.amount)}</span>, className: "text-right" },
  { header: "Balance after", cell: (e) => <span className="tabular-nums">{formatMoney(e.balance_after)}</span>, className: "text-right" },
  { header: "Ref", cell: (e) => e.reference ?? "—", hideOnSmall: true },
];

/** Credit ledger for one customer: every credit sale, reversal and settlement, with running balance. */
export function LedgerDialog({ customerId, customerName, onClose }: LedgerDialogProps) {
  const query = useLedger(customerId);
  return (
    <Dialog open={customerId !== null} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Credit ledger{customerName ? `: ${customerName}` : ""}</DialogTitle>
          <DialogDescription>Positive amounts increase what is owed; negative amounts reduce it.</DialogDescription>
        </DialogHeader>
        <QueryBoundary query={query} isEmpty={(d) => d.entries.length === 0}>
          {(ledger) => (
            <div className="space-y-3">
              <p className="text-sm">
                Current due: <strong className="tabular-nums">{formatMoney(ledger.current_due)}</strong>
              </p>
              <DataTable columns={columns} rows={ledger.entries} rowKey={(e) => `${e.at}-${e.kind}-${e.reference ?? ""}-${e.amount}`} />
            </div>
          )}
        </QueryBoundary>
      </DialogContent>
    </Dialog>
  );
}

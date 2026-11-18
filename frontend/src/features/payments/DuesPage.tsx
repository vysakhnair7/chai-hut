import { BookOpen, HandCoins } from "lucide-react";
import { useState } from "react";
import { DataTable, type Column } from "@/components/common/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompanyDue, OutstandingCustomer } from "@/types/finance";
import { formatMoney } from "@/utils/format";
import { LedgerDialog } from "./LedgerDialog";
import { SettleDialog } from "./SettleDialog";
import { useOutstanding } from "./hooks";

export default function DuesPage() {
  const query = useOutstanding();
  const [ledger, setLedger] = useState<OutstandingCustomer | null>(null);
  const [settling, setSettling] = useState<OutstandingCustomer | null>(null);

  const customerColumns: Column<OutstandingCustomer>[] = [
    {
      header: "Customer",
      cell: (c) => (
        <div>
          <p className="font-medium">{c.full_name}</p>
          <p className="text-xs text-muted-foreground">{c.company_name}</p>
        </div>
      ),
    },
    { header: "Phone", cell: (c) => c.phone, hideOnSmall: true },
    { header: "Amount due", cell: (c) => <span className="font-semibold tabular-nums">{formatMoney(c.amount_due)}</span>, className: "text-right" },
    {
      header: "",
      className: "text-right",
      cell: (c) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setLedger(c)} aria-label={`Ledger for ${c.full_name}`}>
            <BookOpen className="h-4 w-4" aria-hidden />
          </Button>
          <Button size="sm" onClick={() => setSettling(c)}>
            <HandCoins className="h-4 w-4" aria-hidden /> Settle
          </Button>
        </div>
      ),
    },
  ];

  const companyColumns: Column<CompanyDue>[] = [
    { header: "Company", cell: (c) => c.company_name },
    { header: "Customers", cell: (c) => c.customers_with_dues, className: "text-right" },
    { header: "Amount due", cell: (c) => <span className="tabular-nums">{formatMoney(c.amount_due)}</span>, className: "text-right" },
  ];

  return (
    <>
      <PageHeader title="Outstanding dues" description="What corporate customers owe on credit. Settling records the cash actually received." />
      <QueryBoundary
        query={query}
        isEmpty={(d) => d.customers.length === 0}
        empty={<EmptyState title="No outstanding dues" description="Everyone is settled up." />}
      >
        {(summary) => (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <StatCard label="Total outstanding" value={formatMoney(summary.total_outstanding)} tone="warning" />
              <StatCard label="Customers with dues" value={String(summary.customers.length)} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>By company</CardTitle>
              </CardHeader>
              <DataTable columns={companyColumns} rows={summary.by_company} rowKey={(c) => c.company_name} />
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>By customer</CardTitle>
              </CardHeader>
              <DataTable columns={customerColumns} rows={summary.customers} rowKey={(c) => c.id} />
            </Card>
          </div>
        )}
      </QueryBoundary>
      <LedgerDialog customerId={ledger?.id ?? null} customerName={ledger?.full_name} onClose={() => setLedger(null)} />
      <SettleDialog customer={settling} onClose={() => setSettling(null)} />
    </>
  );
}

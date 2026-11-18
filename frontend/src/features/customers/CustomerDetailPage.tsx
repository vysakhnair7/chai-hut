import { ArrowLeft, Pencil, RefreshCw, Trash2, BookOpen } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { CopyableId } from "@/components/common/CopyableId";
import { DataTable, type Column } from "@/components/common/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryBoundary } from "@/components/common/QueryBoundary";
import { ActiveBadge, OrderStatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useRole } from "@/hooks/useRole";
import { useOrders } from "@/features/orders/hooks";
import { itemsSummary } from "@/features/orders/utils";
import { LedgerDialog } from "@/features/payments/LedgerDialog";
import { customerService } from "@/services/customerService";
import type { Customer, CustomerBasic } from "@/types/customer";
import type { Order } from "@/types/order";
import { formatDateTime, formatMoney } from "@/utils/format";
import { CustomerEditDialog } from "./CustomerFormDialog";
import { PreferencesCard } from "./PreferencesCard";
import { useCustomer, useRegenerateChaiId } from "./hooks";

export default function CustomerDetailPage() {
  const { customerId = "" } = useParams();
  const { isManagerUp } = useRole();
  const query = useCustomer(customerId, isManagerUp);

  return (
    <>
      <Link to="/customers" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All customers
      </Link>
      <QueryBoundary query={query}>
        {(customer) => <CustomerBody customer={customer} />}
      </QueryBoundary>
    </>
  );
}

function isFull(c: CustomerBasic | Customer): c is Customer {
  return "amount_due" in c;
}

function CustomerBody({ customer }: { customer: CustomerBasic | Customer }) {
  const { isOwner, isManagerUp } = useRole();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const regenerate = useRegenerateChaiId(customer.id);
  const remove = useApiMutation(() => customerService.remove(customer.id), {
    success: "Customer deleted",
    invalidate: [["customers"], ["customer-search"]],
    onSuccess: () => navigate("/customers"),
  });

  const full = isFull(customer) ? customer : null;

  return (
    <>
      <PageHeader
        title={customer.full_name}
        description={customer.company_name}
        actions={
          isManagerUp && full ? (
            <>
              <Button variant="outline" onClick={() => setLedgerOpen(true)}>
                <BookOpen className="h-4 w-4" aria-hidden /> Credit ledger
              </Button>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" aria-hidden /> Edit
              </Button>
              {isOwner && (
                <Button variant="outline" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4" aria-hidden /> Delete
                </Button>
              )}
            </>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[8rem_1fr] gap-y-3 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <ActiveBadge status={customer.status} />
              </dd>
              <dt className="text-muted-foreground">Chai ID</dt>
              <dd>
                <CopyableId value={customer.chai_id} label="Chai ID" />
              </dd>
              {full && (
                <>
                  <dt className="text-muted-foreground">Username</dt>
                  <dd>{full.username}</dd>
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd>{full.phone}</dd>
                  <dt className="text-muted-foreground">Amount due</dt>
                  <dd className="font-semibold tabular-nums">{formatMoney(full.amount_due)}</dd>
                  <dt className="text-muted-foreground">Registered</dt>
                  <dd>{formatDateTime(full.created_at)}</dd>
                </>
              )}
            </dl>
            {isManagerUp && (
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setConfirmRegen(true)}>
                <RefreshCw className="h-4 w-4" aria-hidden /> Issue new Chai ID
              </Button>
            )}
          </CardContent>
        </Card>

        <PreferencesCard customerId={customer.id} />
      </div>

      <OrderHistory customerId={customer.id} showAmounts={isManagerUp} />

      {full && <CustomerEditDialog open={editing} onOpenChange={setEditing} customer={full} />}
      {isManagerUp && (
        <LedgerDialog
          customerId={ledgerOpen ? customer.id : null}
          customerName={customer.full_name}
          onClose={() => setLedgerOpen(false)}
        />
      )}
      <ConfirmDialog
        open={confirmRegen}
        onOpenChange={setConfirmRegen}
        title="Issue a new Chai ID?"
        description="The current Chai ID stops working immediately. Tell the customer their new ID."
        confirmLabel="Issue new ID"
        destructive
        loading={regenerate.isPending}
        onConfirm={() => regenerate.mutate(undefined, { onSettled: () => setConfirmRegen(false) })}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this customer?"
        description="Only customers with no dues and no order history can be deleted. Otherwise deactivate them instead."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate(undefined, { onSettled: () => setConfirmDelete(false) })}
      />
    </>
  );
}

function OrderHistory({ customerId, showAmounts }: { customerId: string; showAmounts: boolean }) {
  const query = useOrders({ customer_id: customerId, limit: 10 });
  const columns: Column<Order>[] = [
    { header: "Token", cell: (o) => <span className="font-semibold">{o.order_token}</span> },
    { header: "Date", cell: (o) => formatDateTime(o.created_at) },
    { header: "Items", cell: (o) => itemsSummary(o.items), hideOnSmall: true },
    { header: "Status", cell: (o) => <OrderStatusBadge status={o.status} /> },
    ...(showAmounts
      ? [{ header: "Total", cell: (o: Order) => <span className="tabular-nums">{formatMoney(o.total_amount)}</span>, className: "text-right" }]
      : []),
  ];

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Recent orders</CardTitle>
      </CardHeader>
      <QueryBoundary query={query} isEmpty={(d) => d.items.length === 0} empty={<EmptyState title="No orders yet" />}>
        {(page) => <DataTable columns={columns} rows={page.items} rowKey={(o) => o.id} />}
      </QueryBoundary>
    </Card>
  );
}

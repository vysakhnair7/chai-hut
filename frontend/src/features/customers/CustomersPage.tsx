import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable, type Column } from "@/components/common/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { ActiveBadge } from "@/components/common/StatusBadge";
import { DefaultSkeleton } from "@/components/common/QueryBoundary";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import { useRole } from "@/hooks/useRole";
import type { ActiveStatus } from "@/types/common";
import type { Customer, CustomerBasic } from "@/types/customer";
import { formatMoney } from "@/utils/format";
import { CustomerCreateDialog } from "./CustomerFormDialog";
import { useCustomerList, useCustomerSearch } from "./hooks";

const PAGE_SIZE = 20;

export default function CustomersPage() {
  const { isManagerUp } = useRole();
  return isManagerUp ? <ManagerCustomers /> : <CashierCustomerLookup />;
}

/** Owner / manager: full directory with filters, dues and registration. */
function ManagerCustomers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<"" | ActiveStatus>("");
  const [hasDue, setHasDue] = useState(false);
  const [offset, setOffset] = useState(0);
  const [creating, setCreating] = useState(false);

  const q = useDebounce(search.trim());
  const companyTerm = useDebounce(company.trim());

  const query = useCustomerList({
    q: q || undefined,
    company: companyTerm || undefined,
    status: status || undefined,
    has_due: hasDue || undefined,
    limit: PAGE_SIZE,
    offset,
  });

  const resetPage = () => setOffset(0);

  const columns: Column<Customer>[] = [
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
    {
      header: "Chai ID",
      cell: (c) => <code className="text-xs">{c.chai_id.slice(0, 8)}…</code>,
      hideOnSmall: true,
    },
    { header: "Amount due", cell: (c) => <span className="tabular-nums">{formatMoney(c.amount_due)}</span> },
    { header: "Status", cell: (c) => <ActiveBadge status={c.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Customers"
        description="Corporate customers identified by their Chai ID."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Register customer
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Search customers"
              placeholder="Search name, username, phone or Chai ID"
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetPage();
              }}
            />
          </div>
          <Input
            aria-label="Filter by company"
            placeholder="Company"
            className="w-44"
            value={company}
            onChange={(e) => {
              setCompany(e.target.value);
              resetPage();
            }}
          />
          <Select
            aria-label="Filter by status"
            className="w-36"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as "" | ActiveStatus);
              resetPage();
            }}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasDue}
              onChange={(e) => {
                setHasDue(e.target.checked);
                resetPage();
              }}
            />
            Has dues
          </label>
        </div>

        {query.isLoading ? (
          <DefaultSkeleton />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data && query.data.items.length === 0 ? (
          <EmptyState
            title="No customers found"
            description="Try a different search or filter, or register a new customer."
          />
        ) : query.data ? (
          <>
            <DataTable
              columns={columns}
              rows={query.data.items}
              rowKey={(c) => c.id}
              onRowClick={(c) => navigate(`/customers/${c.id}`)}
            />
            <Pagination total={query.data.total} limit={query.data.limit} offset={query.data.offset} onChange={setOffset} />
          </>
        ) : null}
      </Card>

      <CustomerCreateDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(c) => navigate(`/customers/${c.id}`)}
      />
    </>
  );
}

/** Cashier: look a customer up by name/phone/Chai ID. Basic fields only: no dues, no phone. */
function CashierCustomerLookup() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const term = useDebounce(search.trim());
  const query = useCustomerSearch(term);

  const columns: Column<CustomerBasic>[] = [
    {
      header: "Customer",
      cell: (c) => (
        <div>
          <p className="font-medium">{c.full_name}</p>
          <p className="text-xs text-muted-foreground">{c.company_name}</p>
        </div>
      ),
    },
    { header: "Chai ID", cell: (c) => <code className="text-xs">{c.chai_id.slice(0, 8)}…</code>, hideOnSmall: true },
    { header: "Status", cell: (c) => <ActiveBadge status={c.status} /> },
  ];

  return (
    <>
      <PageHeader title="Customers" description="Look up a registered customer by name, username, phone or Chai ID." />
      <Card>
        <div className="border-b p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Search customers"
              placeholder="Type at least 2 characters"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {term.length < 2 ? (
          <EmptyState icon={Search} title="Search for a customer" description="Results appear as you type." />
        ) : query.isLoading ? (
          <DefaultSkeleton />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data && query.data.length === 0 ? (
          <EmptyState title="No matching customer" description="Ask a manager to register them if they are new." />
        ) : query.data ? (
          <DataTable columns={columns} rows={query.data} rowKey={(c) => c.id} onRowClick={(c) => navigate(`/customers/${c.id}`)} />
        ) : null}
      </Card>
    </>
  );
}

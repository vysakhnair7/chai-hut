import { FolderPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable, type Column } from "@/components/common/DataTable";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { DefaultSkeleton } from "@/components/common/QueryBoundary";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { useDateRange } from "@/hooks/useDateRange";
import { useRole } from "@/hooks/useRole";
import type { Expense } from "@/types/finance";
import { formatDate, formatMoney } from "@/utils/format";
import { ExpenseCategoryDialog, ExpenseDialog } from "./ExpenseDialogs";
import { useDeleteExpense, useExpenseCategories, useExpenses } from "./hooks";

const PAGE_SIZE = 25;

export default function ExpensesPage() {
  const { isOwner } = useRole();
  const dateRange = useDateRange("thisMonth");
  const [categoryId, setCategoryId] = useState("");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [deleting, setDeleting] = useState<Expense | null>(null);

  const categories = useExpenseCategories();
  const range = dateRange.range;
  const query = useExpenses({
    category_id: categoryId || undefined,
    date_from: range?.date_from,
    date_to: range?.date_to,
    limit: PAGE_SIZE,
    offset,
  });
  const remove = useDeleteExpense(() => setDeleting(null));

  const categoryName = useMemo(() => {
    const map = new Map((categories.data ?? []).map((c) => [c.id, c.name]));
    return (id: string) => map.get(id) ?? "—";
  }, [categories.data]);

  const columns: Column<Expense>[] = [
    { header: "Date", cell: (x) => formatDate(x.expense_date) },
    { header: "Category", cell: (x) => categoryName(x.category_id), hideOnSmall: true },
    { header: "Description", cell: (x) => x.description },
    { header: "Amount", cell: (x) => <span className="tabular-nums">{formatMoney(x.amount)}</span>, className: "text-right" },
    {
      header: "",
      className: "text-right",
      cell: (x) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" aria-label={`Edit ${x.description}`} onClick={() => setEditing(x)}>
            <Pencil className="h-4 w-4" aria-hidden />
          </Button>
          {isOwner && (
            <Button size="sm" variant="ghost" aria-label={`Delete ${x.description}`} onClick={() => setDeleting(x)}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const cats = categories.data ?? [];

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Money spent running the café. These reduce net profit in the owner's reports."
        actions={
          <>
            {isOwner && (
              <Button variant="outline" onClick={() => setAddingCategory(true)}>
                <FolderPlus className="h-4 w-4" aria-hidden /> New category
              </Button>
            )}
            <Button onClick={() => setAdding(true)} disabled={cats.length === 0} title={cats.length === 0 ? "No expense categories yet" : undefined}>
              <Plus className="h-4 w-4" aria-hidden /> Add expense
            </Button>
          </>
        }
      />
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
          <Select aria-label="Filter by category" className="w-48" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setOffset(0); }}>
            <option value="">All categories</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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
          <EmptyState title="No expenses in this period" description="Add an expense to start tracking costs." />
        ) : query.data ? (
          <>
            <DataTable columns={columns} rows={query.data.items} rowKey={(x) => x.id} />
            <Pagination total={query.data.total} limit={query.data.limit} offset={query.data.offset} onChange={setOffset} />
          </>
        ) : null}
      </Card>

      <ExpenseDialog open={adding} onOpenChange={setAdding} categories={cats} />
      <ExpenseDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} categories={cats} expense={editing} />
      {isOwner && <ExpenseCategoryDialog open={addingCategory} onOpenChange={setAddingCategory} />}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this expense?"
        description={deleting ? `"${deleting.description}" for ${formatMoney(deleting.amount)} will be removed from the books.` : ""}
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  );
}

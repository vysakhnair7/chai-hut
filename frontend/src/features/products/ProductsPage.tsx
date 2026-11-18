import { Layers, Pencil, Plus, Search, Tag, Boxes, Ban } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable, type Column } from "@/components/common/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { DefaultSkeleton } from "@/components/common/QueryBoundary";
import { ProductStatusBadge } from "@/components/common/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import { useRole } from "@/hooks/useRole";
import type { Product, ProductStatus } from "@/types/catalog";
import { formatMoney, formatPercent } from "@/utils/format";
import { CategoriesDialog } from "./CategoriesDialog";
import { PriceDialog, ProductCreateDialog, ProductEditDialog, StockDialog } from "./ProductDialogs";
import { useCategories, useDiscontinueProduct, useProducts } from "./hooks";

const PAGE_SIZE = 25;
type Action = { kind: "edit" | "price" | "stock" | "discontinue"; product: Product };

export default function ProductsPage() {
  const { isOwner, isManagerUp } = useRole();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<"" | ProductStatus>("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [action, setAction] = useState<Action | null>(null);
  const [creating, setCreating] = useState(false);
  const [managingCategories, setManagingCategories] = useState(false);

  const q = useDebounce(search.trim());
  const categories = useCategories();
  const products = useProducts({
    q: q || undefined,
    category_id: categoryId || undefined,
    status: status || undefined,
    in_stock_only: inStockOnly || undefined,
    limit: PAGE_SIZE,
    offset,
  });
  const discontinue = useDiscontinueProduct(action?.product.id ?? "", () => setAction(null));

  const categoryName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories.data ?? []) map.set(c.id, c.name);
    return (id: string) => map.get(id) ?? "—";
  }, [categories.data]);

  const columns: Column<Product>[] = [
    {
      header: "Product",
      cell: (p) => (
        <div>
          <p className="font-medium">{p.name}</p>
          {p.description && <p className="line-clamp-1 text-xs text-muted-foreground">{p.description}</p>}
        </div>
      ),
    },
    { header: "Category", cell: (p) => categoryName(p.category_id), hideOnSmall: true },
    { header: "Price", cell: (p) => <span className="tabular-nums">{formatMoney(p.mrp)}</span>, className: "text-right" },
    { header: "GST", cell: (p) => formatPercent(p.gst_rate), hideOnSmall: true, className: "text-right" },
    {
      header: "Stock",
      cell: (p) => (
        <span className="tabular-nums">
          {p.stock_quantity}
          {p.stock_quantity === 0 && p.status === "available" && <Badge tone="warning" className="ml-2">Empty</Badge>}
        </span>
      ),
      className: "text-right",
    },
    { header: "Status", cell: (p) => <ProductStatusBadge status={p.status} /> },
    ...(isManagerUp
      ? [
          {
            header: "Actions",
            className: "text-right",
            cell: (p: Product) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" aria-label={`Change price of ${p.name}`} onClick={() => setAction({ kind: "price", product: p })}>
                  <Tag className="h-4 w-4" aria-hidden />
                </Button>
                <Button size="sm" variant="ghost" aria-label={`Change stock of ${p.name}`} onClick={() => setAction({ kind: "stock", product: p })}>
                  <Boxes className="h-4 w-4" aria-hidden />
                </Button>
                {isOwner && (
                  <>
                    <Button size="sm" variant="ghost" aria-label={`Edit ${p.name}`} onClick={() => setAction({ kind: "edit", product: p })}>
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                    {p.status !== "discontinued" && (
                      <Button size="sm" variant="ghost" aria-label={`Discontinue ${p.name}`} onClick={() => setAction({ kind: "discontinue", product: p })}>
                        <Ban className="h-4 w-4" aria-hidden />
                      </Button>
                    )}
                  </>
                )}
              </div>
            ),
          } satisfies Column<Product>,
        ]
      : []),
  ];

  const cats = categories.data ?? [];
  const reset = () => setOffset(0);

  return (
    <>
      <PageHeader
        title="Products & Menu"
        description={
          isOwner
            ? "Manage the menu, prices and stock."
            : isManagerUp
              ? "Update prices and stock. Adding or editing menu items is an owner task."
              : "The current menu and what is in stock."
        }
        actions={
          isOwner ? (
            <>
              <Button variant="outline" onClick={() => setManagingCategories(true)}>
                <Layers className="h-4 w-4" aria-hidden /> Categories
              </Button>
              <Button onClick={() => setCreating(true)} disabled={cats.length === 0} title={cats.length === 0 ? "Add a category first" : undefined}>
                <Plus className="h-4 w-4" aria-hidden /> Add product
              </Button>
            </>
          ) : undefined
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Search products"
              placeholder="Search products"
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                reset();
              }}
            />
          </div>
          <Select
            aria-label="Filter by category"
            className="w-44"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              reset();
            }}
          >
            <option value="">All categories</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by status"
            className="w-40"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as "" | ProductStatus);
              reset();
            }}
          >
            <option value="">All statuses</option>
            <option value="available">Available</option>
            <option value="out_of_stock">Out of stock</option>
            <option value="discontinued">Discontinued</option>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => {
                setInStockOnly(e.target.checked);
                reset();
              }}
            />
            In stock only
          </label>
        </div>

        {products.isLoading ? (
          <DefaultSkeleton />
        ) : products.isError ? (
          <ErrorState error={products.error} onRetry={() => void products.refetch()} />
        ) : products.data && products.data.items.length === 0 ? (
          <EmptyState title="No products found" description="Try a different search or filter." />
        ) : products.data ? (
          <>
            <DataTable columns={columns} rows={products.data.items} rowKey={(p) => p.id} />
            <Pagination total={products.data.total} limit={products.data.limit} offset={products.data.offset} onChange={setOffset} />
          </>
        ) : null}
      </Card>

      {isOwner && <ProductCreateDialog open={creating} onOpenChange={setCreating} categories={cats} />}
      {isOwner && <CategoriesDialog open={managingCategories} onOpenChange={setManagingCategories} categories={cats} />}
      {isOwner && action?.kind === "edit" && (
        <ProductEditDialog open onOpenChange={(o) => !o && setAction(null)} product={action.product} categories={cats} />
      )}
      {isManagerUp && action?.kind === "price" && (
        <PriceDialog open onOpenChange={(o) => !o && setAction(null)} product={action.product} />
      )}
      {isManagerUp && action?.kind === "stock" && (
        <StockDialog open onOpenChange={(o) => !o && setAction(null)} product={action.product} />
      )}
      <ConfirmDialog
        open={action?.kind === "discontinue"}
        onOpenChange={(o) => !o && setAction(null)}
        title={`Discontinue ${action?.product.name ?? "product"}?`}
        description="It disappears from the POS menu. Past orders keep their history."
        confirmLabel="Discontinue"
        destructive
        loading={discontinue.isPending}
        onConfirm={() => discontinue.mutate()}
      />
    </>
  );
}

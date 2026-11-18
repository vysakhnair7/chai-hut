import { Check, Minus, Plus, Printer, Search, ShoppingCart, Trash2, UserCheck, UserRound, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/ErrorState";
import { DefaultSkeleton } from "@/components/common/QueryBoundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import { useRole } from "@/hooks/useRole";
import { useCustomerPreferences, useCustomerSearch } from "@/features/customers/hooks";
import { useCategories, useMenu, usePopularProducts } from "@/features/products/hooks";
import type { Product } from "@/types/catalog";
import type { CustomerBasic } from "@/types/customer";
import type { Order } from "@/types/order";
import { ApiError, getErrorMessage } from "@/utils/errors";
import { formatMoney } from "@/utils/format";
import {
  addToCart,
  cartItems,
  cartUnits,
  estimateSubtotalPaise,
  paiseToMoneyString,
  removeFromCart,
  setQuantity,
  type Cart,
} from "./cart";
import { useCreateOrder } from "./hooks";
import { TokenSlip } from "./TokenSlip";

type CustomerMode = "walk_in" | "registered";

export default function PosPage() {
  const { isManagerUp } = useRole();
  const menu = useMenu();
  const categories = useCategories();
  const popular = usePopularProducts();

  const [mode, setMode] = useState<CustomerMode>("walk_in");
  const [customer, setCustomer] = useState<CustomerBasic | null>(null);
  const [walkInName, setWalkInName] = useState("");
  const [cart, setCart] = useState<Cart>({});
  const [discount, setDiscount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [filter, setFilter] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [maybeCreated, setMaybeCreated] = useState(false);
  const [placed, setPlaced] = useState<Order | null>(null);

  // A ref, not state: a fast double tap must not create two orders before React re-renders the disabled button.
  const submitting = useRef(false);

  const create = useCreateOrder((order) => {
    setPlaced(order);
    setFormError(null);
    setMaybeCreated(false);
  });

  const products = useMemo(() => (menu.data?.items ?? []).filter((p) => p.status !== "discontinued"), [menu.data]);
  const visible = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return products.filter(
      (p) => (!categoryId || p.category_id === categoryId) && (!term || p.name.toLowerCase().includes(term)),
    );
  }, [products, categoryId, filter]);

  const units = cartUnits(cart);
  const estimate = paiseToMoneyString(estimateSubtotalPaise(cart, products));
  const customerBlocked = mode === "registered" && (customer === null || customer.status !== "active");
  const canSubmit = units > 0 && !customerBlocked && !create.isPending;

  const startNewOrder = () => {
    setPlaced(null);
    setCart({});
    setCustomer(null);
    setWalkInName("");
    setDiscount("");
    setFormError(null);
    setMaybeCreated(false);
  };

  const submit = () => {
    if (submitting.current) return;
    submitting.current = true;
    setFormError(null);
    setMaybeCreated(false);
    const trimmedDiscount = discount.trim();
    create.mutate(
      {
        ...(mode === "registered" && customer ? { customer_id: customer.id } : {}),
        ...(mode === "walk_in" && walkInName.trim() ? { walk_in_name: walkInName.trim() } : {}),
        items: cartItems(cart),
        ...(isManagerUp && trimmedDiscount ? { discount_amount: trimmedDiscount } : {}),
      },
      {
        onSettled: () => {
          submitting.current = false;
        },
        onError: (error) => {
          // The cart is kept so nothing has to be re-entered.
          setFormError(getErrorMessage(error));
          // A network failure means we cannot know whether the order was saved.
          setMaybeCreated(error instanceof ApiError && error.status === 0);
        },
      },
    );
  };

  if (placed) {
    return <OrderPlaced order={placed} onNewOrder={startNewOrder} />;
  }

  return (
    <>
      <PageHeader title="New order" description="Pick the customer, add items, then place the order." />
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2" role="group" aria-label="Customer type">
                <Button variant={mode === "walk_in" ? "default" : "outline"} size="sm" aria-pressed={mode === "walk_in"} onClick={() => setMode("walk_in")}>
                  <UserRound className="h-4 w-4" aria-hidden /> Walk-in
                </Button>
                <Button variant={mode === "registered" ? "default" : "outline"} size="sm" aria-pressed={mode === "registered"} onClick={() => setMode("registered")}>
                  <UserCheck className="h-4 w-4" aria-hidden /> Registered customer
                </Button>
              </div>
              {mode === "walk_in" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="walk-in-name">Name to call out (optional)</Label>
                  <Input id="walk-in-name" maxLength={80} value={walkInName} onChange={(e) => setWalkInName(e.target.value)} />
                </div>
              ) : (
                <CustomerPicker
                  customer={customer}
                  onSelect={setCustomer}
                  products={products}
                  onAddProduct={(id) => setCart((c) => addToCart(c, id, products.find((p) => p.id === id)?.stock_quantity))}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Menu</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex flex-wrap gap-2">
                <div className="relative min-w-[10rem] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input aria-label="Find a product" placeholder="Find a product" className="pl-9" value={filter} onChange={(e) => setFilter(e.target.value)} />
                </div>
                <Select aria-label="Category" className="w-44" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">All categories</option>
                  {(categories.data ?? []).filter((c) => c.status === "active").map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              {popular.data && popular.data.length > 0 && (
                <div className="mb-3" aria-label="Popular items">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Popular</p>
                  <div className="flex flex-wrap gap-2">
                    {popular.data
                      .filter((p) => p.is_available)
                      .map((p) => {
                        const item = products.find((x) => x.id === p.product_id);
                        return (
                          <Button
                            key={p.product_id}
                            size="sm"
                            variant="secondary"
                            aria-label={`Add ${p.name}, popular`}
                            disabled={!item || item.stock_quantity <= 0}
                            onClick={() => setCart((c) => addToCart(c, p.product_id, item?.stock_quantity))}
                          >
                            {p.name}
                          </Button>
                        );
                      })}
                  </div>
                </div>
              )}
              {menu.isLoading ? (
                <DefaultSkeleton />
              ) : menu.isError ? (
                <ErrorState error={menu.error} onRetry={() => void menu.refetch()} />
              ) : visible.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No products match.</p>
              ) : (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {visible.map((p) => (
                    <li key={p.id}>
                      <ProductTile product={p} inCart={cart[p.id] ?? 0} onAdd={() => setCart((c) => addToCart(c, p.id, p.stock_quantity))} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <aside aria-label="Current order" className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" aria-hidden /> Order
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {units === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Tap items on the menu to add them.</p>
              ) : (
                <ul className="divide-y">
                  {Object.entries(cart).map(([id, qty]) => {
                    const p = products.find((x) => x.id === id);
                    if (!p) return null;
                    return (
                      <li key={id} className="flex items-center justify-between gap-2 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{formatMoney(p.mrp)} each</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="outline" className="h-8 w-8" aria-label={`Decrease ${p.name}`} onClick={() => setCart((c) => setQuantity(c, id, qty - 1, p.stock_quantity))}>
                            <Minus className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                          <span className="w-7 text-center text-sm font-semibold tabular-nums" aria-label={`${p.name} quantity`}>
                            {qty}
                          </span>
                          <Button size="icon" variant="outline" className="h-8 w-8" aria-label={`Increase ${p.name}`} disabled={qty >= p.stock_quantity} onClick={() => setCart((c) => addToCart(c, id, p.stock_quantity))}>
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Remove ${p.name}`} onClick={() => setCart((c) => removeFromCart(c, id))}>
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="flex items-baseline justify-between border-t pt-3 text-sm">
                <span>
                  Items <strong>{units}</strong>
                </span>
                <span className="text-right">
                  <span className="block text-xs text-muted-foreground">Estimate before GST</span>
                  <strong className="text-base tabular-nums" data-testid="estimate">
                    {formatMoney(estimate)}
                  </strong>
                </span>
              </div>
              <p className="text-xs text-muted-foreground">The final bill, with GST, is calculated by the server when you place the order.</p>

              {isManagerUp && (
                <div className="space-y-1.5">
                  <Label htmlFor="discount">Discount (₹, optional)</Label>
                  <Input id="discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                </div>
              )}

              {mode === "registered" && customer === null && (
                <p className="text-xs font-medium text-warning">Select a registered customer, or switch to Walk-in.</p>
              )}
              {mode === "registered" && customer && customer.status !== "active" && (
                <p role="alert" className="text-xs font-medium text-danger">This customer is inactive and cannot place orders.</p>
              )}
              {formError && (
                <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
                  {formError}
                </p>
              )}
              {maybeCreated && (
                <p role="alert" className="rounded-md bg-warning/15 px-3 py-2 text-sm font-medium text-warning">
                  The connection dropped, so this order may already exist. Check Active Orders before placing it again.
                </p>
              )}

              <Button size="lg" className="w-full" disabled={!canSubmit} loading={create.isPending} onClick={submit}>
                Place order
              </Button>
              {units > 0 && (
                <Button variant="ghost" className="w-full" onClick={() => setCart({})} disabled={create.isPending}>
                  <X className="h-4 w-4" aria-hidden /> Clear order
                </Button>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}

function ProductTile({ product, inCart, onAdd }: { product: Product; inCart: number; onAdd: () => void }) {
  const soldOut = product.status !== "available" || product.stock_quantity <= 0;
  const atLimit = inCart >= product.stock_quantity;
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={soldOut || atLimit}
      className="relative flex min-h-[5.5rem] w-full flex-col justify-between rounded-lg border bg-surface p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="text-sm font-semibold leading-tight">{product.name}</span>
      <span className="mt-2 flex items-end justify-between gap-2 text-xs">
        <span className="font-medium tabular-nums">{formatMoney(product.mrp)}</span>
        {soldOut ? <Badge tone="warning">Out of stock</Badge> : <span className="text-muted-foreground">{product.stock_quantity} left</span>}
      </span>
      {inCart > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-accent-foreground" aria-label={`${inCart} in order`}>
          {inCart}
        </span>
      )}
    </button>
  );
}

interface CustomerPickerProps {
  customer: CustomerBasic | null;
  onSelect: (c: CustomerBasic | null) => void;
  products: Product[];
  onAddProduct: (productId: string) => void;
}

function CustomerPicker({ customer, onSelect, products, onAddProduct }: CustomerPickerProps) {
  const [term, setTerm] = useState("");
  const debounced = useDebounce(term.trim());
  const results = useCustomerSearch(debounced, customer === null);

  if (customer) {
    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2 rounded-md border bg-muted/40 p-3">
          <div>
            <p className="font-semibold">{customer.full_name}</p>
            <p className="text-sm text-muted-foreground">{customer.company_name}</p>
            {customer.status !== "active" && <Badge tone="danger" className="mt-1">Inactive</Badge>}
          </div>
          <Button size="sm" variant="outline" onClick={() => onSelect(null)}>
            Change
          </Button>
        </div>
        <CustomerPreferenceQuickAdd customerId={customer.id} products={products} onAdd={onAddProduct} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="customer-search">Search by name, phone, username or Chai ID</Label>
      <Input id="customer-search" autoComplete="off" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Type at least 2 characters" />
      {debounced.length >= 2 &&
        (results.isLoading ? (
          <p className="text-sm text-muted-foreground">Searching…</p>
        ) : results.isError ? (
          <p role="alert" className="text-sm text-danger">{getErrorMessage(results.error)}</p>
        ) : results.data && results.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No registered customer found. Use Walk-in, or ask a manager to register them.</p>
        ) : (
          <ul className="divide-y rounded-md border" aria-label="Matching customers">
            {(results.data ?? []).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                  onClick={() => onSelect(c)}
                >
                  <span>
                    <span className="block text-sm font-medium">{c.full_name}</span>
                    <span className="block text-xs text-muted-foreground">{c.company_name}</span>
                  </span>
                  {c.status !== "active" ? <Badge tone="danger">Inactive</Badge> : <Check className="h-4 w-4 text-muted-foreground" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

/** Shows the customer's Saved Regular and Most Frequent separately, each with a one-tap add. */
function CustomerPreferenceQuickAdd({ customerId, products, onAdd }: { customerId: string; products: Product[]; onAdd: (id: string) => void }) {
  const prefs = useCustomerPreferences(customerId);
  if (prefs.isLoading) return <p className="text-sm text-muted-foreground">Loading preferences…</p>;
  if (prefs.isError) return <p className="text-sm text-muted-foreground">Preferences are unavailable right now.</p>;
  if (!prefs.data) return null;
  const { saved_regular, most_frequent } = prefs.data;

  const row = (label: string, product: { product_id: string; product_name: string; is_available: boolean } | null, extra?: string) => {
    const onMenu = product ? products.some((p) => p.id === product.product_id && p.status === "available" && p.stock_quantity > 0) : false;
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          {product ? (
            <p className="truncate text-sm font-medium">
              {product.product_name}
              {extra && <span className="ml-1 font-normal text-muted-foreground">{extra}</span>}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">None yet</p>
          )}
        </div>
        {product && (
          <Button size="sm" variant="accent" disabled={!product.is_available || !onMenu} onClick={() => onAdd(product.product_id)}>
            {product.is_available && onMenu ? "Add" : "Unavailable"}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {row("Saved regular", saved_regular)}
      {row("Most frequent", most_frequent, most_frequent ? `(${most_frequent.orders_with_product} of ${most_frequent.total_completed_orders})` : undefined)}
    </div>
  );
}

function OrderPlaced({ order, onNewOrder }: { order: Order; onNewOrder: () => void }) {
  const { isManagerUp } = useRole();
  const label = order.customer ? order.customer.full_name : order.walk_in_name;
  return (
    <>
      <PageHeader title="Order placed" description="Hand over the token and start preparing." actions={
        <div className="no-print flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden /> Print token
          </Button>
          <Button onClick={onNewOrder}>New order</Button>
        </div>
      } />
      <TokenSlip token={order.order_token} customerLabel={label} items={order.items} createdAt={order.created_at} />
      {isManagerUp && (
        <p className="no-print mt-4 text-center text-sm text-muted-foreground">
          Bill total (from server): <strong className="tabular-nums">{formatMoney(order.total_amount)}</strong> · Invoice {order.invoice_number}
        </p>
      )}
    </>
  );
}

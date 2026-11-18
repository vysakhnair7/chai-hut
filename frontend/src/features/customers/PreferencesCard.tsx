import { Heart, TrendingUp } from "lucide-react";
import { useState } from "react";
import { ErrorState } from "@/components/common/ErrorState";
import { DefaultSkeleton } from "@/components/common/QueryBoundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { useRole } from "@/hooks/useRole";
import { formatPercent, pluralize } from "@/utils/format";
import { useMenu } from "@/features/products/hooks";
import { useClearRegular, useCustomerPreferences, useSetRegular } from "./hooks";

/**
 * Two different things, shown separately on purpose:
 *  - Saved Regular: the drink staff chose to store for this customer (manager/owner can change it).
 *  - Most Frequent: calculated by the backend from completed orders. Never edited by hand.
 */
export function PreferencesCard({ customerId }: { customerId: string }) {
  const { isManagerUp } = useRole();
  const prefs = useCustomerPreferences(customerId);
  const menu = useMenu();
  const setRegular = useSetRegular(customerId);
  const clearRegular = useClearRegular(customerId);
  const [selected, setSelected] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>What this customer usually has.</CardDescription>
      </CardHeader>
      <CardContent>
        {prefs.isLoading ? (
          <DefaultSkeleton />
        ) : prefs.isError ? (
          <ErrorState error={prefs.error} onRetry={() => void prefs.refetch()} />
        ) : prefs.data ? (
          <div className="space-y-4">
            <section aria-label="Saved regular">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Heart className="h-3.5 w-3.5" aria-hidden /> Saved regular
              </p>
              {prefs.data.saved_regular ? (
                <p className="font-medium">
                  {prefs.data.saved_regular.product_name}
                  {!prefs.data.saved_regular.is_available && <Badge tone="warning" className="ml-2">Unavailable now</Badge>}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">None saved.</p>
              )}
              {isManagerUp && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Select
                    aria-label="Choose saved regular"
                    className="w-56"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    <option value="">Choose a product…</option>
                    {(menu.data?.items ?? [])
                      .filter((p) => p.status !== "discontinued")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </Select>
                  <Button
                    size="sm"
                    disabled={!selected}
                    loading={setRegular.isPending}
                    onClick={() => setRegular.mutate(selected, { onSuccess: () => setSelected("") })}
                  >
                    Save as regular
                  </Button>
                  {prefs.data.saved_regular && (
                    <Button size="sm" variant="outline" loading={clearRegular.isPending} onClick={() => clearRegular.mutate()}>
                      Clear
                    </Button>
                  )}
                </div>
              )}
            </section>

            <section aria-label="Most frequent">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden /> Most frequent
              </p>
              {prefs.data.most_frequent ? (
                <p className="font-medium">
                  {prefs.data.most_frequent.product_name}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    in {pluralize(prefs.data.most_frequent.orders_with_product, "order")} of{" "}
                    {prefs.data.most_frequent.total_completed_orders} ({formatPercent(prefs.data.most_frequent.share_pct)})
                  </span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Not enough completed orders yet.</p>
              )}
              {prefs.data.top_products.length > 1 && (
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {prefs.data.top_products.map((p) => (
                    <li key={p.product_id}>
                      {p.product_name}: {pluralize(p.orders_with_product, "order")}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

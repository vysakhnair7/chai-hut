import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";

interface QueryLike<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

interface QueryBoundaryProps<T> {
  query: QueryLike<T>;
  children: (data: T) => ReactNode;
  /** Custom loading placeholder. Defaults to three skeleton rows. */
  loading?: ReactNode;
  /** When it returns true, `empty` is shown instead of children. */
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
}

export function DefaultSkeleton() {
  return (
    <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-2/3" />
    </div>
  );
}

/** One place that renders the loading / error / empty / success states for a query. */
export function QueryBoundary<T>({
  query,
  children,
  loading,
  isEmpty,
  empty,
}: QueryBoundaryProps<T>) {
  if (query.isLoading) return <>{loading ?? <DefaultSkeleton />}</>;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data === undefined) return null;
  if (isEmpty?.(query.data)) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  return <>{children(query.data)}</>;
}

/**
 * Skeleton loaders.
 *
 * Building blocks for loading.tsx files. Uses pure CSS shimmer (no JS), Tailwind-only.
 *
 * The inline-row primitives (SkeletonRow, SkeletonCard, SkeletonList) live in
 * `components/ui/empty-state.tsx` so the EmptyState + Skeleton design language
 * shares one home. We re-export here so callers can grab everything from a
 * single import.
 */

export { SkeletonRow, SkeletonCard, SkeletonList } from "@/components/ui/empty-state";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted/60 ${className}`} aria-hidden="true" />;
}

/** Grid of card-shaped skeletons — for Portfolio / Production photo grid */
export function GridCardSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid gap-2 sm:gap-2.5 md:gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
          <Skeleton className="h-[100px] md:h-[120px] rounded-none" />
          <div className="p-2 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <div className="px-2 pb-1.5">
            <Skeleton className="h-2 w-2/3" />
          </div>
          <div className="px-2 py-1.5 border-t border-border flex justify-between">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-8" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** KPI strip skeleton */
export function KpiStripSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-3.5 space-y-2">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-2.5 w-3/4" />
        </div>
      ))}
    </div>
  );
}

/** List row skeleton — for Customers / Sales tables */
export function ListRowSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <Skeleton className="h-3 w-16 shrink-0" />
          <Skeleton className="h-3 w-12 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Page header skeleton — title + subtitle + actions */
export function PageHeaderSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-3 w-32" />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  );
}

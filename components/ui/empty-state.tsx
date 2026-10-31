import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * EmptyState — unified "no data" pattern.
 *
 * Use anywhere a list, table, tab, modal or section has nothing to show.
 * Variants:
 *  - size="sm" → inline empty (audit log, notes tab, sidebar widget)
 *  - size="md" → default (search no-results, list pages)
 *  - size="lg" → full page (404, big dashboards)
 *
 * Provides icon avatar · title · helper · 1-3 CTAs (primary or outline).
 */
export interface EmptyStateAction {
  label: string;
  href: string;
  icon?: React.ReactNode;
  variant?: "primary" | "outline";
}

export function EmptyState({
  icon,
  title,
  helper,
  actions,
  size = "md",
  className
}: {
  icon: React.ReactNode;
  title: string;
  helper?: string;
  actions?: EmptyStateAction[];
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizing = {
    sm: { padding: "px-3 py-6", avatar: "h-9 w-9 mb-2", title: "text-[13px]", helper: "text-[12px] max-w-[260px]" },
    md: { padding: "px-4 py-10", avatar: "h-12 w-12 mb-3", title: "text-[14px]", helper: "text-[12px] max-w-[300px]" },
    lg: { padding: "px-6 py-16", avatar: "h-16 w-16 mb-4", title: "text-[16px]", helper: "text-[13px] max-w-[420px]" }
  }[size];

  return (
    <div className={cn("text-center", sizing.padding, className)}>
      <div
        className={cn(
          "mx-auto rounded-full bg-[hsl(var(--surface-muted))] flex items-center justify-center text-muted-foreground/60",
          sizing.avatar
        )}
      >
        {icon}
      </div>
      <p className={cn("font-semibold text-foreground", sizing.title)}>{title}</p>
      {helper && <p className={cn("text-muted-foreground mt-1 mx-auto", sizing.helper)}>{helper}</p>}
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {actions.map((a, i) => (
            <Link
              key={i}
              href={a.href}
              className={cn(
                "text-[12px] px-3 py-1.5 rounded-md font-medium inline-flex items-center gap-1.5 min-h-[44px] lg:min-h-0",
                a.variant === "outline"
                  ? "border border-border hover:bg-muted text-foreground"
                  : "border border-[hsl(var(--primary))]/30 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-soft))] hover:text-[hsl(var(--primary-dark))]"
              )}
            >
              {a.icon}
              {a.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * SkeletonRow — shimmer placeholder for a single list item.
 * Use 3-5 of these stacked while a list is loading.
 */
export function SkeletonRow({
  avatar = true,
  lines = 2,
  className
}: {
  avatar?: boolean;
  lines?: 1 | 2;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-3 py-2.5 min-h-[44px]", className)}>
      {avatar && <div className="h-4 w-4 rounded bg-muted animate-pulse shrink-0" />}
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
        {lines === 2 && <div className="h-2.5 bg-muted rounded animate-pulse w-1/3" />}
      </div>
    </div>
  );
}

/**
 * SkeletonCard — shimmer placeholder for a card-shaped item (gallery tile, customer card).
 */
export function SkeletonCard({
  aspect = "square",
  className
}: {
  aspect?: "square" | "portrait" | "wide";
  className?: string;
}) {
  const aspectClass = aspect === "portrait" ? "aspect-[4/5]" : aspect === "wide" ? "aspect-[16/9]" : "aspect-square";
  return (
    <div className={cn("rounded-lg border border-border bg-card overflow-hidden", className)}>
      <div className={cn("bg-muted animate-pulse", aspectClass)} />
      <div className="p-2 space-y-1.5">
        <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
        <div className="h-2.5 bg-muted rounded animate-pulse w-1/3" />
      </div>
    </div>
  );
}

/**
 * SkeletonList — convenience: render N SkeletonRows with optional header.
 */
export function SkeletonList({ count = 5, title, className }: { count?: number; title?: string; className?: string }) {
  return (
    <div className={className}>
      {title && (
        <p className="px-3 sm:px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      )}
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

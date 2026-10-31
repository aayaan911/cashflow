import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The gold-standard form layout (app/(app)/production/[id]/edit/page.tsx), shared so every add and
 * edit form reads the same: numbered sections with an icon tile, one Field per control (icon, label,
 * hint), and on phones a sticky save bar that submits the form through the HTML5 `form=` attribute.
 * Server components; no client code.
 */

export function FormSection({
  number,
  icon,
  title,
  description,
  badge,
  badgeTone = "green",
  children,
  className
}: {
  number?: number;
  /** Category icon in a soft green tile beside the number. */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Right-side chip, e.g. "Required" or "৳25,000". */
  badge?: string;
  badgeTone?: "green" | "red";
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card shadow-[var(--shadow-1)]", className)}>
      <header className="flex items-center gap-3 rounded-t-2xl border-b border-border bg-gradient-to-r from-[hsl(var(--surface-muted))]/50 to-[hsl(var(--surface-muted))]/20 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <div className="inline-flex shrink-0 items-center gap-1.5">
          {number !== undefined && (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--primary-fill))] text-[12px] font-bold text-[hsl(var(--primary-foreground))]">
              {number}
            </span>
          )}
          {icon && (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary-dark))] [&>svg]:h-4 [&>svg]:w-4">
              {icon}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>}
        </div>
        {badge && (
          <span
            className={cn(
              "hidden shrink-0 items-center rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider sm:inline-flex",
              badgeTone === "red"
                ? "border-[hsl(var(--destructive))]/20 bg-[hsl(var(--destructive-soft))] text-[hsl(var(--destructive))]"
                : "border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary-dark))]"
            )}
          >
            {badge}
          </span>
        )}
      </header>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function FormField({
  icon,
  label,
  htmlFor,
  hint,
  optional,
  children,
  className
}: {
  icon?: ReactNode;
  label: string;
  /** The control's id. Omit for a group (pills), whose radiogroup carries its own name. */
  htmlFor?: string;
  hint?: ReactNode;
  /** Adds a quiet "optional" after the label. */
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const text = (
    <>
      {icon && <span className="text-muted-foreground [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
      {label}
      {optional && <span className="font-normal text-muted-foreground">optional</span>}
    </>
  );
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      {htmlFor ? (
        <label className="flex items-center gap-1.5 text-[13px] font-medium text-foreground" htmlFor={htmlFor}>
          {text}
        </label>
      ) : (
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">{text}</p>
      )}
      {children}
      {hint && <div className="text-[12px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

/**
 * The phone save bar: fixed to the bottom under `lg`, buttons reach the form through `form=`. The
 * page adds bottom padding (pb-24) so the last field is never hidden under it.
 */
export function StickySaveBar({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 flex gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      {children}
    </div>
  );
}

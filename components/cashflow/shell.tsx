import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { cn } from "@/lib/utils";
import { monthLabel, shiftMonth } from "@/lib/cashflow";

/** The page frame every Cashflow page uses: topbar, then the 1360px column with the shell's spacing. */
export function Page({
  title,
  add,
  children,
  narrow = false
}: {
  title: string;
  add?: ReactNode;
  children: ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className="min-h-screen">
      <Topbar title={title} revealOnScroll add={add} />
      <div
        className={cn(
          "px-4 sm:px-6 lg:px-8 pt-2.5 pb-4 sm:pt-[22px] sm:pb-6 space-y-3.5 sm:space-y-[18px] mx-auto",
          narrow ? "max-w-[860px]" : "max-w-[1360px]"
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function Card({
  title,
  sub,
  action,
  children,
  className,
  bodyClass
}: {
  title?: string;
  sub?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={cn("rounded-[14px] border border-border bg-card shadow-[var(--shadow-1)]", className)}>
      {title && (
        <div className="flex items-start justify-between gap-2.5 px-[18px] pt-4">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h3>
            {sub && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn("px-[18px] pb-4 pt-3.5", bodyClass)}>{children}</div>
    </section>
  );
}

/** Underlined link tabs (prototype v4): one row, scrolls on a phone. */
export function LinkTabs({
  tabs,
  current
}: {
  tabs: { href: string; label: string; icon?: ReactNode }[];
  current: string;
}) {
  return (
    <div className="-mx-0.5 flex gap-0.5 overflow-x-auto border-b border-border scrollbar-none [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => {
        const on = t.href === current;
        return (
          <Link
            key={t.href}
            href={t.href}
            prefetch={false}
            aria-current={on ? "page" : undefined}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 text-[13px] font-medium -mb-px",
              on
                ? "border-[hsl(var(--primary-fill))] font-semibold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.icon}
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

export const chipClass =
  "inline-flex h-[30px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-[11px] text-[12.5px] font-medium hover:bg-muted";
export const chipOnClass =
  "border-[hsl(var(--primary-soft))] bg-[hsl(var(--primary-soft))] font-semibold text-[hsl(var(--primary-dark))] hover:bg-[hsl(var(--primary-soft))]";

/** ‹ November 2026 › plus optional filter chips, all as links so the page stays a Server Component. */
export function MonthChips({ month, base, children }: { month: string; base: string; children?: ReactNode }) {
  const link = (m: string) => `${base}${base.includes("?") ? "&" : "?"}m=${m}`;
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none [&::-webkit-scrollbar]:hidden">
      <Link
        href={link(shiftMonth(month, -1))}
        prefetch={false}
        className={cn(chipClass, "w-[30px] justify-center px-0")}
        aria-label="Previous month"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </Link>
      <span className={cn(chipClass, chipOnClass)}>{monthLabel(month)}</span>
      <Link
        href={link(shiftMonth(month, 1))}
        prefetch={false}
        className={cn(chipClass, "w-[30px] justify-center px-0")}
        aria-label="Next month"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
      {children && <span className="w-1.5 shrink-0" aria-hidden />}
      {children}
    </div>
  );
}

export function Chip({ href, on, children }: { href: string; on?: boolean; children: ReactNode }) {
  return (
    <Link href={href} prefetch={false} className={cn(chipClass, on && chipOnClass)}>
      {children}
    </Link>
  );
}

/** The goal-gradient bar, tone by how much is used. */
export function Bar({
  pct,
  tone,
  className
}: {
  pct: number;
  tone?: "amber" | "red" | "info" | "purple" | "green";
  className?: string;
}) {
  const fill =
    tone === "red"
      ? "bg-[hsl(var(--destructive))]"
      : tone === "amber"
        ? "bg-[hsl(var(--amber))]"
        : tone === "info"
          ? "bg-[hsl(var(--info))]"
          : tone === "purple"
            ? "bg-[hsl(var(--purple))]"
            : "bg-[hsl(var(--primary))]";
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--track))]", className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", fill)}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}
export function usedTone(p: number): "red" | "amber" | "green" {
  return p >= 90 ? "red" : p >= 75 ? "amber" : "green";
}

/** A list row: icon, title + line, right value. */
export function Row({
  icon,
  title,
  line,
  right,
  action,
  bar
}: {
  icon?: ReactNode;
  title: ReactNode;
  line?: ReactNode;
  right?: ReactNode;
  action?: ReactNode;
  bar?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-border py-[11px] first:border-t-0">
      {icon}
      <div className="min-w-0 flex-1">
        <b className="block truncate text-[13.5px] font-[650]">{title}</b>
        {line && <small className="mt-px block text-[12px] text-muted-foreground">{line}</small>}
        {bar}
      </div>
      {right && <div className="shrink-0 text-right tabular-nums">{right}</div>}
      {action}
    </div>
  );
}

export function Empty({ title, line }: { title: string; line: string }) {
  return (
    <div className="px-4 py-9 text-center">
      <p className="text-[14px] font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-[320px] text-[12.5px] text-muted-foreground">{line}</p>
    </div>
  );
}

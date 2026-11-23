import Link from "next/link";
import type { ReactNode } from "react";
import { takaCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

/*
 * Hand-rolled bars in the dashboard's own style (no chart library, CLAUDE.md): rounded tops, token colours,
 * every bar carries its value in a title for hover and screen readers, and the figure that matters is
 * printed as text beside it, so the colour is never the only signal.
 */

export function Legend({ items }: { items: { label: string; className: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] text-muted-foreground">
      {items.map((i) => (
        <span key={i.label}>
          <i className={cn("mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] align-[-1px]", i.className)} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Two bars per column (income and spending), with a red dot under a column that needs a look. */
export function PairBars({
  points,
  a,
  b,
  height = 190,
  label
}: {
  points: { key: string; label: string; a: number; b: number; href?: string; flag?: boolean; on?: boolean }[];
  a: { name: string; className: string };
  b: { name: string; className: string };
  height?: number;
  label: string;
}) {
  const max = Math.max(1, ...points.flatMap((p) => [p.a, p.b]));
  return (
    <div role="img" aria-label={label} className="flex items-end gap-1 sm:gap-1.5 pt-4" style={{ height }}>
      {points.map((p) => {
        const col = (
          <>
            <span className="flex h-full w-full items-end justify-center gap-[2px] sm:gap-[3px]">
              <i
                title={`${p.label} ${a.name} ${takaCompact(p.a)}`}
                className={cn("block w-[45%] max-w-[20px] rounded-t-[4px]", a.className)}
                style={{ height: `${p.a ? Math.max(2, (p.a / max) * 100) : 0}%` }}
              />
              <i
                title={`${p.label} ${b.name} ${takaCompact(p.b)}`}
                className={cn("block w-[45%] max-w-[20px] rounded-t-[4px]", b.className)}
                style={{ height: `${p.b ? Math.max(2, (p.b / max) * 100) : 0}%` }}
              />
            </span>
            <span
              className={cn(
                "mt-1.5 text-[11px] leading-none",
                p.on ? "font-semibold text-foreground" : "text-muted-foreground"
              )}
            >
              {p.label}
            </span>
            <span
              className={cn("mt-1 h-1.5 w-1.5 rounded-full", p.flag ? "bg-destructive" : "bg-transparent")}
              aria-hidden
            />
          </>
        );
        return p.href ? (
          <Link
            key={p.key}
            href={p.href}
            prefetch={false}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
          >
            {col}
          </Link>
        ) : (
          <div key={p.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            {col}
          </div>
        );
      })}
    </div>
  );
}

/** One bar per column around a zero line: kept money up in green, a loss down in red. */
export function SignedBars({
  points,
  height = 230,
  label
}: {
  points: { key: string; label: string; value: number; href?: string }[];
  height?: number;
  label: string;
}) {
  const up = Math.max(0, ...points.map((p) => p.value));
  const down = Math.max(0, ...points.map((p) => -p.value));
  const span = Math.max(1, up + down);
  const upPct = (up / span) * 100;
  return (
    <div role="img" aria-label={label} className="relative" style={{ height }}>
      <div className="absolute inset-x-0 bottom-5 top-5" aria-hidden>
        <div className="absolute inset-x-0 border-t border-dashed border-border" style={{ top: `${upPct}%` }} />
      </div>
      <div className="absolute inset-x-0 bottom-5 top-5 flex gap-2">
        {points.map((p) => {
          const h = (Math.abs(p.value) / span) * 100;
          const pos = p.value >= 0;
          const inner = (
            <>
              <span
                className={cn(
                  "absolute left-1/2 w-[56%] max-w-[34px] -translate-x-1/2",
                  pos ? "rounded-t-[4px] bg-[hsl(var(--primary))]" : "rounded-b-[4px] bg-destructive"
                )}
                style={pos ? { bottom: `${100 - upPct}%`, height: `${h}%` } : { top: `${upPct}%`, height: `${h}%` }}
                title={`${p.label} ${takaCompact(p.value)}`}
              />
              <span
                className={cn(
                  "absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10.5px]",
                  pos ? "text-[hsl(var(--primary-dark))]" : "text-destructive"
                )}
                style={pos ? { bottom: `calc(${100 - upPct + h}% + 2px)` } : { top: `calc(${upPct + h}% + 2px)` }}
              >
                {takaCompact(p.value)}
              </span>
            </>
          );
          return p.href ? (
            <Link key={p.key} href={p.href} prefetch={false} className="relative min-w-0 flex-1">
              {inner}
            </Link>
          ) : (
            <div key={p.key} className="relative min-w-0 flex-1">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A ranked list with a bar under each name: categories, payers. */
export function HBars({
  rows,
  label
}: {
  rows: { key: string; name: ReactNode; minor: number; right?: ReactNode; strong?: boolean; href?: string }[];
  label: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.minor));
  return (
    <div role="img" aria-label={label} className="divide-y divide-border">
      {rows.map((r) => {
        const body = (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-2.5">
            <div className="min-w-0">
              <div className={cn("truncate text-[13px]", r.strong && "font-semibold")}>{r.name}</div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--track))]">
                <div
                  className={cn(
                    "h-full rounded-full",
                    r.strong ? "bg-destructive" : "bg-[hsl(var(--foreground)/0.38)]"
                  )}
                  style={{ width: `${Math.max(r.minor ? 1.5 : 0, (r.minor / max) * 100)}%` }}
                />
              </div>
            </div>
            <div className="text-right">
              {r.right ?? <b className="font-mono text-[13px]">{takaCompact(r.minor)}</b>}
            </div>
          </div>
        );
        return r.href ? (
          <Link key={r.key} href={r.href} prefetch={false} className="block hover:bg-muted/40">
            {body}
          </Link>
        ) : (
          <div key={r.key}>{body}</div>
        );
      })}
    </div>
  );
}

/** The 0 to 100% gauge with the two thresholds marked. */
export function Gauge({ pct, tone }: { pct: number; tone: "good" | "warn" | "bad" }) {
  const fill =
    tone === "bad" ? "bg-destructive" : tone === "warn" ? "bg-[hsl(var(--amber))]" : "bg-[hsl(var(--primary))]";
  return (
    <div className="relative mt-2 h-2.5 w-full rounded-full bg-[hsl(var(--track))]">
      <div className={cn("h-full rounded-full", fill)} style={{ width: `${Math.min(100, pct)}%` }} />
      <i className="absolute top-[-3px] h-[16px] w-px bg-border" style={{ left: "40%" }} aria-hidden />
      <i className="absolute top-[-3px] h-[16px] w-px bg-border" style={{ left: "60%" }} aria-hidden />
    </div>
  );
}

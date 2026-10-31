import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type KpiTone = "default" | "good" | "warn" | "bad";

export interface KpiItem {
  label: string;
  value: ReactNode;
  /** One short line of context under the value. */
  sub?: ReactNode;
  /** Colour goes on the number only, never on the tile (prototype v3 rule 3). */
  tone?: KpiTone;
  /** When set the whole tile is a link to the page or folder that explains the number. */
  href?: string;
}

const toneClass: Record<KpiTone, string> = {
  default: "text-foreground",
  good: "text-[hsl(var(--primary-dark))]",
  warn: "text-[hsl(var(--amber-text))]",
  bad: "text-destructive"
};

/**
 * KpiStrip (prototype v3 rule 3, 2026-09-27): four numbers in one bordered strip, two per row on a
 * phone. Sentence-case labels, no icons, no tinted backgrounds. Replaces the three KPI systems the
 * app had (StatCard tiles, the Portfolio/Production KpiTile strip, AviaryPulse) on the pages that
 * adopt it. Wrapping grids use sm:divide-x, never divide-x (CLAUDE.md section 7).
 */
export function KpiStrip({ items, className }: { items: KpiItem[]; className?: string }) {
  return (
    <div
      // A tile that links to one record (Top buyer, Largest payment) is a shortcut, not a row of the list:
      // the popup's previous / next and "N of M" skip links in here.
      data-peek-skip=""
      className={cn(
        "grid grid-cols-2 sm:grid-cols-4 rounded-[14px] border border-border bg-card shadow-[var(--shadow-1)] overflow-hidden",
        className
      )}
    >
      {items.map((k, i) => {
        const inner = (
          <>
            {/* Prototype v4 .kpi: label 13/500, value 25px (20px on a phone) at line-height 1.15, the
                sub line wraps on a phone and truncates on desktop. */}
            <span className="block text-[12px] sm:text-[13px] font-medium text-muted-foreground truncate">
              {k.label}
            </span>
            <span
              className={cn(
                "block text-[19px] sm:text-[25px] font-bold tracking-[-0.035em] leading-[1.15] mt-0.5 sm:mt-1 truncate",
                toneClass[k.tone ?? "default"]
              )}
            >
              {k.value}
            </span>
            {/* The sub line is desktop only (2026-10-28): on a phone the four tiles are label and number, half
                the height, so the list starts on the first screen. */}
            {k.sub && (
              <span className="hidden sm:block text-[12.5px] text-muted-foreground mt-0.5 sm:truncate">{k.sub}</span>
            )}
          </>
        );
        const cell = cn(
          "block min-w-0 px-3.5 py-2.5 sm:px-5 sm:py-4",
          // hairlines: right of every cell except the row's last, and under the first phone row
          i % 2 === 0 && "border-r border-border",
          "sm:border-r sm:[&:nth-child(4n)]:border-r-0",
          i < 2 && items.length > 2 && "border-b border-border sm:border-b-0"
        );
        return k.href ? (
          <Link
            key={k.label}
            href={k.href}
            prefetch={false}
            className={cn(cell, "hover:bg-muted/50 transition-colors")}
          >
            {inner}
          </Link>
        ) : (
          <div key={k.label} className={cell}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

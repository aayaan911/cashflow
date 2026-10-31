import { bdt } from "@/lib/utils";

/**
 * paidPct — the one place the settled percentage is computed.
 *
 * The denominator is paid + due rather than the sale price, so a repriced or part-allocated
 * deal can never produce a figure over 100 or a negative one. Every surface that shows a
 * settled percentage calls this, so a bar and the caption beside it can never disagree.
 */
export function paidPct(paid: number, due: number): number {
  const total = paid + due;
  if (!Number.isFinite(total) || total <= 0) return 0;
  const pct = Math.max(0, Math.min(100, Math.round((paid / total) * 100)));
  // Money still owed never reads as fully paid, and a first small payment never reads as nothing.
  if (due > 0 && pct >= 100) return 99;
  if (paid > 0 && pct <= 0) return 1;
  return pct;
}

/**
 * PaidProgress — the goal-gradient bar on anything with money still owed.
 *
 * Hull 1932 / Kivetz 2006: effort rises as a goal looks closer. "৳552,000 due" gives a breeder
 * a number to dread; "paid ৳3,078,000 of ৳3,630,000 · 85%" gives them a deal that is nearly
 * finished, and finishing it is one WhatsApp message. Same money, and the second one gets called.
 *
 * Both figures are passed in, never derived here: per-customer money comes from the
 * `customer_dashboard` view and per-deal money from `salePaidSplit()`. The money invariant
 * stays where it belongs.
 */
export function PaidProgress({
  paid,
  due,
  compact = false,
  tone = "default",
  className = ""
}: {
  paid: number;
  due: number;
  /** Bar only, no caption. For dense rows where the amounts are already on screen. */
  compact?: boolean;
  /**
   * `onPrimary` for a bar sitting on a `bg-primary` hero, where a primary bar is green on green.
   * Built from --primary-foreground, not white: that token flips to near-black in dark mode along
   * with the hero's text, and a white bar there measured 1.14:1 against the hero.
   */
  tone?: "default" | "onPrimary" | "due";
  className?: string;
}) {
  const total = paid + due;
  if (total <= 0) return null;
  const pct = paidPct(paid, due);

  const track = tone === "onPrimary" ? "bg-[hsl(var(--primary-foreground)/0.25)]" : "bg-[hsl(var(--track))]";
  // "due": the dashboard's money-first rows draw what is still out in amber (prototype v4), so the
  // bar reads as money in progress rather than a finished green.
  const fill =
    tone === "onPrimary"
      ? "bg-[hsl(var(--primary-foreground)/0.85)]"
      : tone === "due"
        ? "bg-[hsl(var(--amber))]"
        : "bg-[hsl(var(--primary))]";

  return (
    <div className={className}>
      <div
        className={`w-full rounded-full overflow-hidden ${track} ${compact ? (tone === "due" ? "h-[5px]" : "h-1.5") : "h-2"}`}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Paid ${bdt(paid)} of ${bdt(total)}`}
      >
        <div className={`h-full rounded-full transition-[width] duration-500 ${fill}`} style={{ width: `${pct}%` }} />
      </div>
      {!compact && (
        <p className="mt-1 text-[12px] text-muted-foreground">
          paid <span className="font-mono text-foreground">{bdt(paid)}</span> of{" "}
          <span className="font-mono">{bdt(total)}</span> · <span className="font-medium">{pct}%</span>
        </p>
      )}
    </div>
  );
}

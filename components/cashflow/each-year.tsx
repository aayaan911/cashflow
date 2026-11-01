import Link from "next/link";
import { Bar, Card, Empty } from "@/components/cashflow/shell";
import type { Tx } from "@/lib/cashflow";
import type { Ledger } from "@/lib/ledger";
import { taka, takaCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/**
 * Each year (KinBird's yearly tab): one row per year, newest first. The year's total against the best
 * year, the change on the year before, the busiest category, and a twelve-bar strip whose bars open
 * that month. Income or expenses only, never both, so the totals read the same way as the page.
 */
export function EachYear({
  rows,
  kind,
  ledger,
  base
}: {
  rows: Tx[];
  kind: "income" | "expense";
  ledger: Ledger;
  base: string;
}) {
  const byYear = new Map<string, Tx[]>();
  for (const t of rows) {
    const y = t.on.slice(0, 4);
    byYear.set(y, [...(byYear.get(y) ?? []), t]);
  }
  const years = [...byYear.keys()].sort().reverse();
  if (!years.length)
    return (
      <Card title="Each year">
        <Empty title="Nothing recorded yet" line="Years appear here as soon as the first entry is in." />
      </Card>
    );

  const total = (y: string) => (byYear.get(y) ?? []).reduce((s, t) => s + t.bdtMinor, 0);
  const totals = new Map(years.map((y) => [y, total(y)]));
  const max = Math.max(1, ...totals.values());
  const best = years.reduce((a, b) => ((totals.get(b) ?? 0) > (totals.get(a) ?? 0) ? b : a));
  const out = kind === "expense";

  return (
    <Card
      title="Each year"
      sub={`${years.length} ${years.length === 1 ? "year" : "years"}. Best year ${best}, ${taka(totals.get(best) ?? 0)}`}
    >
      <div className="divide-y divide-border">
        {years.map((y, i) => {
          const tx = byYear.get(y) ?? [];
          const sum = totals.get(y) ?? 0;
          const prev = years[i + 1] ? (totals.get(years[i + 1]) ?? 0) : 0;
          const change = prev ? Math.round(((sum - prev) / prev) * 100) : null;
          const months = Array.from({ length: 12 }, (_, m) => {
            const key = `${y}-${String(m + 1).padStart(2, "0")}`;
            return { key, minor: tx.filter((t) => t.on.startsWith(key)).reduce((s, t) => s + t.bdtMinor, 0) };
          });
          const active = months.filter((m) => m.minor > 0).length;
          const monthMax = Math.max(1, ...months.map((m) => m.minor));
          const byCat = new Map<string | null, number>();
          for (const t of tx) byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + t.bdtMinor);
          const [topId, topMinor] = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
          const latest = [...months].reverse().find((m) => m.minor > 0)?.key ?? `${y}-12`;
          return (
            <div key={y} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,300px)] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Link href={`${base}?m=${latest}`} prefetch={false} className="text-[17px] font-bold hover:underline">
                    {y}
                  </Link>
                  <span
                    className={cn(
                      "font-mono text-[19px] font-semibold tabular-nums",
                      out ? "text-destructive" : "text-[hsl(var(--primary-dark))]"
                    )}
                  >
                    {taka(sum)}
                  </span>
                  {change !== null && (
                    <span
                      className={cn(
                        "font-mono text-[12px] tabular-nums",
                        change === 0
                          ? "text-muted-foreground"
                          : change > 0 === out
                            ? "text-destructive"
                            : "text-[hsl(var(--primary-dark))]"
                      )}
                    >
                      {change > 0 ? "+" : ""}
                      {change}% on {years[i + 1]}
                    </span>
                  )}
                </div>
                <Bar pct={(sum / max) * 100} tone={out ? "red" : "green"} className="mt-2 h-2" />
                <p className="mt-2 text-[12.5px] text-muted-foreground">
                  {tx.length} {tx.length === 1 ? "entry" : "entries"}
                  {active > 0 && (
                    <>
                      {" "}
                      · {takaCompact(Math.round(sum / active))} a month across {active} active
                    </>
                  )}
                  {topMinor > 0 && (
                    <>
                      {" "}
                      · most on <b className="text-foreground">{ledger.catName(topId) ?? "Uncategorised"}</b>,{" "}
                      {takaCompact(topMinor)}
                    </>
                  )}
                </p>
              </div>
              <div className="flex h-[64px] items-end gap-1" aria-label={`${y} by month`}>
                {months.map((m, k) => (
                  <Link
                    key={m.key}
                    href={`${base}?m=${m.key}`}
                    prefetch={false}
                    title={`${m.key}: ${taka(m.minor)}`}
                    className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                  >
                    <span
                      className={cn(
                        "block w-full max-w-[18px] rounded-t-[3px]",
                        m.minor === 0
                          ? "bg-[hsl(var(--track))]"
                          : out
                            ? "bg-[hsl(var(--destructive))]/55 group-hover:bg-[hsl(var(--destructive))]"
                            : "bg-[hsl(var(--primary))]/55 group-hover:bg-[hsl(var(--primary))]"
                      )}
                      style={{ height: `${m.minor ? Math.max(6, (m.minor / monthMax) * 100) : 4}%` }}
                    />
                    <span className="mt-1 text-[10px] text-muted-foreground">{MONTH_INITIALS[k]}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

import Link from "next/link";
import { PageTitle } from "@/components/page-title";
import { KpiStrip } from "@/components/kpi-strip";
import { Page, Card, LinkTabs, Bar, Empty } from "@/components/cashflow/shell";
import { getLedger } from "@/lib/ledger";
import { inMonth, monthLabel, monthOf, monthShort, shiftMonth, sumBdt, type Tx } from "@/lib/cashflow";
import { pct, taka, takaCompact } from "@/lib/money";
import { cn, todayLocalISO } from "@/lib/utils";

export const metadata = { title: "Stats" };

/** Stats: twelve months (or each year) of earned, spent and kept, with where it went and where it came from. */
export default async function StatsPage({ searchParams }: { searchParams?: { view?: string } }) {
  const ledger = await getLedger();
  const view = searchParams?.view === "years" ? "years" : "months";
  const month = monthOf(todayLocalISO());

  const buckets =
    view === "months"
      ? Array.from({ length: 12 }, (_, i) => {
          const m = shiftMonth(month, i - 11);
          return { key: m, label: monthShort(m), long: monthLabel(m), tx: inMonth(ledger.tx, m) as Tx[] };
        })
      : (() => {
          const years = [...new Set(ledger.tx.map((t) => t.on.slice(0, 4)))].sort().slice(-6);
          if (!years.length) years.push(month.slice(0, 4));
          return years.map((y) => ({ key: y, label: y, long: y, tx: ledger.tx.filter((t) => t.on.startsWith(y)) }));
        })();
  const inc = buckets.map((b) => sumBdt(b.tx, "income"));
  const exp = buckets.map((b) => sumBdt(b.tx, "expense"));
  const earned = inc.reduce((a, b) => a + b, 0);
  const spent = exp.reduce((a, b) => a + b, 0);
  const kept = earned - spent;
  const max = Math.max(1, ...inc, ...exp);
  const bestIdx = inc.indexOf(Math.max(...inc));
  const periods = Math.max(1, buckets.filter((_, i) => inc[i] || exp[i]).length);
  const all = buckets.flatMap((b) => b.tx);

  const byCat = new Map<string, number>();
  for (const t of all)
    if (t.kind === "expense")
      byCat.set(
        ledger.catName(t.categoryId) ?? "Uncategorised",
        (byCat.get(ledger.catName(t.categoryId) ?? "Uncategorised") ?? 0) + t.bdtMinor
      );
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const bySrc = new Map<string, number>();
  for (const t of all)
    if (t.kind === "income")
      bySrc.set(
        t.source || ledger.catName(t.categoryId) || "Other",
        (bySrc.get(t.source || ledger.catName(t.categoryId) || "Other") ?? 0) + t.bdtMinor
      );
  const srcs = [...bySrc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const byAcct = new Map<string, number>();
  for (const t of all)
    if (t.kind === "expense")
      byAcct.set(ledger.acctName(t.accountId), (byAcct.get(ledger.acctName(t.accountId)) ?? 0) + t.bdtMinor);
  const accts = [...byAcct.entries()].sort((a, b) => b[1] - a[1]);
  const rates = buckets.map((_, i) => (inc[i] ? Math.max(0, Math.round(((inc[i] - exp[i]) / inc[i]) * 100)) : 0));
  const span = view === "months" ? "the last 12 months" : "each year";

  const bars = (rows: [string, number][], tone?: "amber" | "info") =>
    rows.length === 0 ? (
      <Empty title="Nothing yet" line="This fills in as you record entries." />
    ) : (
      rows.map(([name, v], i) => (
        <div
          key={name}
          className="grid grid-cols-[minmax(0,110px)_1fr_auto] items-center gap-2.5 py-[7px] text-[13px] sm:grid-cols-[150px_1fr_auto]"
        >
          <span className="truncate">{name}</span>
          <Bar pct={pct(v, rows[0][1])} tone={tone ?? (i === 0 ? "green" : "amber")} className="h-2" />
          <span className="min-w-[72px] text-right font-mono text-[12.5px] tabular-nums">{takaCompact(v)}</span>
        </div>
      ))
    );

  return (
    <Page title="Stats">
      <PageTitle
        eyebrow={view === "months" ? `${monthLabel(buckets[0].key)} to ${monthLabel(month)}` : "Each year"}
        title="Stats"
        line={
          earned ? (
            <>
              You kept <b>{pct(Math.max(0, kept), earned)}%</b> of what you earned in {span}. Best{" "}
              {view === "months" ? "month" : "year"} was <b>{buckets[bestIdx].long}</b>, {takaCompact(inc[bestIdx])} in.
            </>
          ) : (
            "Earned, spent and kept, month by month. It fills in as you record income and expenses."
          )
        }
      />
      <LinkTabs
        current={view === "months" ? "/stats" : "/stats?view=years"}
        tabs={[
          { href: "/stats", label: "Last 12 months" },
          { href: "/stats?view=years", label: "Each year" }
        ]}
      />
      <KpiStrip
        items={[
          {
            label: "Earned",
            value: takaCompact(earned),
            sub: `${takaCompact(Math.round(earned / periods))} a ${view === "months" ? "month" : "year"}`,
            tone: "good"
          },
          {
            label: "Spent",
            value: takaCompact(spent),
            sub: `${takaCompact(Math.round(spent / periods))} a ${view === "months" ? "month" : "year"} · ${pct(spent, earned)}% of earned`,
            tone: "bad"
          },
          {
            label: "Kept",
            value: takaCompact(kept),
            sub: earned ? `${pct(Math.max(0, kept), earned)}% of earned` : "earned minus spent",
            tone: kept < 0 ? "bad" : "default"
          },
          {
            label: "Biggest cost",
            value: cats[0]?.[0] ?? "·",
            sub: cats[0] ? `${takaCompact(cats[0][1])} · ${pct(cats[0][1], spent)}% of spending` : "no spending yet"
          }
        ]}
      />
      <div className="grid gap-3.5 sm:gap-[18px] lg:grid-cols-[1.45fr_1fr]">
        <Card title="Income vs spending" sub={view === "months" ? "Each month" : "Each year"}>
          <div className="flex gap-3.5 text-[12px] text-muted-foreground">
            <span>
              <i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] bg-[hsl(var(--primary-fill))] align-[-1px]" />
              Income
            </span>
            <span>
              <i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] bg-[hsl(var(--track))] align-[-1px]" />
              Spending
            </span>
          </div>
          <div className="flex h-[190px] items-end gap-1.5 pt-5">
            {buckets.map((b, i) => (
              <Link
                key={b.key}
                href={view === "months" ? `/expenses?m=${b.key}` : "/stats?view=years"}
                prefetch={false}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
              >
                {i === bestIdx && inc[i] > 0 && (
                  <span className="mb-1 font-mono text-[10.5px] text-muted-foreground">{takaCompact(inc[i])}</span>
                )}
                <span className="flex h-full w-full items-end justify-center gap-[3px]">
                  <i
                    className="block w-[45%] max-w-[22px] rounded-t-[4px] bg-[hsl(var(--primary-fill))]"
                    style={{ height: `${Math.max(2, (inc[i] / max) * 100)}%` }}
                  />
                  <i
                    className="block w-[45%] max-w-[22px] rounded-t-[4px] bg-[hsl(var(--track))]"
                    style={{ height: `${Math.max(2, (exp[i] / max) * 100)}%` }}
                  />
                </span>
                <span
                  className={cn(
                    "mt-1.5 text-[11px]",
                    i === bestIdx ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}
                >
                  {b.label}
                </span>
              </Link>
            ))}
          </div>
        </Card>
        <Card title="Where it went" sub={`Top categories, ${span}`}>
          {bars(cats)}
        </Card>
      </div>
      <div className="grid gap-3.5 sm:gap-[18px] lg:grid-cols-3">
        <Card title="Where it came from" sub="Income by source">
          {bars(srcs, "info")}
        </Card>
        <Card title="Kept, each period" sub="Share of income not spent">
          <div className="flex h-[150px] items-end gap-1.5 pt-4">
            {buckets.map((b, i) => (
              <div
                key={b.key}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                title={`${b.long}: ${rates[i]}%`}
              >
                <i
                  className="block w-[60%] max-w-[22px] rounded-t-[4px] bg-[hsl(var(--purple))]"
                  style={{ height: `${Math.max(2, rates[i])}%` }}
                />
                <span className="mt-1.5 text-[11px] text-muted-foreground">{b.label}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Spent from" sub="By account">
          {accts.length ? (
            accts.map(([name, v]) => (
              <div
                key={name}
                className="flex items-center justify-between border-t border-border py-2 text-[13px] first:border-t-0"
              >
                <span>{name}</span>
                <span className="font-mono tabular-nums">{taka(v)}</span>
              </div>
            ))
          ) : (
            <Empty title="Nothing yet" line="Spending per account shows here." />
          )}
        </Card>
      </div>
    </Page>
  );
}

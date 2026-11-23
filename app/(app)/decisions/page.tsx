import Link from "next/link";
import { PageTitle } from "@/components/page-title";
import { KpiStrip } from "@/components/kpi-strip";
import { Page, Card, Empty, chipClass } from "@/components/cashflow/shell";
import { Gauge, HBars, Legend, PairBars, SignedBars } from "@/components/cashflow/charts";
import { InsightAlerts, Pill } from "@/components/cashflow/insight-alerts";
import { getLedger } from "@/lib/ledger";
import { buildInsights } from "@/lib/insights";
import { monthShort } from "@/lib/cashflow";
import { pct, taka, takaCompact } from "@/lib/money";
import { cn, shortDate, todayLocalISO } from "@/lib/utils";

export const metadata = { title: "Decisions" };

const INCOME = { name: "Income", className: "bg-[hsl(var(--primary))]" };
const SPEND = { name: "Spending", className: "bg-destructive" };

/**
 * Decisions: five questions the ledger can answer (burn, money kept, leaks, the bird business, client
 * dependency), the money that looks unlogged, and what to set as a budget. Every number comes from the
 * rows getLedger() already loads; lending and repayments are kept out of earned and spent.
 */
export default async function DecisionsPage() {
  const today = todayLocalISO();
  const ledger = await getLedger();
  const d = buildInsights(ledger, today);
  const empty = ledger.tx.length === 0;
  const growth = (g: number | null) => (g === null ? null : Math.round(g * 100));

  const share = d.topShare ? Math.round(d.topShare.share * 100) : 0;
  const shareTone: "good" | "warn" | "bad" = share > 60 ? "bad" : share >= 40 ? "warn" : "good";
  const birdNet = d.bird.allIncome - d.bird.allSpend;
  const topTwo = d.leaks.slice(0, 2).reduce((s, l) => s + l.last, 0);
  const budgetIdeas = d.leaks.filter((l) => l.id && l.last > 0).slice(0, 6);

  return (
    <Page title="Decisions">
      <PageTitle
        eyebrow={`Decisions · ${shortDate(today)}`}
        title="Where your money really goes"
        line={
          empty ? (
            "Add income and expenses, and this page turns them into decisions."
          ) : (
            <>
              You spent <b className="text-destructive">{taka(d.spent12)}</b> in the last 12 months and logged{" "}
              <b>{taka(d.earned12)}</b> of income.{" "}
              {d.kept12 < 0
                ? "Either income is going unrecorded, or savings are paying for life."
                : `You kept ${takaCompact(d.kept12)}, ${pct(d.kept12, d.earned12)}% of what came in.`}
            </>
          )
        }
      />
      {empty ? (
        <Card>
          <Empty title="No money logged yet" line="Decisions need a few months of income and spending." />
        </Card>
      ) : (
        <>
          <InsightAlerts alerts={d.alerts} />

          {/* 1 · Burn */}
          <Card
            title="Burn vs income"
            sub="Last 12 months. Am I living off savings? A red dot marks a month with income under 15% of spending."
            action={<Pill tone={d.kept12 < 0 ? "bad" : "good"}>Kept {takaCompact(d.kept12)}</Pill>}
          >
            <KpiStrip
              className="mb-3.5 shadow-none"
              items={[
                {
                  label: "Spent",
                  value: takaCompact(d.spent12),
                  sub: "last 12 months",
                  tone: "bad",
                  href: "/expenses?view=months"
                },
                {
                  label: "Income logged",
                  value: takaCompact(d.earned12),
                  sub: "last 12 months",
                  href: "/income?view=months"
                },
                { label: "Average burn", value: takaCompact(d.avgBurn), sub: "per month" },
                {
                  label: "Kept",
                  value: takaCompact(d.kept12),
                  sub: d.earned12 ? `${pct(Math.max(0, d.kept12), d.earned12)}% of income` : "no income logged",
                  tone: d.kept12 < 0 ? "bad" : "good"
                }
              ]}
            />
            <Legend
              items={[
                { label: INCOME.name, className: INCOME.className },
                { label: SPEND.name, className: SPEND.className }
              ]}
            />
            <PairBars
              label="Monthly income and spending for the last 12 months"
              a={INCOME}
              b={SPEND}
              points={d.months.map((m) => ({
                key: m.month,
                label: monthShort(m.month),
                a: m.income,
                b: m.spend,
                href: `/expenses?m=${m.month}`,
                flag: m.spend > 0 && m.income < m.spend * 0.15,
                on: m.month === d.month
              }))}
            />
          </Card>

          <div className="grid gap-3.5 sm:gap-[18px] lg:grid-cols-2">
            {/* 2 · Kept */}
            <Card title="Money kept each year" sub="Income minus spending, and the share of income you kept.">
              <SignedBars
                label="Money kept per year"
                points={d.years.map((y) => ({ key: y.year, label: y.year, value: y.kept, href: `/stats?view=years` }))}
              />
              <div className="mt-2 flex gap-2">
                {d.years.map((y) => (
                  <span key={y.year} className="flex-1 text-center text-[11px] text-muted-foreground">
                    {y.year}
                  </span>
                ))}
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-left text-[12px] text-muted-foreground">
                      <th className="py-2 pr-2 font-semibold">Year</th>
                      <th className="py-2 pr-2 text-right font-semibold">Earned</th>
                      <th className="py-2 pr-2 text-right font-semibold">Spent</th>
                      <th className="py-2 pr-2 text-right font-semibold">Kept</th>
                      <th className="py-2 text-right font-semibold">Keep rate</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-[12.5px] tabular-nums">
                    {[...d.years].reverse().map((y) => (
                      <tr key={y.year} className="border-b border-border last:border-0">
                        <td className="py-2 pr-2 font-sans font-semibold">
                          {y.year}
                          {d.bestYear?.year === y.year && (
                            <span className="ml-1.5 font-sans text-[11px] font-medium text-[hsl(var(--primary-dark))]">
                              best
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-2 text-right">{takaCompact(y.income)}</td>
                        <td className="py-2 pr-2 text-right">{takaCompact(y.spend)}</td>
                        <td
                          className={cn(
                            "py-2 pr-2 text-right font-semibold",
                            y.kept < 0 ? "text-destructive" : "text-[hsl(var(--primary-dark))]"
                          )}
                        >
                          {takaCompact(y.kept)}
                        </td>
                        <td className={cn("py-2 text-right", y.kept < 0 && "text-destructive")}>
                          {y.keepRate === null ? "n/a" : `${Math.round(y.keepRate * 100)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* 5 · Dependency */}
            <Card
              title="Client dependency"
              sub="How exposed am I to one source of income?"
              action={
                d.topShare ? (
                  <Pill tone={shareTone}>
                    {shareTone === "bad" ? "Risky" : shareTone === "warn" ? "Watch" : "Safe"}
                  </Pill>
                ) : undefined
              }
            >
              {d.topShare ? (
                <>
                  <p className="text-[13px]">
                    <b>{d.topShare.name}</b> is <b>{share}%</b> of {d.topShare.year} income (
                    {takaCompact(d.topShare.minor)} of {takaCompact(d.topShare.total)}).
                    {d.sourcesYear.fallback && (
                      <span className="text-muted-foreground">
                        {" "}
                        {d.month.slice(0, 4)} has too little income logged to judge yet.
                      </span>
                    )}
                  </p>
                  <Gauge pct={share} tone={shareTone} />
                  <p className="mt-1.5 text-[12px] text-muted-foreground">
                    Under 40% safe · 40 to 60% watch · over 60% risky
                  </p>
                  <p className="mb-1 mt-4 text-[12px] font-semibold text-muted-foreground">All time, by source</p>
                  <HBars
                    label="Income by source, all time"
                    rows={d.sourcesAll.slice(0, 8).map((s) => ({
                      key: s.name,
                      name: s.name,
                      minor: s.minor,
                      strong: false,
                      right: (
                        <span className="font-mono text-[12.5px]">
                          <b>{takaCompact(s.minor)}</b>{" "}
                          <span className="text-muted-foreground">
                            {pct(
                              s.minor,
                              d.sourcesAll.reduce((t, x) => t + x.minor, 0)
                            )}
                            %
                          </span>
                        </span>
                      )
                    }))}
                  />
                </>
              ) : (
                <Empty title="No income logged yet" line="Your biggest payers show here once income is in." />
              )}
            </Card>
          </div>

          {/* 3 · Leaks */}
          <Card
            title="Leak finder"
            sub={`Spending by category, last 12 months, against the 12 before. The top 2 are ${pct(topTwo, d.spent12)}% of all spending.`}
            action={
              <Link href="/expenses?view=categories" className={chipClass}>
                Categories ›
              </Link>
            }
          >
            <HBars
              label="Spending by category, last 12 months"
              rows={d.leaks
                .filter((l, i) => i < 10 || l.name.toLowerCase() === "waste of money")
                .map((l) => {
                  const g = growth(l.growth);
                  return {
                    key: l.id ?? l.name,
                    name: (
                      <>
                        {l.name}
                        {g !== null && g > 25 && (
                          <span className="ml-2 align-middle">
                            <Pill tone="bad">up {g}%</Pill>
                          </span>
                        )}
                      </>
                    ),
                    minor: l.last,
                    strong: l.top,
                    href: l.id ? `/expenses?view=categories` : undefined,
                    right: (
                      <span className="block font-mono text-[12.5px] leading-tight">
                        <b>{takaCompact(l.last)}</b>
                        <small className="block text-[11px] text-muted-foreground">
                          {pct(l.last, d.spent12)}% · {takaCompact(Math.round(l.last / 12))}/mo
                          {g !== null ? ` · ${g > 0 ? "+" : ""}${g}%` : l.prior === 0 && l.last > 0 ? " · new" : ""}
                        </small>
                      </span>
                    )
                  };
                })}
            />
            {d.waste12 === 0 && (
              <p className="mt-2 text-[12px] text-muted-foreground">
                Nothing marked “Waste of money” in the last 12 months.
              </p>
            )}
          </Card>

          {/* 4 · Bird */}
          <Card
            title="Bird P&L"
            sub="Is KinBird making or losing money on the books?"
            action={
              d.bird.allSpend > 0 && d.bird.allIncome < d.bird.allSpend * 0.1 ? (
                <Pill tone="bad">Sales not logged</Pill>
              ) : (
                <Pill tone={birdNet >= 0 ? "good" : "warn"}>{birdNet >= 0 ? "Profitable" : "Net loss"}</Pill>
              )
            }
          >
            <KpiStrip
              className="mb-3.5 shadow-none"
              items={[
                {
                  label: "Bird spend, all time",
                  value: takaCompact(d.bird.allSpend),
                  tone: "bad",
                  href: "/expenses?view=categories"
                },
                { label: "Bird income logged", value: takaCompact(d.bird.allIncome), tone: "good", href: "/income" },
                { label: "Net on the books", value: takaCompact(birdNet), tone: birdNet < 0 ? "bad" : "good" },
                {
                  label: "Income covers",
                  value: `${d.bird.allSpend ? Math.round((d.bird.allIncome / d.bird.allSpend) * 100) : 0}%`,
                  sub: `last 12 months: ${takaCompact(d.bird.last12.income)} in, ${takaCompact(d.bird.last12.spend)} out`,
                  tone: "warn"
                }
              ]}
            />
            <Legend
              items={[
                { label: "Bird income logged", className: INCOME.className },
                { label: "Bird spend", className: SPEND.className }
              ]}
            />
            <PairBars
              label="Bird spending against bird income per year"
              a={{ name: "Bird income", className: INCOME.className }}
              b={{ name: "Bird spend", className: SPEND.className }}
              points={d.bird.years.map((y) => ({ key: y.year, label: y.year, a: y.income, b: y.spend }))}
            />
            <p className="mt-2 text-[12px] text-muted-foreground">
              Bird sales tracked elsewhere (KinBird Pro, WhatsApp deals) are not counted until they are added here as
              income under Bird or Sold.
            </p>
          </Card>

          {/* 6 · What to set */}
          <Card
            title="Budgets your data suggests"
            sub="Your 12-month average per category. Set it as the monthly limit, then trim the top two."
            action={
              <Link href="/budgets" className={chipClass}>
                Budgets ›
              </Link>
            }
          >
            <div className="divide-y divide-border">
              {budgetIdeas.map((l, i) => {
                const avg = Math.round(l.last / 12);
                const target = i < 2 ? Math.round((avg * 0.9) / 50000) * 50000 : Math.round(avg / 10000) * 10000;
                return (
                  <div key={l.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                    <span className="min-w-0">
                      <b className="block truncate">{l.name}</b>
                      <small className="block text-[12px] text-muted-foreground">
                        averages {takaCompact(avg)} a month{i < 2 ? ", one of your two biggest" : ""}
                      </small>
                    </span>
                    <span className="shrink-0 text-right font-mono text-[13px]">
                      <b>{takaCompact(Math.max(target, 10000))}</b>
                      <small className="block font-sans text-[11.5px] text-muted-foreground">
                        {i < 2 ? "10% under average" : "monthly limit"}
                      </small>
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </Page>
  );
}

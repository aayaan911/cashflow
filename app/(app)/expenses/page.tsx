import Link from "next/link";
import { CalendarDays, BarChart3, PieChart, Plus, Repeat } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { topbarAddClass } from "@/components/topbar";
import { Page, Chip, LinkTabs, MonthChips, Bar, usedTone, Card, Empty } from "@/components/cashflow/shell";
import { TxTable } from "@/components/cashflow/tx-table";
import { AddTx } from "@/components/cashflow/add-tx";
import { FirstRun } from "@/components/cashflow/first-run";
import { CatIcon } from "@/components/cashflow/category-icon";
import { getLedger } from "@/lib/ledger";
import { inMonth, monthLabel, monthShort, resolveMonth, shiftMonth, sumBdt, type Tx } from "@/lib/cashflow";
import { pct, taka, takaCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata = { title: "Expenses" };

type Search = { m?: string; cat?: string; view?: string };

/**
 * Expenses (prototype v4): one month at a time, a category chip row, the ledger with an inline add row,
 * the month's total in the footer. "Each month" and "By category" are the two summary views.
 */
export default async function ExpensesPage({ searchParams }: { searchParams?: Search }) {
  const ledger = await getLedger();
  const month = resolveMonth(searchParams?.m);
  const view = searchParams?.view === "months" || searchParams?.view === "categories" ? searchParams.view : "month";
  const catFilter = searchParams?.cat ?? "";
  const expenses = ledger.tx.filter((t) => t.kind === "expense");
  const thisMonth = inMonth(expenses, month) as Tx[];
  const rows = catFilter ? thisMonth.filter((t) => t.categoryId === catFilter) : thisMonth;
  const total = rows.reduce((s, t) => s + t.bdtMinor, 0);
  const monthTotal = thisMonth.reduce((s, t) => s + t.bdtMinor, 0);
  const byCat = new Map<string | null, number>();
  for (const t of thisMonth) byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + t.bdtMinor);
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const topName = top[0] ? (ledger.catName(top[0][0]) ?? "Uncategorised") : null;
  const base = `/expenses?m=${month}`;
  const returnTo = `${base}${catFilter ? `&cat=${catFilter}` : ""}`;
  const empty = ledger.accounts.length === 0 && ledger.categories.length === 0;

  return (
    <Page
      title="Expenses"
      add={
        <Link href="#add" className={topbarAddClass}>
          <Plus className="h-4 w-4" /> Add expense
        </Link>
      }
    >
      <PageTitle
        title="Expenses"
        line={
          monthTotal > 0 ? (
            <>
              <b className="text-destructive">{taka(monthTotal)}</b> spent in {monthLabel(month)}.{" "}
              {topName && (
                <>
                  Most of it on <b>{topName}</b>, {taka(top[0][1])}.
                </>
              )}
            </>
          ) : (
            <>Nothing recorded for {monthLabel(month)} yet. Add the first expense below.</>
          )
        }
      />
      {empty && <FirstRun returnTo={returnTo} />}
      <LinkTabs
        current={view === "month" ? base : `${base}&view=${view}`}
        tabs={[
          { href: base, label: "This month", icon: <CalendarDays className="h-3.5 w-3.5" /> },
          { href: `${base}&view=months`, label: "Each month", icon: <BarChart3 className="h-3.5 w-3.5" /> },
          { href: `${base}&view=categories`, label: "By category", icon: <PieChart className="h-3.5 w-3.5" /> },
          { href: "/recurring", label: "Recurring", icon: <Repeat className="h-3.5 w-3.5" /> }
        ]}
      />
      {view === "month" && (
        <>
          <MonthChips month={month} base="/expenses">
            <Chip href={base} on={!catFilter}>
              All
            </Chip>
            {ledger.categories
              .filter((c) => c.kind === "expense")
              .map((c) => (
                <Chip key={c.id} href={`${base}&cat=${c.id}`} on={catFilter === c.id}>
                  {c.name}
                  {byCat.get(c.id) ? (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {takaCompact(byCat.get(c.id) ?? 0)}
                    </span>
                  ) : null}
                </Chip>
              ))}
          </MonthChips>
          <div
            id="add"
            className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-1)]"
          >
            {rows.length > 0 ? (
              <TxTable
                rows={rows}
                ledger={ledger}
                returnTo={returnTo}
                total={{
                  label: `Total for ${monthLabel(month)}${catFilter ? ` · ${ledger.catName(catFilter)}` : ""}`,
                  minor: total,
                  kind: "expense"
                }}
              />
            ) : (
              <Empty
                title="No expenses here yet"
                line={
                  catFilter
                    ? "Nothing in this category this month."
                    : "Add one below. It lands in this month's total straight away."
                }
              />
            )}
            {!empty && (
              <AddTx kind="expense" ledger={ledger} returnTo={returnTo} placeholder="Item, e.g. Pathao ride" />
            )}
          </div>
        </>
      )}
      {view === "months" && <EachMonth expenses={expenses} month={month} />}
      {view === "categories" && (
        <Card
          title={`By category, ${monthLabel(month)}`}
          sub={`${taka(monthTotal)} across ${top.length} categories`}
          action={<MonthChips month={month} base="/expenses?view=categories" />}
        >
          {top.length === 0 ? (
            <Empty title="Nothing this month" line="Spending by category shows here once there are entries." />
          ) : (
            <div className="divide-y divide-border">
              {top.map(([id, minor]) => {
                const c = ledger.cat(id);
                const budget = c?.budgetMinor ?? 0;
                const p = budget ? pct(minor, budget) : 0;
                return (
                  <div key={id ?? "none"} className="flex items-center gap-3 py-2.5">
                    <CatIcon icon={c?.icon ?? "tag"} name={c?.name ?? "Uncategorised"} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <b className="truncate text-[13.5px]">{c?.name ?? "Uncategorised"}</b>
                        <span className="font-mono text-[13px] font-medium tabular-nums">{taka(minor)}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Bar pct={budget ? p : pct(minor, monthTotal)} tone={budget ? usedTone(p) : "green"} />
                        <span className="w-[86px] shrink-0 text-right text-[11.5px] text-muted-foreground">
                          {budget ? `${p}% of ${takaCompact(budget)}` : `${pct(minor, monthTotal)}% of month`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </Page>
  );
}

function EachMonth({ expenses, month }: { expenses: Tx[]; month: string }) {
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(month, i - 11));
  const totals = months.map((m) => sumBdt(inMonth(expenses, m) as Tx[], "expense"));
  const max = Math.max(1, ...totals);
  const avg = totals.filter(Boolean).length
    ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.filter(Boolean).length)
    : 0;
  return (
    <Card
      title="Each month"
      sub={avg ? `Average ${taka(avg)} a month over the last year` : "Twelve months, ending with the month you are on"}
    >
      <div className="flex h-[190px] items-end gap-1.5 pt-5">
        {months.map((m, i) => (
          <Link
            key={m}
            href={`/expenses?m=${m}`}
            prefetch={false}
            className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end"
          >
            {totals[i] > 0 && (
              <span className="mb-1 hidden font-mono text-[10.5px] text-muted-foreground sm:block">
                {takaCompact(totals[i])}
              </span>
            )}
            <span
              className={cn(
                "block w-[60%] max-w-[26px] rounded-t-[4px]",
                m === month
                  ? "bg-[hsl(var(--destructive))]"
                  : "bg-[hsl(var(--destructive))]/45 group-hover:bg-[hsl(var(--destructive))]/70"
              )}
              style={{ height: `${Math.max(2, (totals[i] / max) * 100)}%` }}
            />
            <span
              className={cn(
                "mt-1.5 text-[11px]",
                m === month ? "font-semibold text-foreground" : "text-muted-foreground"
              )}
            >
              {monthShort(m)}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

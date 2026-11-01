import Link from "next/link";
import { BarChart3, CalendarDays, Plus, Users } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { topbarAddClass } from "@/components/topbar";
import { Page, Chip, LinkTabs, MonthChips, Bar, Card, Empty } from "@/components/cashflow/shell";
import { TxTable } from "@/components/cashflow/tx-table";
import { AddTx } from "@/components/cashflow/add-tx";
import { FirstRun } from "@/components/cashflow/first-run";
import { getLedger } from "@/lib/ledger";
import { inMonth, monthLabel, monthShort, resolveMonth, shiftMonth, sumBdt, type Tx } from "@/lib/cashflow";
import { dollars, pct, taka, takaCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata = { title: "Income" };

type Search = { m?: string; cat?: string; view?: string };

export default async function IncomePage({ searchParams }: { searchParams?: Search }) {
  const ledger = await getLedger();
  const month = resolveMonth(searchParams?.m);
  const view = searchParams?.view === "months" || searchParams?.view === "sources" ? searchParams.view : "month";
  const catFilter = searchParams?.cat ?? "";
  const income = ledger.tx.filter((t) => t.kind === "income");
  const thisMonth = inMonth(income, month) as Tx[];
  const rows = catFilter ? thisMonth.filter((t) => t.categoryId === catFilter) : thisMonth;
  const total = rows.reduce((s, t) => s + t.bdtMinor, 0);
  const monthTotal = thisMonth.reduce((s, t) => s + t.bdtMinor, 0);
  const usdThisMonth = thisMonth.filter((t) => t.currency === "USD").reduce((s, t) => s + t.amountMinor, 0);
  const base = `/income?m=${month}`;
  const returnTo = `${base}${catFilter ? `&cat=${catFilter}` : ""}`;
  const empty = ledger.accounts.length === 0 && ledger.categories.length === 0;

  const bySource = new Map<string, number>();
  for (const t of income)
    bySource.set(t.source || "No source", (bySource.get(t.source || "No source") ?? 0) + t.bdtMinor);
  const sources = [...bySource.entries()].sort((a, b) => b[1] - a[1]);
  const allTotal = sources.reduce((s, [, v]) => s + v, 0);

  return (
    <Page
      title="Income"
      add={
        <Link href="#add" className={topbarAddClass}>
          <Plus className="h-4 w-4" /> Add income
        </Link>
      }
    >
      <PageTitle
        title="Income"
        line={
          monthTotal > 0 ? (
            <>
              <b>{taka(monthTotal)}</b> earned in {monthLabel(month)}.
              {usdThisMonth > 0 && <> {dollars(usdThisMonth)} of it came in dollars.</>}
            </>
          ) : (
            <>Nothing recorded for {monthLabel(month)} yet. Add the first entry below.</>
          )
        }
      />
      {empty && <FirstRun returnTo={returnTo} />}
      <LinkTabs
        current={view === "month" ? base : `${base}&view=${view}`}
        tabs={[
          { href: base, label: "This month", icon: <CalendarDays className="h-3.5 w-3.5" /> },
          { href: `${base}&view=months`, label: "Each month", icon: <BarChart3 className="h-3.5 w-3.5" /> },
          { href: `${base}&view=sources`, label: "By source", icon: <Users className="h-3.5 w-3.5" /> }
        ]}
      />
      {view === "month" && (
        <>
          <MonthChips month={month} base="/income">
            <Chip href={base} on={!catFilter}>
              All
            </Chip>
            {ledger.categories
              .filter((c) => c.kind === "income")
              .map((c) => (
                <Chip key={c.id} href={`${base}&cat=${c.id}`} on={catFilter === c.id}>
                  {c.name}
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
                showSource
                total={{ label: `Total for ${monthLabel(month)}`, minor: total, kind: "income" }}
              />
            ) : (
              <Empty
                title="No income here yet"
                line="Add one below. A dollar amount on a USD account is converted at your latest withdrawal rate."
              />
            )}
            {!empty && (
              <AddTx kind="income" ledger={ledger} returnTo={returnTo} placeholder="Item, e.g. Fiverr order" />
            )}
          </div>
        </>
      )}
      {view === "months" && <EachMonth income={income} month={month} />}
      {view === "sources" && (
        <Card
          title="By source"
          sub={allTotal ? `${taka(allTotal)} all time, ${sources.length} sources` : "Who pays you, all time"}
        >
          {sources.length === 0 ? (
            <Empty title="No sources yet" line="Type who paid in the Source box when you add income." />
          ) : (
            <div className="divide-y divide-border">
              {sources.map(([name, minor]) => (
                <div
                  key={name}
                  className="grid grid-cols-[minmax(0,120px)_1fr_auto] items-center gap-3 py-2.5 text-[13px] sm:grid-cols-[160px_1fr_auto]"
                >
                  <b className="truncate">{name}</b>
                  <Bar pct={pct(minor, sources[0][1])} className="h-2" />
                  <span className="w-[80px] text-right font-mono tabular-nums">{takaCompact(minor)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </Page>
  );
}

function EachMonth({ income, month }: { income: Tx[]; month: string }) {
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(month, i - 11));
  const totals = months.map((m) => sumBdt(inMonth(income, m) as Tx[], "income"));
  const max = Math.max(1, ...totals);
  const best = totals.indexOf(Math.max(...totals));
  return (
    <Card
      title="Each month"
      sub={
        totals[best]
          ? `Best month ${monthLabel(months[best])}, ${taka(totals[best])}`
          : "Twelve months, ending with the month you are on"
      }
    >
      <div className="flex h-[190px] items-end gap-1.5 pt-5">
        {months.map((m, i) => (
          <Link
            key={m}
            href={`/income?m=${m}`}
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
                  ? "bg-[hsl(var(--primary-fill))]"
                  : "bg-[hsl(var(--primary))]/45 group-hover:bg-[hsl(var(--primary))]/70"
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

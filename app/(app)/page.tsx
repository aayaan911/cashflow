import Link from "next/link";
import { ArrowDownLeft, Globe, HandCoins, Plus, Repeat, Target } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { topbarAddClass } from "@/components/topbar";
import { KpiStrip } from "@/components/kpi-strip";
import { buttonVariants } from "@/components/ui/button";
import { Page, Card, Row, Bar, usedTone, Empty, chipClass } from "@/components/cashflow/shell";
import { FirstRun } from "@/components/cashflow/first-run";
import { CatIcon } from "@/components/cashflow/category-icon";
import { getAccountProfile } from "@/lib/data";
import { getLedger } from "@/lib/ledger";
import {
  getDebts,
  getGoals,
  getRecurring,
  inMonth,
  monthLabel,
  monthOf,
  monthShort,
  shiftMonth,
  sumBdt,
  type Tx
} from "@/lib/cashflow";
import { budgetsFor } from "@/lib/budgets";
import { dollars, pct, taka, takaCompact } from "@/lib/money";
import { cn, daysBetweenLocal, plural, shortDate, todayLocalISO } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

/**
 * Dashboard (prototype v4): greeting with the one number that matters, budget card with the four biggest
 * categories, "Needs your attention" ranked by money at stake, the KPI strip, income vs spending for a year,
 * and what is coming up from the recurring list.
 */
export default async function DashboardPage() {
  const today = todayLocalISO();
  const month = monthOf(today);
  // Every read of the page starts here, together: one database round trip, not two.
  const [profile, ledger, recurring, debts, { goals }, budgets] = await Promise.all([
    getAccountProfile(),
    getLedger(),
    getRecurring(),
    getDebts(),
    getGoals(),
    budgetsFor(month, getLedger())
  ]);
  const first = profile?.fullName?.split(/\s+/)[0];
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Dhaka" }).format(new Date())
  );
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const empty = ledger.accounts.length === 0 && ledger.categories.length === 0;

  const thisMonth = inMonth(ledger.tx, month) as Tx[];
  const spent = sumBdt(thisMonth, "expense");
  const earned = sumBdt(thisMonth, "income");
  const lastMonthSpent = sumBdt(inMonth(ledger.tx, shiftMonth(month, -1)) as Tx[], "expense");
  const lastMonthEarned = sumBdt(inMonth(ledger.tx, shiftMonth(month, -1)) as Tx[], "income");
  const budgetTotal = budgets.reduce((s, b) => s + b.limitMinor, 0);
  const daysLeft =
    daysBetweenLocal(today, `${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()}`) ??
    0;
  const top = [...budgets].sort((a, b) => b.spentMinor - a.spentMinor).slice(0, 4);

  // Attention: due bills, budgets near the limit, debts owed to you, dollars sitting idle.
  const due = recurring.filter(
    (r) => r.active && r.kind === "expense" && (daysBetweenLocal(today, r.nextOn) ?? 99) <= 7
  );
  const dueTotal = due.reduce((s, r) => s + r.amountMinor, 0);
  const over = budgets.filter((b) => b.limitMinor > 0 && pct(b.spentMinor, b.limitMinor) >= 90);
  const owedToMe = debts.filter((d) => d.direction === "lent" && !d.settledAt && d.totalMinor > d.paidMinor);
  const owedTotal = owedToMe.reduce((s, d) => s + d.totalMinor - d.paidMinor, 0);
  const usdAccounts = ledger.accounts.filter((a) => a.currency === "USD" && !a.archived);
  const usdIdle = usdAccounts.reduce((s, a) => s + (ledger.balances.get(a.id) ?? 0), 0);
  const saved = goals.reduce((s, g) => s + g.savedMinor, 0);
  const savedTarget = goals.reduce((s, g) => s + g.targetMinor, 0);

  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(month, i - 11));
  const incomeSeries = months.map((m) => sumBdt(inMonth(ledger.tx, m) as Tx[], "income"));
  const expenseSeries = months.map((m) => sumBdt(inMonth(ledger.tx, m) as Tx[], "expense"));
  const max = Math.max(1, ...incomeSeries, ...expenseSeries);
  const kept = incomeSeries.reduce((a, b) => a + b, 0) - expenseSeries.reduce((a, b) => a + b, 0);

  const upcoming = recurring
    .filter((r) => r.active)
    .sort((a, b) => a.nextOn.localeCompare(b.nextOn))
    .slice(0, 5);

  return (
    <Page
      title="Dashboard"
      add={
        <Link href="/expenses#add" className={topbarAddClass}>
          <Plus className="h-4 w-4" /> Add expense
        </Link>
      }
    >
      <PageTitle
        eyebrow={`${shortDate(today)} · ${monthLabel(month)}${profile?.since ? ` · day ${(daysBetweenLocal(profile.since, today) ?? 0) + 1} of Cashflow` : ""}`}
        title={first ? `${greet}, ${first}` : greet}
        line={
          empty ? (
            "Your money, in one place. Start with a few accounts and categories."
          ) : budgetTotal > 0 ? (
            <>
              <b>{taka(Math.max(0, budgetTotal - spent))}</b> left to spend in {monthLabel(month).split(" ")[0]}.
              {dueTotal > 0 && (
                <>
                  {" "}
                  <b className="text-destructive">{taka(dueTotal)}</b> in bills is due within a week.
                </>
              )}
            </>
          ) : (
            <>
              <b className="text-destructive">{taka(spent)}</b> spent and <b>{taka(earned)}</b> earned in{" "}
              {monthLabel(month).split(" ")[0]}.
              {dueTotal > 0 && (
                <>
                  {" "}
                  <b className="text-destructive">{taka(dueTotal)}</b> in bills is due within a week.
                </>
              )}
            </>
          )
        }
        actions={
          <>
            <Link href="/income#add" className={buttonVariants({ variant: "outline" })}>
              <ArrowDownLeft className="h-4 w-4" /> Add income
            </Link>
            <Link href="/expenses#add" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Add expense
            </Link>
          </>
        }
      />
      {empty && <FirstRun returnTo="/" />}
      <div className="grid gap-3.5 sm:gap-[18px] lg:grid-cols-[1.45fr_1fr]">
        <Card
          title="Spent this month"
          action={
            <Link href="/budgets" className={chipClass}>
              All {budgets.length} ›
            </Link>
          }
        >
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-[30px] font-bold leading-[1.1] tracking-[-0.04em] tabular-nums">{taka(spent)}</span>
            <span className="text-[13px] text-muted-foreground">
              {budgetTotal > 0
                ? `of ${taka(budgetTotal)} budget · ${pct(spent, budgetTotal)}%`
                : lastMonthSpent
                  ? `vs ${taka(lastMonthSpent)} last month`
                  : "no budget set yet"}{" "}
              · {plural(daysLeft, "day")} left
            </span>
          </div>
          {budgetTotal > 0 && (
            <Bar pct={pct(spent, budgetTotal)} tone={usedTone(pct(spent, budgetTotal))} className="mt-2.5" />
          )}
          <div className="mt-3">
            {top.length === 0 ? (
              <Empty
                title="No spending yet this month"
                line="The four biggest categories show here with their budget bars."
              />
            ) : (
              top.map((b) => {
                const p = b.limitMinor ? pct(b.spentMinor, b.limitMinor) : 0;
                return (
                  <Row
                    key={b.category.id}
                    icon={<CatIcon icon={b.category.icon} name={b.category.name} />}
                    title={b.category.name}
                    line={
                      b.limitMinor
                        ? `${taka(b.spentMinor)} of ${taka(b.limitMinor)} · ${p}%`
                        : `${taka(b.spentMinor)} · no budget`
                    }
                    bar={b.limitMinor ? <Bar pct={p} tone={usedTone(p)} className="mt-1.5" /> : undefined}
                    right={
                      b.limitMinor ? (
                        <>
                          <b className={cn("block text-[14px]", p >= 90 && "text-destructive")}>
                            {taka(b.limitMinor - b.spentMinor)}
                          </b>
                          <small className="block text-[11.5px] text-muted-foreground">left</small>
                        </>
                      ) : undefined
                    }
                  />
                );
              })
            )}
          </div>
        </Card>
        <Card title="Needs your attention" sub="Ranked by money at stake">
          {due.length + over.length + owedToMe.length + (usdIdle > 0 ? 1 : 0) === 0 ? (
            <Empty
              title="Nothing waiting on you"
              line="Bills due this week, budgets near the limit and money owed to you show here."
            />
          ) : (
            <>
              {due.length > 0 && (
                <Row
                  icon={
                    <Tile tone="amber">
                      <Repeat className="h-[15px] w-[15px]" />
                    </Tile>
                  }
                  title={`${plural(due.length, "bill")} due by ${shortDate(due[due.length - 1].nextOn).replace(/ \d{4}$/, "")}`}
                  line={due.map((r) => `${r.name} ${takaCompact(r.amountMinor)}`).join(" · ")}
                  action={
                    <Link href="/recurring" className="text-[13px] font-semibold text-[hsl(var(--primary-dark))]">
                      Pay ›
                    </Link>
                  }
                />
              )}
              {over.map((b) => (
                <Row
                  key={b.category.id}
                  icon={
                    <Tile tone="red">
                      <Target className="h-[15px] w-[15px]" />
                    </Tile>
                  }
                  title={`${b.category.name} budget ${pct(b.spentMinor, b.limitMinor)}% used`}
                  line={
                    b.limitMinor > b.spentMinor
                      ? `${taka(b.limitMinor - b.spentMinor)} left, ${plural(daysLeft, "day")} to go.`
                      : `${taka(b.spentMinor - b.limitMinor)} over, ${plural(daysLeft, "day")} to go.`
                  }
                  action={
                    <Link href="/budgets" className="text-[13px] font-semibold text-[hsl(var(--primary-dark))]">
                      Adjust ›
                    </Link>
                  }
                />
              ))}
              {owedToMe.length > 0 && (
                <Row
                  icon={
                    <Tile tone="info">
                      <HandCoins className="h-[15px] w-[15px]" />
                    </Tile>
                  }
                  title={`${owedToMe.length === 1 ? owedToMe[0].person : plural(owedToMe.length, "person", "people")} still ${owedToMe.length === 1 ? "owes" : "owe"} you ${taka(owedTotal)}`}
                  line={`Oldest since ${shortDate(owedToMe[owedToMe.length - 1].startedOn)}.`}
                  action={
                    <Link href="/debts" className="text-[13px] font-semibold text-[hsl(var(--primary-dark))]">
                      Collect ›
                    </Link>
                  }
                />
              )}
              {usdIdle > 0 && (
                <Row
                  icon={
                    <Tile tone="green">
                      <Globe className="h-[15px] w-[15px]" />
                    </Tile>
                  }
                  title={`${dollars(usdIdle)} sitting in ${usdAccounts.map((a) => a.name).join(" and ")}`}
                  line={`Worth ${taka(usdIdle * ledger.rate)} at ৳${ledger.rate}, your last withdrawal rate.`}
                  action={
                    <Link href="/transfers" className="text-[13px] font-semibold text-[hsl(var(--primary-dark))]">
                      Withdraw ›
                    </Link>
                  }
                />
              )}
            </>
          )}
        </Card>
      </div>
      <KpiStrip
        items={[
          {
            label: "Net worth",
            value: takaCompact(ledger.netWorthBdt),
            sub: `${plural(ledger.accounts.filter((a) => !a.archived).length, "account")}${usdIdle ? ` · ${dollars(usdIdle)} at ৳${ledger.rate}` : ""}`,
            href: "/accounts"
          },
          {
            label: `Income, ${monthShort(month)}`,
            value: takaCompact(earned),
            sub: lastMonthEarned
              ? `vs ${takaCompact(lastMonthEarned)} in ${monthShort(shiftMonth(month, -1))}`
              : "nothing last month",
            tone: "good",
            href: "/income"
          },
          {
            label: `Spent, ${monthShort(month)}`,
            value: takaCompact(spent),
            sub: lastMonthSpent ? `${pct(spent, lastMonthSpent)}% of last month so far` : "nothing last month",
            tone: "bad",
            href: "/expenses"
          },
          {
            label: "Saved",
            value: takaCompact(saved),
            sub: goals.length
              ? `${plural(goals.length, "goal")} · ${pct(saved, savedTarget)}% of target`
              : "no goals yet",
            href: "/savings"
          }
        ]}
      />
      <div className="grid gap-3.5 sm:gap-[18px] lg:grid-cols-[1.45fr_1fr]">
        <Card
          title="Income vs spending"
          sub={`Last 12 months · kept ${takaCompact(Math.max(0, kept))} of ${takaCompact(incomeSeries.reduce((a, b) => a + b, 0))} earned`}
        >
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
          <div className="flex h-[170px] items-end gap-1.5 pt-4">
            {months.map((m, i) => (
              <Link
                key={m}
                href={`/expenses?m=${m}`}
                prefetch={false}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
              >
                {m === month && incomeSeries[i] > 0 && (
                  <span className="mb-1 font-mono text-[10.5px] text-muted-foreground">
                    {takaCompact(incomeSeries[i])}
                  </span>
                )}
                <span className="flex h-full w-full items-end justify-center gap-[3px]">
                  <i
                    className={cn(
                      "block w-[45%] max-w-[22px] rounded-t-[4px]",
                      m === month ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--primary-fill))]"
                    )}
                    style={{ height: `${Math.max(2, (incomeSeries[i] / max) * 100)}%` }}
                  />
                  <i
                    className="block w-[45%] max-w-[22px] rounded-t-[4px] bg-[hsl(var(--track))]"
                    style={{ height: `${Math.max(2, (expenseSeries[i] / max) * 100)}%` }}
                  />
                </span>
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
        <Card
          title="Coming up"
          sub="Bills and income from your recurring list"
          action={
            <Link href="/calendar" className={chipClass}>
              Calendar
            </Link>
          }
        >
          {upcoming.length === 0 ? (
            <Empty title="Nothing scheduled" line="Tick “Every month” on an expense, or add one under Recurring." />
          ) : (
            upcoming.map((r) => {
              const d = daysBetweenLocal(today, r.nextOn) ?? 0;
              const inc = r.kind === "income";
              return (
                <Row
                  key={r.id}
                  icon={
                    <span
                      className={cn("kb-pill min-w-[64px] justify-center", inc ? "" : "kb-pill-neutral")}
                      style={inc ? ({ "--h": 150 } as React.CSSProperties) : undefined}
                    >
                      {shortDate(r.nextOn).replace(/ \d{4}$/, "")}
                    </span>
                  }
                  title={r.name}
                  line={`${d < 0 ? `${plural(-d, "day")} overdue` : d === 0 ? "today" : `in ${plural(d, "day")}`} · ${ledger.acctName(r.accountId)}`}
                  right={
                    <b className={cn("block text-[14px]", inc && "text-[hsl(var(--primary-dark))]")}>
                      {inc ? "+" : "−"}
                      {taka(r.currency === "USD" ? r.amountMinor * ledger.rate : r.amountMinor)}
                    </b>
                  }
                />
              );
            })
          )}
        </Card>
      </div>
    </Page>
  );
}

function Tile({ tone, children }: { tone: "amber" | "red" | "info" | "green"; children: React.ReactNode }) {
  const cls = {
    amber: "bg-[hsl(var(--amber-soft))] text-[hsl(var(--amber-text))]",
    red: "bg-[hsl(var(--destructive-soft))] text-destructive",
    info: "bg-[hsl(var(--info-soft))] text-[hsl(var(--info-text))]",
    green: "bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary-dark))]"
  }[tone];
  return (
    <span className={cn("grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px]", cls)}>{children}</span>
  );
}

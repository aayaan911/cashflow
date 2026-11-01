import Link from "next/link";
import { PiggyBank, Target } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { buttonVariants } from "@/components/ui/button";
import { topbarAddClass } from "@/components/topbar";
import { KpiStrip } from "@/components/kpi-strip";
import { Input, MoneyInput } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Page, Card, Bar, Empty } from "@/components/cashflow/shell";
import { AccountSelect, AddRow, Select } from "@/components/cashflow/fields";
import { addDeposit, saveGoal } from "@/app/money/actions";
import { getLedger } from "@/lib/ledger";
import { getGoals, monthOf, shiftMonth, sumBdt, inMonth, type Tx } from "@/lib/cashflow";
import { pct, taka, takaCompact } from "@/lib/money";
import { cn, plural, shortDate, todayLocalISO } from "@/lib/utils";

export const metadata = { title: "Savings" };

/** Months from this month until a goal's due date, at least 1. */
function monthsUntil(due: string | null, today: string): number {
  if (!due) return 0;
  const [y1, m1] = today.split("-").map(Number);
  const [y2, m2] = due.split("-").map(Number);
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1));
}

/** Savings: goals with a target and a date, and the deposits toward each (your Notion "Savings Finance"). */
export default async function SavingsPage() {
  const [ledger, { goals, deposits }] = await Promise.all([getLedger(), getGoals()]);
  const today = todayLocalISO();
  const year = today.slice(0, 4);
  const saved = goals.reduce((s, g) => s + g.savedMinor, 0);
  const target = goals.reduce((s, g) => s + g.targetMinor, 0);
  const thisYear = deposits.filter((d) => d.on.startsWith(year)).reduce((s, d) => s + d.amountMinor, 0);
  const yearIncome = Array.from({ length: Number(today.slice(5, 7)) }, (_, i) => shiftMonth(monthOf(today), -i)).reduce(
    (s, m) => s + sumBdt(inMonth(ledger.tx, m) as Tx[], "income"),
    0
  );
  const needed = goals
    .filter((g) => g.dueOn && g.savedMinor < g.targetMinor)
    .reduce((s, g) => s + Math.ceil((g.targetMinor - g.savedMinor) / monthsUntil(g.dueOn, today)), 0);
  const last3 = [0, 1, 2].map((i) => monthOf(today).replace(/.*/, shiftMonth(monthOf(today), -i)));
  const pace = Math.round(
    deposits.filter((d) => last3.includes(monthOf(d.on))).reduce((s, d) => s + d.amountMinor, 0) / 3
  );
  const next = [...goals]
    .filter((g) => g.savedMinor < g.targetMinor)
    .sort((a, b) => a.targetMinor - a.savedMinor - (b.targetMinor - b.savedMinor))[0];
  const best = [...goals].sort((a, b) => b.savedMinor / b.targetMinor - a.savedMinor / a.targetMinor)[0];
  const goalName = (id: string) => goals.find((g) => g.id === id)?.name ?? "Removed goal";
  const tones = ["green", "info", "purple", "amber"] as const;

  return (
    <Page
      title="Savings"
      add={
        <Link href="#deposit-form" className={topbarAddClass}>
          <PiggyBank className="h-4 w-4" /> Add to savings
        </Link>
      }
    >
      <PageTitle
        title="Savings"
        line={
          goals.length ? (
            <>
              <b>{takaCompact(saved)}</b> put away across {plural(goals.length, "goal")}.
              {best && (
                <>
                  {" "}
                  {best.name} is <b>{pct(best.savedMinor, best.targetMinor)}%</b> there.
                </>
              )}
            </>
          ) : (
            "Give your savings a name, a target and a date. Each deposit moves the bar."
          )
        }
        actions={
          <Link href="#goal-form" className={buttonVariants({ variant: "outline" })}>
            <Target className="h-4 w-4" /> New goal
          </Link>
        }
      />
      <KpiStrip
        items={[
          {
            label: "Saved in total",
            value: takaCompact(saved),
            sub: `${plural(goals.length, "goal")} · ${takaCompact(target)} target`
          },
          {
            label: `This year`,
            value: takaCompact(thisYear),
            sub: yearIncome ? `${pct(thisYear, yearIncome)}% of income` : "deposits since January",
            tone: "good"
          },
          {
            label: "Monthly pace",
            value: taka(pace),
            sub: needed ? `needed: ${taka(needed)} for every goal on time` : "average of the last 3 months",
            tone: needed && pace < needed ? "warn" : "default"
          },
          {
            label: "Next milestone",
            value: next?.name ?? "·",
            sub: next
              ? `${taka(next.targetMinor - next.savedMinor)} to go${next.dueOn ? ` · ${shortDate(next.dueOn)}` : ""}`
              : "every goal reached"
          }
        ]}
      />
      {goals.length === 0 ? (
        <Card>
          <Empty title="No goals yet" line="Emergency fund, a trip, a laptop: add the first one below." />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((g, i) => (
            <section
              key={g.id}
              className="flex flex-col gap-2 rounded-[14px] border border-border bg-card px-[18px] py-4 shadow-[var(--shadow-1)]"
            >
              <div className="flex items-baseline justify-between gap-2.5">
                <b className="truncate text-[14.5px]">{g.name}</b>
                {g.dueOn && (
                  <span className="shrink-0 text-[12.5px] text-muted-foreground">
                    by {shortDate(g.dueOn).replace(/^\d+ /, "")}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[24px] font-bold tracking-[-0.035em] tabular-nums">{taka(g.savedMinor)}</span>
                <span className="text-[12.5px] text-muted-foreground">of {taka(g.targetMinor)}</span>
              </div>
              <Bar pct={pct(g.savedMinor, g.targetMinor)} tone={tones[i % tones.length]} className="h-2" />
              <div className="flex justify-between text-[12.5px] text-muted-foreground">
                <span>
                  {pct(g.savedMinor, g.targetMinor)}%{g.accountId ? ` · in ${ledger.acctName(g.accountId)}` : ""}
                </span>
                <span>{g.savedMinor >= g.targetMinor ? "Reached" : `${taka(g.targetMinor - g.savedMinor)} to go`}</span>
              </div>
              {g.dueOn && g.savedMinor < g.targetMinor && (
                <p className="text-[12px] text-muted-foreground">
                  {taka(Math.ceil((g.targetMinor - g.savedMinor) / monthsUntil(g.dueOn, today)))} a month gets there on
                  time.
                </p>
              )}
            </section>
          ))}
        </div>
      )}
      {goals.length > 0 && (
        <Card title="Add to savings" className="scroll-mt-20" bodyClass="p-0">
          <form action={addDeposit} id="deposit-form">
            <input type="hidden" name="return_to" value="/savings" />
            <AddRow className="border-t-0 bg-transparent sm:grid-cols-[150px_1fr_170px_150px]">
              <Input type="date" name="deposited_on" defaultValue={today} aria-label="Date" className="h-10" />
              <Select name="goal_id" aria-label="Goal" className="h-10">
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
              <Select name="source" defaultValue="From income" aria-label="Source" className="h-10">
                <option>From income</option>
                <option>Debt back</option>
                <option>Sale</option>
                <option>Gift</option>
              </Select>
              <MoneyInput
                name="amount"
                placeholder="Amount"
                min="0"
                step="1"
                required
                aria-label="Amount"
                className="h-10"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-full">
                <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <input type="checkbox" name="withdraw" className="h-4 w-4 accent-[hsl(var(--primary-fill))]" />
                  This is a withdrawal from the goal
                </label>
                <SubmitButton pendingText="Saving…" className="min-h-[40px]">
                  <PiggyBank className="h-4 w-4" /> Save
                </SubmitButton>
              </div>
            </AddRow>
          </form>
        </Card>
      )}
      {deposits.length > 0 && (
        <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-1)]">
          <Table className="min-w-[560px]">
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Goal</TH>
                <TH>Source</TH>
                <TH className="text-right">Amount</TH>
              </tr>
            </THead>
            <TBody>
              {deposits.slice(0, 50).map((d) => (
                <TR key={d.id}>
                  <TD className="text-muted-foreground">{shortDate(d.on)}</TD>
                  <TD className="font-semibold">{goalName(d.goalId)}</TD>
                  <TD>{d.source ? <span className="kb-pill kb-pill-neutral">{d.source}</span> : null}</TD>
                  <TD
                    className={cn(
                      "text-right font-mono tabular-nums",
                      d.amountMinor > 0 ? "text-[hsl(var(--primary-dark))]" : "text-destructive"
                    )}
                  >
                    {d.amountMinor > 0 ? "+" : "−"}
                    {taka(Math.abs(d.amountMinor))}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
      <Card title="New goal" className="scroll-mt-20" bodyClass="p-0">
        <form action={saveGoal} id="goal-form">
          <input type="hidden" name="return_to" value="/savings" />
          <AddRow className="border-t-0 bg-transparent sm:grid-cols-[1fr_160px_160px_170px]">
            <Input
              name="name"
              placeholder="Name, e.g. Emergency fund"
              required
              aria-label="Goal name"
              className="h-10"
            />
            <MoneyInput
              name="target"
              placeholder="Target"
              min="0"
              step="1"
              required
              aria-label="Target"
              className="h-10"
            />
            <Input type="date" name="due_on" aria-label="Target date" className="h-10" />
            <AccountSelect accounts={ledger.accounts} allowNone label="Kept in" />
            <div className="flex justify-end sm:col-span-full">
              <SubmitButton pendingText="Saving…" className="min-h-[40px]">
                <Target className="h-4 w-4" /> Add goal
              </SubmitButton>
            </div>
          </AddRow>
        </form>
      </Card>
    </Page>
  );
}

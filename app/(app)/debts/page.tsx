import Link from "next/link";
import { Check, HandCoins } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { topbarAddClass } from "@/components/topbar";
import { KpiStrip } from "@/components/kpi-strip";
import { Input, MoneyInput } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Page, Card, LinkTabs, Bar, Empty } from "@/components/cashflow/shell";
import { AccountSelect, AddRow, Select } from "@/components/cashflow/fields";
import { addDebt, addDebtPayment, settleDebt } from "@/app/money/actions";
import { getLedger } from "@/lib/ledger";
import { getDebts, type Debt } from "@/lib/cashflow";
import { pct, taka } from "@/lib/money";
import { daysBetweenLocal, plural, shortDate, todayLocalISO } from "@/lib/utils";

export const metadata = { title: "Debts" };

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

/**
 * Debts: money lent and borrowed, with part payments, laid out like KinBird's Customers. None of it counts as
 * income or spending: lending ৳20,000 is not a ৳20,000 expense.
 */
export default async function DebtsPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const [ledger, debts] = await Promise.all([getLedger(), getDebts()]);
  const tab = searchParams?.tab === "settled" ? "settled" : "open";
  const today = todayLocalISO();
  const open = debts.filter((d) => !d.settledAt && d.paidMinor < d.totalMinor);
  const settled = debts.filter((d) => d.settledAt || d.paidMinor >= d.totalMinor);
  const lent = open.filter((d) => d.direction === "lent");
  const borrowed = open.filter((d) => d.direction === "borrowed");
  const owedToMe = lent.reduce((s, d) => s + d.totalMinor - d.paidMinor, 0);
  const iOwe = borrowed.reduce((s, d) => s + d.totalMinor - d.paidMinor, 0);
  const year = today.slice(0, 4);
  const collected = debts
    .filter((d) => d.direction === "lent")
    .flatMap((d) => d.payments)
    .filter((p) => p.on.startsWith(year));
  const oldest = [...open].sort((a, b) => a.startedOn.localeCompare(b.startedOn))[0];

  const person = (d: Debt) => {
    const left = d.totalMinor - d.paidMinor;
    const days = daysBetweenLocal(d.startedOn, today) ?? 0;
    const done = Boolean(d.settledAt) || left <= 0;
    return (
      <div key={d.id} className="border-t border-border py-3 first:border-t-0">
        <div className="flex items-center gap-3">
          <span
            className={`grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[12px] font-bold ${d.direction === "lent" ? "bg-[hsl(var(--info-soft))] text-[hsl(var(--info-text))]" : "bg-[hsl(var(--surface-muted))] text-foreground"}`}
          >
            {initials(d.person)}
          </span>
          <div className="min-w-0 flex-1">
            <b className="block truncate text-[13.5px]">{d.person}</b>
            <small className="block text-[12px] text-muted-foreground">
              {done ? (
                <span className="font-semibold text-[hsl(var(--primary-dark))]">Settled</span>
              ) : (
                <b className={d.direction === "lent" ? "text-destructive" : "text-foreground"}>
                  {taka(left)} {d.direction === "lent" ? "due" : "left"}
                </b>
              )}{" "}
              · {pct(d.paidMinor, d.totalMinor)}% of {taka(d.totalMinor)} paid ·{" "}
              {done ? `since ${shortDate(d.startedOn)}` : plural(days, "day")}
              {d.note ? ` · ${d.note}` : ""}
            </small>
            <Bar
              pct={pct(d.paidMinor, d.totalMinor)}
              tone={done ? "green" : d.direction === "lent" ? "amber" : "info"}
              className="mt-1.5"
            />
          </div>
          {done && (
            <span className="kb-pill" style={{ "--h": 150 } as React.CSSProperties}>
              <Check className="h-3 w-3" /> Done
            </span>
          )}
        </div>
        {!done && (
          <form
            action={addDebtPayment}
            className="mt-2.5 grid grid-cols-[1fr_auto] gap-2 pl-[42px] sm:grid-cols-[140px_1fr_auto_auto]"
          >
            <input type="hidden" name="return_to" value={tab === "open" ? "/debts" : "/debts?tab=settled"} />
            <input type="hidden" name="debt_id" value={d.id} />
            <Input
              type="date"
              name="paid_on"
              defaultValue={today}
              aria-label="Date paid"
              className="col-span-2 h-9 text-[13px] sm:col-span-1"
            />
            <MoneyInput
              name="amount"
              placeholder={`Up to ${taka(left).slice(1)}`}
              min="0"
              step="1"
              required
              aria-label="Amount paid"
              className="h-9 text-[13px]"
            />
            <SubmitButton size="sm" pendingText="…" className="h-9">
              {d.direction === "lent" ? "Collect" : "Pay"}
            </SubmitButton>
            <button
              formAction={settleDebt}
              name="id"
              value={d.id}
              className="hidden h-9 rounded-[10px] px-2.5 text-[12.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:block"
              title="Mark settled without a payment"
            >
              Settle
            </button>
          </form>
        )}
      </div>
    );
  };

  const list = tab === "open" ? open : settled;
  return (
    <Page
      title="Debts"
      add={
        <Link href="#debt-form" className={topbarAddClass}>
          <HandCoins className="h-4 w-4" /> Record debt
        </Link>
      }
    >
      <PageTitle
        title="Debts"
        line={
          open.length ? (
            <>
              {owedToMe > 0 && (
                <>
                  <b className="text-destructive">{taka(owedToMe)}</b> is still with{" "}
                  {plural(new Set(lent.map((d) => d.person)).size, "person", "people")}.{" "}
                </>
              )}
              {iOwe > 0 && (
                <>
                  You owe <b>{taka(iOwe)}</b>.{" "}
                </>
              )}
              None of this counts as income or spending.
            </>
          ) : (
            "Money you lent or borrowed. It stays out of your income and spending totals."
          )
        }
      />
      <KpiStrip
        items={[
          {
            label: "Owed to you",
            value: taka(owedToMe),
            sub: plural(lent.length, "open debt"),
            tone: owedToMe ? "bad" : "default"
          },
          { label: "You owe", value: taka(iOwe), sub: plural(borrowed.length, "open debt") },
          {
            label: `Collected in ${year}`,
            value: taka(collected.reduce((s, p) => s + p.amountMinor, 0)),
            sub: plural(collected.length, "repayment"),
            tone: "good"
          },
          {
            label: "Oldest",
            value: oldest?.person ?? "·",
            sub: oldest
              ? `${plural(daysBetweenLocal(oldest.startedOn, today) ?? 0, "day")} · ${taka(oldest.totalMinor - oldest.paidMinor)} left`
              : "nothing open"
          }
        ]}
      />
      <LinkTabs
        current={tab === "open" ? "/debts" : "/debts?tab=settled"}
        tabs={[
          { href: "/debts", label: `Open (${open.length})` },
          { href: "/debts?tab=settled", label: `Settled (${settled.length})` }
        ]}
      />
      <div className="grid gap-3.5 sm:gap-[18px] lg:grid-cols-2">
        <Card title="Owed to you" sub="You lent it, they pay you back">
          {list.filter((d) => d.direction === "lent").length ? (
            list.filter((d) => d.direction === "lent").map(person)
          ) : (
            <Empty
              title="Nobody owes you"
              line={tab === "open" ? "Record money you lend below." : "Settled loans show here."}
            />
          )}
        </Card>
        <Card title="You owe" sub="You borrowed it, you pay it back">
          {list.filter((d) => d.direction === "borrowed").length ? (
            list.filter((d) => d.direction === "borrowed").map(person)
          ) : (
            <Empty
              title="You owe nobody"
              line={tab === "open" ? "Record money you borrow below." : "Settled debts show here."}
            />
          )}
        </Card>
      </div>
      <Card title="Record a debt" className="scroll-mt-20" bodyClass="p-0">
        <form action={addDebt} id="debt-form">
          <input type="hidden" name="return_to" value="/debts" />
          <AddRow className="border-t-0 bg-transparent sm:grid-cols-[150px_150px_1fr_150px] lg:grid-cols-[150px_150px_1fr_170px_150px_1fr]">
            <Input type="date" name="started_on" defaultValue={today} aria-label="Date" className="h-10" />
            <Select name="direction" defaultValue="lent" aria-label="Direction" className="h-10">
              <option value="lent">I lent</option>
              <option value="borrowed">I borrowed</option>
            </Select>
            <Input name="person" placeholder="Who, e.g. Rafin" required aria-label="Person" className="h-10" />
            <AccountSelect accounts={ledger.accounts} allowNone />
            <MoneyInput
              name="amount"
              placeholder="Amount"
              min="0"
              step="1"
              required
              aria-label="Amount"
              className="h-10"
            />
            <Input name="note" placeholder="Note, e.g. camera lens" aria-label="Note" className="h-10" />
            <div className="flex justify-end sm:col-span-full">
              <SubmitButton pendingText="Saving…" className="min-h-[40px]">
                <HandCoins className="h-4 w-4" /> Record
              </SubmitButton>
            </div>
          </AddRow>
        </form>
      </Card>
    </Page>
  );
}

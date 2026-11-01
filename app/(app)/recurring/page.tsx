import Link from "next/link";
import { Check, Pause, Play, Repeat, Trash2 } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { topbarAddClass } from "@/components/topbar";
import { KpiStrip } from "@/components/kpi-strip";
import { Input, MoneyInput } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Page, Card, LinkTabs, Empty } from "@/components/cashflow/shell";
import { AccountSelect, AddRow, Select } from "@/components/cashflow/fields";
import { CatIcon, CatPill } from "@/components/cashflow/category-icon";
import { FirstRun } from "@/components/cashflow/first-run";
import { deleteRecurring, payRecurring, saveRecurring, toggleRecurring } from "@/app/money/actions";
import { getLedger } from "@/lib/ledger";
import { getRecurring, type Recurring } from "@/lib/cashflow";
import { money, taka } from "@/lib/money";
import { addDaysISO, cn, daysBetweenLocal, plural, shortDate, todayLocalISO } from "@/lib/utils";

export const metadata = { title: "Recurring" };

const EVERY: Record<string, string> = { week: "Weekly", month: "Monthly", year: "Yearly" };

/** Monthly value of an item in taka: weekly × 52/12, yearly ÷ 12. */
function monthly(r: Recurring, rate: number) {
  const bdt = r.currency === "USD" ? r.amountMinor * rate : r.amountMinor;
  return r.every === "week" ? Math.round((bdt * 52) / 12) : r.every === "year" ? Math.round(bdt / 12) : bdt;
}

/**
 * Recurring: rent, bills, retainers. "Paid" records the transaction on its due date and moves the next date
 * on by one period, so the dashboard's Coming up and the calendar always read from here.
 */
export default async function RecurringPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const [ledger, items] = await Promise.all([getLedger(), getRecurring()]);
  const tab = ["paused", "income", "expense"].includes(searchParams?.tab ?? "") ? searchParams!.tab! : "active";
  const today = todayLocalISO();
  const active = items.filter((r) => r.active);
  const rows =
    tab === "paused"
      ? items.filter((r) => !r.active)
      : tab === "income"
        ? active.filter((r) => r.kind === "income")
        : tab === "expense"
          ? active.filter((r) => r.kind === "expense")
          : active;
  const out = active.filter((r) => r.kind === "expense" && r.every !== "year");
  const inc = active.filter((r) => r.kind === "income");
  const outMonthly = out.reduce((s, r) => s + monthly(r, ledger.rate), 0);
  const inMonthly = inc.reduce((s, r) => s + monthly(r, ledger.rate), 0);
  const dueWeek = active.filter((r) => r.kind === "expense" && (daysBetweenLocal(today, r.nextOn) ?? 99) <= 7);
  const yearly = active.filter((r) => r.every === "year");
  const empty = ledger.accounts.length === 0 && ledger.categories.length === 0;

  return (
    <Page
      title="Recurring"
      add={
        <Link href="#recurring-form" className={topbarAddClass}>
          <Repeat className="h-4 w-4" /> Add recurring
        </Link>
      }
    >
      <PageTitle
        title="Recurring"
        line={
          active.length ? (
            <>
              <b>{taka(outMonthly)}</b> leaves every month on {plural(out.length, "item")}
              {inMonthly ? (
                <>
                  , and <b className="text-[hsl(var(--primary-dark))]">{taka(inMonthly)}</b> comes in
                </>
              ) : null}
              .
              {dueWeek.length > 0 && (
                <> {plural(dueWeek.length, "is", "are").replace(/^\d+ /, `${dueWeek.length} `)} due this week.</>
              )}
            </>
          ) : (
            "Rent, bills, subscriptions and retainers. Add them once and Cashflow reminds you when each is due."
          )
        }
      />
      {empty && <FirstRun returnTo="/recurring" />}
      <KpiStrip
        items={[
          { label: "Monthly out", value: taka(outMonthly), sub: plural(out.length, "active bill") },
          { label: "Monthly in", value: taka(inMonthly), sub: plural(inc.length, "item"), tone: "good" },
          {
            label: "Due in 7 days",
            value: taka(dueWeek.reduce((s, r) => s + monthly(r, ledger.rate), 0)),
            sub: dueWeek.length
              ? dueWeek
                  .map((r) => r.name)
                  .slice(0, 3)
                  .join(", ")
              : "nothing due",
            tone: dueWeek.length ? "warn" : "default"
          },
          {
            label: "Yearly",
            value: taka(
              yearly.reduce((s, r) => s + (r.currency === "USD" ? r.amountMinor * ledger.rate : r.amountMinor), 0)
            ),
            sub: yearly[0] ? `${yearly[0].name} · ${shortDate(yearly[0].nextOn)}` : "none"
          }
        ]}
      />
      <LinkTabs
        current={tab === "active" ? "/recurring" : `/recurring?tab=${tab}`}
        tabs={[
          { href: "/recurring", label: "Active" },
          { href: "/recurring?tab=expense", label: "Bills" },
          { href: "/recurring?tab=income", label: "Income" },
          { href: "/recurring?tab=paused", label: "Paused" }
        ]}
      />
      <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-1)]">
        {rows.length === 0 ? (
          <Empty
            title={tab === "paused" ? "Nothing paused" : "Nothing recurring yet"}
            line="Add one below, or tick “Every month” when you add an expense."
          />
        ) : (
          <Table className="min-w-[760px]">
            <THead>
              <tr>
                <TH>Item</TH>
                <TH>Category</TH>
                <TH>Every</TH>
                <TH>Next</TH>
                <TH className="text-right">Amount</TH>
                <TH className="w-[170px]" aria-label="Actions" />
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => {
                const cat = ledger.cat(r.categoryId);
                const d = daysBetweenLocal(today, r.nextOn) ?? 0;
                const isInc = r.kind === "income";
                return (
                  <TR key={r.id} className={cn(!r.active && "opacity-60")}>
                    <TD>
                      <span className="flex items-center gap-2.5 font-semibold">
                        <CatIcon
                          icon={cat?.icon ?? "tag"}
                          name={cat?.name ?? r.name}
                          className="h-[26px] w-[26px] rounded-[7px] [&_svg]:h-[13px] [&_svg]:w-[13px]"
                        />
                        <span className="min-w-0">
                          <span className="block truncate">{r.name}</span>
                          <span className="block text-[11.5px] font-normal text-muted-foreground">
                            {ledger.acctName(r.accountId)}
                            {r.estimate ? " · estimate, confirm when paid" : ""}
                          </span>
                        </span>
                      </span>
                    </TD>
                    <TD>
                      <CatPill name={cat?.name} />
                    </TD>
                    <TD className="text-muted-foreground">{EVERY[r.every]}</TD>
                    <TD>
                      {r.active ? (
                        <span
                          className={cn("kb-pill", d > 7 && "kb-pill-neutral")}
                          style={d <= 7 ? ({ "--h": d < 0 ? 1 : 35 } as React.CSSProperties) : undefined}
                        >
                          {shortDate(r.nextOn).replace(/ \d{4}$/, "")}
                          {d < 0 ? " · overdue" : d === 0 ? " · today" : d <= 7 ? ` · ${d}d` : ""}
                        </span>
                      ) : (
                        <span className="kb-pill kb-pill-neutral">paused</span>
                      )}
                    </TD>
                    <TD className={cn("text-right font-mono tabular-nums", isInc && "text-[hsl(var(--primary-dark))]")}>
                      {isInc ? "+" : "−"}
                      {money(r.amountMinor, r.currency)}
                    </TD>
                    <TD>
                      <span className="flex items-center justify-end gap-1">
                        {r.active && (
                          <form action={payRecurring}>
                            <input type="hidden" name="return_to" value="/recurring" />
                            <input type="hidden" name="id" value={r.id} />
                            <SubmitButton size="sm" pendingText="…" className="h-8">
                              <Check className="h-3.5 w-3.5" /> {isInc ? "Received" : "Paid"}
                            </SubmitButton>
                          </form>
                        )}
                        <form action={toggleRecurring}>
                          <input
                            type="hidden"
                            name="return_to"
                            value={tab === "active" ? "/recurring" : `/recurring?tab=${tab}`}
                          />
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="active" value={r.active ? "0" : "1"} />
                          <button
                            type="submit"
                            className="grid h-8 w-8 place-items-center rounded-[7px] text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label={r.active ? `Pause ${r.name}` : `Resume ${r.name}`}
                            title={r.active ? "Pause" : "Resume"}
                          >
                            {r.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                          </button>
                        </form>
                        <form action={deleteRecurring}>
                          <input type="hidden" name="return_to" value="/recurring" />
                          <input type="hidden" name="id" value={r.id} />
                          <button
                            type="submit"
                            className="grid h-8 w-8 place-items-center rounded-[7px] text-muted-foreground/60 hover:bg-[hsl(var(--destructive-soft))] hover:text-destructive"
                            aria-label={`Remove ${r.name}`}
                            title="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      </span>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </div>
      <Card
        title="Add recurring"
        sub="It shows on the calendar and under Coming up. Mark it paid each time and the next date moves on."
        className="scroll-mt-20"
        bodyClass="p-0"
      >
        <form action={saveRecurring} id="recurring-form">
          <input type="hidden" name="return_to" value="/recurring" />
          <AddRow className="border-t-0 bg-transparent sm:grid-cols-[1fr_130px_150px] lg:grid-cols-[1fr_120px_170px_150px_120px_150px_140px]">
            <Input name="name" placeholder="Name, e.g. Internet (Link3)" required aria-label="Name" className="h-10" />
            <Select name="kind" defaultValue="expense" aria-label="Kind" className="h-10">
              <option value="expense">Bill</option>
              <option value="income">Income</option>
            </Select>
            <Select name="category_id" defaultValue="" aria-label="Category" className="h-10">
              <option value="">No category</option>
              {ledger.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.kind === "income" ? "income" : "expense"})
                </option>
              ))}
            </Select>
            <AccountSelect accounts={ledger.accounts} />
            <Select name="every" defaultValue="month" aria-label="Every" className="h-10">
              <option value="month">Monthly</option>
              <option value="week">Weekly</option>
              <option value="year">Yearly</option>
            </Select>
            <Input
              type="date"
              name="next_on"
              defaultValue={addDaysISO(today, 30)}
              required
              aria-label="Next due"
              className="h-10"
            />
            <MoneyInput
              name="amount"
              placeholder="Amount"
              min="0"
              step="0.01"
              required
              aria-label="Amount"
              className="h-10"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-full">
              <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <input type="checkbox" name="estimate" className="h-4 w-4 accent-[hsl(var(--primary-fill))]" />
                The amount changes (electricity): treat it as an estimate
              </label>
              <SubmitButton pendingText="Saving…" className="min-h-[40px]">
                <Repeat className="h-4 w-4" /> Add
              </SubmitButton>
            </div>
          </AddRow>
        </form>
      </Card>
    </Page>
  );
}

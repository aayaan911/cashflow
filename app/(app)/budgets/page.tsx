import Link from "next/link";
import { Target } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { topbarAddClass } from "@/components/topbar";
import { KpiStrip } from "@/components/kpi-strip";
import { MoneyInput } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Page, MonthChips, Bar, usedTone, Empty } from "@/components/cashflow/shell";
import { CatIcon } from "@/components/cashflow/category-icon";
import { FirstRun } from "@/components/cashflow/first-run";
import { setBudget } from "@/app/money/actions";
import { getLedger } from "@/lib/ledger";
import { budgetsFor } from "@/lib/budgets";
import { monthLabel, monthOf, resolveMonth } from "@/lib/cashflow";
import { pct, taka, takaCompact, toMajor } from "@/lib/money";
import { cn, daysBetweenLocal, plural, todayLocalISO } from "@/lib/utils";

export const metadata = { title: "Budgets" };

/**
 * Budgets: a limit per expense category for the month, its bar coloured by how much is used. The limit field
 * on each row saves for this month and, by default, becomes the category's limit for later months too.
 */
export default async function BudgetsPage({ searchParams }: { searchParams?: { m?: string } }) {
  const month = resolveMonth(searchParams?.m);
  const [ledger, lines] = await Promise.all([getLedger(), budgetsFor(month, getLedger())]);
  const limit = lines.reduce((s, b) => s + b.limitMinor, 0);
  const spent = lines.reduce((s, b) => s + b.spentMinor, 0);
  const sorted = [...lines].sort(
    (a, b) =>
      (b.limitMinor ? b.spentMinor / b.limitMinor : -1) - (a.limitMinor ? a.spentMinor / a.limitMinor : -1) ||
      b.spentMinor - a.spentMinor
  );
  const near = lines.filter((b) => b.limitMinor > 0 && pct(b.spentMinor, b.limitMinor) >= 90);
  const today = todayLocalISO();
  const isNow = month === monthOf(today);
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const daysLeft = isNow ? (daysBetweenLocal(today, `${month}-${String(daysInMonth).padStart(2, "0")}`) ?? 0) + 1 : 0;
  const unbudgeted = lines.filter((b) => !b.limitMinor && b.spentMinor > 0);
  const returnTo = `/budgets?m=${month}`;

  return (
    <Page
      title="Budgets"
      add={
        <Link href="#budget-table" className={topbarAddClass}>
          <Target className="h-4 w-4" /> Set budgets
        </Link>
      }
    >
      <PageTitle
        title="Budgets"
        line={
          limit > 0 ? (
            <>
              <b>{taka(Math.max(0, limit - spent))}</b> left of {taka(limit)} for {monthLabel(month)}.
              {near.length > 0 && (
                <>
                  {" "}
                  <b className="text-destructive">{plural(near.length, "category", "categories")}</b>{" "}
                  {near.length === 1 ? "is" : "are"} at 90% or more.
                </>
              )}
            </>
          ) : (
            "Set a monthly limit on each category. The bars turn amber at 75% and red at 90%."
          )
        }
      />
      {ledger.categories.length === 0 && ledger.accounts.length === 0 && <FirstRun returnTo={returnTo} />}
      <KpiStrip
        items={[
          {
            label: "Budget",
            value: takaCompact(limit),
            sub: plural(lines.filter((b) => b.limitMinor).length, "category", "categories")
          },
          {
            label: "Spent",
            value: takaCompact(spent),
            sub: limit ? `${pct(spent, limit)}% used` : "no limit set",
            tone: limit && pct(spent, limit) >= 90 ? "bad" : limit && pct(spent, limit) >= 75 ? "warn" : "default"
          },
          {
            label: "Left",
            value: takaCompact(Math.max(0, limit - spent)),
            sub:
              isNow && daysLeft
                ? `${taka(Math.max(0, Math.floor((limit - spent) / daysLeft)))} a day for ${plural(daysLeft, "day")}`
                : monthLabel(month)
          },
          {
            label: "Not budgeted",
            value: takaCompact(unbudgeted.reduce((s, b) => s + b.spentMinor, 0)),
            sub: unbudgeted.length
              ? unbudgeted
                  .map((b) => b.category.name)
                  .slice(0, 2)
                  .join(", ")
              : "everything has a limit"
          }
        ]}
      />
      <MonthChips month={month} base="/budgets" />
      <div
        id="budget-table"
        className="scroll-mt-20 overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-1)]"
      >
        {lines.length === 0 ? (
          <Empty title="No expense categories yet" line="Add categories first, then give each a monthly limit." />
        ) : (
          <Table className="min-w-[720px]">
            <THead>
              <tr>
                <TH>Category</TH>
                <TH className="w-[30%]">Used</TH>
                <TH className="text-right">Spent</TH>
                <TH className="text-right">Left</TH>
                <TH className="w-[230px]">Limit for {monthLabel(month, true)}</TH>
              </tr>
            </THead>
            <TBody>
              {sorted.map((b) => {
                const p = b.limitMinor ? pct(b.spentMinor, b.limitMinor) : 0;
                const left = b.limitMinor - b.spentMinor;
                return (
                  <TR key={b.category.id}>
                    <TD>
                      <span className="flex items-center gap-2.5 font-semibold">
                        <CatIcon
                          icon={b.category.icon}
                          name={b.category.name}
                          className="h-[26px] w-[26px] rounded-[7px] [&_svg]:h-[13px] [&_svg]:w-[13px]"
                        />
                        {b.category.name}
                      </span>
                    </TD>
                    <TD>
                      {b.limitMinor ? (
                        <span className="flex items-center gap-2">
                          <Bar pct={p} tone={usedTone(p)} />
                          <span
                            className={cn(
                              "w-[38px] shrink-0 text-right text-[12px] font-semibold",
                              p >= 90
                                ? "text-destructive"
                                : p >= 75
                                  ? "text-[hsl(var(--amber-text))]"
                                  : "text-muted-foreground"
                            )}
                          >
                            {p}%
                          </span>
                        </span>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">No limit</span>
                      )}
                    </TD>
                    <TD className="text-right font-mono tabular-nums">{taka(b.spentMinor)}</TD>
                    <TD className={cn("text-right font-mono tabular-nums", left < 0 && "text-destructive")}>
                      {b.limitMinor ? (left < 0 ? `−${taka(-left)}` : taka(left)) : "·"}
                    </TD>
                    <TD>
                      <form action={setBudget} className="flex items-center gap-1.5">
                        <input type="hidden" name="return_to" value={returnTo} />
                        <input type="hidden" name="category_id" value={b.category.id} />
                        <input type="hidden" name="month" value={month} />
                        <input type="hidden" name="as_default" value="on" />
                        <MoneyInput
                          name="limit"
                          defaultValue={b.limitMinor ? toMajor(b.limitMinor) : ""}
                          placeholder="Limit"
                          min="0"
                          step="1"
                          aria-label={`Limit for ${b.category.name}`}
                          className="h-9 text-[13px]"
                        />
                        <SubmitButton size="sm" variant="outline" pendingText="…" className="h-9">
                          Save
                        </SubmitButton>
                      </form>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </div>
    </Page>
  );
}

import Link from "next/link";
import { Repeat } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { topbarAddClass } from "@/components/topbar";
import { Page, Card, MonthChips, Empty } from "@/components/cashflow/shell";
import { getLedger } from "@/lib/ledger";
import { getRecurring, monthLabel, resolveMonth, type Recurring } from "@/lib/cashflow";
import { taka } from "@/lib/money";
import { addDaysISO, cn, shortDate, todayLocalISO } from "@/lib/utils";

export const metadata = { title: "Calendar" };

interface Ev {
  on: string;
  name: string;
  minor: number;
  kind: "bill" | "income" | "paid" | "received";
  sub: string;
}

/** Every date a recurring item falls on within [from, to], walking forward from next_on. */
function occurrences(r: Recurring, from: string, to: string): string[] {
  const out: string[] = [];
  let d = r.nextOn;
  for (let i = 0; i < 60 && d <= to; i++) {
    if (d >= from) out.push(d);
    if (r.every === "week") d = addDaysISO(d, 7);
    else {
      const [y, m, day] = d.split("-").map(Number);
      const step = r.every === "year" ? 12 : 1;
      const t = new Date(y, m - 1 + step, 1);
      const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
      d = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
    }
  }
  return out;
}

/**
 * Calendar: the month grid. Paid and received entries from the ledger, plus what is still due from the
 * recurring list. Amber is a bill to pay, green is money expected, red is already paid.
 */
export default async function CalendarPage({ searchParams }: { searchParams?: { m?: string } }) {
  const [ledger, recurring] = await Promise.all([getLedger(), getRecurring()]);
  const month = resolveMonth(searchParams?.m);
  const today = todayLocalISO();
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const days = new Date(y, m, 0).getDate();
  const last = `${month}-${String(days).padStart(2, "0")}`;

  const events: Ev[] = [];
  for (const t of ledger.tx) {
    if (t.on < first || t.on > last || !t.recurringId) continue;
    events.push({
      on: t.on,
      name: t.name,
      minor: t.bdtMinor,
      kind: t.kind === "income" ? "received" : "paid",
      sub: `${t.kind === "income" ? "Received" : "Paid"} · ${ledger.acctName(t.accountId)}`
    });
  }
  for (const r of recurring.filter((x) => x.active)) {
    for (const on of occurrences(r, first < today ? today : first, last)) {
      events.push({
        on,
        name: r.name,
        minor: r.currency === "USD" ? r.amountMinor * ledger.rate : r.amountMinor,
        kind: r.kind === "income" ? "income" : "bill",
        sub: `${r.kind === "income" ? "Expected" : on < today ? "Overdue" : "Due"} · ${ledger.acctName(r.accountId)}`
      });
    }
  }
  events.sort((a, b) => a.on.localeCompare(b.on));
  const byDay = new Map<string, Ev[]>();
  for (const e of events) byDay.set(e.on, [...(byDay.get(e.on) ?? []), e]);
  const goingOut = events.filter((e) => e.kind === "bill" || e.kind === "paid").reduce((s, e) => s + e.minor, 0);
  const comingIn = events.filter((e) => e.kind === "income" || e.kind === "received").reduce((s, e) => s + e.minor, 0);

  // Monday-first grid with the neighbouring months greyed.
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const cells: { iso: string; day: number; out: boolean }[] = [];
  for (let i = lead; i > 0; i--) {
    const iso = addDaysISO(first, -i);
    cells.push({ iso, day: Number(iso.slice(8)), out: true });
  }
  for (let d = 1; d <= days; d++) cells.push({ iso: `${month}-${String(d).padStart(2, "0")}`, day: d, out: false });
  while (cells.length % 7) {
    const iso = addDaysISO(cells[cells.length - 1].iso, 1);
    cells.push({ iso, day: Number(iso.slice(8)), out: true });
  }
  const tone = (k: Ev["kind"]) =>
    k === "income" || k === "received"
      ? "bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary-dark))]"
      : k === "paid"
        ? "bg-[hsl(var(--destructive-soft))] text-destructive"
        : "bg-[hsl(var(--amber-soft))] text-[hsl(var(--amber-text))]";
  const dot = (k: Ev["kind"]) =>
    k === "income" || k === "received"
      ? "bg-[hsl(var(--primary))]"
      : k === "paid"
        ? "bg-[hsl(var(--destructive))]"
        : "bg-[hsl(var(--amber))]";

  return (
    <Page
      title="Calendar"
      add={
        <Link href="/recurring#recurring-form" className={topbarAddClass}>
          <Repeat className="h-4 w-4" /> Add bill
        </Link>
      }
    >
      <PageTitle
        eyebrow={monthLabel(month)}
        title="Calendar"
        line={
          events.length ? (
            <>
              <b>{taka(goingOut)}</b> going out and <b className="text-[hsl(var(--primary-dark))]">{taka(comingIn)}</b>{" "}
              coming in this month, from your recurring list.
            </>
          ) : (
            "Bills and income from your recurring list land here by day."
          )
        }
      />
      <div className="grid gap-3.5 sm:gap-[18px] lg:grid-cols-[1.45fr_1fr]">
        <Card title={monthLabel(month)} action={<MonthChips month={month} base="/calendar" />}>
          <div className="grid grid-cols-7 gap-1">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="py-1 text-center text-[11.5px] font-semibold text-muted-foreground">
                {d}
              </div>
            ))}
            {cells.map((c) => {
              const evs = byDay.get(c.iso) ?? [];
              return (
                <div
                  key={c.iso}
                  className={cn(
                    "flex aspect-square min-w-0 flex-col gap-[3px] overflow-hidden rounded-[10px] border border-border bg-card p-1.5 text-[12.5px]",
                    c.out && "opacity-40",
                    c.iso === today &&
                      "border-[hsl(var(--primary-fill))] shadow-[inset_0_0_0_1px_hsl(var(--primary-fill))]"
                  )}
                >
                  <span className="font-semibold">{c.day}</span>
                  {evs.slice(0, 2).map((e, i) => (
                    <span
                      key={i}
                      className={cn("hidden truncate rounded-[5px] px-1.5 py-px text-[11px] sm:block", tone(e.kind))}
                    >
                      {e.name}
                    </span>
                  ))}
                  {evs.length > 2 && (
                    <span className="hidden text-[10.5px] text-muted-foreground sm:block">+{evs.length - 2} more</span>
                  )}
                  <span className="mt-auto flex flex-wrap gap-[3px] sm:hidden">
                    {evs.map((e, i) => (
                      <i key={i} className={cn("h-[7px] w-[7px] rounded-full", dot(e.kind))} />
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
        <Card title="This month">
          <div className="mb-2 flex flex-wrap gap-3.5 text-[12px] text-muted-foreground">
            <span>
              <i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] bg-[hsl(var(--amber))] align-[-1px]" />
              Bill due
            </span>
            <span>
              <i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] bg-[hsl(var(--primary))] align-[-1px]" />
              Income
            </span>
            <span>
              <i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] bg-[hsl(var(--destructive))] align-[-1px]" />
              Paid
            </span>
          </div>
          {events.length === 0 ? (
            <Empty title="Nothing this month" line="Add rent, bills and retainers under Recurring." />
          ) : (
            events.map((e, i) => (
              <div key={i} className="flex items-center gap-3 border-t border-border py-[11px] first:border-t-0">
                <span
                  className={cn("kb-pill min-w-[64px] justify-center", e.kind === "bill" ? "" : "")}
                  style={{ "--h": e.kind === "bill" ? 35 : e.kind === "paid" ? 1 : 150 } as React.CSSProperties}
                >
                  {shortDate(e.on).replace(/ \d{4}$/, "")}
                </span>
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[13.5px]">{e.name}</b>
                  <small className="block text-[12px] text-muted-foreground">{e.sub}</small>
                </div>
                <b
                  className={cn(
                    "font-mono text-[13.5px] tabular-nums",
                    (e.kind === "income" || e.kind === "received") && "text-[hsl(var(--primary-dark))]"
                  )}
                >
                  {e.kind === "income" || e.kind === "received" ? "+" : "−"}
                  {taka(e.minor)}
                </b>
              </div>
            ))
          )}
        </Card>
      </div>
    </Page>
  );
}

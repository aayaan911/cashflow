import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ListOrdered, Plus } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { topbarAddClass } from "@/components/topbar";
import { KpiStrip } from "@/components/kpi-strip";
import { Page, Chip, LinkTabs, Empty } from "@/components/cashflow/shell";
import { TxTable } from "@/components/cashflow/tx-table";
import { FirstRun } from "@/components/cashflow/first-run";
import { getLedger } from "@/lib/ledger";
import { sumBdt, type Tx } from "@/lib/cashflow";
import { taka } from "@/lib/money";
import { plural } from "@/lib/utils";

export const metadata = { title: "Transactions" };

type Search = { kind?: string; acct?: string; q?: string };

/** Every entry, newest first, with a kind tab, an account chip and a search box (prototype v4 Payments). */
export default async function TransactionsPage({ searchParams }: { searchParams?: Search }) {
  const ledger = await getLedger();
  const kind = searchParams?.kind === "income" || searchParams?.kind === "expense" ? searchParams.kind : "";
  const acct = searchParams?.acct ?? "";
  const q = (searchParams?.q ?? "").trim().toLowerCase();
  let rows: Tx[] = ledger.tx;
  if (kind) rows = rows.filter((t) => t.kind === kind);
  if (acct) rows = rows.filter((t) => t.accountId === acct);
  if (q)
    rows = rows.filter((t) =>
      [t.name, t.note, t.source, ledger.catName(t.categoryId)].some((v) => v?.toLowerCase().includes(q))
    );
  const shown = rows.slice(0, 300);
  const qs = (patch: Partial<Search>) => {
    const p = new URLSearchParams();
    const next = { kind, acct, q, ...patch };
    if (next.kind) p.set("kind", next.kind);
    if (next.acct) p.set("acct", next.acct);
    if (next.q) p.set("q", next.q);
    const s = p.toString();
    return `/transactions${s ? `?${s}` : ""}`;
  };
  const returnTo = qs({});
  const last30 = ledger.tx.filter((t) => Date.parse(t.on) >= Date.now() - 30 * 86400000);
  const empty = ledger.accounts.length === 0 && ledger.categories.length === 0;

  return (
    <Page
      title="Transactions"
      add={
        <Link href="/expenses#add" className={topbarAddClass}>
          <Plus className="h-4 w-4" /> Add expense
        </Link>
      }
    >
      <PageTitle
        title="Transactions"
        line={
          ledger.tx.length ? (
            <>
              <b>{plural(last30.length, "entry", "entries")}</b> in the last 30 days:{" "}
              <b className="text-[hsl(var(--primary-dark))]">{taka(sumBdt(last30, "income"))}</b> in,{" "}
              <b className="text-destructive">{taka(sumBdt(last30, "expense"))}</b> out.
            </>
          ) : (
            "Every income and expense you record shows here, newest first."
          )
        }
      />
      {empty && <FirstRun returnTo={returnTo} />}
      <KpiStrip
        items={[
          {
            label: "All time in",
            value: taka(sumBdt(ledger.tx, "income")),
            sub: plural(ledger.tx.filter((t) => t.kind === "income").length, "entry", "entries"),
            tone: "good",
            href: "/income"
          },
          {
            label: "All time out",
            value: taka(sumBdt(ledger.tx, "expense")),
            sub: plural(ledger.tx.filter((t) => t.kind === "expense").length, "entry", "entries"),
            tone: "bad",
            href: "/expenses"
          },
          {
            label: "Transfers",
            value: String(ledger.transfers.length),
            sub: "between your accounts",
            href: "/transfers"
          },
          {
            label: "Net worth",
            value: taka(ledger.netWorthBdt),
            sub: `${plural(ledger.accounts.filter((a) => !a.archived).length, "account")} · $1 = ৳${ledger.rate}`,
            href: "/accounts"
          }
        ]}
      />
      <LinkTabs
        current={kind ? qs({ kind }) : qs({ kind: "" })}
        tabs={[
          { href: qs({ kind: "" }), label: "All", icon: <ListOrdered className="h-3.5 w-3.5" /> },
          { href: qs({ kind: "income" }), label: "Income", icon: <ArrowDownLeft className="h-3.5 w-3.5" /> },
          { href: qs({ kind: "expense" }), label: "Expenses", icon: <ArrowUpRight className="h-3.5 w-3.5" /> },
          { href: "/transfers", label: "Transfers", icon: <ArrowLeftRight className="h-3.5 w-3.5" /> }
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
          <Chip href={qs({ acct: "" })} on={!acct}>
            All accounts
          </Chip>
          {ledger.accounts
            .filter((a) => !a.archived)
            .map((a) => (
              <Chip key={a.id} href={qs({ acct: a.id })} on={acct === a.id}>
                {a.name}
              </Chip>
            ))}
        </div>
        <form className="ml-auto w-full sm:w-[280px]" action="/transactions" method="get">
          {kind && <input type="hidden" name="kind" value={kind} />}
          {acct && <input type="hidden" name="acct" value={acct} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search item, note or source"
            aria-label="Search"
            className="h-9 w-full rounded-[10px] border border-border bg-card px-3 text-[13px] shadow-[var(--shadow-1)] placeholder:text-muted-foreground focus-visible:border-[hsl(var(--ring))] focus-visible:outline-none"
          />
        </form>
      </div>
      <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-1)]">
        {shown.length ? (
          <TxTable
            rows={shown}
            ledger={ledger}
            returnTo={returnTo}
            showKind={!kind}
            total={{
              label:
                rows.length > shown.length
                  ? `Showing ${shown.length} of ${rows.length}`
                  : plural(rows.length, "entry", "entries"),
              minor: rows.reduce((s, t) => s + (t.kind === "income" ? t.bdtMinor : -t.bdtMinor), 0)
            }}
          />
        ) : (
          <Empty
            title={q || kind || acct ? "Nothing matches" : "No entries yet"}
            line={
              q || kind || acct
                ? "Try another word or clear the filters."
                : "Add income or an expense and it appears here."
            }
          />
        )}
      </div>
    </Page>
  );
}

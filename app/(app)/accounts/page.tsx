import Link from "next/link";
import { Archive, ArchiveRestore, Wallet } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { topbarAddClass } from "@/components/topbar";
import { Input, MoneyInput } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Page, Card, Empty } from "@/components/cashflow/shell";
import { AddRow, Select } from "@/components/cashflow/fields";
import { AccountIcon } from "@/components/cashflow/category-icon";
import { FirstRun } from "@/components/cashflow/first-run";
import { archiveAccount, saveAccount } from "@/app/money/actions";
import { getLedger } from "@/lib/ledger";
import { dollars, money, taka, takaCompact, toMajor } from "@/lib/money";
import { plural, shortDate } from "@/lib/utils";

export const metadata = { title: "Accounts" };

const KINDS = [
  { value: "bank", label: "Bank" },
  { value: "mobile", label: "Mobile wallet" },
  { value: "cash", label: "Cash" },
  { value: "usd", label: "USD wallet (Payoneer, Fiverr…)" },
  { value: "other", label: "Other" }
];
const KIND_LABEL: Record<string, string> = {
  bank: "Bank",
  mobile: "Mobile wallet",
  cash: "In hand",
  usd: "USD wallet",
  other: "Other"
};

/**
 * Accounts: one card per account with its balance, worked out from the opening balance plus every entry and
 * transfer. A USD account shows dollars with the taka value at the last withdrawal rate.
 */
export default async function AccountsPage({ searchParams }: { searchParams?: { edit?: string } }) {
  const ledger = await getLedger();
  const live = ledger.accounts.filter((a) => !a.archived);
  const archived = ledger.accounts.filter((a) => a.archived);
  const editing = ledger.accounts.find((a) => a.id === searchParams?.edit) ?? null;
  const biggest = [...live].sort(
    (a, b) =>
      (ledger.balances.get(b.id) ?? 0) * (b.currency === "USD" ? ledger.rate : 1) -
      (ledger.balances.get(a.id) ?? 0) * (a.currency === "USD" ? ledger.rate : 1)
  )[0];
  const lastMove = (id: string) => {
    const t = ledger.tx.find((x) => x.accountId === id);
    const tr = ledger.transfers.find((x) => x.fromId === id || x.toId === id);
    const tOn = t?.on ?? "";
    const trOn = tr?.on ?? "";
    if (!tOn && !trOn) return "no entries yet";
    if (tOn >= trOn && t)
      return `${t.kind === "income" ? "+" : "−"}${money(t.amountMinor, t.currency)} · ${shortDate(t.on).replace(/ \d{4}$/, "")}`;
    return tr
      ? `${tr.toId === id ? "+" : "−"}${money(tr.toId === id ? tr.receivedMinor : tr.sentMinor, tr.toId === id ? tr.receivedCurrency : tr.sentCurrency)} transfer · ${shortDate(tr.on).replace(/ \d{4}$/, "")}`
      : "";
  };

  return (
    <Page
      title="Accounts"
      add={
        <Link href="#account-form" className={topbarAddClass}>
          <Wallet className="h-4 w-4" /> Add account
        </Link>
      }
    >
      <PageTitle
        title="Accounts"
        line={
          live.length ? (
            <>
              <b>{takaCompact(ledger.netWorthBdt)}</b> across {plural(live.length, "account")}.
              {biggest && (
                <>
                  {" "}
                  Most of it sits in <b>{biggest.name}</b>.
                </>
              )}{" "}
              Balances are worked out from your entries.
            </>
          ) : (
            "Banks, mobile wallets, cash and USD wallets. Add the ones you use."
          )
        }
      />
      {ledger.accounts.length === 0 && ledger.categories.length === 0 && <FirstRun returnTo="/accounts" />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {live.map((a) => {
          const bal = ledger.balances.get(a.id) ?? 0;
          return (
            <section
              key={a.id}
              className="flex flex-col gap-2.5 rounded-[14px] border border-border bg-card px-[18px] py-4 shadow-[var(--shadow-1)]"
            >
              <div className="flex items-center gap-2.5">
                <AccountIcon kind={a.kind} className="h-[34px] w-[34px] rounded-[10px]" />
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[14px]">{a.name}</b>
                  <small className="block text-[12px] text-muted-foreground">{KIND_LABEL[a.kind]}</small>
                </div>
                <span
                  className={a.currency === "USD" ? "kb-pill" : "kb-pill kb-pill-neutral"}
                  style={a.currency === "USD" ? ({ "--h": 211 } as React.CSSProperties) : undefined}
                >
                  {a.currency}
                </span>
              </div>
              <div
                className={`text-[24px] font-bold tracking-[-0.035em] tabular-nums ${bal < 0 ? "text-destructive" : ""}`}
              >
                {money(bal, a.currency)}
                {a.currency === "USD" && (
                  <small className="ml-1.5 text-[12.5px] font-medium tracking-normal text-muted-foreground">
                    ≈ {taka(bal * ledger.rate)}
                  </small>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 text-[12.5px] text-muted-foreground">
                <span className="truncate">{lastMove(a.id)}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <Link href={`/transactions?acct=${a.id}`} className="font-semibold text-[hsl(var(--primary-dark))]">
                    History ›
                  </Link>
                  <Link
                    href={`/accounts?edit=${a.id}#account-form`}
                    className="font-semibold text-foreground/70 hover:text-foreground"
                  >
                    Edit
                  </Link>
                </span>
              </div>
            </section>
          );
        })}
      </div>
      {live.length === 0 && ledger.accounts.length > 0 && (
        <Empty title="Every account is archived" line="Restore one below, or add a new account." />
      )}
      <Card
        title={editing ? `Edit ${editing.name}` : "Add an account"}
        sub={
          editing
            ? "The opening balance is what it held before your first entry here."
            : "The opening balance is what it holds today, before any entries."
        }
        className="scroll-mt-20"
        bodyClass="p-0"
      >
        <form action={saveAccount} id="account-form">
          <input type="hidden" name="return_to" value="/accounts" />
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <AddRow className="border-t-0 bg-transparent sm:grid-cols-[1fr_220px_180px_auto]">
            <Input
              name="name"
              placeholder="Name, e.g. DBBL, Payoneer, Nagad"
              defaultValue={editing?.name}
              required
              aria-label="Account name"
              className="h-10"
            />
            <Select name="kind" defaultValue={editing?.kind ?? "bank"} aria-label="Type" className="h-10">
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
            <MoneyInput
              name="opening"
              placeholder="Opening balance"
              defaultValue={editing ? toMajor(editing.openingMinor) : undefined}
              min="0"
              step="0.01"
              aria-label="Opening balance"
              className="h-10"
            />
            <SubmitButton pendingText="Saving…" className="min-h-[40px]">
              {editing ? "Save" : "Add account"}
            </SubmitButton>
          </AddRow>
          <p className="px-3 pb-3 text-[12px] text-muted-foreground">
            A USD wallet keeps dollars and converts at your latest withdrawal rate (now ৳{ledger.rate}).
          </p>
        </form>
        {editing && (
          <form action={archiveAccount} className="border-t border-border px-3 py-2.5">
            <input type="hidden" name="return_to" value="/accounts" />
            <input type="hidden" name="id" value={editing.id} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-destructive"
            >
              <Archive className="h-3.5 w-3.5" /> Archive {editing.name}
            </button>
          </form>
        )}
      </Card>
      {archived.length > 0 && (
        <Card title="Archived" sub="Hidden from pickers. Their history stays.">
          {archived.map((a) => (
            <div key={a.id} className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0">
              <AccountIcon kind={a.kind} />
              <span className="flex-1 text-[13.5px] font-semibold">{a.name}</span>
              <span className="font-mono text-[13px] text-muted-foreground">
                {a.currency === "USD" ? dollars(ledger.balances.get(a.id) ?? 0) : taka(ledger.balances.get(a.id) ?? 0)}
              </span>
              <form action={archiveAccount}>
                <input type="hidden" name="return_to" value="/accounts" />
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="restore" value="1" />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[hsl(var(--primary-dark))]"
                >
                  <ArchiveRestore className="h-3.5 w-3.5" /> Restore
                </button>
              </form>
            </div>
          ))}
        </Card>
      )}
    </Page>
  );
}

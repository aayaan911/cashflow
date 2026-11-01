import Link from "next/link";
import { ArrowLeftRight, Trash2 } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { topbarAddClass } from "@/components/topbar";
import { KpiStrip } from "@/components/kpi-strip";
import { Input, MoneyInput } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Page, Card, Empty } from "@/components/cashflow/shell";
import { AccountSelect, AddRow } from "@/components/cashflow/fields";
import { FirstRun } from "@/components/cashflow/first-run";
import { addTransfer, deleteTransfer } from "@/app/money/actions";
import { getLedger } from "@/lib/ledger";
import { money, taka, takaCompact, dollars } from "@/lib/money";
import { plural, shortDate, todayLocalISO } from "@/lib/utils";

export const metadata = { title: "Transfers" };

/**
 * Transfers (your Notion "Withdraws"): money moving between your own accounts. Not income, not spending.
 * A USD to BDT withdrawal records the rate you got, and that rate values every USD balance afterwards.
 */
export default async function TransfersPage() {
  const ledger = await getLedger();
  const year = todayLocalISO().slice(0, 4);
  const usdOut = ledger.transfers.filter((t) => t.sentCurrency === "USD" && t.receivedCurrency === "BDT");
  const thisYear = usdOut.filter((t) => t.on.startsWith(year));
  const sentUsd = thisYear.reduce((s, t) => s + t.sentMinor, 0);
  const gotBdt = thisYear.reduce((s, t) => s + t.receivedMinor, 0);
  const avgRate = sentUsd ? Math.round((gotBdt / sentUsd) * 100) / 100 : 0;
  const bestRate = Math.max(0, ...usdOut.map((t) => t.rate ?? 0));
  const feesBdt = ledger.transfers
    .filter((t) => t.on.startsWith(year))
    .reduce((s, t) => s + (t.sentCurrency === "USD" ? t.feeMinor * ledger.rate : t.feeMinor), 0);
  const usdAccounts = ledger.accounts.filter((a) => a.currency === "USD" && !a.archived);
  const usdIdle = usdAccounts.reduce((s, a) => s + (ledger.balances.get(a.id) ?? 0), 0);
  const empty = ledger.accounts.length === 0;

  return (
    <Page
      title="Transfers"
      add={
        <Link href="#add" className={topbarAddClass}>
          <ArrowLeftRight className="h-4 w-4" /> New transfer
        </Link>
      }
    >
      <PageTitle
        title="Transfers"
        line={
          usdIdle > 0 ? (
            <>
              <b>{dollars(usdIdle)}</b> is still in {usdAccounts.map((a) => a.name).join(" and ")}. Your last withdrawal
              got <b>৳{ledger.rate}</b> per dollar.
            </>
          ) : (
            "Money moving between your own accounts. It never counts as income or spending."
          )
        }
      />
      {empty && <FirstRun returnTo="/transfers" />}
      <KpiStrip
        items={[
          {
            label: `Withdrawn in ${year}`,
            value: takaCompact(gotBdt),
            sub: sentUsd
              ? `${dollars(sentUsd)} · ${plural(thisYear.length, "withdrawal")}`
              : "no dollar withdrawals yet"
          },
          {
            label: "Average rate",
            value: avgRate ? `৳${avgRate}` : "·",
            sub: bestRate ? `per dollar · best ৳${bestRate}` : "per dollar"
          },
          {
            label: "Fees",
            value: taka(feesBdt),
            sub: gotBdt ? `${((feesBdt / gotBdt) * 100).toFixed(1)}% of withdrawals` : "this year"
          },
          { label: "Transfers", value: String(ledger.transfers.length), sub: "all time" }
        ]}
      />
      <Card
        title="New transfer"
        sub="From one of your accounts to another. For dollars, enter the rate you got or the taka that arrived."
        className="scroll-mt-20"
        bodyClass="p-0"
      >
        <form action={addTransfer} id="add">
          <input type="hidden" name="return_to" value="/transfers" />
          <AddRow className="border-t-0 bg-transparent sm:grid-cols-[150px_1fr_1fr_140px] lg:grid-cols-[150px_1fr_1fr_130px_120px_130px_110px]">
            <Input type="date" name="occurred_on" defaultValue={todayLocalISO()} aria-label="Date" className="h-10" />
            <AccountSelect
              accounts={ledger.accounts}
              balances={ledger.balances}
              name="from_account_id"
              label="From"
              defaultValue={usdAccounts[0]?.id}
            />
            <AccountSelect
              accounts={ledger.accounts}
              balances={ledger.balances}
              name="to_account_id"
              label="To"
              defaultValue={ledger.accounts.find((a) => a.currency === "BDT" && a.kind === "bank")?.id}
            />
            <MoneyInput
              name="sent"
              placeholder="Sent"
              min="0"
              step="0.01"
              required
              aria-label="Amount sent"
              className="h-10"
            />
            <Input
              name="rate"
              inputMode="decimal"
              placeholder={`Rate ৳${ledger.rate}`}
              aria-label="Rate, taka per dollar"
              className="h-10"
            />
            <MoneyInput
              name="received"
              placeholder="Received"
              min="0"
              step="0.01"
              aria-label="Amount received"
              className="h-10"
            />
            <MoneyInput name="fee" placeholder="Fee" min="0" step="0.01" aria-label="Fee" className="h-10" />
            <div className="flex justify-end sm:col-span-full">
              <SubmitButton pendingText="Saving…" className="min-h-[40px]">
                <ArrowLeftRight className="h-4 w-4" /> Record transfer
              </SubmitButton>
            </div>
          </AddRow>
        </form>
      </Card>
      <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--shadow-1)]">
        {ledger.transfers.length === 0 ? (
          <Empty title="No transfers yet" line="Payoneer to bank, bank to bKash, bKash to cash: each one goes here." />
        ) : (
          <Table className="min-w-[640px]">
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>From</TH>
                <TH>To</TH>
                <TH className="text-right">Sent</TH>
                <TH className="text-right">Rate</TH>
                <TH className="text-right">Received</TH>
                <TH className="text-right">Fee</TH>
                <TH className="w-9" aria-label="Actions" />
              </tr>
            </THead>
            <TBody>
              {ledger.transfers.map((t) => (
                <TR key={t.id}>
                  <TD className="whitespace-nowrap text-muted-foreground">{shortDate(t.on)}</TD>
                  <TD className="font-semibold">{ledger.acctName(t.fromId)}</TD>
                  <TD>{ledger.acctName(t.toId)}</TD>
                  <TD className="text-right font-mono tabular-nums">{money(t.sentMinor, t.sentCurrency)}</TD>
                  <TD className="text-right font-mono tabular-nums text-muted-foreground">
                    {t.rate ? `৳${t.rate}` : "·"}
                  </TD>
                  <TD className="text-right font-mono tabular-nums">{money(t.receivedMinor, t.receivedCurrency)}</TD>
                  <TD className="text-right font-mono tabular-nums text-muted-foreground">
                    {t.feeMinor ? money(t.feeMinor, t.sentCurrency) : "·"}
                  </TD>
                  <TD className="pr-2">
                    <form action={deleteTransfer}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="return_to" value="/transfers" />
                      <button
                        type="submit"
                        className="grid h-8 w-8 place-items-center rounded-[7px] text-muted-foreground/60 hover:bg-[hsl(var(--destructive-soft))] hover:text-destructive"
                        aria-label="Remove transfer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </Page>
  );
}

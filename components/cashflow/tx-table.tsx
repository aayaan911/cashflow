import { Trash2 } from "lucide-react";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CatIcon, CatPill } from "@/components/cashflow/category-icon";
import { deleteTransaction } from "@/app/money/actions";
import type { Ledger } from "@/lib/ledger";
import type { Tx } from "@/lib/cashflow";
import { dollars, taka } from "@/lib/money";
import { cn, shortDate } from "@/lib/utils";

/**
 * The ledger table (prototype v4 Expenses): date, item with its category icon, category pill, account,
 * amount in taka (red out, green in), the dollar figure beside it for a USD account. Delete is a tiny
 * icon form at the row's end, soft delete on the server.
 */
export function TxTable({
  rows,
  ledger,
  returnTo,
  showKind = false,
  showSource = false,
  total
}: {
  rows: Tx[];
  ledger: Ledger;
  returnTo: string;
  showKind?: boolean;
  showSource?: boolean;
  total?: { label: string; minor: number; kind?: "income" | "expense" };
}) {
  const hasUsd = rows.some((t) => t.currency === "USD");
  return (
    <Table className="min-w-[640px]">
      <THead>
        <tr>
          <TH className="w-[88px]">Date</TH>
          <TH>Item</TH>
          {showSource && <TH>Source</TH>}
          <TH>Category</TH>
          <TH>Account</TH>
          <TH className="text-right">Amount</TH>
          {hasUsd && <TH className="text-right">USD</TH>}
          <TH className="w-9" aria-label="Actions" />
        </tr>
      </THead>
      <TBody>
        {rows.map((t) => {
          const cat = ledger.cat(t.categoryId);
          const out = t.kind === "expense";
          return (
            <TR key={t.id}>
              <TD className="whitespace-nowrap text-muted-foreground">{shortDate(t.on).replace(/ \d{4}$/, "")}</TD>
              <TD>
                <span className="flex items-center gap-2.5 font-semibold">
                  <CatIcon
                    icon={cat?.icon ?? (out ? "tag" : "banknote")}
                    name={cat?.name ?? (out ? "expense" : "income")}
                    className="h-[26px] w-[26px] rounded-[7px] [&_svg]:h-[13px] [&_svg]:w-[13px]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate">
                      {t.name}
                      {showKind && (
                        <span className="ml-1.5 text-[11.5px] font-medium text-muted-foreground">
                          {out ? "expense" : "income"}
                        </span>
                      )}
                    </span>
                    {(t.note || (!showSource && t.source)) && (
                      <span className="block truncate text-[11.5px] font-normal text-muted-foreground">
                        {[t.source && !showSource ? t.source : null, t.note].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                </span>
              </TD>
              {showSource && <TD>{t.source ?? <span className="text-muted-foreground">·</span>}</TD>}
              <TD>
                <CatPill name={cat?.name} />
              </TD>
              <TD className="text-muted-foreground">{ledger.acctName(t.accountId)}</TD>
              <TD
                className={cn(
                  "whitespace-nowrap text-right font-mono tabular-nums font-medium",
                  out ? "text-destructive" : "text-[hsl(var(--primary-dark))]"
                )}
              >
                {out ? "−" : "+"}
                {taka(t.bdtMinor)}
              </TD>
              {hasUsd && (
                <TD className="text-right font-mono tabular-nums text-muted-foreground">
                  {t.currency === "USD" ? dollars(t.amountMinor) : ""}
                </TD>
              )}
              <TD className="pr-2">
                <form action={deleteTransaction}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="return_to" value={returnTo} />
                  <button
                    type="submit"
                    className="grid h-8 w-8 place-items-center rounded-[7px] text-muted-foreground/60 hover:bg-[hsl(var(--destructive-soft))] hover:text-destructive"
                    title="Remove"
                    aria-label={`Remove ${t.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </TD>
            </TR>
          );
        })}
      </TBody>
      {total && (
        <tfoot>
          <tr className="border-t border-border">
            <td colSpan={showSource ? 5 : 4} className="px-3 py-2.5 font-bold">
              {total.label}
            </td>
            <td
              className={cn(
                "px-3 py-2.5 text-right font-mono font-bold tabular-nums",
                total.kind === "expense"
                  ? "text-destructive"
                  : total.kind === "income"
                    ? "text-[hsl(var(--primary-dark))]"
                    : ""
              )}
            >
              {total.kind === "expense" ? "−" : total.kind === "income" ? "+" : ""}
              {taka(total.minor)}
            </td>
            <td colSpan={hasUsd ? 2 : 1} />
          </tr>
        </tfoot>
      )}
    </Table>
  );
}

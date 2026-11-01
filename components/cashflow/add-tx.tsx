import { Plus } from "lucide-react";
import { Input, MoneyInput } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { AccountSelect, AddRow, CategorySelect } from "@/components/cashflow/fields";
import { addTransaction } from "@/app/money/actions";
import type { Ledger } from "@/lib/ledger";
import { todayLocalISO } from "@/lib/utils";

/**
 * The inline add row under a ledger (prototype v4 Expenses): date, item, category, account, amount, then
 * "Every month" and the Add button. Posts natively to addTransaction. The USD account case needs no extra
 * field: the server applies the latest withdrawal rate and stores both figures.
 */
export function AddTx({
  kind,
  ledger,
  returnTo,
  placeholder
}: {
  kind: "income" | "expense";
  ledger: Ledger;
  returnTo: string;
  placeholder: string;
}) {
  const income = kind === "income";
  return (
    <form action={addTransaction}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="return_to" value={returnTo} />
      <AddRow
        className={
          income ? "sm:grid-cols-[150px_1fr_150px_170px_150px_140px]" : "sm:grid-cols-[150px_1fr_170px_150px_140px]"
        }
      >
        <Input type="date" name="occurred_on" defaultValue={todayLocalISO()} aria-label="Date" className="h-10" />
        <Input name="name" placeholder={placeholder} required aria-label="Item" className="h-10" />
        {income && <Input name="source" placeholder="Source, e.g. Fiverr" aria-label="Source" className="h-10" />}
        <CategorySelect categories={ledger.categories} kind={kind} />
        <AccountSelect accounts={ledger.accounts} balances={ledger.balances} />
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
            <input
              type="checkbox"
              name="recurring"
              className="h-4 w-4 rounded border-input accent-[hsl(var(--primary-fill))]"
            />
            {income ? "Every month (retainer, salary)" : "Every month (rent, electricity)"}
          </label>
          <SubmitButton pendingText="Saving…" className="min-h-[40px]">
            <Plus className="h-4 w-4" aria-hidden />
            Add
          </SubmitButton>
        </div>
      </AddRow>
    </form>
  );
}

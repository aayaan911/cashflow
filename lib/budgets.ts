import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { inMonth, type Category, type Tx } from "@/lib/cashflow";
import type { Ledger } from "@/lib/ledger";

export interface BudgetLine {
  category: Category;
  /** This month's limit: the budgets row for the month, else the category default. */
  limitMinor: number;
  spentMinor: number;
  /** True when the limit came from a per-month override. */
  override: boolean;
}

const getMonthOverrides = cache(async (month: string) => {
  const { data } = await createClient()
    .from("budgets")
    .select("category_id,limit_minor")
    .eq("month", `${month}-01`)
    .is("deleted_at", null);
  return new Map((data ?? []).map((b) => [b.category_id as string, Number(b.limit_minor)]));
});

/** One line per expense category for a month: limit, spent, with the category default as the fallback. */
export async function budgetsFor(month: string, ledgerIn: Ledger | Promise<Ledger>): Promise<BudgetLine[]> {
  // Both reads start together: awaiting the ledger first cost the dashboard one extra database round trip.
  const [overrides, ledger] = await Promise.all([getMonthOverrides(month), ledgerIn]);
  const spent = new Map<string, number>();
  for (const t of inMonth(ledger.tx, month) as Tx[])
    if (t.kind === "expense" && t.categoryId) spent.set(t.categoryId, (spent.get(t.categoryId) ?? 0) + t.bdtMinor);
  return ledger.categories
    .filter((c) => c.kind === "expense")
    .map((c) => ({
      category: c,
      limitMinor: overrides.has(c.id) ? (overrides.get(c.id) ?? 0) : c.budgetMinor,
      spentMinor: spent.get(c.id) ?? 0,
      override: overrides.has(c.id)
    }));
}

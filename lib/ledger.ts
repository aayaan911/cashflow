import { cache } from "react";
import {
  accountBalances,
  getAccounts,
  getAllTx,
  getCategories,
  getTransfers,
  latestUsdRate,
  toBdt,
  type Account,
  type Category,
  type Transfer,
  type Tx
} from "@/lib/cashflow";

export interface Ledger {
  accounts: Account[];
  categories: Category[];
  tx: Tx[];
  transfers: Transfer[];
  /** Balance per account id, in the account's own currency (minor units). */
  balances: Map<string, number>;
  /** Taka per dollar from the last USD withdrawal, or the default. */
  rate: number;
  /** Every live account's balance in taka, summed. */
  netWorthBdt: number;
  catName: (id: string | null) => string | null;
  cat: (id: string | null) => Category | null;
  acctName: (id: string | null) => string;
  acct: (id: string | null) => Account | null;
}

/** Everything a money page needs, in four parallel queries, once per request. */
export const getLedger = cache(async (): Promise<Ledger> => {
  const [accounts, categories, tx, transfers] = await Promise.all([
    getAccounts(),
    getCategories(),
    getAllTx(),
    getTransfers()
  ]);
  const balances = accountBalances(accounts, tx, transfers);
  const rate = latestUsdRate(transfers);
  const netWorthBdt = accounts
    .filter((a) => !a.archived)
    .reduce((s, a) => s + toBdt(balances.get(a.id) ?? 0, a.currency, rate), 0);
  const catById = new Map(categories.map((c) => [c.id, c]));
  const acctById = new Map(accounts.map((a) => [a.id, a]));
  return {
    accounts,
    categories,
    tx,
    transfers,
    balances,
    rate,
    netWorthBdt,
    catName: (id) => (id ? (catById.get(id)?.name ?? null) : null),
    cat: (id) => (id ? (catById.get(id) ?? null) : null),
    acctName: (id) => (id ? (acctById.get(id)?.name ?? "Removed account") : "No account"),
    acct: (id) => (id ? (acctById.get(id) ?? null) : null)
  };
});

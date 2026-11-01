import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { todayLocalISO } from "@/lib/utils";

/*
 * Cashflow data layer. Every loader is React cache()d: one client, one query per request. Money comes back
 * from PostgREST as strings for bigint columns, so each loader coerces to Number at the edge.
 */

export type Currency = "BDT" | "USD";
export type Kind = "income" | "expense";

export interface Account {
  id: string;
  name: string;
  kind: "bank" | "mobile" | "cash" | "usd" | "other";
  currency: Currency;
  openingMinor: number;
  sort: number;
  archived: boolean;
}
export interface Category {
  id: string;
  name: string;
  kind: Kind;
  icon: string;
  budgetMinor: number;
  sort: number;
}
export interface Tx {
  id: string;
  kind: Kind;
  on: string;
  name: string;
  note: string | null;
  amountMinor: number;
  currency: Currency;
  bdtMinor: number;
  fxRate: number | null;
  categoryId: string | null;
  accountId: string | null;
  source: string | null;
  recurringId: string | null;
}
export interface Transfer {
  id: string;
  on: string;
  fromId: string | null;
  toId: string | null;
  sentMinor: number;
  sentCurrency: Currency;
  receivedMinor: number;
  receivedCurrency: Currency;
  feeMinor: number;
  rate: number | null;
  note: string | null;
}
export interface Recurring {
  id: string;
  name: string;
  kind: Kind;
  amountMinor: number;
  currency: Currency;
  categoryId: string | null;
  accountId: string | null;
  every: "week" | "month" | "year";
  nextOn: string;
  active: boolean;
  estimate: boolean;
}
export interface Debt {
  id: string;
  person: string;
  direction: "lent" | "borrowed";
  totalMinor: number;
  startedOn: string;
  note: string | null;
  settledAt: string | null;
  paidMinor: number;
  payments: { id: string; on: string; amountMinor: number; note: string | null }[];
}
export interface Goal {
  id: string;
  name: string;
  targetMinor: number;
  dueOn: string | null;
  accountId: string | null;
  savedMinor: number;
}
export interface Deposit {
  id: string;
  goalId: string;
  on: string;
  amountMinor: number;
  source: string | null;
  note: string | null;
}

const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const nOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Default taka per dollar, used for a USD balance until a withdrawal records a real rate. */
export const DEFAULT_USD_RATE = 122;

/* ───────────── month helpers ───────────── */

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}
export function monthStart(month: string): string {
  return `${month}-01`;
}
export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthLabel(month: string, short = false): string {
  const [y, m] = month.split("-").map(Number);
  return `${(short ? MONTHS_SHORT : MONTHS_LONG)[m - 1]} ${y}`;
}
export function monthShort(month: string): string {
  return MONTHS_SHORT[Number(month.split("-")[1]) - 1];
}
/** A `?m=YYYY-MM` query value, or this month. */
export function resolveMonth(value: string | undefined): string {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : monthOf(todayLocalISO());
}

/* ───────────── loaders ───────────── */

export const getAccounts = cache(async (): Promise<Account[]> => {
  const { data } = await createClient()
    .from("accounts")
    .select("id,name,kind,currency,opening_minor,sort,archived_at")
    .is("deleted_at", null)
    .order("sort")
    .order("created_at");
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    currency: r.currency,
    openingMinor: n(r.opening_minor),
    sort: r.sort,
    archived: Boolean(r.archived_at)
  }));
});

export const getCategories = cache(async (): Promise<Category[]> => {
  const { data } = await createClient()
    .from("categories")
    .select("id,name,kind,icon,budget_minor,sort")
    .is("deleted_at", null)
    .order("sort")
    .order("name");
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    icon: r.icon,
    budgetMinor: n(r.budget_minor),
    sort: r.sort
  }));
});

function mapTx(r: Record<string, unknown>): Tx {
  return {
    id: r.id as string,
    kind: r.kind as Kind,
    on: r.occurred_on as string,
    name: r.name as string,
    note: (r.note as string | null) ?? null,
    amountMinor: n(r.amount_minor),
    currency: r.currency as Currency,
    bdtMinor: n(r.amount_bdt_minor),
    fxRate: nOrNull(r.fx_rate),
    categoryId: (r.category_id as string | null) ?? null,
    accountId: (r.account_id as string | null) ?? null,
    source: (r.source as string | null) ?? null,
    recurringId: (r.recurring_id as string | null) ?? null
  };
}
const TX_COLS =
  "id,kind,occurred_on,name,note,amount_minor,currency,amount_bdt_minor,fx_rate,category_id,account_id,source,recurring_id";

/** Every live transaction, newest first. A personal ledger is a few thousand rows at most. */
/**
 * Supabase returns at most 1,000 rows per request. Read the first page with an exact count, then every other
 * page at once, so years of history cost two round trips, not one per thousand rows.
 */
const PAGE = 1000;
async function readAll(table: "transactions" | "transfers", cols: string): Promise<Record<string, unknown>[]> {
  const query = (withCount: boolean) =>
    createClient()
      .from(table)
      .select(cols, withCount ? { count: "exact" } : undefined)
      .is("deleted_at", null)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });
  const first = await query(true).range(0, PAGE - 1);
  const rows = (first.data ?? []) as unknown as Record<string, unknown>[];
  const total = first.count ?? rows.length;
  if (total <= PAGE) return rows;
  const rest = await Promise.all(
    Array.from({ length: Math.ceil(total / PAGE) - 1 }, (_, i) =>
      query(false).range((i + 1) * PAGE, (i + 2) * PAGE - 1)
    )
  );
  return rows.concat(...rest.map((r) => (r.data ?? []) as unknown as Record<string, unknown>[]));
}

export const getAllTx = cache(async (): Promise<Tx[]> => {
  return (await readAll("transactions", TX_COLS)).map((r) => mapTx(r));
});

export const getTransfers = cache(async (): Promise<Transfer[]> => {
  const data = await readAll(
    "transfers",
    "id,occurred_on,from_account_id,to_account_id,sent_minor,sent_currency,received_minor,received_currency,fee_minor,rate,note"
  );
  return data.map((r) => ({
    id: r.id as string,
    on: r.occurred_on as string,
    fromId: r.from_account_id as string | null,
    toId: r.to_account_id as string | null,
    sentMinor: n(r.sent_minor),
    sentCurrency: r.sent_currency as Currency,
    receivedMinor: n(r.received_minor),
    receivedCurrency: r.received_currency as Currency,
    feeMinor: n(r.fee_minor),
    rate: nOrNull(r.rate),
    note: r.note as string | null
  }));
});

export const getRecurring = cache(async (): Promise<Recurring[]> => {
  const { data } = await createClient()
    .from("recurring")
    .select("id,name,kind,amount_minor,currency,category_id,account_id,every,next_on,active,estimate")
    .is("deleted_at", null)
    .order("next_on");
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    amountMinor: n(r.amount_minor),
    currency: r.currency,
    categoryId: r.category_id,
    accountId: r.account_id,
    every: r.every,
    nextOn: r.next_on,
    active: r.active,
    estimate: r.estimate
  }));
});

export const getDebts = cache(async (): Promise<Debt[]> => {
  const supabase = createClient();
  const [{ data: debts }, { data: pays }] = await Promise.all([
    supabase
      .from("debts")
      .select("id,person,direction,total_minor,started_on,note,settled_at")
      .is("deleted_at", null)
      .order("started_on", { ascending: false }),
    supabase
      .from("debt_payments")
      .select("id,debt_id,paid_on,amount_minor,note")
      .is("deleted_at", null)
      .order("paid_on", { ascending: false })
  ]);
  return (debts ?? []).map((d) => {
    const payments = (pays ?? [])
      .filter((p) => p.debt_id === d.id)
      .map((p) => ({ id: p.id, on: p.paid_on, amountMinor: n(p.amount_minor), note: p.note }));
    return {
      id: d.id,
      person: d.person,
      direction: d.direction,
      totalMinor: n(d.total_minor),
      startedOn: d.started_on,
      note: d.note,
      settledAt: d.settled_at,
      paidMinor: payments.reduce((s, p) => s + p.amountMinor, 0),
      payments
    };
  });
});

export const getGoals = cache(async (): Promise<{ goals: Goal[]; deposits: Deposit[] }> => {
  const supabase = createClient();
  const [{ data: goals }, { data: deps }] = await Promise.all([
    supabase
      .from("savings_goals")
      .select("id,name,target_minor,due_on,account_id")
      .is("deleted_at", null)
      .order("created_at"),
    supabase
      .from("savings_deposits")
      .select("id,goal_id,deposited_on,amount_minor,source,note")
      .is("deleted_at", null)
      .order("deposited_on", { ascending: false })
  ]);
  const deposits: Deposit[] = (deps ?? []).map((d) => ({
    id: d.id,
    goalId: d.goal_id,
    on: d.deposited_on,
    amountMinor: n(d.amount_minor),
    source: d.source,
    note: d.note
  }));
  return {
    goals: (goals ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      targetMinor: n(g.target_minor),
      dueOn: g.due_on,
      accountId: g.account_id,
      savedMinor: deposits.filter((d) => d.goalId === g.id).reduce((s, d) => s + d.amountMinor, 0)
    })),
    deposits
  };
});

/* ───────────── derived numbers ───────────── */

/** Balance of each account in its own currency: opening + income - expenses + transfers in - transfers out - fees. */
export function accountBalances(accounts: Account[], tx: Tx[], transfers: Transfer[]): Map<string, number> {
  const bal = new Map(accounts.map((a) => [a.id, a.openingMinor]));
  const add = (id: string | null, v: number) => {
    if (id && bal.has(id)) bal.set(id, (bal.get(id) ?? 0) + v);
  };
  for (const t of tx) add(t.accountId, t.kind === "income" ? t.amountMinor : -t.amountMinor);
  for (const t of transfers) {
    add(t.fromId, -(t.sentMinor + t.feeMinor));
    add(t.toId, t.receivedMinor);
  }
  return bal;
}

/** The most recent USD to BDT rate recorded on a transfer, or the default. */
export function latestUsdRate(transfers: Transfer[]): number {
  const t = transfers.find((x) => x.sentCurrency === "USD" && x.receivedCurrency === "BDT" && x.rate);
  return t?.rate ?? DEFAULT_USD_RATE;
}

export function toBdt(minor: number, currency: Currency, rate: number): number {
  return currency === "USD" ? Math.round(minor * rate) : minor;
}

export function sumBdt(tx: Tx[], kind: Kind): number {
  return tx.filter((t) => t.kind === kind).reduce((s, t) => s + t.bdtMinor, 0);
}

export function inMonth(tx: { on: string }[], month: string) {
  return tx.filter((t) => t.on.startsWith(month));
}

/** Whether a user still has an empty workspace: no accounts and no categories. */
export const needsDefaults = cache(async (): Promise<boolean> => {
  const [a, c] = await Promise.all([getAccounts(), getCategories()]);
  return a.length === 0 && c.length === 0;
});

/** Starter accounts and categories for a new user. Names are generic; a user renames them in Setup. */
export const DEFAULT_ACCOUNTS = [
  { name: "Cash", kind: "cash", currency: "BDT" },
  { name: "Bank", kind: "bank", currency: "BDT" },
  { name: "bKash", kind: "mobile", currency: "BDT" }
] as const;
export const DEFAULT_CATEGORIES = [
  { name: "Family", kind: "expense", icon: "home" },
  { name: "Monthly cost", kind: "expense", icon: "zap" },
  { name: "Snacks & meal", kind: "expense", icon: "coffee" },
  { name: "Transport", kind: "expense", icon: "car" },
  { name: "Shopping", kind: "expense", icon: "shopping-bag" },
  { name: "Business", kind: "expense", icon: "briefcase" },
  { name: "Tools & software", kind: "expense", icon: "wrench" },
  { name: "Health & fitness", kind: "expense", icon: "heart" },
  { name: "Friends & hangout", kind: "expense", icon: "users" },
  { name: "Charity", kind: "expense", icon: "gift" },
  { name: "Other", kind: "expense", icon: "tag" },
  { name: "Freelance", kind: "income", icon: "laptop" },
  { name: "Business", kind: "income", icon: "briefcase" },
  { name: "Salary", kind: "income", icon: "banknote" },
  { name: "Sale", kind: "income", icon: "tag" },
  { name: "Gift", kind: "income", icon: "gift" },
  { name: "Other", kind: "income", icon: "circle" }
] as const;

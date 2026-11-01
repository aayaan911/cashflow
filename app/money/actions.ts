"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/data";
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
  latestUsdRate,
  getTransfers,
  toBdt,
  type Currency
} from "@/lib/cashflow";
import { parseMinor } from "@/lib/money";
import { addDaysISO, todayLocalISO } from "@/lib/utils";

/*
 * Every write in Cashflow. Each action validates in plain words, writes one or two rows, then redirects back
 * to the page it came from with ?message= for the ToastBanner. owner_id is the column default (auth.uid()),
 * so a row can never be written for someone else.
 */

const clean = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const opt = (v: FormDataEntryValue | null) => clean(v) || null;
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

function back(formData: FormData, message: string, tone: "success" | "error" = "success"): never {
  const to = clean(formData.get("return_to")) || "/";
  const path = to.startsWith("/") ? to : "/";
  revalidatePath("/", "layout");
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${new URLSearchParams({ message, tone })}`);
}

async function requireUser() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  return user;
}

/* ───────────── first run ───────────── */

export async function seedDefaults(formData: FormData) {
  await requireUser();
  const supabase = createClient();
  const { count } = await supabase.from("accounts").select("id", { count: "exact", head: true }).is("deleted_at", null);
  if ((count ?? 0) > 0) back(formData, "Your setup already has accounts.");
  await supabase.from("accounts").insert(DEFAULT_ACCOUNTS.map((a, i) => ({ ...a, sort: i })));
  await supabase.from("categories").insert(DEFAULT_CATEGORIES.map((c, i) => ({ ...c, sort: i })));
  back(formData, "Starter accounts and categories added. Rename them any time in Setup.");
}

/* ───────────── transactions ───────────── */

export async function addTransaction(formData: FormData) {
  await requireUser();
  const kind = clean(formData.get("kind")) === "income" ? "income" : "expense";
  const name = clean(formData.get("name"));
  const on = clean(formData.get("occurred_on")) || todayLocalISO();
  const minor = parseMinor(formData.get("amount"));
  if (!name) back(formData, "Give it a name, like “Pathao ride” or “Fiverr order”.", "error");
  if (!minor) back(formData, "Enter an amount above zero.", "error");
  if (!isDate(on)) back(formData, "Pick a date.", "error");

  const supabase = createClient();
  const accountId = opt(formData.get("account_id"));
  let currency: Currency = "BDT";
  if (accountId) {
    const { data: acct } = await supabase.from("accounts").select("currency").eq("id", accountId).maybeSingle();
    currency = (acct?.currency as Currency) ?? "BDT";
  }
  const rateInput = Number(clean(formData.get("fx_rate")));
  const rate = currency === "USD" ? (rateInput > 0 ? rateInput : latestUsdRate(await getTransfers())) : null;
  const { error } = await supabase.from("transactions").insert({
    kind,
    occurred_on: on,
    name,
    note: opt(formData.get("note")),
    amount_minor: minor,
    currency,
    amount_bdt_minor: toBdt(minor, currency, rate ?? 1),
    fx_rate: rate,
    category_id: opt(formData.get("category_id")),
    account_id: accountId,
    source: opt(formData.get("source"))
  });
  if (error) back(formData, `Could not save: ${error.message}`, "error");

  // "Every month" on an expense or income row also creates the recurring item, due next month.
  if (formData.get("recurring") === "on") {
    await supabase.from("recurring").insert({
      name,
      kind,
      amount_minor: minor,
      currency,
      category_id: opt(formData.get("category_id")),
      account_id: accountId,
      every: "month",
      next_on: addMonths(on, 1)
    });
  }
  back(formData, kind === "income" ? `Income recorded: ${name}.` : `Expense recorded: ${name}.`);
}

export async function deleteTransaction(formData: FormData) {
  await requireUser();
  const id = clean(formData.get("id"));
  if (id) await createClient().from("transactions").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  back(formData, "Removed.");
}

/* ───────────── transfers ───────────── */

export async function addTransfer(formData: FormData) {
  await requireUser();
  const on = clean(formData.get("occurred_on")) || todayLocalISO();
  const fromId = opt(formData.get("from_account_id"));
  const toId = opt(formData.get("to_account_id"));
  const sent = parseMinor(formData.get("sent"));
  if (!fromId || !toId) back(formData, "Pick the account it left and the account it reached.", "error");
  if (fromId === toId) back(formData, "From and to are the same account.", "error");
  if (!sent) back(formData, "Enter the amount sent.", "error");

  const supabase = createClient();
  const { data: accts } = await supabase.from("accounts").select("id,currency").in("id", [fromId, toId]);
  const cur = (id: string) => (accts?.find((a) => a.id === id)?.currency as Currency) ?? "BDT";
  const sentCur = cur(fromId);
  const recvCur = cur(toId);
  const rateInput = Number(clean(formData.get("rate")));
  const fee = parseMinor(formData.get("fee")) ?? 0;
  let received = parseMinor(formData.get("received"));
  let rate: number | null = null;
  if (sentCur !== recvCur) {
    // USD → BDT needs a rate or a received amount; one gives the other.
    if (!received && rateInput > 0) received = Math.round(sent * rateInput);
    if (!received) back(formData, "Enter the rate you got, or the taka that arrived.", "error");
    rate = sentCur === "USD" ? Math.round((received / sent) * 10000) / 10000 : null;
  } else if (!received) received = sent;

  const { error } = await supabase.from("transfers").insert({
    occurred_on: on,
    from_account_id: fromId,
    to_account_id: toId,
    sent_minor: sent,
    sent_currency: sentCur,
    received_minor: received,
    received_currency: recvCur,
    fee_minor: fee,
    rate,
    note: opt(formData.get("note"))
  });
  if (error) back(formData, `Could not save: ${error.message}`, "error");
  back(formData, "Transfer recorded.");
}

export async function deleteTransfer(formData: FormData) {
  await requireUser();
  const id = clean(formData.get("id"));
  if (id) await createClient().from("transfers").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  back(formData, "Removed.");
}

/* ───────────── accounts ───────────── */

export async function saveAccount(formData: FormData) {
  await requireUser();
  const id = opt(formData.get("id"));
  const name = clean(formData.get("name"));
  const kind = clean(formData.get("kind")) || "bank";
  const currency: Currency = kind === "usd" || clean(formData.get("currency")) === "USD" ? "USD" : "BDT";
  const opening = parseMinor(formData.get("opening")) ?? 0;
  if (!name) back(formData, "Give the account a name.", "error");
  const supabase = createClient();
  const row = { name, kind, currency, opening_minor: opening };
  const { error } = id
    ? await supabase.from("accounts").update(row).eq("id", id)
    : await supabase.from("accounts").insert(row);
  if (error) back(formData, `Could not save: ${error.message}`, "error");
  back(formData, id ? `${name} updated.` : `${name} added.`);
}

export async function archiveAccount(formData: FormData) {
  await requireUser();
  const id = clean(formData.get("id"));
  const restore = formData.get("restore") === "1";
  if (id)
    await createClient()
      .from("accounts")
      .update({ archived_at: restore ? null : new Date().toISOString() })
      .eq("id", id);
  back(formData, restore ? "Account restored." : "Account archived. Its history stays.");
}

/* ───────────── categories ───────────── */

export async function saveCategory(formData: FormData) {
  await requireUser();
  const id = opt(formData.get("id"));
  const name = clean(formData.get("name"));
  const kind = clean(formData.get("kind")) === "income" ? "income" : "expense";
  const icon = clean(formData.get("icon")) || "tag";
  const budget = parseMinor(formData.get("budget")) ?? 0;
  if (!name) back(formData, "Give the category a name.", "error");
  const supabase = createClient();
  const { error } = id
    ? await supabase.from("categories").update({ name, icon, budget_minor: budget }).eq("id", id)
    : await supabase.from("categories").insert({ name, kind, icon, budget_minor: budget });
  if (error) back(formData, `Could not save: ${error.message}`, "error");
  back(formData, id ? `${name} updated.` : `${name} added.`);
}

export async function deleteCategory(formData: FormData) {
  await requireUser();
  const id = clean(formData.get("id"));
  if (id) await createClient().from("categories").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  back(formData, "Category removed. Its entries keep their history.");
}

/* ───────────── budgets ───────────── */

/** Sets this month's limit for a category. Also used as the default for later months. */
export async function setBudget(formData: FormData) {
  await requireUser();
  const categoryId = clean(formData.get("category_id"));
  const month = clean(formData.get("month"));
  const limit = parseMinor(formData.get("limit")) ?? 0;
  if (!categoryId || !/^\d{4}-\d{2}$/.test(month)) back(formData, "Pick a category and a month.", "error");
  const supabase = createClient();
  const { error } = await supabase
    .from("budgets")
    .upsert(
      { category_id: categoryId, month: `${month}-01`, limit_minor: limit },
      { onConflict: "owner_id,category_id,month" }
    );
  if (error) back(formData, `Could not save: ${error.message}`, "error");
  if (formData.get("as_default") === "on")
    await supabase.from("categories").update({ budget_minor: limit }).eq("id", categoryId);
  back(formData, "Budget saved.");
}

/* ───────────── recurring ───────────── */

function addMonths(iso: string, by: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1 + by, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, last));
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
}
function advance(iso: string, every: string): string {
  return every === "week" ? addDaysISO(iso, 7) : every === "year" ? addMonths(iso, 12) : addMonths(iso, 1);
}

export async function saveRecurring(formData: FormData) {
  await requireUser();
  const id = opt(formData.get("id"));
  const name = clean(formData.get("name"));
  const kind = clean(formData.get("kind")) === "income" ? "income" : "expense";
  const amount = parseMinor(formData.get("amount"));
  const every = ["week", "month", "year"].includes(clean(formData.get("every")))
    ? clean(formData.get("every"))
    : "month";
  const nextOn = clean(formData.get("next_on"));
  if (!name) back(formData, "Give it a name.", "error");
  if (!amount) back(formData, "Enter an amount.", "error");
  if (!isDate(nextOn)) back(formData, "Pick the next due date.", "error");
  const supabase = createClient();
  const accountId = opt(formData.get("account_id"));
  let currency: Currency = "BDT";
  if (accountId) {
    const { data: acct } = await supabase.from("accounts").select("currency").eq("id", accountId).maybeSingle();
    currency = (acct?.currency as Currency) ?? "BDT";
  }
  const row = {
    name,
    kind,
    amount_minor: amount,
    currency,
    category_id: opt(formData.get("category_id")),
    account_id: accountId,
    every,
    next_on: nextOn,
    estimate: formData.get("estimate") === "on"
  };
  const { error } = id
    ? await supabase.from("recurring").update(row).eq("id", id)
    : await supabase.from("recurring").insert(row);
  if (error) back(formData, `Could not save: ${error.message}`, "error");
  back(formData, id ? `${name} updated.` : `${name} added to recurring.`);
}

export async function toggleRecurring(formData: FormData) {
  await requireUser();
  const id = clean(formData.get("id"));
  const active = formData.get("active") === "1";
  if (id) await createClient().from("recurring").update({ active }).eq("id", id);
  back(formData, active ? "Resumed." : "Paused. It stays in the list.");
}

export async function deleteRecurring(formData: FormData) {
  await requireUser();
  const id = clean(formData.get("id"));
  if (id) await createClient().from("recurring").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  back(formData, "Removed from recurring.");
}

/** "Paid" on a recurring item: records the transaction for its next date and moves next_on forward. */
export async function payRecurring(formData: FormData) {
  await requireUser();
  const id = clean(formData.get("id"));
  const supabase = createClient();
  const { data: r } = await supabase.from("recurring").select("*").eq("id", id).maybeSingle();
  if (!r) back(formData, "That recurring item is gone.", "error");
  const amount = parseMinor(formData.get("amount")) ?? Number(r.amount_minor);
  const on = clean(formData.get("occurred_on")) || r.next_on;
  const rate = r.currency === "USD" ? latestUsdRate(await getTransfers()) : null;
  const { error } = await supabase.from("transactions").insert({
    kind: r.kind,
    occurred_on: on,
    name: r.name,
    amount_minor: amount,
    currency: r.currency,
    amount_bdt_minor: toBdt(amount, r.currency, rate ?? 1),
    fx_rate: rate,
    category_id: r.category_id,
    account_id: r.account_id,
    recurring_id: r.id
  });
  if (error) back(formData, `Could not save: ${error.message}`, "error");
  await supabase
    .from("recurring")
    .update({ next_on: advance(r.next_on, r.every) })
    .eq("id", id);
  back(formData, `${r.name} recorded. Next due ${advance(r.next_on, r.every)}.`);
}

/* ───────────── debts ───────────── */

export async function addDebt(formData: FormData) {
  await requireUser();
  const person = clean(formData.get("person"));
  const direction = clean(formData.get("direction")) === "borrowed" ? "borrowed" : "lent";
  const total = parseMinor(formData.get("amount"));
  const on = clean(formData.get("started_on")) || todayLocalISO();
  if (!person) back(formData, "Who is it with?", "error");
  if (!total) back(formData, "Enter the amount.", "error");
  const { error } = await createClient()
    .from("debts")
    .insert({
      person,
      direction,
      total_minor: total,
      started_on: on,
      account_id: opt(formData.get("account_id")),
      note: opt(formData.get("note"))
    });
  if (error) back(formData, `Could not save: ${error.message}`, "error");
  back(
    formData,
    direction === "lent"
      ? `Lent to ${person}. It stays out of your spending.`
      : `Borrowed from ${person}. It stays out of your income.`
  );
}

export async function addDebtPayment(formData: FormData) {
  await requireUser();
  const debtId = clean(formData.get("debt_id"));
  const amount = parseMinor(formData.get("amount"));
  const on = clean(formData.get("paid_on")) || todayLocalISO();
  if (!debtId || !amount) back(formData, "Enter the amount paid.", "error");
  const supabase = createClient();
  const { error } = await supabase.from("debt_payments").insert({
    debt_id: debtId,
    paid_on: on,
    amount_minor: amount,
    account_id: opt(formData.get("account_id")),
    note: opt(formData.get("note"))
  });
  if (error) back(formData, `Could not save: ${error.message}`, "error");
  // Settle automatically once the payments cover the total.
  const [{ data: debt }, { data: pays }] = await Promise.all([
    supabase.from("debts").select("total_minor,person").eq("id", debtId).maybeSingle(),
    supabase.from("debt_payments").select("amount_minor").eq("debt_id", debtId).is("deleted_at", null)
  ]);
  const paid = (pays ?? []).reduce((s, p) => s + Number(p.amount_minor), 0);
  if (debt && paid >= Number(debt.total_minor)) {
    await supabase.from("debts").update({ settled_at: new Date().toISOString() }).eq("id", debtId);
    back(formData, `${debt.person} is settled.`);
  }
  back(formData, "Payment recorded.");
}

export async function settleDebt(formData: FormData) {
  await requireUser();
  const id = clean(formData.get("id"));
  if (id) await createClient().from("debts").update({ settled_at: new Date().toISOString() }).eq("id", id);
  back(formData, "Marked as settled.");
}

/* ───────────── savings ───────────── */

export async function saveGoal(formData: FormData) {
  await requireUser();
  const id = opt(formData.get("id"));
  const name = clean(formData.get("name"));
  const target = parseMinor(formData.get("target"));
  const due = clean(formData.get("due_on"));
  if (!name) back(formData, "Name the goal.", "error");
  if (!target) back(formData, "Enter a target amount.", "error");
  const supabase = createClient();
  const row = {
    name,
    target_minor: target,
    due_on: isDate(due) ? due : null,
    account_id: opt(formData.get("account_id"))
  };
  const { error } = id
    ? await supabase.from("savings_goals").update(row).eq("id", id)
    : await supabase.from("savings_goals").insert(row);
  if (error) back(formData, `Could not save: ${error.message}`, "error");
  back(formData, id ? `${name} updated.` : `Goal added: ${name}.`);
}

export async function addDeposit(formData: FormData) {
  await requireUser();
  const goalId = clean(formData.get("goal_id"));
  const amount = parseMinor(formData.get("amount"));
  const withdraw = formData.get("withdraw") === "on";
  const on = clean(formData.get("deposited_on")) || todayLocalISO();
  if (!goalId) back(formData, "Pick a goal.", "error");
  if (!amount) back(formData, "Enter an amount.", "error");
  const { error } = await createClient()
    .from("savings_deposits")
    .insert({
      goal_id: goalId,
      deposited_on: on,
      amount_minor: withdraw ? -amount : amount,
      source: opt(formData.get("source")),
      note: opt(formData.get("note"))
    });
  if (error) back(formData, `Could not save: ${error.message}`, "error");
  back(formData, withdraw ? "Withdrawal recorded." : "Saved. Nice.");
}

export async function deleteGoal(formData: FormData) {
  await requireUser();
  const id = clean(formData.get("id"));
  if (id) await createClient().from("savings_goals").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  back(formData, "Goal removed.");
}

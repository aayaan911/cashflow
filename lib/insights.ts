import { monthOf, shiftMonth, type Tx } from "@/lib/cashflow";
import type { Ledger } from "@/lib/ledger";

/*
 * Decisions: what the ledger says about how money moves, computed from the rows already loaded by
 * getLedger(), so the page costs no extra round trip. Lending, borrowing and repayments are kept out of
 * "earned" and "spent": a loan coming back is not income and a loan going out is not spending.
 */

const DEBT_CATEGORIES = new Set(["debt", "debt back", "debt i took", "debt i paid back", "payment"]);
const BIRD_INCOME = new Set(["bird", "sold"]);
const WASTE = "waste of money";

export interface MonthPoint {
  month: string;
  income: number;
  spend: number;
}
export interface YearPoint {
  year: string;
  income: number;
  spend: number;
  kept: number;
  keepRate: number | null;
}
export interface Leak {
  id: string | null;
  name: string;
  last: number;
  prior: number;
  growth: number | null;
  top: boolean;
}
export interface Alert {
  tone: "red" | "amber";
  title: string;
  line: string;
  href: string;
}
export interface Insights {
  month: string;
  months: MonthPoint[];
  spent12: number;
  earned12: number;
  kept12: number;
  avgBurn: number;
  years: YearPoint[];
  bestYear: YearPoint | null;
  leaks: Leak[];
  leakTotal: number;
  waste12: number;
  bird: {
    years: { year: string; spend: number; income: number }[];
    last12: { spend: number; income: number };
    allSpend: number;
    allIncome: number;
  };
  sourcesAll: { name: string; minor: number }[];
  sourcesYear: { year: string; total: number; rows: { name: string; minor: number }[]; fallback: boolean };
  topShare: { name: string; share: number; minor: number; total: number; year: string } | null;
  alerts: Alert[];
}

const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);

export function buildInsights(ledger: Ledger, today: string): Insights {
  const month = monthOf(today);
  const catName = (id: string | null) => ledger.catName(id) ?? "Uncategorised";
  const isDebt = (t: Tx) => DEBT_CATEGORIES.has(catName(t.categoryId).toLowerCase());
  const real = ledger.tx.filter((t) => !isDebt(t));

  // 1 · last 12 months, ending with this one
  const monthKeys = Array.from({ length: 12 }, (_, i) => shiftMonth(month, i - 11));
  const byMonth = new Map(monthKeys.map((m) => [m, { month: m, income: 0, spend: 0 }]));
  const firstMonth = monthKeys[0];
  const priorFirst = shiftMonth(firstMonth, -12);
  for (const t of real) {
    const p = byMonth.get(t.on.slice(0, 7));
    if (p) p[t.kind === "income" ? "income" : "spend"] += t.bdtMinor;
  }
  const months = monthKeys.map((m) => byMonth.get(m)!);
  const spent12 = months.reduce((s, m) => s + m.spend, 0);
  const earned12 = months.reduce((s, m) => s + m.income, 0);

  // 2 · each calendar year
  const yInc = new Map<string, number>();
  const ySp = new Map<string, number>();
  for (const t of real) add(t.kind === "income" ? yInc : ySp, t.on.slice(0, 4), t.bdtMinor);
  const years = [...new Set([...yInc.keys(), ...ySp.keys()])].sort().map((year) => {
    const income = yInc.get(year) ?? 0;
    const spend = ySp.get(year) ?? 0;
    return { year, income, spend, kept: income - spend, keepRate: income ? (income - spend) / income : null };
  });
  const bestYear = years.length ? years.reduce((a, b) => (b.kept > a.kept ? b : a)) : null;

  // 3 · leak finder: categories over the last 12 months against the 12 before
  const last = new Map<string, number>();
  const prior = new Map<string, number>();
  for (const t of real) {
    if (t.kind !== "expense") continue;
    const m = t.on.slice(0, 7);
    const key = t.categoryId ?? "";
    if (m >= firstMonth && m <= month) add(last, key, t.bdtMinor);
    else if (m >= priorFirst && m < firstMonth) add(prior, key, t.bdtMinor);
  }
  const wasteCat = ledger.categories.find((c) => c.kind === "expense" && c.name.toLowerCase() === WASTE);
  if (wasteCat && !last.has(wasteCat.id)) last.set(wasteCat.id, 0);
  const leaks = [...last.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, v], i) => {
      const p = prior.get(key) ?? 0;
      return {
        id: key || null,
        name: catName(key || null),
        last: v,
        prior: p,
        growth: p > 0 ? (v - p) / p : null,
        top: i < 2
      };
    });
  const waste12 = wasteCat ? (last.get(wasteCat.id) ?? 0) : 0;

  // 4 · bird P&L
  const birdExp = new Map<string, number>();
  const birdInc = new Map<string, number>();
  let last12Spend = 0;
  let last12Income = 0;
  for (const t of ledger.tx) {
    const name = catName(t.categoryId).toLowerCase();
    const m = t.on.slice(0, 7);
    if (t.kind === "expense" && name === "bird") {
      add(birdExp, t.on.slice(0, 4), t.bdtMinor);
      if (m >= firstMonth) last12Spend += t.bdtMinor;
    } else if (t.kind === "income" && BIRD_INCOME.has(name)) {
      add(birdInc, t.on.slice(0, 4), t.bdtMinor);
      if (m >= firstMonth) last12Income += t.bdtMinor;
    }
  }
  const birdYears = [...new Set([...birdExp.keys(), ...birdInc.keys()])]
    .sort()
    .map((year) => ({ year, spend: birdExp.get(year) ?? 0, income: birdInc.get(year) ?? 0 }));
  const allSpend = birdYears.reduce((s, y) => s + y.spend, 0);
  const allIncome = birdYears.reduce((s, y) => s + y.income, 0);

  // 5 · who pays: income by category (Notion's types are the payers) all time, and the latest real year
  const income = real.filter((t) => t.kind === "income");
  const srcAll = new Map<string, number>();
  for (const t of income) add(srcAll, catName(t.categoryId), t.bdtMinor);
  const sourcesAll = [...srcAll.entries()].map(([name, minor]) => ({ name, minor })).sort((a, b) => b.minor - a.minor);
  const thisYear = month.slice(0, 4);
  const lastYear = String(Number(thisYear) - 1);
  const thisTotal = yInc.get(thisYear) ?? 0;
  // A year whose income is under a tenth of the year before has not been logged yet: judge on the last full one.
  const fallback = thisTotal < (yInc.get(lastYear) ?? 0) * 0.1;
  const judgeYear = fallback ? lastYear : thisYear;
  const srcYear = new Map<string, number>();
  for (const t of income) if (t.on.startsWith(judgeYear)) add(srcYear, catName(t.categoryId), t.bdtMinor);
  const yearRows = [...srcYear.entries()].map(([name, minor]) => ({ name, minor })).sort((a, b) => b.minor - a.minor);
  const yearTotal = yearRows.reduce((s, r) => s + r.minor, 0);
  const topShare = yearRows[0]
    ? {
        name: yearRows[0].name,
        minor: yearRows[0].minor,
        total: yearTotal,
        share: yearRows[0].minor / yearTotal,
        year: judgeYear
      }
    : null;

  // Alerts: money that is probably happening but not written down
  const alerts: Alert[] = [];
  const thinMonths = months.filter((m) => m.spend > 0 && m.income < m.spend * 0.15);
  if (thinMonths.length)
    alerts.push({
      tone: "red",
      title: `${thinMonths.length} of the last 12 months: income under 15% of spending`,
      line: "Most likely income that was never logged, not a real loss. Check Payoneer, Fiverr, clients and bird sales.",
      href: "/income?view=months"
    });
  const lastSeen = new Map<string, string>();
  const entries = new Map<string, number>();
  for (const t of income) {
    const n = catName(t.categoryId);
    if (t.on > (lastSeen.get(n) ?? "")) lastSeen.set(n, t.on);
    entries.set(n, (entries.get(n) ?? 0) + 1);
  }
  const daysSince = (d: string) => Math.round((Date.parse(today) - Date.parse(d)) / 86400000);
  for (const s of sourcesAll.slice(0, 4)) {
    const seen = lastSeen.get(s.name);
    if (!seen || s.name === "Other" || (entries.get(s.name) ?? 0) < 6) continue;
    const gap = daysSince(seen);
    if (gap >= 45)
      alerts.push({
        tone: "red",
        title: `${s.name} not logged for ${gap >= 60 ? `${Math.round(gap / 30)} months` : `${gap} days`}`,
        line: `One of your biggest sources, last entry ${seen}. Add what came in since, or mark it stopped.`,
        href: "/income"
      });
  }
  for (const a of ledger.accounts) {
    if (a.archived) continue;
    const bal = ledger.balances.get(a.id) ?? 0;
    if (bal < 0)
      alerts.push({
        tone: "amber",
        title: `${a.name} shows a negative balance`,
        line: "Money moved into this account was never logged as a transfer, so net worth reads wrong.",
        href: "/transfers"
      });
  }
  if (allSpend > 0 && allIncome < allSpend * 0.1)
    alerts.push({
      tone: "amber",
      title: "Bird sales are mostly missing",
      line: "Bird spending is logged, bird income is not, so the bird business reads as a loss here.",
      href: "/income"
    });

  const leakTotal = leaks.reduce((s, l) => s + l.last, 0);
  return {
    month,
    months,
    spent12,
    earned12,
    kept12: earned12 - spent12,
    avgBurn: Math.round(spent12 / 12),
    years,
    bestYear,
    leaks,
    leakTotal,
    waste12,
    bird: { years: birdYears, last12: { spend: last12Spend, income: last12Income }, allSpend, allIncome },
    sourcesAll,
    sourcesYear: { year: judgeYear, total: yearTotal, rows: yearRows, fallback },
    topShare,
    alerts
  };
}

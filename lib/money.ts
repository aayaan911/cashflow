import { bdt, bdtCompact } from "@/lib/utils";
import type { Currency } from "@/lib/cashflow";

/*
 * Money display. Everything is stored as integer minor units (paisa / cents); these helpers are the only
 * place that divides by 100, so a page never shows a float it did its own maths on.
 */

/** ৳5,67,000 from minor units (lakh grouping). Whole taka: paisa are stored but a ledger reads in taka. */
export function taka(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return "—";
  return bdt(Math.round(minor / 100));
}
/** ৳2.65L style for tiles and badges. */
export function takaCompact(minor: number): string {
  return bdtCompact(Math.round(minor / 100));
}
/** $1,840 or $1,840.50 from cents. */
export function dollars(minor: number): string {
  const v = minor / 100;
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
}
export function money(minor: number, currency: Currency): string {
  return currency === "USD" ? dollars(minor) : taka(minor);
}
/** Signed: "+৳5,000" / "−৳5,000" (a real minus sign, not a hyphen). */
export function signed(minor: number, currency: Currency = "BDT"): string {
  const abs = money(Math.abs(minor), currency);
  return minor < 0 ? `−${abs}` : `+${abs}`;
}
/** A form amount ("1500", "1,500.50") to minor units, or null when it is not a positive number. */
export function parseMinor(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").replace(/[,\s৳$]/g, "");
  if (!raw) return null;
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}
/** Major units for a defaultValue in an input: 150000 minor → "1500". */
export function toMajor(minor: number): string {
  const v = minor / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}
export function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}

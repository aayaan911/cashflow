import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Taka formatter. Also the last line of defence against bad money input.
 *
 * PostgREST hands `numeric` columns back as STRINGS, so a value that skipped
 * its loader coercion would render as "৳500300" (concatenated) or, once it hit
 * arithmetic, "৳NaN". Coercing here means a stray string still groups
 * correctly, and anything that is not a finite number falls back to the normal
 * empty-value dash instead of printing nonsense at a breeder.
 */
/**
 * A count with its noun, so no screen prints "1 deals": plural(1, "deal") is "1 deal", plural(3, "deal") is
 * "3 deals", plural(2, "baby", "babies") is "2 babies". Pass both forms when a verb has to agree:
 * plural(n, "row needs", "rows need").
 */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function bdt(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  const value = Number(n);
  if (!Number.isFinite(value)) return "—";
  // Lakh grouping (৳5,67,000), the way a breeder says the number. "en-BD" falls back to Western
  // grouping in Node's ICU, so server and phone printed ৳567,000; en-IN groups the same everywhere.
  return "৳" + value.toLocaleString("en-IN");
}

/**
 * Compact taka for badges: ৳2.65L, ৳45K, ৳900. Indian grouping (lakh) because that is how a breeder
 * says the number; two decimals for lakh and crore, one for thousands, trailing zeros dropped.
 */
export function bdtCompact(value: number | null | undefined): string {
  const n = Math.round(Number(value ?? 0));
  const abs = Math.abs(n);
  const trim = (x: number) => (Math.round(x * 10) / 10).toString().replace(/\.0$/, "");
  // Lakh and crore keep two decimals (৳2.65L, not ৳2.6L): a rounded ৳5,000 is real money here.
  const trim2 = (x: number) => x.toFixed(2).replace(/\.?0+$/, "");
  // The unit is picked after rounding: 99,999 is ৳1L, never ৳100K, and 99,99,999 is ৳1Cr, never ৳100L.
  const crore = `৳${trim2(n / 10000000)}Cr`;
  if (abs >= 10000000) return crore;
  const lakh = trim2(n / 100000);
  if (abs >= 100000) return Math.abs(Number(lakh)) >= 100 ? crore : `৳${lakh}L`;
  if (abs >= 1000) return Math.abs(Number(trim(n / 1000))) >= 100 ? `৳${lakh}L` : `৳${trim(n / 1000)}K`;
  return `৳${n}`;
}

/**
 * Strip Notion-import bookkeeping out of a note before DISPLAY.
 *
 * The R3/R4 importer stamps "Imported from Notion D3" onto every payment it
 * creates (app/(app)/setup/actions.ts) so the row's provenance is auditable.
 * That is useful in the database and useless to a breeder: it leaks our
 * migration plumbing into a screen he shows to customers. Some Notion notes
 * also arrive with a leading "//" comment marker from the old system.
 *
 * Display layer only. The stored note is never modified, so provenance and
 * the audit trail survive; edit forms and exports still show the raw value.
 * Returns null when nothing but the artifact was there, so callers can fall
 * back to their normal empty state instead of rendering a blank cell.
 */
export function cleanNote(note: string | null | undefined): string | null {
  if (!note) return null;
  const cleaned = note
    .replace(/Imported from Notion\s*D\d*\b\.?/gi, "")
    .replace(/^\s*\/\/+\s*/, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s·,;-]+|[\s·,;-]+$/g, "")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Escape the LIKE wildcards (% and _) and the escape character itself, so a name such as "Rafi_2"
 * matches only itself in an .ilike() filter instead of any character in that slot.
 */
export function escapeLikePattern(s: string): string {
  return s.replace(/[%_\\]/g, (m) => `\\${m}`);
}

/* ------------------------------------------------------------------ *
 * Local calendar dates
 *
 * Every date column in this database is a plain Postgres `date`, so it
 * reaches us as a floating "YYYY-MM-DD" with no zone: a hatch day, a lay
 * day, a follow-up day. `new Date("2026-09-07")` reads that as UTC
 * midnight, which in Dhaka (UTC+6) is 06:00 that morning. Two failures
 * follow from it:
 *
 *   1. Compare it against the local clock and every derived answer is a day
 *      early between 00:00 and 06:00 — a bird hatched today reads "not yet
 *      hatched", today's calendar event reads "1d ago".
 *   2. Round-trip a locally-built Date through `.toISOString()` and the day
 *      is wrong ALL day, not just before 06:00, because local midnight in
 *      Dhaka is 18:00 UTC of the previous date. That is what shifted every
 *      expected lay, candle and hatch date one day early.
 *
 * The fix is to keep floating dates in local time end to end: parse at
 * LOCAL midnight, format back from the LOCAL getters. Timestamps
 * (`created_at` and friends) are a real instant rather than a floating day,
 * so they are deliberately left to the normal parser.
 * ------------------------------------------------------------------ */

/** The shape a Postgres `date` column arrives in. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a stored date value into a Date safe for calendar arithmetic.
 *
 * "YYYY-MM-DD" is built at LOCAL midnight so the calendar day the database
 * holds survives in any timezone. Anything else (a timestamptz) falls
 * through to the normal parser, which is correct for an instant.
 *
 * Returns null for empty, malformed or rolled-over input ("2026-13-45") so
 * callers render their own empty state instead of the string "Invalid Date".
 */
export function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  if (DATE_ONLY.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    // `new Date(26, …)` means 1926, so a year under 100 needs restoring.
    if (year < 100) date.setFullYear(year);
    // Reject rollovers ("2026-13-45"), which the old UTC parser rejected too.
    if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** A Date's LOCAL calendar day as "YYYY-MM-DD". Never goes through toISOString(). */
export function formatLocalDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * The aviary's own timezone. Every "today" in the app means today in Dhaka.
 *
 * This has to be explicit rather than inherited from the runtime clock. The
 * browser is on the breeder's phone (Dhaka, correct), but the server renders in
 * UTC on Vercel, six hours behind, so a server-rendered "today" was yesterday
 * for the first six hours of every Bangladeshi day: events booked a day early,
 * a bird hatched this morning reading "not yet hatched". Vercel reserves the TZ
 * environment variable, so it cannot be set from configuration.
 *
 * Single-country by design (CLAUDE.md section 1). Revisit only if KinBird sells
 * outside Bangladesh, and then make it per-account rather than per-deployment.
 */
export const BUSINESS_TIME_ZONE = "Asia/Dhaka";

/**
 * Today as "YYYY-MM-DD" in the aviary's timezone, on the server and in the
 * browser alike. en-CA formats as YYYY-MM-DD, which is why it is used here.
 */
export function todayLocalISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

/**
 * The calendar day an INSTANT (a timestamptz such as created_at) fell on in the
 * aviary's timezone. A record written at 03:30 Dhaka belongs to that day, not to
 * the previous UTC one. Use this only when an instant must be shown or grouped
 * as a day; never to reinterpret a stored DATE, which parseLocalDate handles.
 */
export function businessDayISO(instant: string | null | undefined): string | null {
  if (!instant) return null;
  const parsed = new Date(instant);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(parsed);
}

/**
 * Shift a stored "YYYY-MM-DD" by whole days and hand back "YYYY-MM-DD".
 *
 * This is the incubation maths on /calendar (start + 7 lay, + 14 candle,
 * + 24 hatch). Local in, local out. Unparseable input returns "" so the
 * event drops out of the view instead of showing a wrong day.
 */
export function addDaysISO(value: string | null | undefined, days: number): string {
  const date = parseLocalDate(value);
  if (!date) return "";
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

/**
 * Whole calendar days from one stored date to another, negative for the past.
 * Both sides are pinned to local midnight first, so today is 0 all day
 * instead of flipping to "1d ago" once the clock passes the UTC offset.
 */
export function daysBetweenLocal(
  fromValue: string | null | undefined,
  toValue: string | null | undefined
): number | null {
  const from = parseLocalDate(fromValue);
  const to = parseLocalDate(toValue);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

/**
 * Lovebird breeding timeline in days, the one source for every "Expected" date: lay about a week after
 * pairing, incubation ~22-24 days after lay (23 used), weaning ~6 weeks after hatch.
 */
export const BREEDING = { layAfterPairing: 7, incubation: 23, weanAfterHatch: 42 } as const;

export function shortDate(d: string | null | undefined) {
  const date = parseLocalDate(d);
  if (!date) return "—";
  // Built by hand: newer ICU prints "Sept" for en-GB, the prototype and every other surface say "Sep".
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Notion-style verbose age: "5 months, 21 days" or "1 year, 8 months, 15 days".
 * Uses true calendar arithmetic (not 30.4-day approximation) so days are accurate.
 */
export function ageFromBirthday(birthday: string | null | undefined): string {
  const start = parseLocalDate(birthday);
  if (!start) return "—";
  // Dhaka's calendar day, not the runtime clock: on a UTC server new Date() is yesterday until 06:00.
  const now = parseLocalDate(todayLocalISO()) ?? new Date();
  if (start > now) return "not yet hatched";

  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    // borrow days from the previous calendar month
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? "" : "s"}`);
  if (months > 0) parts.push(`${months} month${months === 1 ? "" : "s"}`);
  if (days > 0 || parts.length === 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  return parts.join(", ");
}

/**
 * A parent bird's sex is nullable: Notion's D1 gained a "NON DNA" option in September 2026 for
 * birds sent for DNA sexing but not yet back. Every render site used `gender === "male" ? Male :
 * Female`, which told a breeder an unsexed bird was a hen. That is a wrong pairing and a wrong
 * inbreeding reading, so unknown has to look unknown everywhere.
 */
export function genderLabel(gender: string | null | undefined, short = false): string {
  if (gender === "male") return short ? "M" : "Male";
  if (gender === "female") return short ? "F" : "Female";
  return short ? "?" : "Unknown";
}
export function genderVariant(gender: string | null | undefined): "male" | "female" | "muted" {
  return gender === "male" ? "male" : gender === "female" ? "female" : "muted";
}

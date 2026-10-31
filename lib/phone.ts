/**
 * Phone number helpers.
 *
 * Breeders type numbers the way they say them ("01926 355363", "+880 1926-355363",
 * "8801926355363"). Supabase Auth, WhatsApp links and the customer records all
 * want strict E.164 ("+8801926355363"). Everything that stores or sends a phone
 * number goes through normalizePhone() first, so one format lives in the database.
 */

/** Bangladesh mobile numbers: 10 digits after +880, operator prefix 13..19. */
const BD_MOBILE = /^1[3-9]\d{8}$/;

export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = String(input)
    .trim()
    .replace(/[\s\-().]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = `+${s.slice(2)}`;

  // Local Bangladesh spellings: 01XXXXXXXXX, 1XXXXXXXXX, 8801XXXXXXXXX.
  if (/^0?1\d{9}$/.test(s)) s = `+880${s.replace(/^0/, "")}`;
  else if (/^8801\d{9}$/.test(s)) s = `+${s}`;

  if (!s.startsWith("+")) return null;
  const digits = s.slice(1);
  if (!/^\d{8,15}$/.test(digits)) return null;
  if (digits.startsWith("880") && !BD_MOBILE.test(digits.slice(3))) return null;
  return `+${digits}`;
}

/** "+8801926355363" → "+880 1926 355363"; other countries are returned as-is. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = e164.match(/^\+880(1\d{3})(\d{6})$/);
  return m ? `+880 ${m[1]} ${m[2]}` : e164;
}

/** Digits only, the form wa.me expects. */
export function whatsappDigits(e164: string): string {
  return e164.replace(/\D/g, "");
}

/** A phone number as text: the Notion import left `<br>` tags in some numbers (seen on Sales, 2026-10-28). */
export function phoneText(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

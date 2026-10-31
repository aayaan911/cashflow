/**
 * Auth feature switches. Read on both server and client (NEXT_PUBLIC_*).
 */

export type PhoneOtpChannel = "sms" | "whatsapp";

/**
 * Phone sign-in / phone verification stays OFF until the Supabase Phone provider
 * is configured (Authentication → Sign In / Providers → Phone, Twilio Verify).
 * Set NEXT_PUBLIC_PHONE_AUTH=whatsapp (recommended for Bangladesh) or =sms in
 * .env.local and in Vercel to switch the UI on. While it is unset every phone
 * form is hidden, so nobody is promised a code that cannot arrive (hard rule 2).
 */
export function phoneOtpChannel(): PhoneOtpChannel | null {
  const value = (process.env.NEXT_PUBLIC_PHONE_AUTH ?? "").trim().toLowerCase();
  if (value === "sms" || value === "whatsapp") return value;
  if (value === "1" || value === "true") return "sms";
  return null;
}

/**
 * "Continue with Google" stays OFF until the Google provider is switched on in Supabase
 * (Authentication → Sign In / Providers → Google; steps in docs/GOOGLE-SIGN-IN-SETUP.md).
 * Set NEXT_PUBLIC_GOOGLE_AUTH=1 in .env.local and in Vercel to show the button. While it is unset
 * the button is not rendered at all, so nobody taps a sign-in that cannot finish (hard rule 2).
 * next.config.js reads the same variable to let the button's form post leave the site.
 */
export function googleAuthEnabled(): boolean {
  // On since 2026-10-05: the Google provider is enabled in Supabase. NEXT_PUBLIC_GOOGLE_AUTH=0 hides the button.
  const value = (process.env.NEXT_PUBLIC_GOOGLE_AUTH ?? "1").trim().toLowerCase();
  return value !== "0" && value !== "false";
}

export const PASSWORD_MIN_LENGTH = 8;

/** Cookie that remembers where an email link should land after /auth/callback. */
export const AFTER_AUTH_COOKIE = "kb_after_auth";

/**
 * The login page's one-shot message ("Check your email", "Wrong password"). It travels in an httpOnly cookie
 * set by our own server code, paired with an id in the URL (`?f=`), never as `?message=` text: a link like
 * /login?message=Call+this+number&tone=success would otherwise print an attacker's words under our green tick.
 */
export const LOGIN_FLASH_COOKIE = "kb_login_flash";
export const LOGIN_FLASH_MAX_AGE = 120;

export interface LoginFlash {
  id: string;
  message: string;
  tone: "success" | "error";
}

export function encodeLoginFlash(flash: LoginFlash): string {
  return encodeURIComponent(JSON.stringify(flash));
}

export function decodeLoginFlash(raw: string | undefined | null): LoginFlash | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as Partial<LoginFlash>;
    if (typeof v.id !== "string" || typeof v.message !== "string") return null;
    return { id: v.id, message: v.message.slice(0, 400), tone: v.tone === "error" ? "error" : "success" };
  } catch {
    return null;
  }
}

export function newLoginFlashId(): string {
  return Math.random().toString(36).slice(2, 10);
}

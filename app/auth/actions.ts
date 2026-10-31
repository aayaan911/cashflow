"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasConfiguredSupabase } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";
import {
  AFTER_AUTH_COOKIE,
  LOGIN_FLASH_COOKIE,
  LOGIN_FLASH_MAX_AGE,
  PASSWORD_MIN_LENGTH,
  encodeLoginFlash,
  googleAuthEnabled,
  newLoginFlashId,
  phoneOtpChannel
} from "@/lib/auth-config";
import { SITE_URL } from "@/lib/site";
import { landingAfterSignIn } from "@/app/auth/first-run";

/* ───────────── helpers ───────────── */

type Tone = "success" | "error";
type LoginMode = "signin" | "signup" | "link" | "phone" | "reset" | "check-email";
/** Which input a message belongs to, so the login page prints it under that field. */
type LoginField = "email" | "password" | "phone" | "token";
type LoginExtra = Partial<Record<"mode" | "email" | "name" | "phone" | "step" | "next", string>> & {
  field?: LoginField;
};

/** A format example, never a real person's number (it used to quote the owner's own WhatsApp). */
const PHONE_EXAMPLE = "Enter the phone number with its country code, for example +880 1XXX XXXXXX.";

const GOOGLE_OFF = "Google sign-in is not switched on for this server yet. Use email for now.";
const GOOGLE_FAILED = "Google sign-in could not start. Try again, or use your email.";

function loginRedirect(message: string | null, tone: Tone, extra: LoginExtra = {}): never {
  const params = new URLSearchParams();
  Object.entries(extra).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  if (message) {
    // The words go in an httpOnly cookie, the URL carries only its id (see LOGIN_FLASH_COOKIE).
    const id = newLoginFlashId();
    cookies().set({
      name: LOGIN_FLASH_COOKIE,
      value: encodeLoginFlash({ id, message, tone }),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/login",
      maxAge: LOGIN_FLASH_MAX_AGE
    });
    params.set("f", id);
  }
  redirect(`/login?${params}`);
}

function accountRedirect(message: string, tone: Tone, extra: Record<string, string> = {}): never {
  redirect(`/account?${new URLSearchParams({ ...extra, message, tone })}`);
}

function requireConfigured(mode: LoginMode): void {
  if (!hasConfiguredSupabase()) {
    loginRedirect("Supabase env vars are not configured yet, so the app is running in preview mode.", "error", {
      mode
    });
  }
}

/** The origin a confirmation / reset link must come back to. */
function requestOrigin(): string {
  const h = headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
  return SITE_URL;
}

/**
 * The /auth/callback URL an email link returns to. `flow` and `email` ride along so the callback can
 * still say something useful when the link is opened in another browser (the Gmail app's own browser
 * has no PKCE verifier cookie): "Email confirmed. Sign in to continue." with the address filled in.
 */
function callbackUrl(
  next?: string,
  extra: { flow?: "signup" | "link" | "reset" | "oauth"; email?: string } = {}
): string {
  const params = new URLSearchParams();
  if (next) params.set("next", next);
  if (extra.flow) params.set("flow", extra.flow);
  if (extra.email) params.set("email", extra.email);
  const qs = params.toString();
  return `${requestOrigin()}/auth/callback${qs ? `?${qs}` : ""}`;
}

/** Second channel for the post-link destination, in case the provider drops the query string. */
function rememberAfterAuth(next: string) {
  try {
    cookies().set({
      name: AFTER_AUTH_COOKIE,
      value: next,
      path: "/",
      maxAge: 60 * 60,
      httpOnly: true,
      sameSite: "lax"
    });
  } catch {}
}

function clean(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/**
 * A `next` posted by the sign-in form. Only a same-site absolute path is honoured: "//host" and
 * "/\host" are protocol-relative to a browser, and a control character or space can smuggle either
 * past a prefix check. Anything else means the dashboard.
 */
function safeNext(raw: string): string {
  if (!raw.startsWith("/") || raw.startsWith("//") || /[\x00-\x20\\]/.test(raw)) return "/";
  return raw;
}

/**
 * Supabase error strings are written for developers. These are the ones a
 * breeder can actually hit, in words that say what to do next.
 */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Wrong email or password. Try again, or reset your password.";
  if (m.includes("email not confirmed"))
    return "Confirm your email first. Open the link we sent you, or ask for a new one.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "An account with this email already exists. Sign in instead.";
  if (m.includes("email rate limit") || m.includes("over_email_send_rate_limit") || m.includes("rate limit")) {
    return "Too many emails were sent in the last hour. Wait a little and try again.";
  }
  if (m.includes("for security purposes, you can only request this after")) {
    return "Please wait a minute before asking for another email.";
  }
  if (m.includes("signups not allowed for otp") || m.includes("signups not allowed"))
    return "No account uses this email yet. Create one first.";
  if (m.includes("token has expired") || m.includes("otp_expired") || (m.includes("invalid") && m.includes("otp"))) {
    return "That code is wrong or has expired. Request a new one.";
  }
  if (
    m.includes("unsupported phone provider") ||
    m.includes("sms provider") ||
    m.includes("error sending sms") ||
    m.includes("phone provider")
  ) {
    return "Phone sign-in is not switched on for this server yet. Use email for now.";
  }
  if (m.includes("provider is not enabled") || m.includes("unsupported provider")) {
    return GOOGLE_OFF;
  }
  if (m.includes("password should be at least") || m.includes("password is too short")) {
    return `Use a password with at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (m.includes("weak password") || m.includes("password is known to be weak") || m.includes("pwned")) {
    return "That password is too easy to guess. Choose a different one.";
  }
  if (m.includes("same password")) return "That is already your current password. Choose a different one.";
  if (m.includes("user not found")) return "No account uses this email. Check the spelling or create an account.";
  if (m.includes("error sending") && m.includes("email"))
    return "We could not send the email just now. Try again in a few minutes.";
  if (m.includes("network") || m.includes("fetch failed"))
    return "Could not reach the sign-in server. Check your connection and try again.";
  return message;
}

/* ───────────── Google (gated by NEXT_PUBLIC_GOOGLE_AUTH) ───────────── */

/**
 * "Continue with Google". Nothing is sent to Google from here: Supabase builds the address of its own
 * /authorize page, this browser keeps the PKCE verifier in a cookie, and the breeder is sent there.
 * Google returns to Supabase, Supabase returns to /auth/callback with a `code`, and the callback
 * exchanges it exactly as it does for an email link. The destination is the one the sign-in form
 * carried (the dashboard otherwise); the callback sends a brand-new account to /start instead, the
 * same rule as a password sign-in. /start itself never redirects, so it must not be the default here:
 * the same button serves returning breeders.
 */
export async function signInWithGoogle(formData: FormData) {
  const mode = clean(formData.get("mode")) === "signup" ? "signup" : "signin";
  requireConfigured(mode);
  if (!googleAuthEnabled()) loginRedirect(GOOGLE_OFF, "error", { mode });

  const next = safeNext(clean(formData.get("next")));
  const keep = { mode, next: next === "/" ? "" : next } as const;

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(next, { flow: "oauth" }) }
  });

  if (error || !data.url) {
    // Only a sentence written here reaches the breeder, never the provider's own wording.
    const msg = error ? friendly(error.message) : "";
    loginRedirect(msg && msg !== error?.message ? msg : GOOGLE_FAILED, "error", keep);
  }
  redirect(data.url);
}

/* ───────────── password sign-in / sign-up ───────────── */

export async function loginWithPassword(formData: FormData) {
  requireConfigured("signin");

  const email = clean(formData.get("email")).toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(clean(formData.get("next")));
  const keep = { mode: "signin", email, next: next === "/" ? "" : next } as const;

  if (!isEmail(email))
    loginRedirect("Enter your email address, like name@gmail.com.", "error", { ...keep, field: "email" });
  if (!password) loginRedirect("Enter your password.", "error", { ...keep, field: "password" });

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      loginRedirect(friendly(error.message), "error", { mode: "check-email", email });
    }
    const credentials = error.message.toLowerCase().includes("invalid login credentials");
    loginRedirect(friendly(error.message), "error", credentials ? { ...keep, field: "password" } : keep);
  }
  // First run (item 6): a brand-new account goes to /start, everyone else where they were going.
  redirect(await landingAfterSignIn(supabase, data.user, next));
}

export async function signUpWithPassword(formData: FormData) {
  requireConfigured("signup");

  // The sign-up form asks only for email and password (2026-10-04). Name and phone are
  // still accepted when posted (older forms, a future longer form) and are stored only when present;
  // the user fills them in on Settings.
  const name = clean(formData.get("name"));
  const phoneRaw = clean(formData.get("phone"));
  const email = clean(formData.get("email")).toLowerCase();
  const password = String(formData.get("password") ?? "");
  const prefill = { mode: "signup" as const, email, name, phone: phoneRaw };

  if (!isEmail(email))
    loginRedirect("Enter your email address, like name@gmail.com.", "error", { ...prefill, field: "email" });
  if (password.length < PASSWORD_MIN_LENGTH) {
    loginRedirect(`Use ${PASSWORD_MIN_LENGTH} characters or more.`, "error", { ...prefill, field: "password" });
  }
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (phoneRaw && !phone) loginRedirect(PHONE_EXAMPLE, "error", { ...prefill, field: "phone" });

  const profile: Record<string, string> = {};
  if (name) profile.full_name = name;
  if (phone) profile.phone_number = phone;

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // The confirmation link lands on first run, not on an empty dashboard.
      emailRedirectTo: callbackUrl("/start", { flow: "signup", email }),
      // Profile fields live in auth user metadata: no extra table, follows the
      // account across devices. The phone here is a contact number; it becomes a
      // verified sign-in phone only through the OTP flow on /account.
      ...(Object.keys(profile).length ? { data: profile } : {})
    }
  });

  if (error) {
    const msg = friendly(error.message);
    loginRedirect(msg, "error", {
      ...prefill,
      field: /password/i.test(msg) ? "password" : msg.startsWith("An account with this email") ? "email" : undefined
    });
  }
  // "Confirm email" off: the account is signed in already.
  if (data.session) redirect("/start");

  // "Confirm email" is on in Supabase: the account exists but cannot sign in
  // until the link in the email is opened. The screen itself says so.
  loginRedirect(null, "success", { mode: "check-email", email });
}

export async function resendSignupEmail(formData: FormData) {
  requireConfigured("check-email");
  const email = clean(formData.get("email")).toLowerCase();
  if (!isEmail(email))
    loginRedirect("Enter your email address, like name@gmail.com.", "error", { mode: "signup", field: "email" });

  const supabase = createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: callbackUrl("/start", { flow: "signup", email }) }
  });
  if (error) loginRedirect(friendly(error.message), "error", { mode: "check-email", email });
  loginRedirect("Sent again. It can take a minute. Look in Spam too.", "success", { mode: "check-email", email });
}

/* ───────────── email link (magic link) ───────────── */

export async function loginWithEmailLink(formData: FormData) {
  requireConfigured("link");
  const email = clean(formData.get("email")).toLowerCase();
  if (!isEmail(email))
    loginRedirect("Enter your email address, like name@gmail.com.", "error", { mode: "link", email, field: "email" });

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    // Sign-up has its own form. A link must not create a half-empty account by accident.
    options: { emailRedirectTo: callbackUrl("/", { flow: "link", email }), shouldCreateUser: false }
  });

  // "No account uses this email" would tell anyone which emails have an
  // account. An unknown email gets the same answer as a known one, as in
  // requestPasswordReset; only errors that say nothing about the account show.
  const sent = "If an account uses this email, a sign-in link is on its way. Open it on this phone.";
  if (error) {
    const msg = friendly(error.message);
    if (msg.startsWith("No account")) loginRedirect(sent, "success", { mode: "link", email });
    loginRedirect(msg, "error", { mode: "link", email });
  }
  loginRedirect(sent, "success", { mode: "link", email });
}

/* ───────────── password reset ───────────── */

export async function requestPasswordReset(formData: FormData) {
  requireConfigured("reset");
  const email = clean(formData.get("email")).toLowerCase();
  if (!isEmail(email))
    loginRedirect("Enter your email address, like name@gmail.com.", "error", { mode: "reset", email, field: "email" });

  const next = "/account?reset=1";
  rememberAfterAuth(next);
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: callbackUrl(next, { flow: "reset", email })
  });

  const sent = "If an account uses this email, a reset link is on its way. Open it on this phone.";
  if (error) {
    const msg = friendly(error.message);
    // Same answer for an unknown email as for a known one (no enumeration).
    if (msg.startsWith("No account")) loginRedirect(sent, "success", { mode: "reset", email });
    loginRedirect(msg, "error", { mode: "reset", email });
  }
  loginRedirect(sent, "success", { mode: "reset", email });
}

/* ───────────── phone OTP (gated by NEXT_PUBLIC_PHONE_AUTH) ───────────── */

export async function startPhoneOtp(formData: FormData) {
  requireConfigured("phone");
  const channel = phoneOtpChannel();
  if (!channel) loginRedirect("Phone sign-in is not switched on for this server yet.", "error", { mode: "signin" });

  const phone = normalizePhone(clean(formData.get("phone")));
  if (!phone) {
    loginRedirect(PHONE_EXAMPLE, "error", { mode: "phone", phone: clean(formData.get("phone")), field: "phone" });
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone, options: { channel } });
  if (error) loginRedirect(friendly(error.message), "error", { mode: "phone", phone });

  loginRedirect(
    channel === "whatsapp"
      ? "Code sent on WhatsApp. It is valid for a few minutes."
      : "Code sent by SMS. It is valid for a few minutes.",
    "success",
    { mode: "phone", step: "verify", phone }
  );
}

export async function verifyPhoneOtp(formData: FormData) {
  requireConfigured("phone");
  const phone = normalizePhone(clean(formData.get("phone")));
  const token = clean(formData.get("token")).replace(/\D/g, "");
  if (!phone) loginRedirect("Start again with your phone number.", "error", { mode: "phone" });
  if (token.length < 6)
    loginRedirect("Enter the 6-digit code.", "error", { mode: "phone", step: "verify", phone, field: "token" });

  const supabase = createClient();
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
  if (error) loginRedirect(friendly(error.message), "error", { mode: "phone", step: "verify", phone, field: "token" });
  redirect(await landingAfterSignIn(supabase, data.user, "/"));
}

/* ───────────── account: profile, phone, password ───────────── */

export async function updateProfile(formData: FormData) {
  if (!hasConfiguredSupabase()) redirect("/login");

  const name = clean(formData.get("name"));
  const phoneRaw = clean(formData.get("phone"));
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  const city = clean(formData.get("city")).slice(0, 80);
  const country = clean(formData.get("country")).slice(0, 80);

  if (name.length < 2) accountRedirect("Enter your name.", "error");
  if (phoneRaw && !phone) accountRedirect(PHONE_EXAMPLE, "error");

  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { error } = await supabase.auth.updateUser({
    data: {
      full_name: name,
      phone_number: phone,
      city: city || null,
      country: country || null
    }
  });
  if (error) accountRedirect(friendly(error.message), "error");

  // With the phone provider on, a new number is also attached to the login
  // identity; Supabase sends a code and the number is verified on entry.
  const channel = phoneOtpChannel();
  if (channel && phone && phone !== data.user.phone) {
    const { error: phoneError } = await supabase.auth.updateUser({ phone }, { emailRedirectTo: undefined });
    if (phoneError) accountRedirect(friendly(phoneError.message), "error");
    accountRedirect("Profile saved. Enter the code we sent to verify your phone.", "success", {
      verify_phone: "1",
      phone
    });
  }

  accountRedirect("Profile saved.", "success");
}

export async function verifyPhoneChange(formData: FormData) {
  if (!hasConfiguredSupabase()) redirect("/login");
  const phone = normalizePhone(clean(formData.get("phone")));
  const token = clean(formData.get("token")).replace(/\D/g, "");
  if (!phone) accountRedirect("Start again from Edit profile.", "error");
  if (token.length < 6) accountRedirect("Enter the 6-digit code.", "error", { verify_phone: "1", phone });

  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: "phone_change" });
  if (error) accountRedirect(friendly(error.message), "error", { verify_phone: "1", phone });
  accountRedirect("Phone verified.", "success");
}

export async function updatePassword(formData: FormData) {
  if (!hasConfiguredSupabase()) redirect("/login");

  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < PASSWORD_MIN_LENGTH) {
    accountRedirect(`Use a password with at least ${PASSWORD_MIN_LENGTH} characters.`, "error");
  }
  if (password !== confirmPassword) accountRedirect("Passwords do not match.", "error");

  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) accountRedirect(friendly(error.message), "error");

  accountRedirect("Password saved. Use it next time you sign in.", "success");
}

export async function signOut() {
  if (hasConfiguredSupabase()) {
    const supabase = createClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { EmailOtpType, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  AFTER_AUTH_COOKIE,
  LOGIN_FLASH_COOKIE,
  LOGIN_FLASH_MAX_AGE,
  encodeLoginFlash,
  newLoginFlashId
} from "@/lib/auth-config";
import { landingAfterSignIn } from "@/app/auth/first-run";

/**
 * Every email link (confirmation, magic link, password reset) comes back here, and so does
 * "Continue with Google" (`flow=oauth`, always the PKCE shape). A link arrives in one of two shapes:
 *
 *   ?code=…                      PKCE. Exchanged for a session with the verifier cookie this browser
 *                                set when the email was requested. Works only in that same browser.
 *   ?token_hash=…&type=…         Token hash (the email templates' {{ .TokenHash }}). Verified with
 *                                verifyOtp, so the link signs the breeder in whichever browser opens
 *                                it, including the Gmail app's own browser.
 *
 * Then the breeder goes where the link was meant to land: `?next=` first, the cookie set by the action
 * second, the dashboard otherwise, except that a brand-new account goes to /start (first run). Only
 * same-origin paths are honoured, so a crafted link cannot bounce a fresh session to another site.
 */
function safePath(value: string | null | undefined, origin: string): string | null {
  // Prefix checks alone let "/\t/evil.com" through: the URL parser strips the
  // tab and reads "//evil.com" as another host. Reject control characters,
  // spaces and backslashes outright, then let the parser decide the origin.
  if (!value || !value.startsWith("/") || /[\x00-\x20\\]/.test(value)) return null;
  try {
    const u = new URL(value, origin);
    // "/..//evil.com" normalises to the path "//evil.com", which is protocol-relative again.
    if (u.origin !== origin || u.pathname.startsWith("//")) return null;
    return u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
}

const EMAIL_OTP_TYPES = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);
type Flow = "signup" | "link" | "reset" | "oauth";

/** "Continue with Google" came back without a session: cancelled at Google, or the browser lost its verifier. */
const GOOGLE_UNFINISHED = "Google sign-in did not finish. Try again, or use your email.";

/** The address the action put on the link, used only to prefill the sign-in form. */
function emailHint(value: string | null): string {
  const v = (value ?? "").trim().toLowerCase();
  return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? v : "";
}

function toLogin(
  origin: string,
  message: string,
  tone: "success" | "error",
  extra: { mode?: string; email?: string } = {}
) {
  const params = new URLSearchParams();
  if (extra.mode) params.set("mode", extra.mode);
  if (extra.email) params.set("email", extra.email);
  // The words go in an httpOnly cookie, the URL carries only its id (see LOGIN_FLASH_COOKIE).
  const id = newLoginFlashId();
  params.set("f", id);
  const response = NextResponse.redirect(new URL(`/login?${params}`, origin));
  response.cookies.set({
    name: LOGIN_FLASH_COOKIE,
    value: encodeLoginFlash({ id, message, tone }),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/login",
    maxAge: LOGIN_FLASH_MAX_AGE
  });
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const email = emailHint(url.searchParams.get("email"));
  const rawFlow = url.searchParams.get("flow");
  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  const cookieStore = cookies();
  const remembered = safePath(cookieStore.get(AFTER_AUTH_COOKIE)?.value, origin);
  const nextParam = safePath(url.searchParams.get("next"), origin);
  const isRecovery = type === "recovery" || rawFlow === "reset" || (nextParam ?? "").startsWith("/account?reset");
  const flow: Flow =
    rawFlow === "signup" || rawFlow === "link" || rawFlow === "reset" || rawFlow === "oauth"
      ? rawFlow
      : isRecovery
        ? "reset"
        : type === "magiclink"
          ? "link"
          : "signup";
  const requested = nextParam ?? remembered ?? (isRecovery ? "/account?reset=1" : "/");
  const again = flow === "reset" ? "reset" : flow === "link" ? "link" : "signin";

  if (providerError) {
    // No email link was involved, so "that link has expired" would be the wrong thing to say.
    if (flow === "oauth") return toLogin(origin, GOOGLE_UNFINISHED, "error", { mode: "signin" });
    return toLogin(
      origin,
      flow === "signup"
        ? "That link has expired or was already used. Sign in, or ask for a new link."
        : "That link has expired or was already used. Ask for a new one and open it within an hour.",
      "error",
      { mode: again, email }
    );
  }

  const supabase = createClient();
  let user: User | null = null;
  let recovery = isRecovery;

  if (tokenHash && type) {
    if (!EMAIL_OTP_TYPES.has(type)) {
      return toLogin(origin, "That link is not complete. Ask for a new one.", "error", { mode: again, email });
    }
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      return toLogin(
        origin,
        flow === "signup"
          ? "That link has expired or was already used. Sign in, or ask for a new link."
          : "That link has expired or was already used. Ask for a new one.",
        "error",
        { mode: again, email }
      );
    }
    user = data.user;
  } else if (code) {
    // The verifier cookie exists only in the browser that asked for the email. Its absence means the
    // link was opened somewhere else: the Gmail app's own browser, another phone, a laptop.
    const hasVerifier = cookieStore.getAll().some((c) => c.name.endsWith("-auth-token-code-verifier"));
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      if (flow === "oauth") return toLogin(origin, GOOGLE_UNFINISHED, "error", { mode: "signin" });
      const otherBrowser =
        !hasVerifier || error.code === "pkce_code_verifier_not_found" || /code verifier/i.test(error.message);
      if (otherBrowser) {
        // Supabase confirmed the address before it handed out the code, so for a sign-up this is good
        // news, not an error: the breeder signs in here once and lands on first run.
        if (flow === "signup") {
          return toLogin(origin, "Email confirmed. Sign in to continue.", "success", { mode: "signin", email });
        }
        if (flow === "reset") {
          return toLogin(
            origin,
            "Open the reset link in the same browser you asked from, or ask for a new link here.",
            "error",
            { mode: "reset", email }
          );
        }
        return toLogin(
          origin,
          "That link opened in a different browser. Sign in here, or ask for a new link here.",
          "error",
          { mode: "signin", email }
        );
      }
      return toLogin(origin, "That link has expired or was already used. Ask for a new one.", "error", {
        mode: again,
        email
      });
    }
    user = data.user;
    // auth-js reports a recovery exchange at runtime; the published type does not declare it yet.
    recovery = recovery || (data as { redirectType?: string | null }).redirectType === "recovery";
  } else {
    // Neither shape. A resent confirmation (supabase.auth.resend has no PKCE) is an implicit-flow link: Supabase
    // confirms the address, then puts the session in the #fragment, which never reaches a server. Already signed
    // in here: carry on. Otherwise the address is confirmed and one sign-in finishes the job.
    const { data } = await supabase.auth.getUser();
    user = data.user;
    if (!user) {
      if (flow === "reset") {
        return toLogin(origin, "That reset link did not finish here. Ask for a new one.", "error", {
          mode: "reset",
          email
        });
      }
      if (flow === "oauth") return toLogin(origin, GOOGLE_UNFINISHED, "error", { mode: "signin" });
      return toLogin(
        origin,
        flow === "signup" ? "Email confirmed. Sign in to continue." : "Sign in to continue.",
        "success",
        { mode: "signin", email }
      );
    }
  }

  // A password reset lands on the new-password form, never on first run.
  const destination = user && !recovery ? await landingAfterSignIn(supabase, user, requested) : requested;
  const response = NextResponse.redirect(new URL(destination, origin));
  if (remembered) response.cookies.set({ name: AFTER_AUTH_COOKIE, value: "", path: "/", maxAge: 0 });
  return response;
}

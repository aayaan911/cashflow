import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactElement, ReactNode } from "react";
import { AlertCircle, CheckCircle2, MailCheck, TrendingUp, MessageCircle, Smartphone } from "lucide-react";
import {
  loginWithEmailLink,
  loginWithPassword,
  requestPasswordReset,
  resendSignupEmail,
  signInWithGoogle,
  signUpWithPassword,
  startPhoneOtp,
  verifyPhoneOtp
} from "@/app/auth/actions";
import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { PasswordField } from "@/components/onboarding/password-field";
import { CarryEmailLink } from "@/components/onboarding/carry-email-link";
import {
  authInputClass,
  authLabelClass,
  authPrimaryButtonClass,
  authQuietLinkClass
} from "@/components/onboarding/field-styles";
import { hasConfiguredSupabase } from "@/lib/env";
import {
  LOGIN_FLASH_COOKIE,
  PASSWORD_MIN_LENGTH,
  decodeLoginFlash,
  googleAuthEnabled,
  phoneOtpChannel
} from "@/lib/auth-config";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

/*
 * /login (redesigned 2026-10-04, "simple like Apple"). One calm card, one primary button per screen,
 * every other path a quiet link under it. Modes: signin (default), signup, link, reset, check-email,
 * and phone only while NEXT_PUBLIC_PHONE_AUTH is set. Forms post natively to the server actions in
 * app/auth/actions.ts with validation off in the browser, so every problem comes back from the server
 * in plain words, printed under the field it belongs to (`?field=`). While NEXT_PUBLIC_GOOGLE_AUTH is
 * set, sign in and sign up also carry "Continue with Google" above the email field.
 */

type Mode = "signin" | "signup" | "link" | "phone" | "reset" | "check-email";
type FieldName = "email" | "password" | "phone" | "token";

type SearchParams = {
  /** Id of the one-shot message held in the LOGIN_FLASH_COOKIE. */
  f?: string;
  message?: string;
  tone?: string;
  mode?: string;
  signup?: string;
  email?: string;
  phone?: string;
  step?: string;
  field?: string;
  next?: string;
};

const TITLES: Record<Mode, string> = {
  signin: "Sign in to CIFLOW",
  signup: "Create your account",
  link: "Email me a sign-in link",
  phone: "Sign in with your phone",
  reset: "Reset your password",
  "check-email": "Check your email"
};

function resolveMode(searchParams?: SearchParams): Mode {
  const requested = searchParams?.signup === "1" ? "signup" : searchParams?.mode;
  const valid: Mode[] = [
    "signin",
    "signup",
    "link",
    "reset",
    "check-email",
    ...(phoneOtpChannel() ? ["phone" as const] : [])
  ];
  return valid.includes(requested as Mode) ? (requested as Mode) : "signin";
}

export function generateMetadata({ searchParams }: { searchParams?: SearchParams }): Metadata {
  const mode = resolveMode(searchParams);
  return { title: mode === "signin" ? "Sign in" : TITLES[mode] };
}

function modeHref(mode: Mode, email?: string) {
  return `/login?mode=${mode}${email ? `&email=${encodeURIComponent(email)}` : ""}`;
}

/** Only a same-site path survives as the post-sign-in destination; the action checks it again. */
function safeNext(raw: string | undefined) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || /[\x00-\x20\\]/.test(raw)) return "";
  return raw;
}

function Field({
  id,
  label,
  hint,
  error,
  children
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className={authLabelClass}>
        {label}
      </label>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          className="flex items-start gap-1.5 text-[14px] font-medium leading-snug text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[14px] leading-snug text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Banner({ tone, children }: { tone: "success" | "error"; children: ReactNode }) {
  const isError = tone === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "mt-5 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[15px] leading-snug",
        isError
          ? "border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive-soft))]/50 text-destructive"
          : "border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary-soft))]/60 text-[hsl(var(--primary-dark))]"
      )}
    >
      {isError ? (
        <AlertCircle className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
      ) : (
        <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
      )}
      <span>{children}</span>
    </div>
  );
}

/** The Google "G". The one place a brand's own colours are used as given, as Google's button guidance asks. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden className="shrink-0">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

/**
 * "Continue with Google", then a quiet "or" above the email form. Rendered only while
 * NEXT_PUBLIC_GOOGLE_AUTH is set, so the page is unchanged until the provider is on in Supabase.
 */
function GoogleSignIn({ mode, next }: { mode: "signin" | "signup"; next?: string }) {
  return (
    <>
      <form action={signInWithGoogle} className="mt-6">
        <input type="hidden" name="mode" value={mode} />
        {next && <input type="hidden" name="next" value={next} />}
        <SubmitButton
          variant="outline"
          className={cn(authPrimaryButtonClass, "gap-3 border-[hsl(var(--border-strong))] text-foreground")}
          pendingText="Opening Google…"
        >
          <GoogleMark />
          Continue with Google
        </SubmitButton>
      </form>
      <div className="mt-5 flex items-center gap-3 text-[14px] text-muted-foreground">
        <span className="flex-1 border-t border-border" aria-hidden />
        or
        <span className="flex-1 border-t border-border" aria-hidden />
      </div>
    </>
  );
}

/**
 * Puts "Continue with Google" above an email form. With the flag off it hands back the form itself, not
 * a wrapper around it, so the page React renders is the same, byte for byte, as before the button existed.
 */
function withGoogle(on: boolean, mode: "signin" | "signup", next: string | undefined, form: ReactElement) {
  if (!on) return form;
  return (
    <>
      <GoogleSignIn mode={mode} next={next} />
      {form}
    </>
  );
}

function QuietLinks({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex flex-col items-center">{children}</div>;
}

export default function LoginPage({ searchParams }: { searchParams?: SearchParams }) {
  // Middleware already redirects a signed-in breeder away from /login, so no auth round trip here.
  const configured = hasConfiguredSupabase();
  const phoneChannel = phoneOtpChannel();
  const googleAuth = configured && googleAuthEnabled();
  const mode = resolveMode(searchParams);
  const email = (searchParams?.email ?? "").trim();
  const phone = searchParams?.phone ?? "";
  const next = safeNext(searchParams?.next);
  // The message is read from our own httpOnly cookie and shown only when the URL carries its id.
  // `?message=` text in a link is ignored: it would let anyone print words under our green tick.
  const flash = decodeLoginFlash(cookies().get(LOGIN_FLASH_COOKIE)?.value);
  const shown = flash && searchParams?.f && flash.id === searchParams.f ? flash : null;
  const message = shown?.message ?? "";
  const tone: "success" | "error" = shown?.tone ?? "success";
  const field = (["email", "password", "phone", "token"] as const).includes(searchParams?.field as FieldName)
    ? (searchParams?.field as FieldName)
    : null;
  // A message that names a field prints under that field; anything else is a banner above the form.
  const fieldError = (name: FieldName) => (tone === "error" && field === name ? message : null);
  const bannerMessage = message && !(tone === "error" && field) ? message : "";
  const describe = (id: string, name: FieldName, hasHint = false) =>
    fieldError(name) ? `${id}-error` : hasHint ? `${id}-hint` : undefined;

  return (
    <main className="min-h-[100dvh] bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center px-4 pt-10 pb-8 sm:pt-16">
        <Link
          href="/"
          prefetch={false}
          className="flex flex-col items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[hsl(var(--primary-fill))] text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-1)]">
            <TrendingUp className="h-6 w-6" aria-hidden />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-foreground">CIFLOW</span>
        </Link>

        <section className="mt-6 w-full max-w-[400px] rounded-2xl border border-border bg-card px-5 py-7 sm:px-8 sm:py-8 shadow-[var(--shadow-1)]">
          {mode === "check-email" && (
            <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary-dark))]">
              <MailCheck className="h-7 w-7" aria-hidden />
            </span>
          )}
          <h1 className="text-center text-[24px] sm:text-[26px] font-bold leading-tight tracking-[-0.02em]">
            {TITLES[mode]}
          </h1>

          {mode === "signup" && (
            <p className="mt-2 text-center text-[15px] text-muted-foreground">Free to start. No card needed.</p>
          )}
          {mode === "link" && (
            <p className="mt-2 text-center text-[15px] text-muted-foreground">
              We email you a link. Tap it on this phone and you are in.
            </p>
          )}
          {mode === "reset" && (
            <p className="mt-2 text-center text-[15px] text-muted-foreground">
              We email you a link to choose a new password.
            </p>
          )}
          {mode === "phone" && (
            <p className="mt-2 text-center text-[15px] text-muted-foreground">
              {phoneChannel === "whatsapp" ? "We send a 6-digit code on WhatsApp." : "We send a 6-digit code by SMS."}
            </p>
          )}

          {!configured && (
            <Banner tone="error">Sign-in is not connected on this server yet, so accounts cannot be used here.</Banner>
          )}
          {bannerMessage && <Banner tone={tone}>{bannerMessage}</Banner>}

          {/* ── Sign in ── */}
          {mode === "signin" && (
            <>
              {withGoogle(
                googleAuth,
                "signin",
                next,
                <form action={loginWithPassword} noValidate className="mt-6 space-y-5">
                  {next && <input type="hidden" name="next" value={next} />}
                  <Field id="email" label="Email" error={fieldError("email")}>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                      autoFocus={!email || field === "email"}
                      defaultValue={email}
                      aria-invalid={Boolean(fieldError("email")) || undefined}
                      aria-describedby={describe("email", "email")}
                      className={authInputClass}
                    />
                  </Field>
                  <Field id="password" label="Password" error={fieldError("password")}>
                    <PasswordField
                      id="password"
                      autoComplete="current-password"
                      autoFocus={Boolean(email) && field !== "email"}
                      invalid={Boolean(fieldError("password"))}
                      describedBy={describe("password", "password")}
                    />
                  </Field>
                  <SubmitButton className={authPrimaryButtonClass} pendingText="Signing in…">
                    Sign in
                  </SubmitButton>
                </form>
              )}
              <QuietLinks>
                <CarryEmailLink href={modeHref("reset", email)} className={authQuietLinkClass}>
                  Forgot password?
                </CarryEmailLink>
                <CarryEmailLink href={modeHref("link", email)} className={authQuietLinkClass}>
                  Email me a sign-in link
                </CarryEmailLink>
                {phoneChannel && (
                  <Link href="/login?mode=phone" prefetch={false} className={authQuietLinkClass}>
                    Sign in with my phone number
                  </Link>
                )}
              </QuietLinks>
              <div className="mt-4 border-t border-border pt-4 text-center text-[15px] text-muted-foreground">
                New here?{" "}
                <CarryEmailLink href={modeHref("signup", email)} className={cn(authQuietLinkClass, "px-1")}>
                  Create your account
                </CarryEmailLink>
              </div>
            </>
          )}

          {/* ── Create account: email and password, nothing else ── */}
          {mode === "signup" && (
            <>
              {withGoogle(
                googleAuth,
                "signup",
                undefined,
                <form action={signUpWithPassword} noValidate className="mt-6 space-y-5">
                  <Field id="email" label="Email" error={fieldError("email")}>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                      autoFocus={!email || field === "email"}
                      defaultValue={email}
                      aria-invalid={Boolean(fieldError("email")) || undefined}
                      aria-describedby={describe("email", "email")}
                      className={authInputClass}
                    />
                  </Field>
                  <Field
                    id="new-password"
                    label="Password"
                    hint={`${PASSWORD_MIN_LENGTH} characters or more`}
                    error={fieldError("password")}
                  >
                    <PasswordField
                      id="new-password"
                      autoComplete="new-password"
                      minLength={PASSWORD_MIN_LENGTH}
                      autoFocus={Boolean(email) && field !== "email"}
                      invalid={Boolean(fieldError("password"))}
                      describedBy={describe("new-password", "password", true)}
                    />
                  </Field>
                  <SubmitButton className={authPrimaryButtonClass} pendingText="Creating account…">
                    Create account
                  </SubmitButton>
                  <p className="text-center text-[14px] leading-relaxed text-muted-foreground">
                    By continuing you agree to the{" "}
                    <Link
                      href="/terms"
                      prefetch={false}
                      className="font-medium text-[hsl(var(--primary-dark))] underline"
                    >
                      Terms
                    </Link>{" "}
                    and{" "}
                    <Link
                      href="/privacy"
                      prefetch={false}
                      className="font-medium text-[hsl(var(--primary-dark))] underline"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </form>
              )}
              <div className="mt-4 border-t border-border pt-4 text-center text-[15px] text-muted-foreground">
                Have an account?{" "}
                <CarryEmailLink href={modeHref("signin", email)} className={cn(authQuietLinkClass, "px-1")}>
                  Sign in
                </CarryEmailLink>
              </div>
            </>
          )}

          {/* ── Email link ── */}
          {mode === "link" && (
            <>
              <form action={loginWithEmailLink} noValidate className="mt-6 space-y-5">
                <Field id="email" label="Email" error={fieldError("email")}>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    autoFocus
                    defaultValue={email}
                    aria-invalid={Boolean(fieldError("email")) || undefined}
                    aria-describedby={describe("email", "email")}
                    className={authInputClass}
                  />
                </Field>
                <SubmitButton className={authPrimaryButtonClass} pendingText="Sending…">
                  Send link
                </SubmitButton>
              </form>
              <QuietLinks>
                <CarryEmailLink href={modeHref("signin", email)} className={authQuietLinkClass}>
                  Back to sign in
                </CarryEmailLink>
              </QuietLinks>
            </>
          )}

          {/* ── Password reset ── */}
          {mode === "reset" && (
            <>
              <form action={requestPasswordReset} noValidate className="mt-6 space-y-5">
                <Field id="email" label="Email" error={fieldError("email")}>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    autoFocus
                    defaultValue={email}
                    aria-invalid={Boolean(fieldError("email")) || undefined}
                    aria-describedby={describe("email", "email")}
                    className={authInputClass}
                  />
                </Field>
                <SubmitButton className={authPrimaryButtonClass} pendingText="Sending…">
                  Send reset link
                </SubmitButton>
              </form>
              <QuietLinks>
                <CarryEmailLink href={modeHref("signin", email)} className={authQuietLinkClass}>
                  Back to sign in
                </CarryEmailLink>
              </QuietLinks>
            </>
          )}

          {/* ── Waiting for the confirmation email ── */}
          {mode === "check-email" && (
            <>
              <div className="mt-3 space-y-2 text-center text-[16px] leading-relaxed">
                <p>
                  We sent a link to <b className="font-semibold break-all">{email || "your email"}</b>.
                </p>
                <p className="text-muted-foreground">Open the link on this phone to finish. It can take a minute.</p>
              </div>
              <div className="mt-6 space-y-3">
                {email && (
                  <form action={resendSignupEmail}>
                    <input type="hidden" name="email" value={email} />
                    <SubmitButton variant="outline" className={authPrimaryButtonClass} pendingText="Sending…">
                      Resend email
                    </SubmitButton>
                  </form>
                )}
                <Link
                  href={modeHref("signup", email)}
                  prefetch={false}
                  className={cn(buttonVariants({ variant: "outline" }), authPrimaryButtonClass)}
                >
                  Use a different email
                </Link>
              </div>
              <p className="mt-5 text-center text-[14px] text-muted-foreground">
                Not in your inbox? Look in Spam or Promotions.
              </p>
              <div className="mt-4 border-t border-border pt-4 text-center text-[15px] text-muted-foreground">
                Already confirmed?{" "}
                <Link href={modeHref("signin", email)} prefetch={false} className={cn(authQuietLinkClass, "px-1")}>
                  Sign in
                </Link>
              </div>
            </>
          )}

          {/* ── Phone code (only while the Phone provider is switched on) ── */}
          {mode === "phone" && phoneChannel && searchParams?.step !== "verify" && (
            <>
              <form action={startPhoneOtp} noValidate className="mt-6 space-y-5">
                <Field
                  id="phone"
                  label="Phone number"
                  hint="With the country code, like +880 1XXX XXXXXX."
                  error={fieldError("phone")}
                >
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    autoFocus
                    defaultValue={phone}
                    aria-invalid={Boolean(fieldError("phone")) || undefined}
                    aria-describedby={describe("phone", "phone", true)}
                    className={authInputClass}
                  />
                </Field>
                <SubmitButton className={authPrimaryButtonClass} pendingText="Sending code…">
                  {phoneChannel === "whatsapp" ? (
                    <MessageCircle className="h-4 w-4" aria-hidden />
                  ) : (
                    <Smartphone className="h-4 w-4" aria-hidden />
                  )}
                  Send code
                </SubmitButton>
              </form>
              <QuietLinks>
                <Link href="/login?mode=signin" prefetch={false} className={authQuietLinkClass}>
                  Sign in with email instead
                </Link>
              </QuietLinks>
            </>
          )}
          {mode === "phone" && phoneChannel && searchParams?.step === "verify" && (
            <>
              <form action={verifyPhoneOtp} noValidate className="mt-6 space-y-5">
                <input type="hidden" name="phone" value={phone} />
                <Field
                  id="token"
                  label={`Code sent to ${formatPhone(phone)}`}
                  hint="6 digits. It expires in a few minutes."
                  error={fieldError("token")}
                >
                  <input
                    id="token"
                    name="token"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoComplete="one-time-code"
                    required
                    autoFocus
                    aria-invalid={Boolean(fieldError("token")) || undefined}
                    aria-describedby={describe("token", "token", true)}
                    className={cn(authInputClass, "font-mono text-[20px] tracking-[0.35em] text-center")}
                  />
                </Field>
                <SubmitButton className={authPrimaryButtonClass} pendingText="Checking…">
                  Sign in
                </SubmitButton>
              </form>
              <form action={startPhoneOtp} className="mt-4 flex flex-col items-center">
                <input type="hidden" name="phone" value={phone} />
                <button type="submit" className={authQuietLinkClass}>
                  Send the code again
                </button>
                <Link href="/login?mode=phone" prefetch={false} className={authQuietLinkClass}>
                  Use a different number
                </Link>
              </form>
            </>
          )}
        </section>
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-x-1 px-4 pb-6 text-[14px] text-muted-foreground">
        <Link
          href="/terms"
          prefetch={false}
          className="inline-flex min-h-[44px] items-center px-2 hover:text-foreground"
        >
          Terms
        </Link>
        <span aria-hidden>·</span>
        <Link
          href="/privacy"
          prefetch={false}
          className="inline-flex min-h-[44px] items-center px-2 hover:text-foreground"
        >
          Privacy
        </Link>
        <span aria-hidden>·</span>
        <Link
          href="/pricing"
          prefetch={false}
          className="inline-flex min-h-[44px] items-center px-2 hover:text-foreground"
        >
          Pricing
        </Link>
      </footer>
    </main>
  );
}

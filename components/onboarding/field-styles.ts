/**
 * Shared look for the sign-in, sign-up and first-run fields (2026-10-04). 48px tall, 16px text (a
 * phone never zooms a 16px field on focus), a filled canvas so the field reads as a field on a white
 * card, and a red edge when the server named this field in an error.
 */
export const authInputClass =
  "block h-12 w-full rounded-xl border border-[hsl(var(--border-strong))] bg-background px-3.5 text-[16px] " +
  "text-foreground placeholder:text-muted-foreground/80 shadow-none transition-colors " +
  "focus-visible:outline-none focus-visible:border-[hsl(var(--primary))] focus-visible:ring-2 " +
  "focus-visible:ring-[hsl(var(--primary))]/30 aria-[invalid=true]:border-[hsl(var(--destructive))] " +
  "disabled:opacity-60";

export const authLabelClass = "block text-[15px] font-medium text-foreground";

export const authPrimaryButtonClass = "w-full h-12 rounded-xl text-[16px] font-semibold";

export const authQuietLinkClass =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg px-2 text-[15px] font-medium " +
  "text-[hsl(var(--primary-dark))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

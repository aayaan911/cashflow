import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Text fields in the v4 look (2026-10-04): the same 46px box as the date picker and the select
 * (components/ui/date-picker.tsx, components/ui/select-field.tsx), 10px radius, `--input` border on the
 * card surface, a green focus ring. 16px type on phones so iOS does not zoom the page on focus, 14px
 * from `sm`. Every form uses these, so a change here restyles them all.
 *
 * `fieldClass` / `textareaClass` are for the few raw <input>/<textarea> elements that cannot use the
 * components (an uncontrolled field inside a client helper). A caller's className still wins
 * (tailwind-merge), so a compact table cell can pass its own height.
 */
export const fieldClass =
  "flex h-[46px] w-full rounded-[10px] border border-input bg-card px-3 text-[16px] sm:text-[14px] text-foreground shadow-[var(--shadow-1)] " +
  "transition-colors placeholder:text-muted-foreground hover:border-[hsl(var(--muted-foreground))] " +
  "focus-visible:outline-none focus-visible:border-[hsl(var(--ring))] focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--ring))]/30 " +
  "aria-[invalid=true]:border-[hsl(var(--destructive))] disabled:cursor-not-allowed disabled:opacity-50 " +
  // No browser spinner on number fields: it is a 9px target and looks like a different app.
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

export const textareaClass =
  "flex min-h-[104px] w-full rounded-[10px] border border-input bg-card px-3 py-2.5 text-[16px] sm:text-[14px] leading-relaxed text-foreground shadow-[var(--shadow-1)] " +
  "transition-colors placeholder:text-muted-foreground hover:border-[hsl(var(--muted-foreground))] resize-y " +
  "focus-visible:outline-none focus-visible:border-[hsl(var(--ring))] focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--ring))]/30 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input type={type} ref={ref} className={cn(fieldClass, className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(textareaClass, className)} {...props} />
);
Textarea.displayName = "Textarea";

/**
 * MoneyInput: a taka amount. The "৳" sits inside the field as a prefix, the keyboard is the number
 * pad (`inputMode="numeric"`), digits are tabular. It is a plain <input> underneath, so `name`, `min`,
 * `required`, `defaultValue` and `type` (default "number") post exactly what they did before.
 */
export const MoneyInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { wrapperClassName?: string }
>(({ className, wrapperClassName, type = "number", inputMode = "numeric", ...props }, ref) => (
  <div className={cn("relative w-full", wrapperClassName)}>
    <span
      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-muted-foreground"
      aria-hidden
    >
      ৳
    </span>
    <input
      ref={ref}
      type={type}
      inputMode={inputMode}
      className={cn(fieldClass, "pl-8 font-semibold tabular-nums placeholder:font-normal", className)}
      {...props}
    />
  </div>
));
MoneyInput.displayName = "MoneyInput";

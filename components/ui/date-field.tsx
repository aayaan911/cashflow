"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";

/**
 * InlineDateForm (2026-10-04): one date on a record that saves the moment a day is picked.
 *
 * A native <form action={serverAction}> around a DatePicker with submitOnSelect, plus two optional
 * one-tap buttons that post an `intent` instead of a date:
 *   intent=today  the shortcut while the date is empty ("Delivered today"); the server reads today
 *                 in Dhaka itself, so a phone with a wrong clock cannot stamp the wrong day;
 *   intent=clear  empties the date ("Not delivered yet"), behind a native confirm.
 * A pick posts no intent, only `name`. The server action decides what each intent means.
 */
export function InlineDateForm({
  action,
  hidden,
  name,
  value,
  min,
  max,
  label,
  placeholder,
  todayLabel,
  todayIcon,
  clearLabel,
  clearIcon,
  confirmClear,
  className
}: {
  action: (formData: FormData) => Promise<void>;
  /** Hidden fields posted with every submit (record id, return tab). */
  hidden: Record<string, string>;
  name: string;
  value: string | null;
  min?: string;
  max?: string;
  /** Spoken field name, also the phone sheet's title. */
  label: string;
  placeholder?: string;
  /** Shown while the date is empty. Posts intent=today. */
  todayLabel?: string;
  todayIcon?: ReactNode;
  /** Shown while a date is set. Posts intent=clear after `confirmClear`. */
  clearLabel?: string;
  clearIcon?: ReactNode;
  confirmClear?: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      className={cn("inline-flex max-w-full flex-wrap items-center justify-end gap-x-1", className)}
    >
      {Object.entries(hidden).map(([key, v]) => (
        <input key={key} type="hidden" name={key} value={v} />
      ))}
      <DatePicker
        variant="inline"
        name={name}
        defaultValue={value ?? ""}
        min={min}
        max={max}
        label={label}
        placeholder={placeholder}
        clearable={false}
        submitOnSelect
      />
      {!value && todayLabel && (
        <IntentButton intent="today" icon={todayIcon} tone="primary">
          {todayLabel}
        </IntentButton>
      )}
      {value && clearLabel && (
        <IntentButton intent="clear" icon={clearIcon} tone="muted" confirm={confirmClear}>
          {clearLabel}
        </IntentButton>
      )}
    </form>
  );
}

function IntentButton({
  intent,
  icon,
  tone,
  confirm,
  children
}: {
  intent: string;
  icon?: ReactNode;
  tone: "primary" | "muted";
  confirm?: string;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="intent"
      value={intent}
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={cn(
        "inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-[12.5px] font-semibold whitespace-nowrap lg:min-h-[32px]",
        "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:opacity-50",
        tone === "primary"
          ? "text-[hsl(var(--primary-dark))] hover:bg-[hsl(var(--primary-soft))]"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}

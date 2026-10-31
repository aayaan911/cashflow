"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { SelectTone } from "@/components/ui/select-field";

/**
 * ChoicePills (2026-10-04, prototype v4 `.seg` and `.methods`). A short set of choices (2 to 5) shown
 * all at once, so it is one tap instead of open, scroll, tap. It replaces a native select element with the
 * same name and values: each choice is a real radio input, so it posts exactly what the select did,
 * arrow keys move between choices natively, and a pick fires the browser's own bubbling `change`.
 *
 * - layout "segmented": one row of equal segments in a grey track, the chosen one a white card
 *   (prototype .seg). For two or three short labels.
 * - layout "pills": wrapping pills, the chosen one green (prototype .methods, the has-[:checked]
 *   pattern of the gold-standard form). For four or five, or longer labels.
 *
 * Like a React select with defaultValue, a value that is not among the choices falls back to the first
 * choice, so the group always posts a value. 44px tall on phones, 38px segments on desktop (46px with
 * the track, the height of every other field).
 */

export type ChoiceOption = {
  value: string;
  label: string;
  icon?: ReactNode;
  /** Colour of the chosen pill. Default green. */
  tone?: SelectTone;
  /** Title text (desktop hover) with a longer explanation. */
  hint?: string;
};

const PILL_ON: Record<SelectTone, string> = {
  green:
    "has-[:checked]:border-[hsl(var(--primary))] has-[:checked]:bg-[hsl(var(--primary-soft))] has-[:checked]:text-[hsl(var(--primary-dark))]",
  amber:
    "has-[:checked]:border-[hsl(var(--amber))] has-[:checked]:bg-[hsl(var(--amber-soft))] has-[:checked]:text-[hsl(var(--amber-text))]",
  red: "has-[:checked]:border-[hsl(var(--destructive))] has-[:checked]:bg-[hsl(var(--destructive-soft))] has-[:checked]:text-[hsl(var(--destructive))]",
  blue: "has-[:checked]:border-[hsl(var(--info))] has-[:checked]:bg-[hsl(var(--info-soft))] has-[:checked]:text-[hsl(var(--info-text))]",
  pink: "has-[:checked]:border-[hsl(var(--pink-border))] has-[:checked]:bg-[hsl(var(--pink-soft))] has-[:checked]:text-[hsl(var(--pink-text))]",
  purple:
    "has-[:checked]:border-[hsl(var(--purple))] has-[:checked]:bg-[hsl(var(--purple))]/15 has-[:checked]:text-[hsl(var(--purple))]",
  neutral:
    "has-[:checked]:border-[hsl(var(--border-strong))] has-[:checked]:bg-[hsl(var(--surface-muted))] has-[:checked]:text-foreground"
};

export function ChoicePills({
  name,
  options,
  defaultValue,
  value: valueProp,
  onChange,
  label,
  layout = "pills",
  form,
  disabled = false,
  className
}: {
  name: string;
  options: ChoiceOption[];
  defaultValue?: string | null;
  /** Controlled value. Pass with onChange. */
  value?: string;
  onChange?: (value: string) => void;
  /** Spoken name of the group (the visible label is the caller's). */
  label: string;
  layout?: "segmented" | "pills";
  /** HTML5 form attribute, for a group that sits outside its form. */
  form?: string;
  disabled?: boolean;
  className?: string;
}) {
  const resolve = (raw: string | null | undefined) => {
    const v = String(raw ?? "");
    return options.some((o) => o.value === v) ? v : (options[0]?.value ?? "");
  };
  const controlled = valueProp !== undefined;
  const [inner, setInner] = useState(() => resolve(defaultValue));
  const [seenDefault, setSeenDefault] = useState(() => String(defaultValue ?? ""));
  if (!controlled && String(defaultValue ?? "") !== seenDefault) {
    setSeenDefault(String(defaultValue ?? ""));
    setInner(resolve(defaultValue));
  }
  const value = controlled ? resolve(valueProp) : resolve(inner);
  const segmented = layout === "segmented";

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cn(
        segmented
          ? "grid w-full gap-[3px] rounded-[12px] bg-[hsl(var(--surface-muted))] p-[3px]"
          : "flex flex-wrap gap-2",
        className
      )}
      style={segmented ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((o) => (
        <label
          key={o.value}
          title={o.hint}
          className={cn(
            "relative inline-flex min-h-[44px] cursor-pointer select-none items-center justify-center gap-1.5 text-center text-[13.5px] font-medium transition-colors",
            "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[hsl(var(--ring))] has-[:focus-visible]:ring-offset-1 has-[:focus-visible]:ring-offset-[hsl(var(--card))]",
            "[&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0",
            disabled && "cursor-not-allowed opacity-50",
            segmented
              ? cn(
                  "rounded-[9px] px-2 text-muted-foreground hover:text-foreground sm:min-h-[38px]",
                  "has-[:checked]:bg-card has-[:checked]:font-semibold has-[:checked]:text-foreground has-[:checked]:shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                )
              : cn(
                  "rounded-[10px] border border-border bg-card px-3.5 text-foreground shadow-[var(--shadow-1)] hover:bg-muted sm:min-h-[42px]",
                  "has-[:checked]:font-semibold has-[:checked]:shadow-none",
                  PILL_ON[o.tone ?? "green"]
                )
          )}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            disabled={disabled}
            form={form}
            onChange={() => {
              if (!controlled) setInner(o.value);
              onChange?.(o.value);
            }}
            className="sr-only"
          />
          {o.icon}
          <span className="truncate">{o.label}</span>
        </label>
      ))}
    </div>
  );
}

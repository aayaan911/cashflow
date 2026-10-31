"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { authInputClass } from "@/components/onboarding/field-styles";

/**
 * PasswordField: the sign-in and sign-up password input with a Show / Hide switch. The switch is a
 * word, not an eye icon, because a 60-year-old breeder reads "Show" faster than he decodes a glyph,
 * and the word itself is the button's name (no aria-pressed: the label already changes).
 */
export function PasswordField({
  id,
  name = "password",
  autoComplete,
  minLength,
  autoFocus,
  invalid,
  describedBy,
  placeholder
}: {
  id: string;
  name?: string;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
  autoFocus?: boolean;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        minLength={minLength}
        required
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(authInputClass, "pr-[4.5rem]")}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-controls={id}
        className="absolute right-1 top-1/2 -translate-y-1/2 h-11 min-w-[3.75rem] rounded-lg px-2.5 text-[15px] font-semibold text-[hsl(var(--primary-dark))] hover:bg-[hsl(var(--primary-soft))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {visible ? "Hide" : "Show"}
        <span className="sr-only"> password</span>
      </button>
    </div>
  );
}

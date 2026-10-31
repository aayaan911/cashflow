"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * PasswordInput — password field with a show/hide toggle (standard SaaS pattern:
 * Asana, ClickUp, Linear all ship this). Keeps the 44px tap target on the toggle.
 */
export function PasswordInput({
  id,
  name,
  placeholder,
  autoComplete,
  minLength,
  required,
  className
}: {
  id: string;
  name: string;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
        className={cn("pr-11", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // A toggle: one fixed name plus aria-pressed, and reachable by Tab like any other control.
        aria-label="Show password"
        aria-pressed={visible}
        aria-controls={id}
        className="absolute right-0 top-0 h-full w-11 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-r-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A coloured value pill (2026-10-04): mutation, cage, cage year, status. `hue` comes from
 * lib/bird-pills.ts; leave it out for a neutral pill. Styling lives in `.kb-pill` (globals.css) so the
 * tint is right in light and in dark without a class per colour.
 */
export function Pill({
  hue,
  icon,
  children,
  className,
  title
}: {
  hue?: number | null;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  const neutral = hue === null || hue === undefined;
  // Only the props that are set: a pill repeats on every card, and an unset prop still costs its name in
  // the page payload.
  return (
    <span
      className={cn("kb-pill", neutral && "kb-pill-neutral", className)}
      {...(title ? { title } : null)}
      {...(neutral ? null : { style: { "--h": hue } as CSSProperties })}
    >
      {icon ? (
        <>
          {icon}
          {children}
        </>
      ) : (
        children
      )}
    </span>
  );
}

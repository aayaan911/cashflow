import Link from "next/link";
import { AlertTriangle, HelpCircle } from "lucide-react";
import type { Alert } from "@/lib/insights";
import { cn } from "@/lib/utils";

/** "Money that is probably happening but not written down": one row per alert, red first. */
export function InsightAlerts({ alerts, className }: { alerts: Alert[]; className?: string }) {
  if (!alerts.length) return null;
  return (
    <section aria-label="Unlogged money alerts" className={cn("grid gap-2 sm:grid-cols-2", className)}>
      {alerts.map((a) => (
        <Link
          key={a.title}
          href={a.href}
          prefetch={false}
          className="flex items-start gap-3 rounded-[12px] border border-border bg-card px-3.5 py-3 shadow-[var(--shadow-1)] hover:bg-muted/40"
        >
          <span
            className={cn(
              "grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px]",
              a.tone === "red"
                ? "bg-[hsl(var(--destructive-soft))] text-destructive"
                : "bg-[hsl(var(--amber-soft))] text-[hsl(var(--amber-text))]"
            )}
          >
            {a.tone === "red" ? (
              <AlertTriangle className="h-[15px] w-[15px]" />
            ) : (
              <HelpCircle className="h-[15px] w-[15px]" />
            )}
          </span>
          <span className="min-w-0">
            <b className="block text-[13.5px] leading-snug">{a.title}</b>
            <small className="mt-0.5 block text-[12.5px] text-muted-foreground">{a.line}</small>
          </span>
        </Link>
      ))}
    </section>
  );
}

export function Pill({ tone, children }: { tone: "good" | "warn" | "bad" | "neutral"; children: React.ReactNode }) {
  const cls = {
    good: "bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary-dark))]",
    warn: "bg-[hsl(var(--amber-soft))] text-[hsl(var(--amber-text))]",
    bad: "bg-[hsl(var(--destructive-soft))] text-destructive",
    neutral: "bg-muted text-muted-foreground"
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-[7px] px-2 text-[11.5px] font-semibold",
        cls
      )}
    >
      {children}
    </span>
  );
}

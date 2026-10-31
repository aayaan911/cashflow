import Link from "next/link";
import type { ReactNode } from "react";
import { Check, ChevronRight, Plus, type LucideIcon } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { PageTitle } from "@/components/page-title";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * First run (2026-10-04, new-account readiness). A page whose records are empty for this account used to
 * draw a strip of ৳0 tiles ("0 of 0 priced"), filter menus over nothing and "No birds match. Loosen a
 * filter", which reads as a broken filter to a breeder on day one. Every top-level page now swaps all of
 * that for one card that says what the page is for and offers ONE green action. Pages render this only
 * when the account holds no rows of that kind, so an aviary with records never sees it.
 */
export type FirstRunAction = { label: string; href: string };

export function FirstRunCard({
  icon: Icon,
  title,
  body,
  action
}: {
  icon: LucideIcon;
  title: string;
  body: ReactNode;
  action: FirstRunAction;
}) {
  return (
    <section className="rounded-[18px] border border-border bg-card px-5 py-8 text-center shadow-[var(--shadow-1)] sm:py-10">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary-dark))]">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h2 className="mt-3 text-[17px] font-semibold tracking-[-0.02em]">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-[480px] text-[14px] leading-[1.5] text-muted-foreground">{body}</p>
      <Link href={action.href} prefetch={false} className={cn(buttonVariants({ size: "lg" }), "mt-4 min-h-[44px]")}>
        <Plus className="h-4 w-4" aria-hidden />
        {action.label}
      </Link>
    </section>
  );
}

/** A whole top-level page in its first-run state: the page title, any flash message, and the card. */
export function FirstRunPage({
  title,
  line,
  message,
  tone,
  card
}: {
  title: string;
  line: ReactNode;
  message?: string;
  tone?: string;
  card: { icon: LucideIcon; title: string; body: ReactNode; action: FirstRunAction };
}) {
  return (
    <div className="min-h-screen">
      <Topbar title={title} revealOnScroll />
      <div className="mx-auto max-w-[1360px] space-y-3.5 px-4 py-4 sm:space-y-[18px] sm:px-6 sm:py-6 lg:px-8">
        <PageTitle title={title} line={line} />
        {message && (
          <p
            role="status"
            className={cn(
              "rounded-md border bg-muted/40 p-3 text-sm",
              tone === "error" ? "text-destructive" : "text-[hsl(var(--primary-dark))] dark:text-[hsl(var(--primary))]"
            )}
          >
            {message}
          </p>
        )}
        <FirstRunCard {...card} />
      </div>
    </div>
  );
}

export type StartStep = { label: string; detail: string; href: string; done: boolean; icon: LucideIcon };

/**
 * Dashboard "Start here" (2026-10-04): what an account sees in place of the money panels until its first
 * sale exists. Three steps, each a link; the first one not done carries the only green button.
 */
export function StartHere({ steps }: { steps: StartStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  return (
    <section className="overflow-hidden rounded-[18px] border border-border bg-card shadow-[var(--shadow-1)]">
      <header className="px-5 pb-3 pt-5">
        <p className="text-[13px] font-semibold text-muted-foreground">Start here</p>
        <h2 className="mt-1 text-[20px] font-bold tracking-[-0.03em]">Three steps to get started</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {doneCount} of {steps.length} done. Your numbers appear here once the first records exist.
        </p>
      </header>
      <ol>
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <li key={step.href} className="border-t border-border">
              <Link
                href={step.href}
                prefetch={false}
                className="flex min-h-[60px] items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50"
              >
                <span
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-bold",
                    step.done
                      ? "bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary-dark))]"
                      : "bg-[hsl(var(--surface-muted))] text-muted-foreground"
                  )}
                  aria-hidden
                >
                  {step.done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "flex items-center gap-1.5 text-[14.5px] font-semibold",
                      step.done && "text-muted-foreground line-through"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    {step.label}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{step.detail}</span>
                </span>
                {step === next ? (
                  <span className={cn(buttonVariants({ size: "sm" }), "shrink-0 min-h-[36px] px-3.5 text-[13px]")}>
                    Start
                  </span>
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

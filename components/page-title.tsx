import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * PageTitle (prototype v3 rule 1, 2026-09-27). Every top-level page opens with a large title and
 * ONE sentence that says what matters now ("৳5,67,000 is still owed on 9 deals"), not a count the
 * KPI strip already shows. The topbar's small title stays hidden until this scrolls away
 * (Topbar revealOnScroll). Actions on the right are the page's one or two money moves.
 */
export function PageTitle({
  title,
  eyebrow,
  line,
  actions,
  className
}: {
  title: string;
  /** Small line above the title: the date, the season, the record kind. */
  eyebrow?: ReactNode;
  /** One sentence. Wrap the number that matters in <b>, a loss in <b className="text-destructive">. */
  line?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-3 pt-1.5 pb-0.5", className)}>
      <div className="min-w-0 max-w-[760px]">
        {eyebrow && <p className="text-[12px] sm:text-[13px] font-semibold text-muted-foreground">{eyebrow}</p>}
        <h1 className="text-[28px] sm:text-[34px] font-bold tracking-[-0.038em] leading-[1.08] mt-0.5">{title}</h1>
        {line && (
          <p className="text-[14.5px] sm:text-[15.5px] leading-[1.45] text-muted-foreground mt-1.5 sm:mt-2 [&_b]:font-[650] [&_b]:text-foreground [&_b.text-destructive]:text-destructive">
            {line}
          </p>
        )}
      </div>
      {actions && <div className="hidden sm:flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}

import * as React from "react";
import { cn } from "@/lib/utils";

export const Table = ({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="relative w-full overflow-auto rounded-xl border bg-card">
    <table className={cn("w-full caption-bottom text-[13px]", className)} {...props} />
  </div>
);
export const THead = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  // Prototype v4 th: card background, 12.5px semibold, sentence case (no uppercase, no tracking).
  <thead className={cn("sticky top-0 z-10 bg-card [&_tr]:border-b", className)} {...props} />
);
export const TBody = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn("[&_tr:last-child]:border-0 [&_tr]:border-b [&_tr]:border-border/60", className)} {...props} />
);
export const TR = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn("transition-colors hover:bg-[hsl(var(--surface-muted))]/70 group/row", className)} {...props} />
);
export const TH = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  // scope="col" by default so a screen reader reads the column name with each cell; a row header passes scope="row".
  <th
    scope="col"
    className={cn(
      "h-9 px-3 text-left align-middle font-semibold text-muted-foreground text-[12.5px] whitespace-nowrap",
      className
    )}
    {...props}
  />
);
export const TD = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn("px-3 py-2.5 align-middle", className)} {...props} />
);

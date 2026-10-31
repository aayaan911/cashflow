import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Pill-style badges matching the KinBird mockup:
 *   soft pastel background + dark same-hue text.
 *   px-2.5, py-0.5, rounded-full, 11px font.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-medium leading-tight transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary-dark))]",
        secondary: "bg-[hsl(var(--surface-muted))] text-foreground/80",
        outline: "border border-border-strong text-foreground bg-transparent",
        destructive: "bg-[hsl(var(--destructive-soft))] text-[hsl(var(--destructive))]",
        success: "bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary-dark))]",
        warning: "bg-[hsl(var(--amber-soft))] text-[hsl(var(--amber-text))]",
        info: "bg-[hsl(var(--info-soft))] text-[hsl(var(--info-text))]",
        muted: "bg-[hsl(var(--surface-muted))] text-muted-foreground",
        female: "bg-[hsl(var(--pink-soft))] text-[hsl(var(--pink-text))] border border-[hsl(var(--pink-border))]",
        male: "bg-[hsl(var(--info-soft))] text-[hsl(var(--info-text))] border border-[hsl(var(--info)/0.3)]"
      }
    },
    defaultVariants: { variant: "default" }
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
// A <span>, not a <div>: badges sit inside <p> and headings, where a <div> is invalid HTML and React
// throws a hydration error. The display comes from the inline-flex class, so layout is unchanged.
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { badgeVariants };

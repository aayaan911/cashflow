import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-[10px] text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[hsl(var(--primary-fill))] text-primary-foreground hover:bg-[hsl(var(--primary-hover))]",
        outline: "border border-border bg-card shadow-[var(--shadow-1)] hover:bg-muted",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive:
          "bg-[hsl(var(--destructive-fill))] text-[hsl(var(--destructive-foreground))] hover:bg-[hsl(var(--destructive-hover))]",
        secondary: "bg-secondary text-secondary-foreground hover:opacity-80"
      },
      // Prototype v4 .btn: 40px tall, 14px side padding; .b-sm keeps 10px padding and 12.5px type.
      size: {
        default: "h-10 px-3.5",
        sm: "h-8 px-2.5 text-[12.5px]",
        lg: "h-10 px-3.5",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: { variant: "default", size: "default" }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";
export { buttonVariants };

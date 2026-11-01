import type { ReactNode, SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { fieldClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Account, Category } from "@/lib/cashflow";
import { money } from "@/lib/money";

/**
 * Native selects in the shell's field look: 46px box, --input border, green focus ring, a chevron at the
 * right. Native because every form here posts with <form action> and the page stays a Server Component.
 */
export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <div className="relative w-full min-w-0">
      <select className={cn(fieldClass, "appearance-none pr-8", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}

export function CategorySelect({
  categories,
  kind,
  name = "category_id",
  defaultValue,
  required
}: {
  categories: Category[];
  kind: "income" | "expense";
  name?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const list = categories.filter((c) => c.kind === kind);
  return (
    <Select name={name} defaultValue={defaultValue ?? list[0]?.id ?? ""} required={required} aria-label="Category">
      {list.length === 0 && <option value="">No category</option>}
      {list.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </Select>
  );
}

export function AccountSelect({
  accounts,
  balances,
  name = "account_id",
  defaultValue,
  label = "Account",
  allowNone = false
}: {
  accounts: Account[];
  balances?: Map<string, number>;
  name?: string;
  defaultValue?: string;
  label?: string;
  allowNone?: boolean;
}) {
  const live = accounts.filter((a) => !a.archived);
  return (
    <Select name={name} defaultValue={defaultValue ?? live[0]?.id ?? ""} aria-label={label}>
      {(allowNone || live.length === 0) && <option value="">{allowNone ? `${label}: none` : "No account yet"}</option>}
      {live.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
          {a.currency === "USD" ? " (USD)" : ""}
          {balances ? ` · ${money(balances.get(a.id) ?? 0, a.currency)}` : ""}
        </option>
      ))}
    </Select>
  );
}

/** The grid an inline add row sits in: one column on a phone, the caller's `sm:grid-cols-[…]` from sm. */
export function AddRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-2 border-t border-border bg-[hsl(var(--surface-muted))]/50 p-3 sm:gap-2.5",
        className
      )}
    >
      {children}
    </div>
  );
}

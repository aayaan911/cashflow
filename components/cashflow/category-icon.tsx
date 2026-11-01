import {
  Banknote,
  Bike,
  Briefcase,
  Building2,
  Car,
  Circle,
  Coffee,
  Gift,
  Globe,
  Heart,
  Home,
  Landmark,
  Laptop,
  Plane,
  ShoppingBag,
  Smartphone,
  Tag,
  Users,
  Wallet,
  Wrench,
  Zap,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Account } from "@/lib/cashflow";

/** The icons a category or account can pick. Keys are stored in categories.icon. */
export const ICONS: Record<string, LucideIcon> = {
  tag: Tag,
  home: Home,
  zap: Zap,
  coffee: Coffee,
  car: Car,
  "shopping-bag": ShoppingBag,
  briefcase: Briefcase,
  wrench: Wrench,
  heart: Heart,
  users: Users,
  gift: Gift,
  laptop: Laptop,
  banknote: Banknote,
  bike: Bike,
  plane: Plane,
  building: Building2,
  globe: Globe,
  circle: Circle
};
export const ICON_KEYS = Object.keys(ICONS);

/** A stable hue for a name, so the same category is the same colour on every page and for every user. */
export function hueOf(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function CatIcon({ icon, name, className }: { icon: string; name: string; className?: string }) {
  const Icon = ICONS[icon] ?? Tag;
  return (
    <span
      className={cn("grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px]", className)}
      style={{ background: `hsl(${hueOf(name)} 55% 90%)`, color: `hsl(${hueOf(name)} 62% 24%)` }}
      aria-hidden
    >
      <Icon className="h-[15px] w-[15px]" />
    </span>
  );
}

/** A tinted category chip: the kb-pill from the shell, with the hue from the name. */
export function CatPill({ name, className }: { name: string | null | undefined; className?: string }) {
  if (!name) return <span className="kb-pill kb-pill-neutral">No category</span>;
  return (
    <span className={cn("kb-pill", className)} style={{ "--h": hueOf(name) } as React.CSSProperties}>
      {name}
    </span>
  );
}

const ACCOUNT_ICON: Record<Account["kind"], LucideIcon> = {
  bank: Landmark,
  mobile: Smartphone,
  cash: Banknote,
  usd: Globe,
  other: Wallet
};
export function AccountIcon({ kind, className }: { kind: Account["kind"]; className?: string }) {
  const Icon = ACCOUNT_ICON[kind] ?? Wallet;
  const tone =
    kind === "usd"
      ? "bg-[hsl(var(--info-soft))] text-[hsl(var(--info-text))]"
      : kind === "mobile"
        ? "bg-[hsl(var(--pink-soft))] text-[hsl(var(--pink-text))]"
        : kind === "bank"
          ? "bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary-dark))]"
          : "bg-[hsl(var(--surface-muted))] text-muted-foreground";
  return (
    <span
      className={cn("grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px]", tone, className)}
      aria-hidden
    >
      <Icon className="h-[15px] w-[15px]" />
    </span>
  );
}

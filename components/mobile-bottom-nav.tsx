"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { GROUPS } from "@/components/sidebar";
import { Settings } from "lucide-react";

/**
 * Phone bottom nav: every sidebar page plus Settings, thumb-zone tabs (44px+ targets).
 * Steps aside on form routes (`/new`, `/edit`) so a form's sticky Save bar owns the bottom.
 */
const FORM_ROUTE = /\/(new|edit)$/;

export function MobileBottomNav() {
  const pathname = usePathname() ?? "/";
  if (pathname.startsWith("/auth") || FORM_ROUTE.test(pathname)) return null;
  const seg = pathname === "/" ? "/" : "/" + pathname.split("/")[1];
  const tabs = [
    ...GROUPS.flatMap((g) => g.items),
    { href: "/settings", label: "Settings", hint: "Account", icon: Settings }
  ];

  return (
    <nav
      aria-label="Main"
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex">
        {tabs.map((t) => {
          const Icon = t.icon;
          const on = seg === t.href;
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                prefetch={false}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  on ? "text-[hsl(var(--primary-dark))]" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

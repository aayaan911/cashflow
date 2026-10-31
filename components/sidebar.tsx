"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { cn, shortDate } from "@/lib/utils";
import { NAV_KEYS } from "@/components/keyboard-shortcuts";
import type { AccountProfile } from "@/lib/data";
import { APP_NAME, APP_TAGLINE } from "@/lib/site";
import { LayoutDashboard, Moon, PanelLeft, Settings, Sun, TrendingUp } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  /** Plain-English hint for the tooltip. */
  hint: string;
  icon: typeof LayoutDashboard;
}

/**
 * The nav. Add a page here only once it exists: a link to a page that is not built is a broken promise.
 * Shared by the desktop sidebar and the phone bottom nav.
 */
export const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Today",
    items: [{ href: "/", label: "Overview", hint: "Where your money stands", icon: LayoutDashboard }]
  }
];

const SETTINGS_PATHS = ["/settings"];

const itemBase =
  "group relative flex items-center gap-[11px] min-h-[40px] px-2.5 rounded-[10px] text-[14px] transition-colors text-[hsl(var(--sidebar-foreground)/0.82)] hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-foreground))]";
const itemOn =
  "is-on bg-[hsl(var(--sidebar-active-bg))] text-[hsl(var(--sidebar-active-fg))] font-semibold shadow-[var(--shadow-1)] hover:bg-[hsl(var(--sidebar-active-bg))] hover:text-[hsl(var(--sidebar-active-fg))]";

const RAIL_KEY = "cf:sidebar-rail";

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const pick = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return (
    pick
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase() || "A"
  );
}

export function Sidebar({ profile = null }: { profile?: AccountProfile | null }) {
  const pathname = usePathname() ?? "/";
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [rail, setRail] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setRail(window.localStorage.getItem(RAIL_KEY) === "1");
    } catch {
      /* storage blocked: stay expanded */
    }
    const onToggle = () => setRail((r) => !r);
    window.addEventListener("kb:toggle-rail", onToggle);
    return () => window.removeEventListener("kb:toggle-rail", onToggle);
  }, []);
  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(RAIL_KEY, rail ? "1" : "0");
    } catch {
      /* storage blocked */
    }
  }, [rail, mounted]);

  const current = pathname === "/" ? "/" : "/" + pathname.split("/")[1];
  const isActive = (href: string) => current === href;
  const settingsActive = SETTINGS_PATHS.includes(current);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <aside
      className={cn(
        "hidden lg:flex shrink-0 flex-col bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] sticky top-0 h-screen overflow-hidden px-2.5 py-3 transition-[width] duration-200",
        rail ? "w-[68px]" : "w-[248px]"
      )}
      style={{ borderRight: "1px solid hsl(var(--sidebar-border))" }}
    >
      <div className={cn("flex items-center gap-2.5 px-1.5 pt-1.5 pb-3", rail && "flex-col")}>
        <div className="grid h-8 w-8 place-items-center rounded-[9px] bg-[hsl(var(--primary-fill))] text-[hsl(var(--primary-foreground))] shrink-0">
          <TrendingUp className="h-4 w-4" />
        </div>
        {!rail && (
          <div className="min-w-0">
            <p className="text-[15px] font-bold tracking-[-0.02em] leading-[1.2] truncate">{APP_NAME}</p>
            <p className="text-[11.5px] text-[hsl(var(--sidebar-muted))] truncate">{APP_TAGLINE}</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setRail((r) => !r)}
          className={cn(
            "grid h-7 w-7 place-items-center rounded-[7px] text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-foreground))] shrink-0",
            rail ? "mt-1.5" : "ml-auto"
          )}
          title={rail ? "Expand sidebar ( [ )" : "Collapse sidebar ( [ )"}
          aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
        >
          <PanelLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      <nav
        className="flex-1 overflow-y-auto scrollbar-none [&::-webkit-scrollbar]:hidden -mx-0.5 px-0.5"
        aria-label="Main"
      >
        {GROUPS.map((group) => (
          <div key={group.title}>
            {rail ? (
              <div className="h-2.5 my-1.5 border-t border-[hsl(var(--sidebar-border))]" aria-hidden />
            ) : (
              <p className="px-2.5 pt-4 pb-1.5 text-[12px] font-semibold text-[hsl(var(--sidebar-muted))]">
                {group.title}
              </p>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              const key = NAV_KEYS[item.href];
              return (
                <Link
                  prefetch={false}
                  key={item.href}
                  href={item.href}
                  title={key ? `${item.label} (G then ${key})` : item.hint}
                  aria-label={rail ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn(itemBase, active && itemOn, rail && "justify-center px-0")}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!rail && <span className="flex-1 min-w-0 truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-[hsl(var(--sidebar-border))] pt-2.5 mt-1.5">
        <Link
          prefetch={false}
          href="/settings"
          title="Settings"
          aria-label={rail ? "Settings" : undefined}
          className={cn(itemBase, settingsActive && itemOn, rail && "justify-center px-0")}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!rail && <span className="flex-1 min-w-0 truncate">Settings</span>}
        </Link>
        <button
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          title="Theme (T)"
          aria-label={rail ? (isDark ? "Light mode" : "Dark mode") : undefined}
          className={cn(itemBase, "w-full text-left", rail && "justify-center px-0")}
        >
          {isDark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          {!rail && <span className="flex-1 min-w-0 truncate">{isDark ? "Light mode" : "Dark mode"}</span>}
        </button>
        {profile?.fullName && (
          <Link
            prefetch={false}
            href="/settings"
            title="Account"
            className={cn(
              "flex items-center gap-2.5 p-2 rounded-[9px] hover:bg-[hsl(var(--sidebar-hover))]",
              rail && "justify-center"
            )}
          >
            <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[hsl(var(--sidebar-active-bg))] text-[hsl(var(--sidebar-active-fg))] text-[12px] font-bold shrink-0">
              {initials(profile.fullName)}
            </span>
            {!rail && (
              <span className="min-w-0">
                <b className="block text-[13px] font-bold truncate">{profile.fullName}</b>
                <small className="block text-[11px] text-[hsl(var(--sidebar-muted))] truncate">
                  {profile.since ? `Since ${shortDate(profile.since)}` : " "}
                </small>
              </span>
            )}
          </Link>
        )}
      </div>
    </aside>
  );
}

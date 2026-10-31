"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function Topbar({
  title,
  subtitle,
  crumb,
  revealOnScroll = false,
  heading = false,
  add
}: {
  title: string;
  subtitle?: string;
  /** Small line ABOVE the title (prototype v4 #crumb): the record kind on a record page ("Deal", "Baby"). */
  crumb?: string;
  /** Pages that open with a large <PageTitle> keep this title hidden until it scrolls away (v3 rule 1). */
  revealOnScroll?: boolean;
  /**
   * The page's <h1> is the large <PageTitle> (or the record hero), so this title is a plain line of text:
   * two h1 on a page confuse a screen reader's outline. Pass `heading` ONLY on a page that has neither,
   * so every page keeps exactly one h1.
   */
  heading?: boolean;
  /**
   * The page's primary add action at the right end of the bar (prototype v4 #topAdd: "Add bird",
   * "Record sale", "New pair"...). Desktop only, as in the prototype: on a phone the + in the bottom
   * nav opens Quick add. Pass a `topbarAddClass` styled Link or button.
   */
  add?: ReactNode;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isDark = mounted ? resolvedTheme === "dark" : false;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!revealOnScroll) return;
    const onScroll = () => setScrolled(window.scrollY > 64);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [revealOnScroll]);
  const hideTitle = revealOnScroll && !scrolled;
  const TitleTag = heading ? "h1" : "p";

  // Below md the centre search is hidden, so the bar has two cells: three columns there left an empty 1fr
  // that took half the free width and cut the title to "Portf..." at 375px (mobile pass 2026-10-05).
  return (
    <header
      className={`sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] min-h-[58px] items-center gap-2.5 border-b bg-background/80 backdrop-blur-xl backdrop-saturate-150 px-3 sm:px-4 lg:px-6 py-2 transition-colors ${hideTitle ? "border-transparent" : "border-border"}`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <div
          className={`flex flex-col items-start justify-center min-w-0 transition-[opacity,transform] duration-200 ${hideTitle ? "opacity-0 translate-y-1" : "opacity-100"}`}
          aria-hidden={hideTitle}
        >
          {crumb && <p className="text-[12px] text-muted-foreground leading-[1.1] truncate w-full">{crumb}</p>}
          <TitleTag className="text-[16px] font-bold tracking-[-0.025em] leading-tight truncate w-full">
            {title}
          </TitleTag>
          {subtitle && <p className="text-[12px] text-muted-foreground leading-tight truncate w-full">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-0.5 justify-self-end">
        <button
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="grid h-11 w-11 place-items-center rounded-[9px] text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Toggle theme"
          title="Theme (T)"
        >
          {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
        {add && <div className="hidden lg:flex items-center ml-1.5">{add}</div>}
      </div>
    </header>
  );
}

/** Prototype v4 .btn.b-pri.addbtn: 40px, 14px side padding, 13.5px semibold, --primary-fill under white text. */
export const topbarAddClass =
  "inline-flex items-center gap-[7px] h-10 px-3.5 rounded-[10px] bg-[hsl(var(--primary-fill))] text-primary-foreground text-[13.5px] font-semibold whitespace-nowrap hover:bg-[hsl(var(--primary-hover))] transition-colors";

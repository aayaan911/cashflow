"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

/**
 * G then a letter jumps to a page (prototype v4 map, printed on each sidebar item on hover).
 */
export const NAV_KEYS: Record<string, string> = {
  "/": "D",
  "/settings": "S"
};

const ROUTE_FOR_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(NAV_KEYS).map(([href, k]) => [k.toLowerCase(), href])
);

/**
 * KeyboardShortcuts — ClickUp-style power-user keys.
 * (Cmd/Ctrl+K is owned by CommandSearch — not handled here, to avoid a double handler.)
 * G then a letter: see NAV_KEYS. T toggles the theme. [ collapses the sidebar to an icon rail.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    let gPressed = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    function isTypingTarget(t: EventTarget | null) {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || t.isContentEditable;
    }

    function handleKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();

      if (gPressed) {
        const href = ROUTE_FOR_KEY[key];
        gPressed = false;
        if (gTimer) clearTimeout(gTimer);
        if (href) {
          e.preventDefault();
          router.push(href);
        }
        return;
      }
      if (key === "g") {
        gPressed = true;
        gTimer = setTimeout(() => {
          gPressed = false;
        }, 1200);
        return;
      }
      if (key === "t") {
        e.preventDefault();
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
        return;
      }
      if (e.key === "[") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("kb:toggle-rail"));
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [router, resolvedTheme, setTheme]);

  return null;
}

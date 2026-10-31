"use client";

import { useEffect, useRef } from "react";

/**
 * Put inside a bottom sheet that is rendered on the server (the payment sheet's UrlSheet). While the
 * sheet is open the page behind it does not scroll under the thumb, and on a phone the sheet sits on top
 * of the on-screen keyboard with the room that is left above it, so the field being typed in and the
 * sheet's Save row stay in sight (visualViewport). Mobile pass 2026-10-05: a swipe on the payment sheet's
 * backdrop scrolled the list behind it 400px.
 */
export function SheetLock() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    const sheet = ref.current?.closest<HTMLElement>('[role="dialog"]') ?? null;
    const vv = window.visualViewport;
    const phone = window.matchMedia("(max-width: 639px)");
    const update = () => {
      if (!sheet || !vv) return;
      const bottom = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
      if (phone.matches && bottom > 0) {
        sheet.style.bottom = `${bottom}px`;
        sheet.style.maxHeight = `${Math.max(240, Math.round(vv.height - 12))}px`;
      } else {
        sheet.style.bottom = "";
        sheet.style.maxHeight = "";
      }
    };
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      root.style.overflow = before;
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      if (sheet) {
        sheet.style.bottom = "";
        sheet.style.maxHeight = "";
      }
    };
  }, []);
  return <span ref={ref} hidden />;
}

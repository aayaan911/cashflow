"use client";

import { useEffect, useRef } from "react";

type Watcher = { onclose: (() => void) | null; destroy: () => void };

/**
 * The phone's Back button (and the back gesture) closes an open bottom sheet instead of leaving the page,
 * through the browser's CloseWatcher (Chrome for Android 120 and later). Mobile pass 2026-10-05: Back with
 * the customer picker open on Record sale left the form and lost what was typed.
 *
 * No history entry is added, so a pick that rewrites the address (UrlSelect's router.replace) cannot be
 * undone by Back, and the bird popup's own history entry is left alone. Where CloseWatcher is missing,
 * Back works as it did. Esc keeps working through the sheet's own handler.
 */
export function useCloseWatcher(active: boolean, onClose: () => void) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!active) return;
    const Ctor = (window as unknown as { CloseWatcher?: new () => Watcher }).CloseWatcher;
    if (!Ctor) return;
    let watcher: Watcher | null = null;
    try {
      watcher = new Ctor();
    } catch {
      return;
    }
    watcher.onclose = () => ref.current();
    return () => watcher?.destroy();
  }, [active]);
}

"use client";

import { useEffect, useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { CheckCircle2, XCircle, X } from "lucide-react";

/**
 * ToastBanner: action feedback at the top of the page.
 * Reads ?message= and ?tone=. A success toast leaves after 5s; an error stays until it is closed, so a
 * breeder has time to read why a save was refused.
 *
 * Leaving strips ?message= / ?tone= from the address with history.replaceState(null, ...), which Next keeps
 * in sync with useSearchParams WITHOUT asking the server for the page again (the state must be null:
 * handing window.history.state back carries Next's own flag and the router skips the sync). The old router.replace re-rendered the
 * page five seconds after every save: one more round trip on mobile data, and the page's own message line
 * vanished under the breeder's thumb, shifting every control up by its height.
 */
export function ToastBanner() {
  const params = useSearchParams();
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);

  const message = params.get("message");
  const tone = params.get("tone");
  const isError = tone === "error";

  // Hide and strip ?message= / ?tone= so a refresh does not bring the toast back.
  function dismiss() {
    setVisible(false);
    const next = new URLSearchParams(window.location.search);
    if (!next.has("message") && !next.has("tone")) return;
    next.delete("message");
    next.delete("tone");
    const qs = next.toString();
    // Keep the #hash: a save that lands on #clutches or #egg-… must not lose its anchor when the toast goes.
    window.history.replaceState(null, "", `${qs ? `${pathname}?${qs}` : pathname}${window.location.hash}`);
  }

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    if (isError) return;
    const t = setTimeout(dismiss, 5000);
    return () => clearTimeout(t);
    // dismiss reads the same pathname listed here.
  }, [message, isError, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!message || !visible) return null;

  return (
    // Centred by a full-width flex row, never by `left-1/2 -translate-x-1/2`: `.animate-in` keeps its last
    // keyframe (`transform: translateY(0)`), which replaced the -50% and left every toast right of centre and
    // cut off at the edge of a phone (measured 2026-10-05).
    <div className="fixed top-3 inset-x-0 z-50 flex justify-center px-3 pointer-events-none">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto flex items-start gap-2.5 max-w-md rounded-lg border px-3.5 py-2.5 shadow-lg animate-in fade-in slide-in-from-top-2 ${
          isError
            ? "border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive-soft))]"
            : "border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary-soft))]"
        }`}
      >
        {isError ? (
          <XCircle className="h-4 w-4 text-[hsl(var(--destructive))] shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-[hsl(var(--primary-dark))] shrink-0 mt-0.5" />
        )}
        <p
          className={`text-[13px] font-medium ${isError ? "text-[hsl(var(--destructive))]" : "text-[hsl(var(--primary-dark))]"}`}
        >
          {message}
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="-my-3 -mr-3 inline-flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

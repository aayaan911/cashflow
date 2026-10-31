"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";
import { createPortal, flushSync, useFormStatus } from "react-dom";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Loader2, Plus, X } from "lucide-react";
import { cn, shortDate, todayLocalISO } from "@/lib/utils";
import { useCloseWatcher } from "@/components/ui/use-close-watcher";

/**
 * DatePicker (2026-10-04, prototype v4 style). Replaces every native <input type="date">.
 *
 * Why hand-rolled: the native control looks different on every phone (a tiny "dd/mm/yyyy" box on
 * cheap Androids), has no "3 days ago" shortcut, and breeders record deliveries and hatches days
 * late. No date library: the app ships to ৳12,000 phones and the maths below is forty lines.
 *
 * Contract:
 *  - Value in and out is a plain "YYYY-MM-DD" string. It is never fed to `new Date("YYYY-MM-DD")`
 *    (that parses as UTC midnight and shows the previous day west of Greenwich). Day arithmetic runs
 *    on UTC calendar days built from the parts, and display goes through shortDate() like the rest
 *    of the app ("4 Oct 2026").
 *  - It submits through <input type="hidden" name={name}>, so it drops into any native
 *    <form action={serverAction}>. Picking a day fires bubbling `input` and `change` events on that
 *    input, so auto-saving forms that listen for `change` (AutoForm) keep working unchanged.
 *  - `submitOnSelect` calls requestSubmit() on the owning form right after a pick: one field that
 *    saves on the fly.
 *  - `required`, `min` and `max` are enforced like the native control: a visually hidden proxy input
 *    carries the constraint, so the browser still blocks the submit, and the picker shows the reason.
 *  - The server renders the trigger with the formatted default value, so nothing flashes on hydrate.
 *    "Today" is read in Dhaka (todayLocalISO) only when the panel opens.
 *  - Phones (below sm) get a bottom sheet with a dim backdrop; wider screens get a popover anchored
 *    to the trigger. Both trap focus; Esc closes and returns focus to the trigger.
 */

/* ------------------------------------------------------------------------------------------------
   "YYYY-MM-DD" arithmetic. UTC calendar days are used only for counting, never for display.
   ------------------------------------------------------------------------------------------------ */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Sunday first: the Bangladeshi week, and the wall calendar a breeder has at home.
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

type Day = { y: number; m: number; d: number };

function utcDay(y: number, m: number, d: number) {
  // setUTCFullYear, not Date.UTC: Date.UTC maps years below 100 to 19xx.
  const t = new Date(0);
  t.setUTCFullYear(y, m - 1, d);
  return t;
}

function isoOf(y: number, m: number, d: number) {
  // Overflow rolls over on purpose (day 0 is the last day of the previous month).
  const t = utcDay(y, m, d);
  const yy = String(t.getUTCFullYear()).padStart(4, "0");
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(t.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function daysIn(y: number, m: number) {
  return utcDay(y, m + 1, 0).getUTCDate();
}

function parseDay(value: string | null | undefined): Day | null {
  const match = ISO_RE.exec(String(value ?? "").slice(0, 10));
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysIn(y, m)) return null;
  return { y, m, d };
}

/** A clean "YYYY-MM-DD", or "" for anything that is not a real calendar day. */
function normalize(value: string | null | undefined) {
  const p = parseDay(value);
  return p ? isoOf(p.y, p.m, p.d) : "";
}

function addDays(iso: string, n: number) {
  const p = parseDay(iso)!;
  return isoOf(p.y, p.m, p.d + n);
}

function addMonths(iso: string, n: number) {
  const p = parseDay(iso)!;
  const first = utcDay(p.y, p.m + n, 1);
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth() + 1;
  return isoOf(y, m, Math.min(p.d, daysIn(y, m)));
}

function weekdayOf(iso: string) {
  const p = parseDay(iso)!;
  return utcDay(p.y, p.m, p.d).getUTCDay();
}

function clampDay(iso: string, min: string, max: string) {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

function longLabel(iso: string) {
  const p = parseDay(iso);
  if (!p) return "";
  return `${WEEKDAYS[weekdayOf(iso)]}, ${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
}

const QUICK_PICKS = {
  past: [
    { offset: 0, label: "Today" },
    { offset: -1, label: "Yesterday" },
    { offset: -3, label: "3 days ago" },
    { offset: -7, label: "7 days ago" }
  ],
  future: [
    { offset: 0, label: "Today" },
    { offset: 1, label: "Tomorrow" },
    { offset: 3, label: "In 3 days" },
    { offset: 7, label: "In 7 days" }
  ]
} as const;

// useLayoutEffect warns during server rendering; the popover only ever positions in the browser.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export type DatePickerProps = {
  /** Form field name. The value posts as "YYYY-MM-DD", or "" when empty. */
  name?: string;
  /** Put on the trigger button, so an existing <label htmlFor> still points at the field. */
  id?: string;
  /** Uncontrolled starting value (ISO or empty). A later change re-syncs the picker. */
  defaultValue?: string | null;
  /** Controlled value. Pass with onChange. */
  value?: string | null;
  onChange?: (value: string) => void;
  /** Earliest selectable day, "YYYY-MM-DD". */
  min?: string;
  /** Latest selectable day, "YYYY-MM-DD". */
  max?: string;
  required?: boolean;
  placeholder?: string;
  /** Spoken name of the field ("Delivered date"); also the sheet title on phones. */
  label?: string;
  /** Offer a Clear control. Defaults to `!required`. */
  clearable?: boolean;
  clearLabel?: string;
  /** When set, Clear asks this question first (native confirm). */
  confirmClear?: string;
  /** requestSubmit() the owning form right after a pick or a clear. */
  submitOnSelect?: boolean;
  /** Shortcut chips above the grid. "past" suits records made late; "future" suits follow-ups. */
  quickPicks?: "past" | "future" | "none";
  /** "field" is a 46px form field; "inline" is a compact value for a fact row. */
  variant?: "field" | "inline";
  /** HTML5 form attribute, for a picker that sits outside its form. */
  form?: string;
  disabled?: boolean;
  className?: string;
};

export function DatePicker({
  name,
  id,
  defaultValue,
  value: valueProp,
  onChange,
  min: minProp,
  max: maxProp,
  required = false,
  placeholder = "Pick a date",
  label,
  clearable,
  clearLabel = "Clear",
  confirmClear,
  submitOnSelect = false,
  quickPicks = "past",
  variant = "field",
  form,
  disabled = false,
  className
}: DatePickerProps) {
  const min = normalize(minProp);
  const max = normalize(maxProp);
  const controlled = valueProp !== undefined;

  // Uncontrolled value, re-synced when the server hands down a new default (after a save).
  const [inner, setInner] = useState(() => normalize(defaultValue));
  const [seenDefault, setSeenDefault] = useState(() => normalize(defaultValue));
  const nextDefault = normalize(defaultValue);
  if (!controlled && nextDefault !== seenDefault) {
    setSeenDefault(nextDefault);
    setInner(nextDefault);
  }
  const value = controlled ? normalize(valueProp) : inner;

  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [mode, setMode] = useState<"days" | "months">("days");
  const [focusDay, setFocusDay] = useState("");
  const [today, setToday] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const proxyRef = useRef<HTMLInputElement>(null);
  const wantFocus = useRef(false);

  const uid = useId();
  const headingId = `${uid}-month`;
  const problemId = `${uid}-problem`;

  const { pending } = useFormStatus();
  const busy = submitOnSelect && pending;
  const canClear = (clearable ?? !required) && !!value;

  const inRange = useCallback((iso: string) => (!min || iso >= min) && (!max || iso <= max), [min, max]);

  // The rule the native control enforced, carried by the proxy input so the browser blocks the submit.
  const rangeMessage =
    value && min && value < min
      ? `Choose ${shortDate(min)} or later.`
      : value && max && value > max
        ? `Choose ${shortDate(max)} or earlier.`
        : "";
  useEffect(() => {
    proxyRef.current?.setCustomValidity(rangeMessage);
  }, [rangeMessage]);

  /* ---------------------------------------------------------------- open / close */

  const openPanel = () => {
    if (disabled || busy) return;
    const now = todayLocalISO();
    setToday(now);
    setFocusDay(clampDay(value || now, min, max));
    setMode("days");
    setSheet(!window.matchMedia("(min-width: 640px)").matches);
    // Inside a modal <dialog> the panel must live in the same top layer, or it renders underneath.
    setHost((triggerRef.current?.closest("dialog") as HTMLElement | null) ?? document.body);
    setPos(null);
    wantFocus.current = true;
    setOpen(true);
  };

  const closePanel = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);
  // The phone's Back closes the sheet rather than leaving the page (mobile pass 2026-10-05).
  useCloseWatcher(open && sheet, () => closePanel(true));

  const commit = (next: string) => {
    const previous = value;
    flushSync(() => {
      if (!controlled) setInner(next);
      onChange?.(next);
      setProblem(null);
      setOpen(false);
    });
    triggerRef.current?.focus();
    const input = hiddenRef.current;
    if (!input || next === previous) return;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    if (submitOnSelect) input.form?.requestSubmit();
  };

  const select = (iso: string) => {
    if (inRange(iso)) commit(iso);
  };

  const clear = () => {
    if (confirmClear && !window.confirm(confirmClear)) return;
    commit("");
  };

  /* ---------------------------------------------------------------- effects while open */

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const r = trigger.getBoundingClientRect();
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 6;
    const edge = 8;
    // Left-aligned with the trigger, or right-aligned when that would run off the screen.
    let left = r.left;
    if (left + w > vw - edge) left = r.right - w;
    left = Math.max(edge, Math.min(left, vw - w - edge));
    const below = r.bottom + gap;
    const fitsBelow = below + h <= vh - edge;
    const fitsAbove = r.top - gap - h >= edge;
    const top = fitsBelow || !fitsAbove ? Math.max(edge, Math.min(below, vh - h - edge)) : r.top - gap - h;
    setPos({ top, left });
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!open || sheet) return;
    place();
    const onMove = () => place();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, sheet, mode, place]);

  // Keyboard focus follows the active day (or month) after open and after arrow-key moves.
  useEffect(() => {
    if (!open || !wantFocus.current) return;
    const panel = panelRef.current;
    if (!panel) return;
    wantFocus.current = false;
    const target =
      mode === "days"
        ? panel.querySelector<HTMLElement>(`[data-day="${focusDay}"]`)
        : panel.querySelector<HTMLElement>('[data-month-active="true"]');
    (target ?? panel.querySelector<HTMLElement>("button:not([disabled])"))?.focus({ preventScroll: true });
  }, [open, mode, focusDay]);

  // Esc is handled on the panel itself and stopped there, so a sheet or modal underneath stays open.
  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      closePanel(true);
    };
    panel.addEventListener("keydown", onKey);
    return () => panel.removeEventListener("keydown", onKey);
  }, [open, host, closePanel]);

  // A click anywhere else closes the popover (the phone sheet has its own backdrop).
  useEffect(() => {
    if (!open || sheet) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || wrapRef.current?.contains(target)) return;
      closePanel(false);
    };
    document.addEventListener("pointerdown", onPointer, true);
    return () => document.removeEventListener("pointerdown", onPointer, true);
  }, [open, sheet, closePanel]);

  // The page behind a bottom sheet must not scroll under the thumb.
  useEffect(() => {
    if (!open || !sheet) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
    };
  }, [open, sheet]);

  /* ---------------------------------------------------------------- keyboard */

  const onPanelKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !panelRef.current) return;
    const nodes = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), [tabindex]:not([tabindex='-1'])")
    ).filter((el) => el.tabIndex >= 0);
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const onGridKey = (e: ReactKeyboardEvent<HTMLTableElement>) => {
    if (!focusDay) return;
    let next: string;
    switch (e.key) {
      case "ArrowLeft":
        next = addDays(focusDay, -1);
        break;
      case "ArrowRight":
        next = addDays(focusDay, 1);
        break;
      case "ArrowUp":
        next = addDays(focusDay, -7);
        break;
      case "ArrowDown":
        next = addDays(focusDay, 7);
        break;
      case "PageUp":
        next = addMonths(focusDay, e.shiftKey ? -12 : -1);
        break;
      case "PageDown":
        next = addMonths(focusDay, e.shiftKey ? 12 : 1);
        break;
      case "Home":
        next = addDays(focusDay, -weekdayOf(focusDay));
        break;
      case "End":
        next = addDays(focusDay, 6 - weekdayOf(focusDay));
        break;
      default:
        // Enter and Space reach the focused day button and select it natively.
        return;
    }
    e.preventDefault();
    wantFocus.current = true;
    setFocusDay(clampDay(next, min, max));
  };

  /* ---------------------------------------------------------------- the panel */

  const view = parseDay(focusDay);
  const panelNode = (() => {
    if (!open || !host || !view) return null;
    const { y, m } = view;
    const lead = weekdayOf(isoOf(y, m, 1));
    const cells = Array.from({ length: 42 }, (_, i) => isoOf(y, m, 1 - lead + i));
    const weeks = Array.from({ length: 6 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
    const monthStart = isoOf(y, m, 1);
    const monthEnd = isoOf(y, m, daysIn(y, m));

    const prevDisabled = mode === "days" ? !!min && addDays(monthStart, -1) < min : !!min && `${y - 1}-12-31` < min;
    const nextDisabled = mode === "days" ? !!max && addDays(monthEnd, 1) > max : !!max && `${y + 1}-01-01` > max;
    const step = (dir: -1 | 1) =>
      setFocusDay(clampDay(addMonths(focusDay, mode === "days" ? dir : dir * 12), min, max));

    const picks =
      quickPicks === "none" || !today
        ? []
        : QUICK_PICKS[quickPicks].map((p) => ({ ...p, iso: addDays(today, p.offset) })).filter((p) => inRange(p.iso));

    const navButton =
      "grid place-items-center h-11 w-11 rounded-[10px] text-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]";

    return createPortal(
      <>
        {sheet && (
          <div
            className="fixed inset-0 z-[120] bg-black/40 motion-safe:animate-in motion-safe:fade-in"
            onClick={() => closePanel(true)}
            aria-hidden
          />
        )}
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={label ? `Choose ${label.toLowerCase()}` : "Choose a date"}
          onKeyDown={onPanelKey}
          className={cn(
            "fixed z-[130] border border-border bg-card text-card-foreground",
            sheet
              ? "inset-x-0 bottom-0 rounded-t-[18px] px-4 pt-2 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-bottom-8"
              : "w-[336px] rounded-[14px] p-3 shadow-[var(--shadow-2)] motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
          )}
          style={sheet ? undefined : { top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
        >
          {sheet && (
            <>
              <div className="mx-auto mb-2.5 h-1 w-9 rounded-full bg-[hsl(var(--border-strong))]" aria-hidden />
              <div className="mb-3 flex items-baseline gap-3">
                <p className="text-[16px] font-semibold">{label ?? "Choose a date"}</p>
                <p className="ml-auto text-[13px] text-muted-foreground">{value ? shortDate(value) : "No date yet"}</p>
              </div>
            </>
          )}

          {picks.length > 0 && (
            <div className="mb-2 grid grid-cols-4 gap-1.5">
              {picks.map((p) => {
                const on = p.iso === value;
                return (
                  <button
                    key={p.label}
                    type="button"
                    aria-pressed={on}
                    title={longLabel(p.iso)}
                    onClick={() => select(p.iso)}
                    className={cn(
                      "h-11 sm:h-9 rounded-full border px-1 text-[12px] font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]",
                      on
                        ? "border-transparent bg-[hsl(var(--primary-fill))] text-[hsl(var(--primary-foreground))]"
                        : "border-border bg-[hsl(var(--surface-muted))] text-foreground hover:bg-muted"
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mb-1 flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                wantFocus.current = true;
                setMode(mode === "days" ? "months" : "days");
              }}
              aria-label={mode === "days" ? "Choose month and year" : "Back to days"}
              className="inline-flex h-11 items-center gap-1 rounded-[10px] px-2 text-[15px] font-semibold hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            >
              <span id={headingId}>{mode === "days" ? `${MONTHS[m - 1]} ${y}` : String(y)}</span>
              <ChevronDown
                className={cn("h-4 w-4 text-muted-foreground transition-transform", mode === "months" && "rotate-180")}
              />
            </button>
            <span className="sr-only" aria-live="polite">
              {mode === "days" ? `${MONTHS[m - 1]} ${y}` : String(y)}
            </span>
            <div className="ml-auto flex items-center">
              <button
                type="button"
                onClick={() => step(-1)}
                disabled={prevDisabled}
                aria-label={mode === "days" ? "Previous month" : "Previous year"}
                className={navButton}
              >
                <ChevronLeft className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                disabled={nextDisabled}
                aria-label={mode === "days" ? "Next month" : "Next year"}
                className={navButton}
              >
                <ChevronRight className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>

          {mode === "days" ? (
            <table
              role="grid"
              aria-labelledby={headingId}
              className="w-full table-fixed border-collapse"
              onKeyDown={onGridKey}
            >
              <thead>
                <tr>
                  {WEEKDAYS_SHORT.map((w, i) => (
                    <th
                      key={w}
                      scope="col"
                      abbr={WEEKDAYS[i]}
                      className="h-8 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {w}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => (
                  <tr key={week[0]}>
                    {week.map((iso) => {
                      const day = Number(iso.slice(8));
                      const outside = iso < monthStart || iso > monthEnd;
                      const selected = iso === value;
                      const isToday = iso === today;
                      const blocked = !inRange(iso);
                      return (
                        <td key={iso} role="gridcell" aria-selected={selected} className="p-0 py-px text-center">
                          <button
                            type="button"
                            data-day={iso}
                            tabIndex={iso === focusDay ? 0 : -1}
                            disabled={blocked}
                            aria-label={`${longLabel(iso)}${isToday ? ", today" : ""}`}
                            aria-current={isToday ? "date" : undefined}
                            onClick={() => select(iso)}
                            className={cn(
                              "mx-auto grid h-11 w-11 place-items-center rounded-full text-[14px] tabular-nums transition-colors sm:h-10 sm:w-10",
                              "outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--card))]",
                              selected
                                ? "bg-[hsl(var(--primary-fill))] font-semibold text-[hsl(var(--primary-foreground))]"
                                : blocked
                                  ? "cursor-not-allowed text-muted-foreground/35"
                                  : cn(
                                      "hover:bg-muted",
                                      isToday &&
                                        "font-semibold text-[hsl(var(--primary-dark))] ring-1 ring-inset ring-[hsl(var(--primary))]",
                                      !isToday && outside && "text-muted-foreground/70"
                                    )
                            )}
                          >
                            {day}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div role="group" aria-label={`Months of ${y}`} className="grid grid-cols-3 gap-1.5 py-1">
              {MONTHS_SHORT.map((short, i) => {
                const month = i + 1;
                const first = isoOf(y, month, 1);
                const last = isoOf(y, month, daysIn(y, month));
                const blocked = (!!min && last < min) || (!!max && first > max);
                const active = month === m;
                const chosen = !!value && value.slice(0, 7) === first.slice(0, 7);
                return (
                  <button
                    key={short}
                    type="button"
                    data-month-active={active}
                    disabled={blocked}
                    aria-label={`${MONTHS[i]} ${y}`}
                    aria-pressed={active}
                    onClick={() => {
                      wantFocus.current = true;
                      setFocusDay(clampDay(isoOf(y, month, Math.min(view.d, daysIn(y, month))), min, max));
                      setMode("days");
                    }}
                    className={cn(
                      "h-12 rounded-[10px] text-[14px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-35",
                      chosen
                        ? "bg-[hsl(var(--primary-fill))] font-semibold text-[hsl(var(--primary-foreground))]"
                        : active
                          ? "bg-[hsl(var(--primary-soft))] font-semibold text-[hsl(var(--primary-dark))]"
                          : "hover:bg-muted"
                    )}
                  >
                    {short}
                  </button>
                );
              })}
            </div>
          )}

          {(canClear || sheet) && (
            <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
              {canClear && (
                <button
                  type="button"
                  onClick={clear}
                  className="h-11 rounded-[10px] px-3 text-[13px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] sm:h-9"
                >
                  {clearLabel}
                </button>
              )}
              {sheet && (
                <button
                  type="button"
                  onClick={() => closePanel(true)}
                  className="ml-auto h-11 rounded-[10px] bg-[hsl(var(--primary-fill))] px-6 text-[14px] font-semibold text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary-hover))] outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--card))]"
                >
                  Done
                </button>
              )}
            </div>
          )}
        </div>
      </>,
      host
    );
  })();

  /* ---------------------------------------------------------------- the trigger */

  const shown = value ? shortDate(value) : "";
  const spoken = label ? `${label}: ${value ? longLabel(value) : "not set"}` : undefined;
  const inline = variant === "inline";

  return (
    <div ref={wrapRef} className={cn("relative", inline ? "inline-flex max-w-full shrink-0" : "w-full", className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={spoken}
        aria-describedby={problem ? problemId : undefined}
        onClick={() => (open ? closePanel(false) : openPanel())}
        className={cn(
          "outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          inline
            ? cn(
                "inline-flex min-h-[44px] max-w-full items-center gap-1.5 whitespace-nowrap rounded-lg px-2 -mr-2 text-[14px] lg:min-h-[36px]",
                "hover:bg-muted focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]",
                open && "bg-muted"
              )
            : cn(
                "flex h-[46px] w-full items-center gap-2 rounded-[10px] border bg-card pl-3 text-left text-[14px] shadow-[var(--shadow-1)]",
                canClear ? "pr-11" : "pr-3",
                problem
                  ? "border-[hsl(var(--destructive))]"
                  : "border-input hover:border-[hsl(var(--muted-foreground))]",
                "focus-visible:border-[hsl(var(--ring))] focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--ring))]/30",
                open && "border-[hsl(var(--ring))] ring-[3px] ring-[hsl(var(--ring))]/30"
              )
        )}
      >
        {inline && !value ? (
          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[hsl(var(--primary-dark))]">
            <Plus className="h-3.5 w-3.5" /> {placeholder}
          </span>
        ) : (
          <>
            {busy ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <CalendarDays
                className={cn("h-4 w-4 shrink-0", value ? "text-[hsl(var(--primary))]" : "text-muted-foreground")}
              />
            )}
            <span
              className={cn(
                inline ? "font-[550]" : "flex-1 truncate",
                value ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {shown || placeholder}
            </span>
            {inline && (
              <ChevronDown
                className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
              />
            )}
          </>
        )}
      </button>

      {canClear && !inline && (
        <button
          type="button"
          onClick={clear}
          disabled={disabled || busy}
          aria-label={label ? `Clear ${label.toLowerCase()}` : "Clear date"}
          className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-[10px] text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <input ref={hiddenRef} type="hidden" name={name} value={value} form={form} />
      {(required || min || max) && (
        <input
          ref={proxyRef}
          type="text"
          tabIndex={-1}
          aria-hidden="true"
          required={required}
          value={value}
          onChange={() => undefined}
          form={form}
          onInvalid={(e) => {
            e.preventDefault();
            setProblem(rangeMessage || (label ? `Choose the ${label.toLowerCase()}.` : "Choose a date."));
            triggerRef.current?.focus();
          }}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        />
      )}
      {problem && (
        <p id={problemId} role="alert" className="mt-1 text-[12px] font-medium text-[hsl(var(--destructive))]">
          {problem}
        </p>
      )}
      {panelNode}
    </div>
  );
}

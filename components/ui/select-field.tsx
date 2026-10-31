"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode
} from "react";
import { createPortal, flushSync, useFormStatus } from "react-dom";
import { Check, ChevronDown, CircleSlash, Loader2, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchKey } from "@/lib/select-options";
import { useCloseWatcher } from "@/components/ui/use-close-watcher";

/**
 * SelectField (2026-10-04, prototype v4 style). Replaces every native select element a breeder sees.
 *
 * Why hand-rolled: the native dropdown is a different, unstyled control on every phone (a grey system
 * list on cheap Androids), cannot show a photo, a phone number or "owes ৳12,000", cannot be searched,
 * and a 70-name customer list is a long thumb scroll. No package: the app ships to ৳12,000 phones, and
 * this file follows the date picker's pattern (components/ui/date-picker.tsx) so the two feel like one.
 *
 * Contract (the same as the native control, so forms and server actions do not change):
 *  - It posts through <input type="hidden" name={name}>, so it drops into any native
 *    <form action={serverAction}>. A pick fires bubbling `input` and `change` on that input, so forms
 *    that auto-save on `change` (AutoForm) keep working. `submitOnSelect` calls requestSubmit().
 *  - The value resolves like a React select with defaultValue: a value that is not among the options falls
 *    back to "" when the field has an empty state (a placeholder, `clearable`, or an option whose value
 *    is ""), otherwise to the first enabled option. What the trigger shows is what will post.
 *  - `required` is enforced like the native control: a visually hidden proxy input carries it, so the
 *    browser blocks the submit, and the field shows the reason under itself (date picker style).
 *  - `disabled` disables the hidden input too, so a disabled field posts nothing, as a disabled select.
 *  - The server renders the trigger with the selected option, so nothing flashes on hydrate.
 *  - Phones (below sm) get a bottom sheet with a dim backdrop; wider screens get a popover anchored to
 *    the trigger. A search box appears on its own above 8 options. Inside a modal <dialog> the panel is
 *    portalled into that dialog so it stays in the top layer; Esc is stopped at the panel, so the first
 *    Esc closes only the select.
 *  - Keyboard: on the trigger, ArrowDown / ArrowUp / Enter / Space open it and a letter jumps to the
 *    first match; in the panel, arrows, Home / End, PageUp / PageDown, type-ahead (no search box),
 *    Enter picks, Esc closes and returns focus to the trigger, Tab is trapped.
 */

export type SelectTone = "green" | "amber" | "red" | "blue" | "pink" | "purple" | "neutral";

export type SelectOption = {
  value: string;
  label: string;
  /** Quieter second line: a phone number, a price, a mutation. */
  description?: string;
  /** Coloured word in front of the second line ("Portfolio", "Production"). */
  tag?: { label: string; tone?: SelectTone };
  /** Small icon in a tinted tile. */
  icon?: ReactNode;
  /** Initials in a round avatar (customers). */
  avatar?: string;
  /** Picture in a rounded square, e.g. the bird's photo. Wins over icon and avatar. */
  media?: ReactNode;
  /** Colour of the icon tile or avatar. */
  tone?: SelectTone;
  /** Right-hand note, e.g. "owes ৳12,000". */
  meta?: string;
  metaTone?: SelectTone;
  /** Extra words the search matches (phone digits, mutation, ring). */
  keywords?: string;
  /** Group heading the option is listed under. */
  group?: string;
  /** Scope chip the option belongs to (see `scopes`); options without one show in every scope. */
  scope?: string;
  /** Show the label in the mono face (ring numbers). */
  mono?: boolean;
  disabled?: boolean;
};

export type SelectScope = { id: string; label: string };

export type SelectFooter = {
  label: string;
  icon?: ReactNode;
  /** Picking the footer sets this value (e.g. "__new__" for an inline new-customer form). */
  value?: string;
  /** Or the footer is a link (e.g. the payment sheet's New customer view). */
  href?: string;
  onSelect?: () => void;
};

export type SelectFieldProps = {
  /** Form field name. Without one nothing posts (a controlled filter). */
  name?: string;
  /** Put on the trigger, so an existing <label htmlFor> still names the field. */
  id?: string;
  options: SelectOption[];
  /** Uncontrolled starting value. A later change re-syncs the field (after a save). */
  defaultValue?: string | null;
  /** Controlled value. Pass with onChange. */
  value?: string | null;
  onChange?: (value: string) => void;
  /** Shown in muted text while the value is "". Also makes "" a legal value. */
  placeholder?: string;
  /** Spoken name of the field ("Customer"); the sheet title on phones. */
  label?: string;
  required?: boolean;
  /** Message under the field when a required field is empty. Default "Choose the <label>." */
  requiredMessage?: string;
  disabled?: boolean;
  /** HTML5 form attribute, for a field that sits outside its form. */
  form?: string;
  /** Add a row that sets the value to "" ("No cage yet"). */
  clearable?: boolean;
  /** Text of that row. Defaults to the placeholder. */
  clearLabel?: string;
  /** Force the search box on or off. Default: on above 8 options. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Filter chips above the list, with live counts. A scope with id "all" matches everything. */
  scopes?: SelectScope[];
  /** Action row under the list ("+ New customer"). */
  footer?: SelectFooter;
  /** Shown when there are no options at all. */
  emptyText?: string;
  /** Rows drawn at once; a line below says how many more a search reaches. */
  maxVisible?: number;
  /** requestSubmit() the owning form right after a pick. */
  submitOnSelect?: boolean;
  /** "field" is the 46px form field; "compact" is a 36px control for toolbars and table cells. */
  variant?: "field" | "compact";
  /** While empty, show the placeholder as the green "+ Add ..." call to action (design rule: never a dash). */
  emptyCta?: boolean;
  /** Muted icon on the trigger while nothing with its own icon is selected. */
  leadingIcon?: ReactNode;
  /** Show the selected option's second line inside the trigger. Default true. */
  showDescription?: boolean;
  /** A spinner on the trigger while the caller is busy (navigating, saving). */
  busy?: boolean;
  "aria-describedby"?: string;
  /** The wrapper. */
  className?: string;
  /** The trigger button. */
  triggerClassName?: string;
};

const SEARCH_AUTO_ABOVE = 8;
const DEFAULT_LIMIT = 80;

export const TONE_TILE: Record<SelectTone, string> = {
  green: "bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary-dark))]",
  amber: "bg-[hsl(var(--amber-soft))] text-[hsl(var(--amber-text))]",
  red: "bg-[hsl(var(--destructive-soft))] text-[hsl(var(--destructive))]",
  blue: "bg-[hsl(var(--info-soft))] text-[hsl(var(--info-text))]",
  pink: "bg-[hsl(var(--pink-soft))] text-[hsl(var(--pink-text))]",
  purple: "bg-[hsl(var(--purple))]/15 text-[hsl(var(--purple))]",
  neutral: "bg-[hsl(var(--surface-muted))] text-muted-foreground"
};

export const TONE_TEXT: Record<SelectTone, string> = {
  green: "text-[hsl(var(--primary-dark))]",
  amber: "text-[hsl(var(--amber-text))]",
  red: "text-[hsl(var(--destructive))]",
  blue: "text-[hsl(var(--info-text))]",
  pink: "text-[hsl(var(--pink-text))]",
  purple: "text-[hsl(var(--purple))]",
  neutral: "text-muted-foreground"
};

// useLayoutEffect warns during server rendering; the panel only ever positions in the browser.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type Row = { kind: "clear" } | { kind: "option"; option: SelectOption };

export function SelectField({
  name,
  id,
  options,
  defaultValue,
  value: valueProp,
  onChange,
  placeholder,
  label,
  required = false,
  requiredMessage,
  disabled = false,
  form,
  clearable = false,
  clearLabel,
  searchable,
  searchPlaceholder,
  scopes,
  footer,
  emptyText = "Nothing to choose from yet.",
  maxVisible = DEFAULT_LIMIT,
  submitOnSelect = false,
  variant = "field",
  leadingIcon,
  emptyCta = false,
  showDescription = true,
  busy: busyProp = false,
  "aria-describedby": describedBy,
  className,
  triggerClassName
}: SelectFieldProps) {
  const controlled = valueProp !== undefined;
  const hasEmptyState = placeholder !== undefined || clearable || options.some((o) => o.value === "");

  // Resolve a raw value the way a React select element does, so what shows is what posts.
  const resolve = useCallback(
    (raw: string | null | undefined) => {
      const v = String(raw ?? "");
      if (v === "" && hasEmptyState) return "";
      if (footer?.value !== undefined && v === footer.value) return v;
      if (options.some((o) => o.value === v)) return v;
      if (hasEmptyState) return "";
      return options.find((o) => !o.disabled)?.value ?? "";
    },
    [options, hasEmptyState, footer?.value]
  );

  // Uncontrolled value, re-synced when the server hands down a new default (after a save).
  const [inner, setInner] = useState(() => String(defaultValue ?? ""));
  const [seenDefault, setSeenDefault] = useState(() => String(defaultValue ?? ""));
  const nextDefault = String(defaultValue ?? "");
  if (!controlled && nextDefault !== seenDefault) {
    setSeenDefault(nextDefault);
    setInner(nextDefault);
  }
  const value = resolve(controlled ? valueProp : inner);

  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<string>("all");
  const [active, setActive] = useState(0);
  const [viewport, setViewport] = useState<{ bottom: number; height: number } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const typeahead = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const focusOnOpen = useRef<"search" | "list" | null>(null);
  // Where the highlight starts once the panel's rows exist: a value to jump to, or the first row.
  const pendingJump = useRef<{ to: string | null } | null>(null);
  const seenFilter = useRef("");

  const uid = useId();
  const listId = `${uid}-list`;
  const problemId = `${uid}-problem`;
  const titleId = `${uid}-title`;
  const rowId = (i: number) => `${uid}-row-${i}`;

  const { pending } = useFormStatus();
  const busy = busyProp || (submitOnSelect && pending);
  const showSearch = searchable ?? options.length > SEARCH_AUTO_ABOVE;
  const compact = variant === "compact";
  const clearText = clearLabel ?? placeholder ?? "Clear";

  const selected = useMemo<SelectOption | null>(() => {
    if (footer?.value !== undefined && value === footer.value) {
      return { value, label: footer.label, icon: footer.icon, tone: "green" };
    }
    return options.find((o) => o.value === value) ?? null;
  }, [options, value, footer]);

  /* ---------------------------------------------------------------- filtering */

  const haystacks = useMemo(
    () =>
      options.map((o) => {
        const hay = searchKey(
          [o.label, o.description, o.tag?.label, o.meta, o.keywords, o.group].filter(Boolean).join(" ")
        );
        return { hay, compact: hay.replace(/ /g, "") };
      }),
    [options]
  );

  const { matched, counts } = useMemo(() => {
    const words = searchKey(query).split(" ").filter(Boolean);
    const hits = options.filter((o, i) => {
      if (o.value === "" && clearable) return false; // drawn as the clear row instead
      if (words.length === 0) return true;
      const h = haystacks[i];
      return words.every((w) => h.hay.includes(w) || h.compact.includes(w));
    });
    const tally: Record<string, number> = {};
    for (const s of scopes ?? []) {
      tally[s.id] = hits.filter((o) => o.scope !== undefined && (s.id === "all" || o.scope === s.id)).length;
    }
    return { matched: hits, counts: tally };
  }, [options, haystacks, query, scopes, clearable]);

  const inScope = useMemo(
    () => (scopes && scope !== "all" ? matched.filter((o) => o.scope === undefined || o.scope === scope) : matched),
    [matched, scopes, scope]
  );
  const shown = inScope.slice(0, maxVisible);
  const hidden = inScope.length - shown.length;

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];
    if (clearable && !query.trim()) list.push({ kind: "clear" });
    for (const option of shown) list.push({ kind: "option", option });
    return list;
  }, [clearable, query, shown]);

  const enabledRow = useCallback(
    (i: number) => {
      const row = rows[i];
      return !!row && (row.kind === "clear" || !row.option.disabled);
    },
    [rows]
  );

  const step = useCallback(
    (from: number, dir: 1 | -1, count = 1) => {
      let i = from;
      let moved = 0;
      let last = from;
      while (moved < count) {
        i += dir;
        if (i < 0 || i >= rows.length) break;
        if (enabledRow(i)) {
          last = i;
          moved++;
        }
      }
      return last;
    },
    [rows.length, enabledRow]
  );

  const firstEnabled = useCallback(() => {
    for (let i = 0; i < rows.length; i++) if (enabledRow(i)) return i;
    return -1;
  }, [rows.length, enabledRow]);

  const lastEnabled = useCallback(() => {
    for (let i = rows.length - 1; i >= 0; i--) if (enabledRow(i)) return i;
    return -1;
  }, [rows.length, enabledRow]);

  const indexOfValue = useCallback(
    (v: string) => rows.findIndex((r) => (r.kind === "clear" ? v === "" : r.option.value === v)),
    [rows]
  );

  /* ---------------------------------------------------------------- open / close / commit */

  const openPanel = (opts?: { query?: string; jumpTo?: string }) => {
    if (disabled || busy) return;
    const phone = !window.matchMedia("(min-width: 640px)").matches;
    const q = opts?.query ?? "";
    const selectedScope = options.find((o) => o.value === value)?.scope;
    const nextScope = scopes && scopes.length > 0 ? (selectedScope ?? scopes[0].id) : "all";
    setSheet(phone);
    // Inside a modal <dialog> the panel must live in the same top layer, or it renders underneath.
    setHost((triggerRef.current?.closest("dialog") as HTMLElement | null) ?? document.body);
    setPos(null);
    setQuery(q);
    setScope(nextScope);
    setActive(-1);
    seenFilter.current = `${q}\u0000${nextScope}`;
    // A typed first letter highlights the first match; otherwise the selected row (or a type-ahead hit).
    pendingJump.current = { to: q ? null : (opts?.jumpTo ?? value) };
    focusOnOpen.current = showSearch && !phone ? "search" : "list";
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
    // Back to the trigger, unless the pick itself put focus somewhere (an inline form that autofocuses).
    const now = document.activeElement;
    if (!now || now === document.body || panelRef.current?.contains(now)) triggerRef.current?.focus();
    const input = hiddenRef.current;
    if (!input || next === previous) return;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    if (submitOnSelect) input.form?.requestSubmit();
  };

  const choose = (i: number) => {
    const row = rows[i];
    if (!row) return;
    if (row.kind === "clear") return commit("");
    if (row.option.disabled) return;
    commit(row.option.value);
  };

  const chooseFooter = () => {
    if (!footer) return;
    if (footer.value !== undefined) commit(footer.value);
    else closePanel(false);
    footer.onSelect?.();
  };

  /* ---------------------------------------------------------------- effects while open */

  // Where the highlight starts: the selected row (or a type-ahead target), else the first row.
  useEffect(() => {
    if (!open || !pendingJump.current) return;
    const { to } = pendingJump.current;
    pendingJump.current = null;
    const at = to === null ? -1 : indexOfValue(to);
    // On a phone nothing is highlighted until a finger or a search picks it: a grey first row reads as chosen.
    setActive(at >= 0 && enabledRow(at) ? at : sheet && to !== null ? -1 : firstEnabled());
  }, [open, sheet, indexOfValue, enabledRow, firstEnabled]);

  // A new search or scope starts the highlight on the first match.
  const filterKey = `${query}\u0000${scope}`;
  useEffect(() => {
    if (!open || seenFilter.current === filterKey) return;
    seenFilter.current = filterKey;
    setActive(sheet && !query.trim() ? -1 : firstEnabled());
  }, [open, sheet, query, filterKey, firstEnabled]);

  // Focus moves into the panel once it exists.
  useEffect(() => {
    if (!open || !focusOnOpen.current) return;
    const target = focusOnOpen.current === "search" ? searchRef.current : listRef.current;
    if (!target) return;
    focusOnOpen.current = null;
    target.focus({ preventScroll: true });
  }, [open, host, rows.length]);

  // The highlighted row stays in view.
  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(rowId(active))?.scrollIntoView({ block: "nearest" });
    // rowId is derived from uid, which never changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    const list = listRef.current;
    if (!trigger || !panel || !list) return;
    const r = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const edge = 8;
    const gap = 6;
    const width = Math.min(Math.max(r.width, compact ? 240 : 300), 560, vw - edge * 2);
    // The height the panel wants: its fixed parts plus the list up to its own 320px cap.
    const natural = panel.offsetHeight - list.clientHeight + Math.min(list.scrollHeight, 320);
    const spaceBelow = vh - r.bottom - gap - edge;
    const spaceAbove = r.top - gap - edge;
    let left = r.left;
    if (left + width > vw - edge) left = r.right - width;
    left = Math.max(edge, Math.min(left, vw - width - edge));
    // Below the trigger when it fits or when below has the room; otherwise above. Never over the trigger:
    // the list gets shorter instead.
    const below = natural <= spaceBelow || spaceBelow >= 260 || spaceBelow >= spaceAbove;
    const maxHeight = Math.max(160, below ? spaceBelow : spaceAbove);
    const height = Math.min(natural, maxHeight);
    const top = below ? r.bottom + gap : r.top - gap - height;
    setPos({ top, left, width, maxHeight });
  }, [compact]);

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
  }, [open, sheet, place, rows.length, host]);

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

  // On a phone the keyboard covers the bottom of the layout viewport; keep the sheet above it.
  useEffect(() => {
    if (!open || !sheet) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const bottom = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      // 86% of the screen normally; with the keyboard up, all the room that is left above it.
      setViewport({ bottom, height: bottom > 0 ? vv.height - 16 : vv.height * 0.86 });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setViewport(null);
    };
  }, [open, sheet]);

  /* ---------------------------------------------------------------- keyboard */

  const matchTypeahead = (text: string, from: number) => {
    const t = text.toLowerCase();
    const n = rows.length;
    for (let k = 1; k <= n; k++) {
      const i = (from + k + n) % n;
      const row = rows[i];
      if (!enabledRow(i)) continue;
      const lbl = row.kind === "clear" ? clearText : row.option.label;
      if (lbl.toLowerCase().startsWith(t)) return i;
    }
    return -1;
  };

  const typeaheadText = (key: string) => {
    const now = Date.now();
    const ta = typeahead.current;
    const text = now - ta.at < 700 ? ta.text + key : key;
    typeahead.current = { text, at: now };
    return text;
  };

  const onTriggerKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (open || disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openPanel();
      return;
    }
    if (e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (showSearch) {
        openPanel({ query: e.key });
        return;
      }
      // Type-ahead on the closed field jumps to the match, as the native select does on desktop.
      const text = typeaheadText(e.key);
      const t = text.toLowerCase();
      const hit = options.find((o) => !o.disabled && o.label.toLowerCase().startsWith(t));
      openPanel({ jumpTo: hit?.value ?? value });
    }
  };

  const onPanelKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const inSearch = e.target === searchRef.current;
    switch (e.key) {
      case "Tab": {
        if (!panelRef.current) return;
        const nodes = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            "button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])"
          )
        ).filter((el) => el.tabIndex >= 0);
        // A short list with no search box has no Tab stop of its own: focus sits on the list. Without this
        // Tab walked out of the panel (it is portalled to the end of the body) to the top of the page, with
        // the list still open and Esc no longer reaching it (keyboard pass, 2026-10-05).
        if (nodes.length === 0) {
          e.preventDefault();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const here = document.activeElement;
        if (here && !nodes.includes(here as HTMLElement)) {
          const following = nodes.some((n) => here.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING);
          const preceding = nodes.some((n) => here.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_PRECEDING);
          if (!e.shiftKey && !following) {
            e.preventDefault();
            first.focus();
          } else if (e.shiftKey && !preceding) {
            e.preventDefault();
            last.focus();
          }
          return;
        }
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
        return;
      }
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => (a < 0 ? firstEnabled() : step(a, 1)));
        return;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => (a < 0 ? lastEnabled() : step(a, -1)));
        return;
      case "PageDown":
        e.preventDefault();
        setActive((a) => step(Math.max(a, 0), 1, 8));
        return;
      case "PageUp":
        e.preventDefault();
        setActive((a) => step(Math.max(a, 0), -1, 8));
        return;
      case "Home":
      case "End":
        // In a search box with text, Home and End move the caret.
        if (inSearch && query) return;
        e.preventDefault();
        setActive(e.key === "Home" ? firstEnabled() : lastEnabled());
        return;
      case "Enter":
        if (!inSearch && e.target !== listRef.current) return; // a focused button or link handles itself
        e.preventDefault();
        if (active >= 0) choose(active);
        return;
      default:
        if (inSearch || e.target !== listRef.current) return;
        if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === " ") {
          e.preventDefault();
          if (active >= 0) choose(active);
          return;
        }
        if (showSearch && searchRef.current) {
          // Typing on the list goes to the search box.
          searchRef.current.focus();
          return;
        }
        e.preventDefault();
        {
          const hit = matchTypeahead(typeaheadText(e.key), active);
          if (hit >= 0) setActive(hit);
        }
    }
  };

  /* ---------------------------------------------------------------- the panel */

  const activeId = open && active >= 0 && rows[active] ? rowId(active) : undefined;
  const groupsUsed = shown.some((o) => o.group);

  const panelNode = (() => {
    if (!open || !host) return null;

    const sheetStyle = viewport
      ? { bottom: viewport.bottom, maxHeight: Math.max(240, viewport.height) }
      : { maxHeight: "86vh" };

    let lastGroup: string | undefined;
    const listChildren: ReactNode[] = [];
    rows.forEach((row, i) => {
      if (row.kind === "option" && groupsUsed && row.option.group !== lastGroup) {
        lastGroup = row.option.group;
        if (row.option.group) {
          listChildren.push(
            <div
              key={`g-${row.option.group}-${i}`}
              role="presentation"
              className="px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-[0.07em] text-muted-foreground"
            >
              {row.option.group}
            </div>
          );
        }
      }
      const isActive = i === active;
      if (row.kind === "clear") {
        const on = value === "";
        listChildren.push(
          <div
            key="clear"
            id={rowId(i)}
            role="option"
            aria-selected={on}
            onPointerMove={() => setActive(i)}
            onClick={() => choose(i)}
            className={cn(
              "flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[10px] px-3 py-1.5 text-[14px] text-muted-foreground",
              isActive && "bg-muted text-foreground"
            )}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[hsl(var(--surface-muted))]">
              <CircleSlash className="h-4 w-4" aria-hidden />
            </span>
            <span className="flex-1 truncate">{clearText}</span>
            {on && <Check className="h-4 w-4 shrink-0 text-[hsl(var(--primary))]" aria-hidden />}
          </div>
        );
        return;
      }
      const o = row.option;
      const on = o.value === value;
      listChildren.push(
        <div
          key={`o-${o.value}`}
          id={rowId(i)}
          role="option"
          aria-selected={on}
          aria-disabled={o.disabled || undefined}
          onPointerMove={() => !o.disabled && setActive(i)}
          onClick={() => !o.disabled && choose(i)}
          className={cn(
            "flex min-h-[44px] items-center gap-3 rounded-[10px] px-3 py-1.5 text-[14px]",
            o.disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer",
            isActive && !o.disabled && "bg-muted",
            on && "bg-[hsl(var(--primary-soft))]/60"
          )}
        >
          <OptionVisual option={o} size="row" />
          <OptionText option={o} selected={on} />
          {o.meta && (
            <span className={cn("shrink-0 text-[12px] font-semibold tabular-nums", TONE_TEXT[o.metaTone ?? "neutral"])}>
              {o.meta}
            </span>
          )}
          <span className="grid w-4 shrink-0 place-items-center">
            {on && <Check className="h-4 w-4 text-[hsl(var(--primary))]" aria-hidden />}
          </span>
        </div>
      );
    });

    const nothing = options.length === 0 ? emptyText : rows.length === 0 ? `Nothing matches "${query.trim()}".` : null;

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
          aria-labelledby={sheet && label ? titleId : undefined}
          aria-label={sheet && label ? undefined : label ? `Choose ${label.toLowerCase()}` : "Choose an option"}
          onKeyDown={onPanelKey}
          className={cn(
            "fixed z-[130] flex flex-col overflow-hidden border border-border bg-card text-card-foreground",
            sheet
              ? "inset-x-0 bottom-0 rounded-t-[18px] pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-bottom-8"
              : "rounded-[14px] shadow-[var(--shadow-2)] motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
          )}
          style={
            sheet
              ? sheetStyle
              : {
                  top: pos?.top ?? -9999,
                  left: pos?.left ?? -9999,
                  width: pos?.width ?? 300,
                  maxHeight: pos?.maxHeight
                }
          }
        >
          {sheet && (
            <>
              <div className="mx-auto mb-1 h-1 w-9 shrink-0 rounded-full bg-[hsl(var(--border-strong))]" aria-hidden />
              <div className="flex shrink-0 items-center gap-2 pl-4 pr-2">
                <p id={titleId} className="flex-1 truncate text-[16px] font-semibold">
                  {label ?? "Choose"}
                </p>
                <button
                  type="button"
                  onClick={() => closePanel(true)}
                  aria-label="Close"
                  className="grid h-11 w-11 place-items-center rounded-[10px] text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </>
          )}

          {(showSearch || (scopes && scopes.length > 0)) && (
            <div className={cn("shrink-0 space-y-2 px-2.5", sheet ? "pb-2 pt-1" : "pt-2.5 pb-1.5")}>
              {showSearch && (
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <input
                    ref={searchRef}
                    type="text"
                    role="combobox"
                    aria-expanded="true"
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={activeId}
                    aria-label={label ? `Search ${label.toLowerCase()}` : "Search"}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={searchPlaceholder ?? "Search"}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="done"
                    className="h-11 w-full rounded-[10px] border border-input bg-background pl-9 pr-10 text-[16px] outline-none placeholder:text-muted-foreground focus:border-[hsl(var(--ring))] focus:ring-[3px] focus:ring-[hsl(var(--ring))]/30 sm:h-10 sm:text-[14px]"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        searchRef.current?.focus();
                      }}
                      aria-label="Clear search"
                      className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-[10px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] sm:h-10 sm:w-10"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
              {scopes && scopes.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto scrollbar-none" role="group" aria-label="Show">
                  {scopes.map((s) => {
                    const on = scope === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setScope(s.id)}
                        className={cn(
                          "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] sm:h-8",
                          on
                            ? "border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary-dark))]"
                            : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {s.label}
                        <span className="font-medium tabular-nums opacity-80">{counts[s.id] ?? 0}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label={label ?? "Options"}
            aria-activedescendant={activeId}
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 py-1.5 outline-none",
              !sheet && "max-h-[320px]"
            )}
          >
            {listChildren}
            {nothing && <p className="px-3 py-5 text-center text-[13px] text-muted-foreground">{nothing}</p>}
            {hidden > 0 && (
              <p className="px-3 py-2 text-center text-[12px] text-muted-foreground">
                Showing {shown.length} of {inScope.length}. Type to narrow it down.
              </p>
            )}
          </div>

          {footer && (
            <div className="shrink-0 border-t border-border p-1.5">
              {footer.href ? (
                <Link
                  href={footer.href}
                  prefetch={false}
                  scroll={false}
                  onClick={() => {
                    closePanel(false);
                    footer.onSelect?.();
                  }}
                  className={footerClass}
                >
                  <FooterIcon icon={footer.icon} />
                  {footer.label}
                </Link>
              ) : (
                <button type="button" onClick={chooseFooter} className={footerClass}>
                  <FooterIcon icon={footer.icon} />
                  {footer.label}
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

  const describe = [describedBy, problem ? problemId : null].filter(Boolean).join(" ") || undefined;
  const hasVisual = !!selected && (!!selected.media || !!selected.icon || !!selected.avatar);

  return (
    <div ref={wrapRef} className={cn("relative w-full min-w-0", className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label}
        aria-required={required || undefined}
        aria-invalid={problem ? true : undefined}
        aria-describedby={describe}
        onClick={() => (open ? closePanel(false) : openPanel())}
        onKeyDown={onTriggerKey}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-[10px] border bg-card text-left outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          compact
            ? "h-11 pl-2.5 pr-2 text-[13px] lg:h-9"
            : cn("min-h-[46px] py-1 pl-3 pr-2.5 text-[14px] shadow-[var(--shadow-1)]", hasVisual && "pl-2"),
          problem ? "border-[hsl(var(--destructive))]" : "border-input hover:border-[hsl(var(--muted-foreground))]",
          "focus-visible:border-[hsl(var(--ring))] focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--ring))]/30",
          open && "border-[hsl(var(--ring))] ring-[3px] ring-[hsl(var(--ring))]/30",
          triggerClassName
        )}
      >
        {selected && hasVisual && !compact ? (
          <OptionVisual option={selected} size="trigger" />
        ) : !selected && emptyCta ? (
          <Plus className="h-4 w-4 shrink-0 text-[hsl(var(--primary-dark))]" aria-hidden />
        ) : (
          leadingIcon && (
            <span
              className={cn(
                "shrink-0 [&>svg]:h-4 [&>svg]:w-4",
                selected ? "text-[hsl(var(--primary))]" : "text-muted-foreground"
              )}
              aria-hidden
            >
              {leadingIcon}
            </span>
          )
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              "truncate",
              selected
                ? "text-foreground"
                : emptyCta
                  ? "font-semibold text-[hsl(var(--primary-dark))]"
                  : "text-muted-foreground",
              selected?.mono && "font-mono",
              selected && !compact && "font-[550]"
            )}
          >
            {selected ? selected.label : value === "" && clearable ? clearText : (placeholder ?? "Choose")}
          </span>
          {selected && showDescription && !compact && (selected.description || selected.tag) && (
            <span className="truncate text-[12px] leading-tight text-muted-foreground">
              {selected.tag && (
                <span className={cn("font-semibold", TONE_TEXT[selected.tag.tone ?? "neutral"])}>
                  {selected.tag.label}
                </span>
              )}
              {selected.tag && selected.description ? " · " : ""}
              {selected.description}
            </span>
          )}
        </span>
        {selected?.meta && !compact && (
          <span
            className={cn(
              "max-w-[45%] shrink-0 truncate text-[12px] font-semibold tabular-nums",
              TONE_TEXT[selected.metaTone ?? "neutral"]
            )}
          >
            {selected.meta}
          </span>
        )}
        {busy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
            aria-hidden
          />
        )}
      </button>

      {name && <input ref={hiddenRef} type="hidden" name={name} value={value} form={form} disabled={disabled} />}
      {required && (
        <input
          type="text"
          tabIndex={-1}
          aria-hidden="true"
          required
          disabled={disabled}
          value={value}
          onChange={() => undefined}
          form={form}
          onInvalid={(e) => {
            e.preventDefault();
            setProblem(requiredMessage ?? (label ? `Choose the ${label.toLowerCase()}.` : "Choose an option."));
            // Like the browser, focus only the first field that is wrong.
            const owner = e.currentTarget.form;
            const first = owner
              ? Array.from(owner.elements).find((el) => !(el as HTMLInputElement).validity?.valid)
              : null;
            if (!first || first === e.currentTarget) triggerRef.current?.focus();
          }}
          className="pointer-events-none absolute inset-x-0 top-0 h-[46px] w-full opacity-0"
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

const footerClass =
  "flex min-h-[44px] w-full items-center gap-3 rounded-[10px] px-3 text-left text-[14px] font-semibold text-[hsl(var(--primary-dark))] outline-none hover:bg-[hsl(var(--primary-soft))]/60 focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]";

function FooterIcon({ icon }: { icon?: ReactNode }) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary-dark))] [&>svg]:h-4 [&>svg]:w-4">
      {icon ?? <span className="text-[16px] leading-none">+</span>}
    </span>
  );
}

/** The leading picture of an option: its media, an icon tile or an initials avatar. */
export function OptionVisual({ option, size }: { option: SelectOption; size: "row" | "trigger" }) {
  const box = size === "row" ? "h-9 w-9" : "h-8 w-8";
  if (option.media) {
    return (
      <span className={cn("relative shrink-0 overflow-hidden rounded-lg bg-[hsl(var(--surface-muted))]", box)}>
        {option.media}
      </span>
    );
  }
  if (option.avatar) {
    return (
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-full text-[12px] font-bold",
          box,
          TONE_TILE[option.tone ?? "neutral"]
        )}
        aria-hidden
      >
        {option.avatar}
      </span>
    );
  }
  if (option.icon) {
    return (
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-lg [&>svg]:h-4 [&>svg]:w-4",
          box,
          TONE_TILE[option.tone ?? "neutral"]
        )}
        aria-hidden
      >
        {option.icon}
      </span>
    );
  }
  return null;
}

function OptionText({ option, selected }: { option: SelectOption; selected: boolean }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className={cn("truncate", option.mono && "font-mono", selected ? "font-semibold" : "font-[500]")}>
        {option.label}
      </span>
      {(option.description || option.tag) && (
        <span className="truncate text-[12px] leading-snug text-muted-foreground">
          {option.tag && (
            <span className={cn("font-semibold", TONE_TEXT[option.tag.tone ?? "neutral"])}>{option.tag.label}</span>
          )}
          {option.tag && option.description ? " · " : ""}
          {option.description}
        </span>
      )}
    </span>
  );
}

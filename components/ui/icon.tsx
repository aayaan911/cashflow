/**
 * A Lucide icon drawn by CSS (speed pass, 2026-10-04). The icon's own Lucide path data lives once in the
 * stylesheet as a mask (`.kb-i-*` in app/globals.css) and the element takes the text colour, so it looks
 * exactly like the Lucide <svg> it replaces. Built for the views that repeat the same few icons on every
 * card or row: an inline <svg> was about 500 bytes in the HTML and the same again in the page payload, 41
 * cards times six icons, where this is one empty element. The size comes from where it sits (`.kb-crow`,
 * `.kb-pill`, ...) or from a `className`; it is decorative, so screen readers skip it like the svg they
 * used to skip.
 */
export type IconName =
  "cake" | "cage" | "calendar-days" | "check" | "dna" | "egg" | "pair" | "plus" | "ring" | "tag" | "users";

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return <i className={className ? `kb-i kb-i-${name} ${className}` : `kb-i kb-i-${name}`} />;
}

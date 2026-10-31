import type { SelectOption } from "@/components/ui/select-field";
import { bdt } from "@/lib/utils";

/**
 * Plain helpers behind the v4 select (components/ui/select-field.tsx). They live outside the client
 * module so server components can build option lists too (a function exported from a "use client"
 * file cannot be called on the server).
 */

/** "Rahim Uddin" -> "RU". Never empty: a nameless row gets "?". */
export function initialsOf(name: string | null | undefined) {
  const words = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  const first = Array.from(words[0])[0] ?? "";
  const second = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? "") : "";
  return (first + second).toUpperCase();
}

/**
 * Search key: lower case, letters and digits only (Latin and Bangla), words split on anything else.
 * "opaline c2" finds "Opaline - C2", "pf31" finds "PF 31", "01711" finds "+880 1711-000000".
 */
export function searchKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9ঀ-৿]+/g, " ")
    .trim();
}

export type CustomerChoice = {
  id: string;
  name: string;
  phone?: string | null;
  /** customer_dashboard.due_total. Never recomputed here. */
  due_total?: number | null;
};

/**
 * One customer row: initials avatar, the name, the phone (searchable) and, when the customer_dashboard
 * view says money is still owed, "owes ৳X" in amber. The order is the caller's.
 */
export function customerOption(c: CustomerChoice): SelectOption {
  const due = Math.max(0, Number(c.due_total ?? 0));
  const phone = c.phone?.trim();
  return {
    value: c.id,
    label: c.name?.trim() || "Unnamed customer",
    description: phone || "No phone",
    avatar: initialsOf(c.name),
    tone: "neutral",
    meta: due > 0 ? `owes ${bdt(due)}` : undefined,
    metaTone: "amber",
    keywords: phone ? phone.replace(/\D+/g, "") : undefined
  };
}

export function customerOptions(customers: CustomerChoice[]): SelectOption[] {
  return customers.map(customerOption);
}

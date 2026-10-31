/**
 * localStorage helpers that cannot take the app down.
 *
 * A raw `JSON.parse(localStorage.getItem(key) ?? "[]")` throws on any corrupted
 * value, and several of these calls sit in components rendered inside the app
 * shell. One bad entry (a half-written value, a browser extension, a user
 * editing storage) therefore turned the whole authenticated app blank rather
 * than degrading to "no recent items". Storage is also unavailable outright in
 * private-mode Safari and when a browser blocks site data, which throws on
 * access, not just on parse.
 *
 * Every read returns the fallback instead of throwing. Every write is
 * best-effort. Nothing here is a place for data that must survive.
 */

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

/** Same as readJson but guarantees an array, so `.map`/`.includes` are always safe. */
export function readJsonArray<T>(key: string): T[] {
  const value = readJson<unknown>(key, []);
  return Array.isArray(value) ? (value as T[]) : [];
}

export function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded or storage blocked: a convenience cache is not worth an error */
  }
}

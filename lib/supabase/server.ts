import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";
import { cache } from "react";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Diagnostic, OFF by default: `KB_QUERY_LOG=1` prints one line per Supabase request a render makes
 * (PostgREST table or rpc, Auth, Storage), so the round trips of a page can be counted and their
 * order read: `[kb-query r3f9 #4 +61ms] GET parent_birds 38ms 200`. `r3f9` tags one server render,
 * `#4` is the fourth request it started, `+61ms` is when it started after the render's first request
 * (a request that starts late was waiting on another), `38ms` is how long it took.
 *
 * It logs the table or function name from the URL path, the method, the HTTP status and timings: never
 * a query string value, a header, a cookie, a body or a key. When the flag is unset the client is built
 * exactly as before: no wrapper, no timer, no log.
 */
const QUERY_LOG = process.env.KB_QUERY_LOG === "1";

/** "parent_birds", "rpc:sidebar_badges", "auth:user", "storage:object/sign". Path names only. */
function requestTarget(url: string): string {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return "unknown";
  }
  const rest = path.match(/^\/rest\/v1\/(rpc\/)?([^/]+)/);
  if (rest) return rest[1] ? `rpc:${rest[2]}` : rest[2];
  const auth = path.match(/^\/auth\/v1\/([^/]+)/);
  if (auth) return `auth:${auth[1]}`;
  // A storage path carries the object path (owner and bird ids) after the operation: keep the operation only.
  const storage = path.match(/^\/storage\/v1\/([^/]+)(?:\/([^/]+))?/);
  if (storage) return `storage:${storage[1]}${storage[2] ? `/${storage[2]}` : ""}`;
  return "other";
}

/** One wrapper per server client, so per request (createClient is cache()d per render). */
function loggedFetch(): typeof fetch {
  const tag = Math.random().toString(16).slice(2, 6);
  let seq = 0;
  let first: number | null = null;
  return async (input, init) => {
    const n = ++seq;
    const started = Date.now();
    if (first === null) first = started;
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const label = `[kb-query r${tag} #${n} +${started - first}ms] ${method} ${requestTarget(url)}`;
    try {
      // Resolved at call time, so Next's patched fetch (no-store for these authorised requests) still applies.
      const response = await globalThis.fetch(input, init);
      console.log(`${label} ${Date.now() - started}ms ${response.status}`);
      return response;
    } catch (error) {
      console.log(`${label} ${Date.now() - started}ms failed`);
      throw error;
    }
  };
}

/**
 * Server-side Supabase client, memoised per request with React cache() so a
 * page that calls it from several server components/loaders builds it once.
 * The cookie store it wraps is itself request-scoped, so sharing is safe.
 */
export const createClient = cache(function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      ...(QUERY_LOG ? { global: { fetch: loggedFetch() } } : null),
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }); } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: "", ...options }); } catch {}
        }
      }
    }
  );
});

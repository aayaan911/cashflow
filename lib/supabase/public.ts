import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cookie-free Supabase client for PUBLIC, unauthenticated reads.
 *
 * Why this exists: lib/supabase/server.ts calls cookies(), and reading cookies
 * opts a route out of static rendering entirely. When the Founding-50 counter
 * was wired up, /welcome and /pricing started calling it — which silently
 * turned both marketing pages from statically-served-at-the-edge into a
 * function invocation in Tokyo on every single visit. From Bangladesh that is
 * a round trip to hnd1 for a page that never changes per visitor.
 *
 * These reads need no session: the RPCs and rows they touch are granted to
 * `anon`. Skipping the cookie store lets the pages stay static/ISR and be
 * served from the Mumbai edge instead.
 *
 * Never use this for anything owner-scoped — with no session, RLS sees `anon`.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

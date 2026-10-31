import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { hasConfiguredSupabase } from "@/lib/env";

/**
 * All loaders live here. Each is wrapped in React cache(): one client and one query per request.
 * Never cache across requests.
 */

/** The verified user, for any write or access decision. Null on an error or no session. */
export const getAuthUser = cache(async () => {
  const { data, error } = await createClient().auth.getUser();
  return error || !data.user ? null : data.user;
});

/**
 * The signed-in user from the session cookie, for DISPLAY only (no network call). Every row a page
 * shows still goes through PostgREST, which checks the JWT and applies RLS. Never use this for an
 * access decision: use getAuthUser there.
 */
export const getSessionUser = cache(async () => {
  const supabase = createClient();
  (supabase.auth as unknown as { suppressGetSessionWarning: boolean }).suppressGetSessionWarning = true;
  const { data, error } = await supabase.auth.getSession();
  return error || !data.session?.user ? null : data.session.user;
});

export interface AccountProfile {
  fullName: string | null;
  /** YYYY-MM-DD the account was created. */
  since: string | null;
}

export const getAccountProfile = cache(async (): Promise<AccountProfile | null> => {
  if (!hasConfiguredSupabase()) return null;
  const user = await getSessionUser();
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name = typeof meta.full_name === "string" && meta.full_name.trim() ? meta.full_name.trim() : null;
  return { fullName: name, since: user.created_at ? user.created_at.slice(0, 10) : null };
});

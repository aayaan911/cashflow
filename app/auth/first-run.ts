import type { User } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";

type ServerClient = ReturnType<typeof createClient>;

/**
 * Where a user goes right after a successful sign-in. CIFLOW has no onboarding page yet, so every
 * sign-in goes where it asked to go. When a first-run flow is built, route new accounts to it here.
 */
export async function landingAfterSignIn(
  _supabase: ServerClient,
  _user: User | null | undefined,
  requested: string
): Promise<string> {
  return requested;
}

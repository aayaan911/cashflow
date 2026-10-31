/**
 * The Supabase project this build talks to. The Supabase to Vercel integration names the browser key
 * NEXT_PUBLIC_SUPABASE_ANON_KEY on older installs and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY on newer ones,
 * so both are accepted. Each name is written out literally: Next only inlines NEXT_PUBLIC_* that way.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

export function hasConfiguredSupabase() {
  return Boolean(
    SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes("your-project") && SUPABASE_KEY !== "your-anon-key"
  );
}

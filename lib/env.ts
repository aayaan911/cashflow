export function hasConfiguredSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return Boolean(url && key && !url.includes("your-project") && key !== "your-anon-key");
}

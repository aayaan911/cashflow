import { NextResponse } from "next/server";
import { hasConfiguredSupabase, SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * GET /api/health: uptime probe. 200 when the function and Supabase answer, 503 otherwise.
 * Public, cookie-free, never cached. It calls Supabase Auth's own health endpoint, so it reads no row.
 * A daily Vercel cron hits it (vercel.json) so a Free Supabase project never pauses for inactivity.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  let db: "ok" | "error" | "unconfigured" = "unconfigured";
  let dbMs: number | null = null;

  if (hasConfiguredSupabase()) {
    const started = Date.now();
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
        headers: { apikey: SUPABASE_KEY },
        cache: "no-store"
      });
      db = res.ok ? "ok" : "error";
    } catch {
      db = "error";
    }
    dbMs = Date.now() - started;
  }

  const ok = db !== "error";
  return NextResponse.json(
    {
      ok,
      db,
      db_ms: dbMs,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      time: new Date().toISOString()
    },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } }
  );
}

"use client";

import { RefreshCw, WifiOff } from "lucide-react";

/**
 * App-surface error boundary. Catches data-layer failures (e.g. a Supabase
 * outage — loadWithFallback rethrows in production instead of serving mock
 * data) and shows an honest retry screen instead of fake records.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <WifiOff className="h-6 w-6 text-muted-foreground" />
        </span>
        <div className="space-y-1">
          <h2 className="text-[16px] font-semibold">Couldn&apos;t load your data</h2>
          <p className="text-[12px] text-muted-foreground">
            The connection to the database failed. Your records are safe: nothing shown here is lost. Check your
            internet and try again.
          </p>
        </div>
        <button
          onClick={reset}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-5 text-[13px] font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
        >
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
        {error.digest && <p className="text-[12px] text-muted-foreground/60 font-mono">ref: {error.digest}</p>}
      </div>
    </div>
  );
}

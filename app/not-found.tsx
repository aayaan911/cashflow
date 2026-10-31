import Link from "next/link";
import { Bird, Home, Search, Egg, Users } from "lucide-react";

/**
 * Branded 404 page. Stays inside app shell, gives the user clear escape routes.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-[hsl(var(--primary-soft))]/30 to-[hsl(var(--info-soft))]/30">
      <div className="max-w-md w-full text-center">
        {/* Visual */}
        <div className="relative mx-auto h-32 w-32 mb-6">
          <div className="absolute inset-0 rounded-full bg-[hsl(var(--primary-soft))] flex items-center justify-center">
            <Bird className="h-16 w-16 text-[hsl(var(--primary-dark))]" />
          </div>
          <div className="absolute -top-2 -right-2 h-10 w-10 rounded-full bg-card border-2 border-[hsl(var(--primary))] flex items-center justify-center text-[18px] font-bold text-[hsl(var(--primary))]">
            ?
          </div>
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-2">This page flew away</h1>
        <p className="text-[14px] text-muted-foreground mb-1">
          The link you followed may be broken, or the bird/page may have been moved or deleted.
        </p>
        <p className="text-[12px] text-muted-foreground mb-8">
          Error code: <code className="font-mono bg-muted/40 px-1.5 py-0.5 rounded">404</code>
        </p>

        {/* Primary CTA */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 h-11 px-6 rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-[14px] font-semibold hover:opacity-90 shadow-sm transition-opacity"
        >
          <Home className="h-4 w-4" /> Go to Dashboard
        </Link>

        {/* Secondary quick links */}
        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            Or try one of these
          </p>
          <div className="grid grid-cols-2 gap-2 text-[13px]">
            <Link
              href="/portfolio"
              className="flex items-center justify-center gap-1.5 h-9 rounded-md border border-border bg-card hover:bg-muted/40 transition-colors min-h-[44px] lg:min-h-0"
            >
              <Bird className="h-3.5 w-3.5" /> Portfolio
            </Link>
            <Link
              href="/production"
              className="flex items-center justify-center gap-1.5 h-9 rounded-md border border-border bg-card hover:bg-muted/40 transition-colors min-h-[44px] lg:min-h-0"
            >
              <Egg className="h-3.5 w-3.5" /> Production
            </Link>
            <Link
              href="/customers"
              className="flex items-center justify-center gap-1.5 h-9 rounded-md border border-border bg-card hover:bg-muted/40 transition-colors min-h-[44px] lg:min-h-0"
            >
              <Users className="h-3.5 w-3.5" /> Customers
            </Link>
            <Link
              href="/search"
              className="flex items-center justify-center gap-1.5 h-9 rounded-md border border-border bg-card hover:bg-muted/40 transition-colors min-h-[44px] lg:min-h-0"
            >
              <Search className="h-3.5 w-3.5" /> Search
            </Link>
          </div>
        </div>

        <p className="mt-8 text-[12px] text-muted-foreground">
          <kbd className="font-mono bg-muted/40 px-1.5 py-0.5 rounded text-[12px]">⌘ + P</kbd> opens the command palette
          from anywhere
        </p>
      </div>
    </div>
  );
}

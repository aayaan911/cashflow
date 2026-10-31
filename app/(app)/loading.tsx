import { Topbar } from "@/components/topbar";

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} aria-hidden="true" />;
}

/**
 * The fallback skeleton for every (app) page without its own loading file (the dashboard, Payments,
 * Expenses, Calendar, Settings, Search, Season plan). It stands in the v3 page frame the pages use: the
 * same gutters and 1360px column, a PageTitle-sized block, one bordered KPI strip (two cells a row on a
 * phone, four on desktop) and one panel, so the title and the first strip do not move when the page
 * arrives. The top bar keeps its title hidden, as those pages do, instead of flashing the word "Loading".
 */
export default function Loading() {
  return (
    <div className="min-h-screen" aria-busy="true">
      <Topbar title="Loading" revealOnScroll />
      <div className="px-4 sm:px-6 lg:px-8 pt-2.5 pb-4 sm:pt-[22px] sm:pb-6 space-y-3.5 sm:space-y-[18px] max-w-[1360px] mx-auto">
        <div className="pt-1.5 pb-0.5">
          <Bar className="h-[30px] sm:h-[37px] w-48 sm:w-64 mt-0.5" />
          <Bar className="h-[21px] sm:h-[22px] w-full max-w-md mt-1.5 sm:mt-2" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 rounded-[14px] border border-border bg-card shadow-[var(--shadow-1)] overflow-hidden">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="px-3.5 py-3 sm:px-5 sm:py-4">
              <Bar className="h-[14px] w-20 my-[3px]" />
              <Bar className="h-[23px] sm:h-[29px] w-16 mt-1" />
              <Bar className="h-[13px] w-24 mt-1.5" />
            </div>
          ))}
        </div>

        <div className="rounded-[18px] border border-border bg-card shadow-[var(--shadow-1)] overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-5 pt-3.5 sm:pt-[18px] pb-2">
            <Bar className="h-5 w-40" />
            <Bar className="h-8 w-20" />
          </div>
          {[0, 1, 2, 3, 4].map((index) => (
            <div
              key={index}
              className="flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[56px] border-t border-border/70"
            >
              <Bar className="h-[34px] w-[34px] rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Bar className="h-3.5 w-1/3" />
                <Bar className="h-3 w-1/2" />
              </div>
              <Bar className="h-4 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

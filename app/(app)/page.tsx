import { Wallet } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { PageTitle } from "@/components/page-title";
import { getAccountProfile } from "@/lib/data";

export const metadata = { title: "Overview" };

/**
 * Overview: the first page after sign-in. Money first, as in the design this shell comes from.
 * It shows no numbers until the first money feature exists: a page never shows a figure it cannot back.
 */
export default async function OverviewPage() {
  const profile = await getAccountProfile();
  const first = profile?.fullName?.split(/\s+/)[0];
  return (
    <div className="min-h-screen">
      <Topbar title="Overview" revealOnScroll />
      <div className="px-4 sm:px-6 lg:px-8 pt-2.5 pb-4 sm:pt-[22px] sm:pb-6 space-y-3.5 sm:space-y-[18px] max-w-[1360px] mx-auto">
        <PageTitle
          title={first ? `Hello, ${first}` : "Overview"}
          line="Your money, in one place. Accounts and transactions are the next step."
        />
        <section className="rounded-[18px] border border-border bg-card px-5 py-8 text-center shadow-[var(--shadow-1)] sm:py-10">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary-dark))]">
            <Wallet className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="mt-3 text-[17px] font-semibold tracking-[-0.02em]">Nothing to show yet</h2>
          <p className="mx-auto mt-1.5 max-w-[480px] text-[14px] leading-[1.5] text-muted-foreground">
            Once accounts and transactions are built, your balance, income and spending appear here.
          </p>
        </section>
      </div>
    </div>
  );
}

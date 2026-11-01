import { Sparkles } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { seedDefaults } from "@/app/money/actions";

/** Shown on every money page while the workspace has no accounts and no categories. */
export function FirstRun({ returnTo }: { returnTo: string }) {
  return (
    <section className="rounded-[18px] border border-border bg-card px-5 py-8 text-center shadow-[var(--shadow-1)] sm:py-10">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary-dark))]">
        <Sparkles className="h-5 w-5" aria-hidden />
      </span>
      <h2 className="mt-3 text-[17px] font-semibold tracking-[-0.02em]">Start with a few accounts and categories</h2>
      <p className="mx-auto mt-1.5 max-w-[460px] text-[14px] leading-[1.5] text-muted-foreground">
        Cash, Bank and bKash, plus the usual categories like Family, Transport and Freelance. Rename or remove any of
        them in Setup.
      </p>
      <form action={seedDefaults} className="mt-4">
        <input type="hidden" name="return_to" value={returnTo} />
        <SubmitButton pendingText="Setting up…" className="min-h-[44px]">
          Add the starter set
        </SubmitButton>
      </form>
    </section>
  );
}

import { LogOut } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { PageTitle } from "@/components/page-title";
import { SubmitButton } from "@/components/submit-button";
import { signOut } from "@/app/auth/actions";
import { getSessionUser } from "@/lib/data";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getSessionUser();
  return (
    <div className="min-h-screen">
      <Topbar title="Settings" revealOnScroll />
      <div className="px-4 sm:px-6 lg:px-8 pt-2.5 pb-4 sm:pt-[22px] sm:pb-6 space-y-3.5 sm:space-y-[18px] max-w-[760px] mx-auto">
        <PageTitle
          title="Settings"
          line={
            user?.email ? (
              <>
                Signed in as <b>{user.email}</b>.
              </>
            ) : (
              "Your account."
            )
          }
        />
        <section className="rounded-[14px] border border-border bg-card p-4 sm:p-5 shadow-[var(--shadow-1)]">
          <form action={signOut}>
            <SubmitButton variant="outline" className="min-h-[44px]">
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </SubmitButton>
          </form>
        </section>
      </div>
    </div>
  );
}

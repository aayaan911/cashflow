import { Sidebar } from "@/components/sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { getAccountProfile } from "@/lib/data";

/** Feeds the account profile (session cookie, no network call) to the desktop sidebar and the phone nav. */
export async function SidebarServer() {
  const profile = await getAccountProfile().catch(() => null);
  return (
    <>
      <Sidebar profile={profile} />
      <MobileBottomNav />
    </>
  );
}

import { Suspense } from "react";
import { SidebarServer } from "@/components/sidebar-server";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { ToastBanner } from "@/components/toast-banner";
import { OfflineBanner } from "@/components/offline-banner";

export const dynamic = "force-dynamic";

// Everything under (app) is behind auth: keep it out of the index entirely.
export const metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <a href="#main" className="kb-skip">
        Skip to content
      </a>
      <OfflineBanner />
      <SidebarServer />
      <KeyboardShortcuts />
      <Suspense fallback={null}>
        <ToastBanner />
      </Suspense>
      <main id="main" tabIndex={-1} className="flex-1 min-w-0 pb-20 outline-none lg:pb-0">
        {children}
      </main>
    </div>
  );
}

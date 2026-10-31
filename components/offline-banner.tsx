"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

/**
 * OfflineBanner — sticky banner that appears when the device loses connection.
 *
 * Full PWA offline mode (service worker + IndexedDB + sync queue) is deferred;
 * this minimum-viable detection at least warns the user before they lose work.
 */
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    // Initial state
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);

    function handleOnline() {
      setIsOnline(true);
      setShowReconnected(true);
      // Auto-hide reconnected banner after 4s
      setTimeout(() => setShowReconnected(false), 4000);
    }
    function handleOffline() {
      setIsOnline(false);
      setShowReconnected(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline === null) return null; // SSR — render nothing

  if (!isOnline) {
    return (
      <div
        role="alert"
        className="fixed top-0 left-0 right-0 z-50 bg-[hsl(var(--destructive))] text-white px-4 py-2 text-[12px] font-medium flex items-center justify-center gap-2 shadow-lg"
      >
        <WifiOff className="h-3.5 w-3.5" />
        <span>Offline: changes won&apos;t save until you reconnect</span>
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div
        role="status"
        className="fixed top-0 left-0 right-0 z-50 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2 text-[12px] font-medium flex items-center justify-center gap-2 shadow-lg animate-in slide-in-from-top"
      >
        <Wifi className="h-3.5 w-3.5" />
        <span>Reconnected ✓</span>
      </div>
    );
  }

  return null;
}

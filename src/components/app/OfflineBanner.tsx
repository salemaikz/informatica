"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { useT } from "@/i18n/useT";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Тонкая полоса «Нет интернета» (янтарная); исчезает, когда связь вернулась. */
export function OfflineBanner() {
  const { t } = useT();
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-warning-soft px-4 py-1.5 text-center text-[13px] font-bold text-text">
      <WifiOff size={15} aria-hidden className="shrink-0 text-warning-strong" />
      <span>{t("offline.banner")}</span>
    </div>
  );
}

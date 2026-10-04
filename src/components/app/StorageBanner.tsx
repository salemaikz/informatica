"use client";

import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { isFocusPath } from "@/lib/recovery";
import { storageStatus, subscribeStorage, type StorageStatus } from "@/lib/safe-storage";
import { useT } from "@/i18n/useT";

/**
 * Полоса вверху приложения, если браузер не сохраняет прогресс (приватный режим, запрет данных сайта)
 * или его память заполнена. Закрывается крестиком до конца сессии; в уроке, тренировке, пробнике и играх не показывается.
 */
export function StorageBanner() {
  const { t } = useT();
  const pathname = usePathname();
  const status = useSyncExternalStore<StorageStatus>(subscribeStorage, storageStatus, () => "ok");
  const [closed, setClosed] = useState(false);
  if (status === "ok" || closed || isFocusPath(pathname)) return null;
  return (
    // lg:pl-68 — отступ под боковое меню (w-64 + поле): оно фиксировано и иначе перекрыло бы начало текста.
    <div role="status" className="flex items-start gap-2 bg-warning-soft px-4 py-2 text-[13px] font-bold text-text lg:pl-68">
      <AlertTriangle size={16} aria-hidden className="mt-0.5 shrink-0 text-warning-strong" />
      <span className="min-w-0 flex-1">{t(status === "full" ? "storage.banner.full" : "storage.banner.memory")}</span>
      <button
        type="button"
        onClick={() => setClosed(true)}
        aria-label={t("common.close")}
        className="relative -my-1 -mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-text focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary after:absolute after:-inset-1"
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}

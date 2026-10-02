"use client";

import { useEffect } from "react";
import { ensureWorker } from "@/components/goals/push";

/** Регистрирует офлайн-воркер (/sw.js). Только в production: в разработке кэш мешал бы hot reload. */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    void ensureWorker().catch(() => {
      /* нет HTTPS или режим без воркеров — приложение работает как обычно */
    });
  }, []);
  return null;
}

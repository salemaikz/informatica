"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { setStudyPath, startActiveClock } from "@/lib/active-clock";

/**
 * Невидимый агент активного времени (#68): запускает часы вкладки и пишет секунды дня в стор каждые 15 с
 * и при уходе со страницы. Единственный писатель DayStat.seconds. Смонтирован в Providers.
 */
export function ActiveTimeAgent() {
  const pathname = usePathname();
  useEffect(() => startActiveClock((sec, kind) => useApp.getState().addActiveSeconds(sec, kind === "game")), []);
  useEffect(() => setStudyPath(pathname), [pathname]);
  return null;
}

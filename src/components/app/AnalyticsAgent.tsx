"use client";

import { useEffect } from "react";
import { analyticsEnabledOnServer, startAnalytics, trackActiveToday } from "@/lib/analytics-client";
import { useApp } from "@/lib/store";

/**
 * Невидимый агент статистики (решение #69): ставит приёмник для track() и снимает его.
 * Работает, только если сбор включён на сервере (NEXT_PUBLIC_ANALYTICS=1) и ученик не выключил его в профиле.
 * Раз в календарный день шлёт событие active (удержание D0/D1/D7/D30 по дню первого запуска): при загрузке и каждый раз, когда
 * вкладку или PWA снова показали (телефон чаще возобновляет приложение из фона, чем перезагружает его).
 * Смонтирован в Providers ПЕРЕД {children}: эффекты экрана (paywall_view, lesson_start) должны застать приёмник.
 */
export function AnalyticsAgent() {
  const allowed = useApp((s) => s.profile.analytics !== false);
  const createdAt = useApp((s) => s.profile.createdAt);

  // Приёмник: выключили в профиле — снимается, накопленное не отправляется.
  useEffect(() => {
    if (!analyticsEnabledOnServer() || !allowed) return;
    return startAnalytics();
  }, [allowed]);

  // Удержание: объявляется один раз в календарный день (отметка в localStorage). Не только при загрузке: открытую вкладку
  // или PWA ученик возобновляет на следующий день без перезагрузки — проверяем при возврате на экран; повторы за день отсекает отметка.
  useEffect(() => {
    if (!analyticsEnabledOnServer() || !allowed) return;
    trackActiveToday(createdAt);
    const onVisible = () => {
      if (document.visibilityState === "visible") trackActiveToday(createdAt);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [allowed, createdAt]);

  return null;
}

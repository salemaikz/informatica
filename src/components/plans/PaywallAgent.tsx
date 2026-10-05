"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { shouldShowPaywall } from "@/lib/economy";
import { tourBlocking } from "@/lib/tour";
import { useApp } from "@/lib/store";
import { useNow, usePlanTier } from "@/components/economy/useEconomy";

/**
 * Невидимый «агент»: на главной карте (/learn) бесплатному ученику, прошедшему онбординг, раз в несколько дней
 * открывает окно тарифов. Не чаще одного раза за монтирование и не в запуске, где шёл проводник первого входа (#104).
 */
export function PaywallAgent() {
  const pathname = usePathname();
  const router = useRouter();
  const onboarded = useApp((s) => s.onboarded);
  const paywall = useApp((s) => s.paywall);
  // Пока идёт проводник первого входа (#104), тарифы не показываем.
  const touring = useApp((s) => tourBlocking(s.tips));
  const notePaywallShown = useApp((s) => s.notePaywallShown);
  const tier = usePlanTier();
  const now = useNow();
  const fired = useRef(false);
  // Проводник шёл в этом запуске приложения: тарифы в этот же запуск не открываем, чтобы окно напоминаний после «Готово» не потерялось.
  const sawTour = useRef(false);

  useEffect(() => {
    if (touring) sawTour.current = true;
    if (fired.current || sawTour.current || pathname !== "/learn" || !onboarded || touring || now <= 0) return;
    if (!shouldShowPaywall(tier, paywall, now)) return;
    fired.current = true;
    notePaywallShown();
    router.push("/plans?from=auto");
  }, [pathname, onboarded, touring, tier, paywall, now, notePaywallShown, router]);

  return null;
}

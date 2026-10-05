"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { shouldShowPaywall } from "@/lib/economy";
import { tourBlocking } from "@/lib/tour";
import { useApp } from "@/lib/store";
import { useNow, usePlanTier } from "@/components/economy/useEconomy";

/**
 * Невидимый «агент»: на главной карте (/learn) бесплатному ученику, прошедшему онбординг, раз в несколько дней
 * открывает окно тарифов. Не чаще одного раза за монтирование.
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

  useEffect(() => {
    if (fired.current || pathname !== "/learn" || !onboarded || touring || now <= 0) return;
    if (!shouldShowPaywall(tier, paywall, now)) return;
    fired.current = true;
    notePaywallShown();
    router.push("/plans?from=auto");
  }, [pathname, onboarded, touring, tier, paywall, now, notePaywallShown, router]);

  return null;
}

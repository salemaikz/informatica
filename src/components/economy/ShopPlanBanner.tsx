"use client";

import { ChevronRight, Crown } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { canStartTrial, TRIAL_DAYS } from "@/lib/economy";
import { daysText } from "@/lib/goals";
import { useT } from "@/i18n/useT";
import { Pill } from "@/components/ui/Pill";
import { useNow, usePlan } from "./useEconomy";

/** Баннер тарифа в магазине: бесплатным — приглашение в «Безлимит», платным — статус тарифа. Ведёт на /plans. */
export function ShopPlanBanner() {
  const { t, lang } = useT();
  const { tier, daysLeft, trial } = usePlan();
  const plan = useApp((s) => s.plan);
  const now = useNow();

  if (tier === "free") {
    const canTrial = canStartTrial(plan, now);
    return (
      <Link
        href="/plans?from=shop"
        className="group relative flex items-center gap-3.5 overflow-hidden rounded-3xl border-2 border-gold bg-gradient-to-br from-gold-soft to-surface p-4 shadow-[0_4px_0_var(--gold)] transition-[translate,box-shadow] active:translate-y-1 active:shadow-none"
      >
        <span className="grid h-13 w-13 shrink-0 place-items-center rounded-2xl bg-gold text-warning-strong shadow-sm">
          <Crown size={28} fill="currentColor" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold leading-tight">{t("shop.plan.freeTitle")}</span>
          <span className="mt-0.5 block text-sm font-semibold text-muted">{t("shop.plan.freeText")}</span>
          {canTrial && (
            <Pill tone="gold" className="mt-2 border border-gold/60 py-1 text-[13px]">
              {t("shop.plan.trial", { days: daysText(TRIAL_DAYS, lang) })}
            </Pill>
          )}
        </span>
        <ChevronRight size={22} className="shrink-0 text-warning-strong transition-transform group-hover:translate-x-0.5" />
      </Link>
    );
  }

  const name = `${t(tier === "lite" ? "shop.plan.lite" : "shop.plan.unlimited")}${trial ? ` (${t("shop.plan.trialMark")})` : ""}`;
  return (
    <Link
      href="/plans?from=shop"
      className="group flex items-center gap-3.5 rounded-3xl border-2 border-gold/60 bg-gold-soft p-4 transition-[translate] active:translate-y-0.5"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold text-warning-strong">
        <Crown size={26} fill="currentColor" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-extrabold leading-tight">{t("shop.plan.current", { plan: name })}</span>
        {daysLeft > 0 && <span className="block text-sm font-bold text-warning-strong">{t("shop.plan.left", { days: daysText(daysLeft, lang) })}</span>}
      </span>
      <span className="shrink-0 text-sm font-extrabold text-primary">{t("shop.plan.more")}</span>
      <ChevronRight size={20} className="shrink-0 text-primary" />
    </Link>
  );
}

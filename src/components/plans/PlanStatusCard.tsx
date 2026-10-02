"use client";

import { Crown, Heart } from "lucide-react";
import { canStartTrial, PLAN_FEATURES, TRIAL_DAYS } from "@/lib/economy";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/cn";
import { daysText } from "@/lib/goals";
import { useT } from "@/i18n/useT";
import { ButtonLink } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { useNow, usePlan } from "@/components/economy/useEconomy";

/** Карточка тарифа для профиля: текущий тариф, сколько осталось, кнопка «Тарифы» → /plans?from=profile. */
export function PlanStatusCard({ className }: { className?: string }) {
  const { t, lang } = useT();
  const { tier, daysLeft, trial } = usePlan();
  const plan = useApp((s) => s.plan);
  const now = useNow();
  const paid = tier !== "free";
  const offerTrial = canStartTrial(plan, now);

  const title = paid
    ? t("plans.status.now", { plan: `${t(tier === "lite" ? "plans.tier.lite" : "plans.tier.unlimited")}${trial ? ` (${t("plans.tier.trial")})` : ""}` })
    : t("plans.profile.free");

  return (
    <section
      aria-label={t("plans.profile.cta")}
      className={cn(
        "flex flex-col gap-3.5 rounded-3xl border-2 p-4",
        paid ? "border-gold/60 bg-gradient-to-br from-gold-soft to-surface" : "border-border bg-surface",
        className,
      )}
    >
      <div className="flex items-center gap-3.5">
        <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl", paid ? "border border-gold bg-gold-soft text-warning-strong" : "bg-heart-soft text-heart")}>
          {paid ? <Crown size={26} fill="currentColor" /> : <Heart size={24} fill="currentColor" />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-extrabold leading-tight">{title}</h3>
          {paid ? (
            daysLeft > 0 && <p className="text-sm font-bold text-warning-strong">{t("plans.status.left", { days: daysText(daysLeft, lang) })}</p>
          ) : (
            <p className="text-sm font-semibold text-muted">{t("plans.profile.freeText", { hearts: PLAN_FEATURES.free.maxHearts, ai: PLAN_FEATURES.free.aiFree })}</p>
          )}
          {!paid && offerTrial && (
            <Pill tone="gold" className="mt-1.5 border border-gold/60">
              {t("plans.card.trialPill", { days: daysText(TRIAL_DAYS, lang) })}
            </Pill>
          )}
        </div>
      </div>
      <ButtonLink href="/plans?from=profile" variant={paid ? "secondary" : "primary"} block>
        {t("plans.profile.cta")}
      </ButtonLink>
    </section>
  );
}

"use client";

import { Check, Crown, Star } from "lucide-react";
import { m } from "motion/react";
import { PLAN_FEATURES, PRICES, formatTenge, perMonthOfYear, yearSaving, type BillingPeriod, type PaidTier } from "@/lib/economy";
import { cn } from "@/lib/cn";
import { daysText } from "@/lib/goals";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { springSoft } from "@/components/motion/presets";
import { formatHours, formatNumber } from "./plans-helpers";

/** Главные пункты тарифа (значения — из PLAN_FEATURES). Используются в карточке и на экране «пробный период включён». */
export function usePlanPerks(tier: PaidTier): string[] {
  const { t, lang } = useT();
  const f = PLAN_FEATURES[tier];
  const chips = t("plans.perk.chips", { mult: formatNumber(f.chipMultiplier) });
  if (tier === "unlimited") return [t("plans.perk.unl.hearts"), t("plans.perk.unl.ai"), chips];
  return [t("plans.perk.lite.hearts", { n: f.maxHearts, time: formatHours(f.regenMs, lang) }), t("plans.perk.lite.ai", { n: f.aiFree }), chips];
}

export interface PlanCardProps {
  tier: PaidTier;
  period: BillingPeriod;
  /** Этот тариф у ученика уже действует (не пробный) — кнопка «Продлить». */
  isCurrent?: boolean;
  /** Показать пометку «7 дней бесплатно» (пробный ещё не использован). */
  trialDays?: number;
  /** Порядок появления (лесенка). */
  index?: number;
  className?: string;
  onChoose: () => void;
}

/** Карточка тарифа. «Безлимит» — золотая: рамка, градиент, бейдж «Популярный», лёгкий блик. */
export function PlanCard({ tier, period, isCurrent, trialDays, index = 0, className, onChoose }: PlanCardProps) {
  const { t, lang } = useT();
  const featured = tier === "unlimited";
  const perks = usePlanPerks(tier);
  const price = PRICES[tier][period];
  const saving = yearSaving(tier);
  const name = t(featured ? "plans.tier.unlimited" : "plans.tier.lite");

  return (
    <m.article
      className={cn("relative flex flex-col pt-3", className)}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springSoft, delay: 0.08 + index * 0.08 }}
      aria-label={name}
    >
      {featured && (
        <span className="absolute left-1/2 top-0 z-10 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border-2 border-gold bg-gold-soft px-3 py-0.5 text-xs font-extrabold uppercase tracking-wide text-warning-strong shadow-[0_2px_0_var(--warning-strong)]">
          <Crown size={13} fill="currentColor" /> {t("plans.badge.popular")}
        </span>
      )}

      <div
        className={cn(
          "relative flex flex-1 flex-col gap-4 overflow-hidden rounded-3xl border-2 p-5",
          featured
            ? "border-gold bg-gradient-to-br from-gold-soft via-surface to-surface pt-7 shadow-[0_5px_0_var(--gold)]"
            : "border-border bg-surface shadow-[0_4px_0_var(--border)]",
        )}
      >
        {featured && (
          // Блик пробегает по карточке раз в несколько секунд (при «меньше анимаций» motion не двигает).
          <m.span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-gold/25 to-transparent"
            initial={{ x: "-100%" }}
            animate={{ x: "480%" }}
            transition={{ duration: 2.2, ease: "easeInOut", repeat: Infinity, repeatDelay: 4.5, delay: 1.2 }}
          />
        )}

        {/* Шапка: значок, название, пометки */}
        <div className="relative flex items-center gap-3">
          <span
            className={cn(
              "grid h-12 w-12 shrink-0 place-items-center rounded-2xl",
              featured ? "border border-gold bg-gold-soft text-warning-strong shadow-sm" : "bg-primary-soft text-primary",
            )}
          >
            {featured ? <Crown size={26} fill="currentColor" /> : <Star size={24} fill="currentColor" />}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-2xl font-extrabold leading-tight">{name}</h3>
            <p className="text-sm font-bold text-muted">{t(featured ? "plans.card.unlimitedTag" : "plans.card.liteTag")}</p>
          </div>
          {isCurrent && <Pill tone="gold">{t("plans.card.current")}</Pill>}
        </div>

        {/* Цена: при смене периода число «въезжает» заново */}
        <div className="relative min-h-[5.75rem]">
          <m.div key={period} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={springSoft}>
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span className={cn("whitespace-nowrap font-extrabold leading-none tracking-tight", featured ? "text-[2.5rem]" : "text-4xl")}>{formatTenge(price)}</span>
              <span className="text-lg font-extrabold text-muted">/ {t(period === "year" ? "plans.per.year" : "plans.per.month")}</span>
            </div>
            {period === "year" ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <span className="whitespace-nowrap text-[15px] font-extrabold">{t("plans.card.perMonth", { price: formatTenge(perMonthOfYear(tier)) })}</span>
                <span className="whitespace-nowrap font-bold text-muted line-through decoration-2">{formatTenge(PRICES[tier].month)}</span>
                <Pill tone="gold" className="border border-gold/50">
                  {t("plans.card.save", { amount: formatTenge(saving.amount) })}
                </Pill>
              </div>
            ) : (
              <p className="mt-2 text-[15px] font-bold text-muted">{t("plans.card.yearHint", { n: saving.percent })}</p>
            )}
          </m.div>
        </div>

        <ul className="relative flex flex-col gap-2.5">
          {perks.map((p) => (
            <li key={p} className="flex items-start gap-2.5 font-bold leading-snug">
              <span
                className={cn(
                  "mt-px grid h-5.5 w-5.5 shrink-0 place-items-center rounded-full",
                  featured ? "border border-gold bg-gold-soft text-warning-strong" : "bg-primary-soft text-primary",
                )}
              >
                <Check size={14} strokeWidth={3.5} />
              </span>
              {p}
            </li>
          ))}
        </ul>

        <div className="relative mt-auto flex flex-col gap-2 pt-1">
          {trialDays !== undefined && featured && (
            <p className="text-center text-sm font-extrabold text-warning-strong">{t("plans.card.trialPill", { days: daysText(trialDays, lang) })}</p>
          )}
          <Button variant={featured ? "primary" : "secondary"} size="lg" block onClick={onChoose}>
            {t(isCurrent ? "plans.card.renew" : "plans.card.choose")}
          </Button>
        </div>
      </div>
    </m.article>
  );
}

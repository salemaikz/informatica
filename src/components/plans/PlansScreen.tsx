"use client";

import { Crown, Sparkles, X } from "lucide-react";
import { m } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { PRICES, TRIAL_DAYS, canStartTrial, formatTenge, type BillingPeriod, type PaidTier } from "@/lib/economy";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/cn";
import { daysText } from "@/lib/goals";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { springSoft } from "@/components/motion/presets";
import { useNow, usePlan } from "@/components/economy/useEconomy";
import { AiLimitNote } from "./AiLimitNote";
import { ComingSoonSheet } from "./ComingSoonSheet";
import { BillingToggle } from "./BillingToggle";
import { CompareTable } from "./CompareTable";
import { PlanCard } from "./PlanCard";
import { PlansHero } from "./PlansHero";
import { TrialCelebration } from "./TrialCelebration";
import { closeAction, parseFrom, planWhat, subtitleKey, yearDiscountPercent } from "./plans-helpers";

/**
 * Куда идти после окна тарифов, если вызвавший его экран просит свой адрес (`?next=/lesson/…`): только путь внутри
 * приложения — начинается с «/», но не с «//» и без «\» (иначе это чужой адрес). Недоверенный параметр: иначе — null (на карту).
 */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 300) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  return raw;
}

/** Полноэкранное окно тарифов (/plans?from=…): без оболочки приложения, как онбординг. */
export function PlansScreen() {
  const { t, lang } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const from = parseFrom(params.get("from"));
  const next = safeNext(params.get("next"));
  const plan = useApp((s) => s.plan);
  const startTrial = useApp((s) => s.startTrial);
  const { tier, daysLeft, trial } = usePlan();
  const now = useNow();
  const trialAvailable = canStartTrial(plan, now);

  const [period, setPeriod] = useState<BillingPeriod>("year");
  const [sheet, setSheet] = useState<{ open: boolean; what?: string }>({ open: false });
  const [won, setWon] = useState(false);

  // Статистика (#69): показ окна — один раз за открытие (защита от двойного вызова эффекта), все три пути приходят сюда.
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    track({ e: "paywall_view", from: from ?? "other" });
  }, [from]);

  // Окно показано вручную — сбрасываем таймер автопоказа (онбординг и auto отмечаются сами).
  useEffect(() => {
    if (from !== "onboarding" && from !== "auto") useApp.getState().notePaywallShown();
  }, [from]);

  const close = () => {
    if (closeAction(from, window.history.length) === "back") router.back();
    else router.replace(next ?? "/learn");
  };

  const choose = (paid: PaidTier) => {
    track({ e: "plan_click", tier: paid, period });
    const name = t(paid === "unlimited" ? "plans.tier.unlimited" : "plans.tier.lite");
    setSheet({ open: true, what: planWhat(name, formatTenge(PRICES[paid][period]), t(period === "year" ? "plans.per.year" : "plans.per.month")) });
  };

  const onTrial = () => {
    if (startTrial()) {
      track({ e: "trial_start", from: from ?? "other" });
      setWon(true);
    }
  };

  const tierName = tier === "free" ? "" : `${t(tier === "lite" ? "plans.tier.lite" : "plans.tier.unlimited")}${trial ? ` (${t("plans.tier.trial")})` : ""}`;
  const currentPaid = tier !== "free" && !trial ? tier : undefined;

  return (
    <div className="relative isolate min-h-dvh overflow-x-clip">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b from-gold-soft to-transparent" />

      <div className={cn("relative mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-3 sm:gap-6 md:max-w-3xl", trialAvailable ? "pb-40" : "pb-12")}>
        {/* Крестик поверх шапки (не отдельной строкой): на 360×640 цена тарифа должна оказаться над кнопкой пробного периода. */}
        <button
          type="button"
          onClick={close}
          aria-label={t("common.close")}
          className="absolute right-2 top-2 z-10 grid h-11 w-11 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <X size={26} strokeWidth={2.6} />
        </button>

        <PlansHero subtitle={subtitleKey(from)} />

        {tier !== "free" && (
          <m.div
            className="flex items-center gap-3.5 rounded-3xl border-2 border-gold/60 bg-gold-soft p-3.5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springSoft}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-gold bg-gold-soft text-warning-strong">
              <Crown size={24} fill="currentColor" />
            </span>
            <span className="min-w-0">
              <span className="block font-extrabold leading-tight">{t("plans.status.now", { plan: tierName })}</span>
              {daysLeft > 0 && <span className="block text-sm font-bold text-warning-strong">{t("plans.status.left", { days: daysText(daysLeft, lang) })}</span>}
            </span>
          </m.div>
        )}

        <BillingToggle value={period} percent={yearDiscountPercent()} onChange={setPeriod} />

        <div className="grid gap-5 md:grid-cols-2 md:items-stretch">
          <PlanCard
            tier="unlimited"
            period={period}
            index={0}
            isCurrent={currentPaid === "unlimited"}
            trialDays={trialAvailable ? TRIAL_DAYS : undefined}
            className="md:order-2"
            onChoose={() => choose("unlimited")}
          />
          <PlanCard tier="lite" period={period} index={1} isCurrent={currentPaid === "lite"} className="md:order-1" onChoose={() => choose("lite")} />
        </div>

        <CompareTable />

        <footer className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-semibold text-muted">{t("plans.foot.pay")}</p>
          <Button variant="ghost" size="lg" block className="max-w-sm" onClick={close}>
            {t("plans.foot.free")}
          </Button>
          <AiLimitNote />
        </footer>
      </div>

      {trialAvailable && !won && (
        <m.div
          className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-bg via-bg/95 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8"
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...springSoft, delay: 0.5 }}
        >
          <div className="mx-auto max-w-lg">
            <Button variant="primary" size="lg" block className="h-auto min-h-14 py-2" icon={<Sparkles size={22} fill="currentColor" />} onClick={onTrial}>
              <span className="flex min-w-0 flex-col items-start text-left leading-tight">
                <span className="max-w-full truncate text-base">{t("plans.trial.cta")}</span>
                <span className="max-w-full truncate text-xs font-bold opacity-90">{t("plans.trial.sub", { days: daysText(TRIAL_DAYS, lang) })}</span>
              </span>
            </Button>
          </div>
        </m.div>
      )}

      <ComingSoonSheet open={sheet.open} what={sheet.what} from={from ?? "other"} onClose={() => setSheet((s) => ({ ...s, open: false }))} />
      {won && <TrialCelebration onStart={() => router.replace(next ?? "/learn")} />}
    </div>
  );
}

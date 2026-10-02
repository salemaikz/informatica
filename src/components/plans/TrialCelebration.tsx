"use client";

import { Check, Crown } from "lucide-react";
import { m } from "motion/react";
import { useEffect } from "react";
import { TRIAL_DAYS } from "@/lib/economy";
import { daysText } from "@/lib/goals";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { Mascot } from "@/components/mascot/Mascot";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { springBouncy, springSoft } from "@/components/motion/presets";
import { usePlanPerks } from "./PlanCard";

/** Праздничный экран после запуска пробного периода: конфетти (если не «меньше анимаций»), что теперь включено, «Начать». */
export function TrialCelebration({ onStart }: { onStart: () => void }) {
  const { t, lang } = useT();
  const reduce = useReduceMotion();
  const perks = usePlanPerks("unlimited");

  useEffect(() => {
    feedback("levelUp");
    if (reduce) return;
    const colors = ["#f0b400", "#f5c22e", "#1a91d6", "#7656f5", "#f2416b"];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    void import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled) return;
      confetti({ particleCount: 110, spread: 80, origin: { y: 0.3 }, colors, disableForReducedMotion: true });
      timer = setTimeout(() => {
        confetti({ particleCount: 50, angle: 60, spread: 60, origin: { x: 0, y: 0.55 }, colors, disableForReducedMotion: true });
        confetti({ particleCount: 50, angle: 120, spread: 60, origin: { x: 1, y: 0.55 }, colors, disableForReducedMotion: true });
      }, 380);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reduce]);

  return (
    <m.div
      className="fixed inset-0 z-[60] overflow-y-auto bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label={t("plans.win.title")}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-gold-soft to-transparent" />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-5 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-10 text-center">
        <div className="relative grid place-items-center">
          <span className="absolute h-48 w-48 rounded-full bg-gold/35 blur-3xl" />
          <m.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springBouncy}>
            <Mascot mood="celebrate" size={132} />
          </m.div>
          <m.span
            className="absolute -right-3 -top-1 grid h-12 w-12 place-items-center rounded-2xl border-2 border-gold bg-gold-soft text-warning-strong shadow-[0_3px_0_var(--warning-strong)]"
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 12 }}
            transition={{ ...springBouncy, delay: 0.25 }}
          >
            <Crown size={26} fill="currentColor" />
          </m.span>
        </div>

        <m.div className="flex flex-col gap-2" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springSoft, delay: 0.2 }}>
          <h1 className="text-balance text-3xl font-extrabold leading-tight">{t("plans.win.title")}</h1>
          <p className="text-balance font-semibold text-muted">{t("plans.win.text", { days: daysText(TRIAL_DAYS, lang) })}</p>
        </m.div>

        <ul className="flex w-full flex-col gap-2.5 rounded-3xl border-2 border-gold/60 bg-gold-soft p-4 text-left">
          {perks.map((p, i) => (
            <m.li
              key={p}
              className="flex items-start gap-2.5 font-bold leading-snug"
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...springSoft, delay: 0.45 + i * 0.12 }}
            >
              <span className="mt-px grid h-5.5 w-5.5 shrink-0 place-items-center rounded-full border border-gold bg-gold-soft text-warning-strong">
                <Check size={14} strokeWidth={3.5} />
              </span>
              {p}
            </m.li>
          ))}
        </ul>

        <m.div className="w-full" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springSoft, delay: 0.9 }}>
          <Button variant="primary" size="lg" block onClick={onStart}>
            {t("plans.win.cta")}
          </Button>
        </m.div>
      </div>
    </m.div>
  );
}

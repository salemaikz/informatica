"use client";

import { Flame } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useState } from "react";
import { feedback } from "@/lib/feedback";
import { useStreak } from "@/lib/hooks";
import { useT } from "@/i18n/useT";
import { useReduceMotion } from "./useReduceMotion";
import { clearStreakStart, streakWasUnlit } from "./streak-snapshot";
import { springBouncy } from "./presets";

/**
 * Итоги первого за день занятия: «Огонь загорелся — серия N дней».
 * Показывается один раз: если на старте занятия день не был засчитан, а теперь засчитан (снимок берёт само занятие).
 */
export function StreakIgnite() {
  const { t } = useT();
  const reduce = useReduceMotion();
  const { current, activeToday } = useStreak();
  const [wasUnlit] = useState(() => streakWasUnlit());
  const show = wasUnlit && activeToday;
  useEffect(() => {
    if (!show) return;
    clearStreakStart();
    // Звук «огонь загорелся» — в такт со вспышкой пламени.
    const id = setTimeout(() => feedback("streak"), 550);
    return () => clearTimeout(id);
  }, [show]);
  if (!show) return null;
  return (
    <m.div
      className="flex items-center justify-center gap-3 rounded-2xl border-2 border-streak bg-streak-soft px-4 py-3"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...springBouncy, delay: 0.4 }}
    >
      <m.span
        className="relative flex origin-bottom items-center justify-center text-streak"
        initial={{ scale: 0.4, rotate: -20 }}
        animate={{ scale: [0.4, 1.4, 1], rotate: [-20, 12, 0] }}
        transition={{ duration: 0.7, delay: 0.55, ease: "easeOut" }}
      >
        <Flame size={34} fill="currentColor" aria-hidden />
        {!reduce && (
          <m.span
            aria-hidden
            className="pointer-events-none absolute h-10 w-10 rounded-full border-2 border-streak"
            initial={{ opacity: 0.9, scale: 0.6 }}
            animate={{ opacity: 0, scale: 2.2 }}
            transition={{ duration: 0.8, delay: 0.75, ease: "easeOut" }}
          />
        )}
      </m.span>
      <div>
        <p className="font-extrabold text-streak">{t("xp.streakLit")}</p>
        <p className="text-sm font-bold text-text">{t("xp.streakDays", { n: current })}</p>
      </div>
    </m.div>
  );
}

"use client";

import { Flame } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useState } from "react";
import { useStreak } from "@/lib/hooks";
import { useT } from "@/i18n/useT";
import { markStreakLitSeen, streakJustLit } from "./AnimatedChips";
import { springBouncy } from "./presets";

/**
 * Итоги первого за день занятия: «Огонь загорелся — серия N дней».
 * Показывается один раз: если перед занятием ученик видел погашенный огонь, а теперь день засчитан.
 */
export function StreakIgnite() {
  const { t } = useT();
  const { current, activeToday } = useStreak();
  const [show] = useState(() => streakJustLit());
  useEffect(() => {
    if (show) markStreakLitSeen();
  }, [show]);
  if (!show || !activeToday) return null;
  return (
    <m.div
      className="flex items-center justify-center gap-3 rounded-2xl border-2 border-streak bg-streak-soft px-4 py-3"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...springBouncy, delay: 0.4 }}
    >
      <m.span
        className="flex origin-bottom text-streak"
        initial={{ scale: 0.4, rotate: -20 }}
        animate={{ scale: [0.4, 1.4, 1], rotate: [-20, 12, 0] }}
        transition={{ duration: 0.7, delay: 0.55, ease: "easeOut" }}
      >
        <Flame size={34} fill="currentColor" aria-hidden />
      </m.span>
      <div>
        <p className="font-extrabold text-streak">{t("xp.streakLit")}</p>
        <p className="text-sm font-bold text-text">{t("xp.streakDays", { n: current })}</p>
      </div>
    </m.div>
  );
}

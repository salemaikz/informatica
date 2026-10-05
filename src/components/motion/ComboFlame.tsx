"use client";

import { Flame, TrendingUp } from "lucide-react";
import { m } from "motion/react";
import { cn } from "@/lib/cn";
import { useStreak } from "@/lib/hooks";
import { useT } from "@/i18n/useT";
import { springBouncy } from "./presets";

/**
 * Серия дней в шапке урока: серая до засчитанного дня, оранжевая после (как в шапке приложения).
 * Огонь — только про серию дней; комбо показывает `ComboBadge` на панели ответа.
 */
export function StreakFlame() {
  const { current, activeToday } = useStreak();
  const { t } = useT();
  return (
    <div
      className={cn("flex min-w-12 items-center justify-end gap-1 font-extrabold transition-colors", activeToday ? "text-streak" : "text-muted")}
      title={t("stats.streak")}
    >
      <Flame size={20} fill={activeToday ? "currentColor" : "none"} aria-hidden />
      {current}
    </div>
  );
}

/** «Комбо ×3» на панели ответа: от 3 верных подряд; цвет streak, иконка не пламя. */
export function ComboBadge({ combo }: { combo: number }) {
  const { t } = useT();
  if (combo < 3) return null;
  return (
    <m.span
      key={combo}
      title={t("xp.comboHint")}
      className="inline-flex items-center gap-1 rounded-full border-2 border-streak bg-streak-soft px-2.5 py-0.5 text-sm font-extrabold text-streak"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...springBouncy, delay: 0.2 }}
    >
      <TrendingUp size={14} aria-hidden /> {t("xp.combo", { n: combo })}
    </m.span>
  );
}

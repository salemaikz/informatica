"use client";

import { Flame, TrendingUp } from "lucide-react";
import { m } from "motion/react";
import { cn } from "@/lib/cn";
import { useStreak } from "@/lib/hooks";
import { useT } from "@/i18n/useT";
import { springBouncy } from "./presets";

/** Подпись серии: «Серия дней», а если сегодня занятий ещё не было — с пояснением (без рода). */
export function streakTitle(t: (k: "stats.streak" | "streak.notToday") => string, current: number, activeToday: boolean): string {
  return current > 0 && !activeToday ? `${t("stats.streak")}. ${t("streak.notToday")}` : t("stats.streak");
}

/**
 * Бейдж «сегодня занятий ещё не было» на иконке огня (родитель — `relative`):
 * точка в цвете серии с вырезом цвета фона, как у значка уведомлений. Заменил точку после числа («3•» читалась как лишний знак).
 * Родителю при показе нужен отступ справа (`mr-1`), чтобы бейдж не наезжал на число.
 * Текст для экранного диктора — `StreakReminderText` после числа.
 */
export function StreakReminderBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return <span aria-hidden data-testid="streak-reminder" className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-streak ring-2 ring-bg" />;
}

/** «Сегодня занятий ещё не было» для экранного диктора — ставится после числа серии. */
export function StreakReminderText({ show }: { show: boolean }) {
  const { t } = useT();
  return show ? <span className="sr-only">. {t("streak.notToday")}</span> : null;
}

/**
 * Серия дней в шапке урока: оранжевая, пока серия идёт (бейдж на огне — день ещё не засчитан).
 * При нуле не показывается: шапка урока узкая, место отдаём полоске прогресса.
 * Огонь — только про серию дней; комбо показывает `ComboBadge` на панели ответа.
 */
export function StreakFlame() {
  const { current, activeToday } = useStreak();
  const { t } = useT();
  if (current <= 0) return null;
  return (
    <div className="flex h-10 items-center gap-1 px-1 font-extrabold text-streak" title={streakTitle(t, current, activeToday)}>
      <span className={cn("relative flex", !activeToday && "mr-1")}>
        <Flame size={20} fill="currentColor" aria-hidden />
        <StreakReminderBadge show={!activeToday} />
      </span>
      <span className="tabular-nums">{current}</span>
      <StreakReminderText show={!activeToday} />
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

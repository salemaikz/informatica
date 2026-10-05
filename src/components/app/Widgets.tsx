"use client";

import clsx from "clsx";
import { Flame, Target } from "lucide-react";
import dynamic from "next/dynamic";
import { useDaily, useLevel, useStreak } from "@/lib/hooks";
import { levelTitle } from "@/lib/gamification";
import { useT } from "@/i18n/useT";
import { XpIcon } from "@/components/economy/XpIcon";
import { Card } from "@/components/ui/Card";
import { ProgressBar, Ring } from "@/components/ui/ProgressBar";

export function StreakChip() {
  const { current, activeToday } = useStreak();
  const { t } = useT();
  return (
    <span title={t("stats.streak")} className={clsx("flex items-center gap-1 font-extrabold", activeToday ? "text-streak" : "text-muted")}>
      <Flame size={20} fill={activeToday ? "currentColor" : "none"} /> {current}
    </span>
  );
}

export function XpChip() {
  const { xp } = useLevel();
  return (
    <span title="XP" className="flex items-center gap-1 font-extrabold text-warning-strong">
      <XpIcon size={18} /> {xp}
    </span>
  );
}

export function LevelChip() {
  const { level } = useLevel();
  const { t } = useT();
  return (
    <span title={t("stats.level")} className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-primary px-1.5 text-sm font-extrabold text-white">
      {level}
    </span>
  );
}

export function DailyGoalCard({ compact }: { compact?: boolean }) {
  const { t } = useT();
  const { xp, goal, progress, done } = useDaily();
  return (
    <Card className={clsx("flex items-center gap-4", compact && "p-3 sm:p-4")}>
      <Ring value={progress} color={done ? "var(--success)" : "var(--gold)"}>
        <Target size={20} className={done ? "text-success" : "text-gold"} />
      </Ring>
      <div className="min-w-0 flex-1">
        <p className="font-extrabold">{done ? t("learn.dailyDone") : t("learn.dailyGoal")}</p>
        <p className="text-sm font-bold text-muted">
          {xp} / {goal} XP
        </p>
      </div>
    </Card>
  );
}

export function LevelCard() {
  const { t, l } = useT();
  const { level, current, needed, progress } = useLevel();
  const { current: streak, best } = useStreak();
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-xl font-extrabold text-white shadow-[0_4px_0_var(--primary-strong)]">
          {level}
        </span>
        <div className="flex-1">
          <p className="font-extrabold">{l(levelTitle(level))}</p>
          <p className="text-sm font-bold text-muted">
            {current} / {needed} XP
          </p>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-1 text-lg font-extrabold text-streak">
            <Flame size={18} fill="currentColor" /> {streak}
          </p>
          <p className="text-xs font-bold text-muted">{t("stats.best", { n: best })}</p>
        </div>
      </div>
      <ProgressBar value={progress} color="var(--primary)" height={10} />
    </Card>
  );
}

/**
 * «Слабые места» в правой колонке: адресные ссылки на тренировку по навыкам (lib/progress → weakSpots).
 * Подгружается лениво и только на клиенте: логика курса и банков заданий не попадает в общий код всех страниц оболочки.
 */
const WeakTopicsRail = dynamic(() => import("@/components/progress/WeakTopicsRail").then((m) => m.WeakTopicsRail), { ssr: false });

export function WeakTopicsCard() {
  return <WeakTopicsRail />;
}

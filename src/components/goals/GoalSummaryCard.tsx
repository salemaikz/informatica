"use client";

import { Target } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { daysText } from "@/lib/goals";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { Pill } from "@/components/ui/Pill";
import { Ring } from "@/components/ui/ProgressBar";
import { useGoalData } from "./useGoalData";

const STATUS_TONE = { none: "muted", below: "warning", on: "success", above: "success" } as const;

/**
 * Компактная карточка цели для главной: «До ЕНТ 214 дней · прогноз ~12/50 · цель 35» и кольцо недели.
 * Без даты ЕНТ — «Поставь цель» и переход в профиль.
 */
export function GoalSummaryCard({ className }: { className?: string }) {
  const { t, lang } = useT();
  const { daysLeft, forecast, goal, week, targetScore } = useGoalData();
  const hasDate = daysLeft !== null;

  const title = !hasDate
    ? t("goals.card.set")
    : daysLeft > 0
      ? t("goals.card.until", { days: daysText(daysLeft, lang) })
      : daysLeft === 0
        ? t("goals.card.today")
        : t("goals.card.past");
  const sub = !hasDate
    ? t("goals.card.setHint")
    : forecast.basis === "none"
      ? t("goals.card.noForecast", { target: targetScore })
      : t("goals.card.forecast", { score: forecast.score, target: targetScore });

  return (
    <Link
      href={hasDate ? "/stats" : "/profile#goals"}
      className={cn(
        "flex items-center gap-3 rounded-3xl border-2 border-border bg-surface p-4 transition-colors hover:bg-surface-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className,
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Target size={24} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-extrabold leading-tight">{title}</span>
        <span className="mt-0.5 block text-sm font-bold text-muted">{sub}</span>
        {hasDate && forecast.basis !== "none" && (
          <Pill tone={STATUS_TONE[goal.status]} className="mt-1.5">
            {t(`goals.status.${goal.status}` as DictKey)}
          </Pill>
        )}
      </span>
      <span className="flex w-[72px] shrink-0 flex-col items-center gap-1">
        <Ring value={week.ratio} size={56} stroke={7} color={week.reached ? "var(--success)" : "var(--primary)"}>
          <span className="text-sm font-extrabold leading-none">{t("goals.card.weekRing", { done: week.done, goal: week.goal })}</span>
        </Ring>
        <span className="text-center text-[11px] font-bold leading-tight text-muted">{t("goals.card.weekLabel")}</span>
      </span>
    </Link>
  );
}

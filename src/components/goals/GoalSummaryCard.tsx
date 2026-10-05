"use client";

import { ChevronRight, Target } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { daysText, hasGoal } from "@/lib/goals";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { Pill } from "@/components/ui/Pill";
import { useGoalData } from "./useGoalData";

const STATUS_TONE = { none: "muted", below: "warning", on: "success", above: "success" } as const;

/**
 * Компактная карточка цели для главной: «До ЕНТ 214 дней · прогноз ~12/50 · цель 35» — только дата, балл и прогноз.
 * Неделя и «сегодня» — в карточке плана (components/plan/PlanCard). Предварительный прогноз по диагностике подписан «Предварительно»;
 * цель «пока не знаю» — «цель не выбрана», без статуса против цели. Цели нет совсем (ни даты, ни балла) — карточки нет:
 * приглашение поставить цель живёт строкой в карточке плана.
 */
export function GoalSummaryCard({ className }: { className?: string }) {
  const { t, lang } = useT();
  const { daysLeft, forecast, goal, examDate, targetScore, targetScoreSet } = useGoalData();
  if (!hasGoal({ examDate, targetScoreSet })) return null;

  const hasDate = daysLeft !== null;
  const hasForecast = forecast.basis !== "none";

  const title = hasDate
    ? daysLeft > 0
      ? t("goals.card.until", { days: daysText(daysLeft, lang) })
      : daysLeft === 0
        ? t("goals.card.today")
        : t("goals.card.past")
    : t("goals.card.addDate");
  const main = hasForecast
    ? t(forecast.basis === "diagnostic" ? "goals.card.main.prelim" : "goals.card.main.forecast", { score: forecast.score })
    : t("goals.card.main.none");
  const tail = targetScoreSet ? t("goals.card.tail.target", { target: targetScore }) : t("goals.card.tail.none");

  return (
    <Link
      href={hasDate ? "/stats" : "/profile#goals"}
      className={cn(
        "flex items-center gap-3 rounded-3xl border-2 border-border bg-surface p-4 transition-colors hover:bg-surface-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className,
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Target size={24} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-extrabold leading-tight">{title}</span>
        <span className="mt-0.5 block text-sm font-bold text-muted">{`${main} · ${tail}`}</span>
        {hasDate && hasForecast && targetScoreSet && (
          <Pill tone={STATUS_TONE[goal.status]} className="mt-1.5">
            {t(`goals.status.${goal.status}` as DictKey)}
          </Pill>
        )}
      </span>
      <ChevronRight size={20} aria-hidden className="shrink-0 text-muted" />
    </Link>
  );
}

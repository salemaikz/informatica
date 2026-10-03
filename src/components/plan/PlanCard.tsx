"use client";

import { CalendarCheck, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { currentWeekOf } from "@/lib/plan";
import { useT } from "@/i18n/useT";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { usePlan } from "./usePlan";

const CARD =
  "flex flex-col gap-3 rounded-3xl border-2 border-border bg-surface p-4 transition-colors hover:bg-surface-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** Компактная карточка плана для главной (под «Продолжить»): неделя, дела недели, полоса прогресса и ссылка на весь план. */
export function PlanCard({ className }: { className?: string }) {
  const { t } = useT();
  const plan = usePlan();

  // Первый кадр: резервируем место, чтобы карта не «прыгала».
  if (!plan) return <div aria-hidden="true" className={cn("h-[104px] rounded-3xl bg-surface-2", className)} />;

  const week = currentWeekOf(plan);
  const icon = (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
      <CalendarCheck size={24} aria-hidden />
    </span>
  );
  const more = (
    <span className="flex shrink-0 items-center gap-0.5 text-sm font-extrabold text-primary">
      {t("plan.card.all")}
      <ChevronRight size={18} aria-hidden />
    </span>
  );

  if (!week) {
    return (
      <Link href="/plan" className={cn(CARD, className)}>
        <span className="flex items-center gap-3">
          {icon}
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-extrabold leading-tight">{t("plan.title")}</span>
            <span className="block text-sm font-bold text-muted">{t("plan.card.past")}</span>
          </span>
          {more}
        </span>
      </Link>
    );
  }

  return (
    <Link href="/plan" className={cn(CARD, className)}>
      <span className="flex items-center gap-3">
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold leading-tight">{t("plan.card.week", { n: week.n, total: plan.totalWeeks })}</span>
          <span className="block text-sm font-bold text-muted">{t("plan.card.tasks", { done: week.done, total: week.total })}</span>
        </span>
        {more}
      </span>
      <ProgressBar
        value={week.total ? week.done / week.total : 0}
        color={week.total > 0 && week.done >= week.total ? "var(--success)" : "var(--primary)"}
        height={10}
        label={t("plan.card.progress")}
      />
    </Link>
  );
}

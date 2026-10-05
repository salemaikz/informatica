"use client";

import { CalendarCheck, ChevronRight, Play, Target } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { hasGoal } from "@/lib/goals";
import { taskHref } from "@/lib/plan";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { ButtonLink } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { pluralForm } from "@/components/learn/map";
import { usePlan, useToday } from "./usePlan";
import { useTaskLabel } from "./useTaskLabel";

const CARD = "flex flex-col gap-3 rounded-3xl border-2 border-border bg-surface p-4";
const HEAD =
  "-m-1 flex items-center gap-3 rounded-2xl p-1 transition-colors hover:bg-surface-2 focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-primary";

/**
 * Карточка плана для главной (под «Продолжить»): «Сегодня: N уроков» и кнопка на первый из них, неделя плана и её прогресс.
 * Если цели нет (ни даты ЕНТ, ни балла) — внизу одна строка-приглашение вместо отдельной карточки цели.
 */
/**
 * heroLessonId — урок, который уже предлагает карточка «Следующий урок» выше: кнопку на тот же урок не повторяем
 * (отзыв владельца: главная без повторов).
 */
export function PlanCard({ className, heroLessonId }: { className?: string; heroLessonId?: string }) {
  const { t } = useT();
  const plan = usePlan();
  const today = useToday(plan);
  const label = useTaskLabel();
  const goal = useApp((s) => hasGoal(s.profile));

  // Первый кадр: резервируем место, чтобы карта не «прыгала».
  if (!plan) return <div aria-hidden="true" className={cn("h-[168px] rounded-3xl bg-surface-2", className)} />;

  const icon = (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
      <CalendarCheck size={24} aria-hidden />
    </span>
  );
  // На узком экране — только стрелка: слово «Весь план» отнимало у названия и подписи треть ширины.
  const more = (
    <span className="flex shrink-0 items-center gap-0.5 text-sm font-extrabold text-primary">
      <span className="sr-only sm:not-sr-only">{t("plan.card.all")}</span>
      <ChevronRight size={20} aria-hidden />
    </span>
  );

  if (!today) {
    return (
      <Link href="/plan" className={cn(CARD, "transition-colors hover:bg-surface-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary", className)}>
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

  const { week, quota, state, target } = today;
  const title =
    state === "todo"
      ? t(`goals15.today.n.${pluralForm(quota.left)}`, { n: quota.left })
      : t(state === "quota" ? "goals15.today.quota" : state === "weekDone" ? "goals15.today.weekDone" : "goals15.today.noLessons");
  // Две подписи без точки-разделителя: на узком экране вторая уходит на новую строку целиком.
  const sub = [
    t("plan.card.week", { n: week.n, total: plan.totalWeeks }),
    quota.done > 0 ? t("goals15.today.passed", { n: quota.done }) : t("plan.card.tasks", { done: week.done, total: week.total }),
  ];
  const primary = state === "todo" || state === "noLessons";

  return (
    <div className={cn(CARD, className)}>
      <Link href="/plan" className={HEAD}>
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold leading-tight">{title}</span>
          <span className="flex flex-wrap gap-x-3 text-sm font-bold text-muted">
            {sub.map((part) => (
              <span key={part}>{part}</span>
            ))}
          </span>
        </span>
        {more}
      </Link>
      <ProgressBar
        value={week.total ? week.done / week.total : 0}
        color={week.total > 0 && week.done >= week.total ? "var(--success)" : "var(--primary)"}
        height={10}
        label={t("plan.card.progress")}
      />
      {target && !(target.type === "lesson" && target.id === heroLessonId) && (
        <ButtonLink
          href={taskHref(target)}
          variant={primary ? "primary" : "secondary"}
          block
          icon={<Play size={18} aria-hidden className="shrink-0" />}
          className="min-w-0"
        >
          <span className="min-w-0 truncate">{t(primary ? "goals15.today.start" : "goals15.today.more", { title: label(target).title })}</span>
        </ButtonLink>
      )}
      {!goal && (
        <Link
          href="/profile#goals"
          className="flex min-h-11 items-center gap-2 rounded-2xl bg-primary-soft px-3 py-2 text-sm font-bold text-primary transition-colors hover:brightness-95 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Target size={18} aria-hidden className="shrink-0" />
          <span className="min-w-0 flex-1">{t("goals15.goal.invite")}</span>
          <ChevronRight size={18} aria-hidden className="shrink-0" />
        </Link>
      )}
    </div>
  );
}

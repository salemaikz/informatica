"use client";

import { AlertTriangle, ArrowLeft, CalendarDays, Check, Gauge, Hourglass, Play, Sun, Target } from "lucide-react";
import { useState } from "react";
import { daysText, formatExamDate } from "@/lib/goals";
import { MAX_LESSONS_PER_WEEK, currentWeekOf, taskHref, type Plan } from "@/lib/plan";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { pluralForm } from "@/components/learn/map";
import { TaskRow } from "./TaskRow";
import { usePlan, useToday } from "./usePlan";
import { useTaskLabel } from "./useTaskLabel";
import { WeekSection } from "./WeekSection";

/** Строка сводки: иконка и текст. */
function Fact({ icon, children, tone = "muted" }: { icon: React.ReactNode; children: React.ReactNode; tone?: "muted" | "warning" | "primary" }) {
  const color = tone === "warning" ? "text-warning-strong" : tone === "primary" ? "text-primary" : "text-muted";
  return (
    <p className={`flex items-start gap-2 text-sm font-bold ${color}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}

/** Блок «Сегодня» сверху: сколько уроков недели пройти сегодня, сами уроки и кнопка «Начать». */
function TodayBlock({ plan }: { plan: Plan }) {
  const { t } = useT();
  const today = useToday(plan);
  const label = useTaskLabel();
  if (!today) return null;

  const { quota, state, target } = today;
  const title =
    state === "todo"
      ? t(`goals15.today.n.${pluralForm(quota.left)}`, { n: quota.left })
      : t(state === "quota" ? "goals15.today.quota" : state === "weekDone" ? "goals15.today.weekDone" : "goals15.today.noLessons");
  const facts = [
    quota.done > 0 ? t("goals15.today.passed", { n: quota.done }) : "",
    quota.weekLeft > 0 ? t("goals15.today.weekLeft", { n: quota.weekLeft }) : "",
  ].filter(Boolean);
  const open = state === "todo" || state === "noLessons";

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${open ? "bg-primary-soft text-primary" : "bg-success-soft text-success-strong"}`}
        >
          {open ? <Sun size={24} aria-hidden /> : <Check size={24} strokeWidth={3} aria-hidden />}
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold leading-tight">{title}</h2>
          {facts.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-x-3 text-sm font-semibold text-muted">
              {facts.map((f) => (
                <span key={f}>{f}</span>
              ))}
            </p>
          )}
        </div>
      </div>
      {state === "todo" && (
        <div className="-mx-2 flex flex-col">
          {quota.lessons.map((task) => (
            <TaskRow key={task.key} task={task} />
          ))}
        </div>
      )}
      {target && (
        <ButtonLink
          href={taskHref(target)}
          variant={open ? "primary" : "secondary"}
          block
          icon={<Play size={18} aria-hidden className="shrink-0" />}
          className="min-w-0"
        >
          {/* Уроки на сегодня выше списком — на кнопке название не повторяем. */}
          <span className="min-w-0 truncate">
            {state === "todo" ? t("goals15.today.go") : t(open ? "goals15.today.start" : "goals15.today.more", { title: label(target).title })}
          </span>
        </ButtonLink>
      )}
    </Card>
  );
}

function Summary({ plan, examDate }: { plan: Plan; examDate: string | null }) {
  const { t, lang } = useT();
  const lessonsText = (n: number) => t(`plan.lessons.${pluralForm(n)}`, { n });

  if (plan.state === "past") {
    return (
      <Card className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-warning-soft text-warning-strong">
            <CalendarDays size={24} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-lg font-extrabold leading-tight">{t("plan.past.title")}</p>
            <p className="mt-1 text-sm font-semibold text-muted">{t("plan.past.text")}</p>
          </div>
        </div>
        <ButtonLink href="/profile#goals" icon={<Target size={18} aria-hidden />} block>
          {t("plan.setDate")}
        </ButtonLink>
      </Card>
    );
  }

  const done = plan.lessonsDone;
  const total = plan.lessonsTotal;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Target size={24} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-extrabold leading-tight">
            {plan.daysLeft !== null ? t("plan.untilExam", { days: daysText(plan.daysLeft, lang) }) : t("plan.noDate")}
          </p>
          <p className="mt-1 text-sm font-semibold text-muted">
            {plan.daysLeft !== null ? t("plan.examOn", { date: formatExamDate(examDate ?? "", lang) }) : t("plan.noDate.hint")}
          </p>
        </div>
      </div>

      {total > 0 && (
        <div>
          <ProgressBar value={done / total} color="var(--success)" height={10} label={t("plan.progress", { done, total })} />
          <p className="mt-1.5 text-sm font-bold">{t("plan.progress", { done, total })}</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Fact icon={<Gauge size={16} aria-hidden />} tone="primary">
          {t("plan.left", { n: plan.lessonsLeft })}
        </Fact>
        {plan.pace !== null && plan.needMore === null && (
          <Fact icon={<Gauge size={16} aria-hidden />}>{t("goals15.plan.pace", { lessons: lessonsText(plan.pace) })}</Fact>
        )}
        {plan.needMore !== null && (
          <Fact icon={<AlertTriangle size={16} aria-hidden />} tone="warning">
            {t("goals15.plan.need", { lessons: lessonsText(plan.needMore) })}
          </Fact>
        )}
        {plan.lessonsLeft === 0 && plan.notReady === 0 && <Fact icon={<Gauge size={16} aria-hidden />}>{t("plan.advice.done")}</Fact>}
        {plan.lessonsLeft > 0 && plan.perWeekNeeded === null && (
          <Fact icon={<Hourglass size={16} aria-hidden />}>{t("plan.advice.late", { n: plan.lessonsLeft })}</Fact>
        )}
        {plan.overflow > 0 &&
          (plan.hasDate ? (
            <Fact icon={<AlertTriangle size={16} aria-hidden />} tone="warning">
              {t("goals15.plan.overflow", { lessons: lessonsText(plan.overflow), max: MAX_LESSONS_PER_WEEK })}
            </Fact>
          ) : (
            <Fact icon={<Hourglass size={16} aria-hidden />}>{t("goals15.plan.beyond", { lessons: lessonsText(plan.overflow) })}</Fact>
          ))}
        {plan.behind > 0 && (
          <Fact icon={<AlertTriangle size={16} aria-hidden />} tone="warning">
            {t("plan.behind", { n: plan.behind })}
          </Fact>
        )}
        {plan.notReady > 0 && <Fact icon={<Hourglass size={16} aria-hidden />}>{t("plan.notReady", { n: plan.notReady })}</Fact>}
      </div>

      {plan.needMore !== null && (
        <ButtonLink href="/profile#goals" variant="secondary" icon={<Gauge size={18} aria-hidden />} block>
          {t("goals15.plan.need.change")}
        </ButtonLink>
      )}
      {plan.daysLeft === null && (
        <ButtonLink href="/profile#goals" variant="secondary" icon={<CalendarDays size={18} aria-hidden />} block>
          {t("plan.setDate")}
        </ButtonLink>
      )}
    </Card>
  );
}

/** Страница «План подготовки»: сводка и недели; текущая неделя раскрыта, остальные свёрнуты. */
export function PlanView() {
  const { t } = useT();
  const plan = usePlan();
  const examDate = useApp((s) => s.profile.examDate);
  // Ручное раскрытие/сворачивание поверх «по умолчанию раскрыта текущая».
  const [override, setOverride] = useState<Record<number, boolean>>({});

  return (
    <div className="flex flex-col gap-4">
      <ButtonLink href="/learn" variant="ghost" size="sm" className="-ml-2 h-10 self-start" icon={<ArrowLeft size={18} aria-hidden />}>
        {t("plan.back")}
      </ButtonLink>
      <header>
        <h1 className="text-2xl font-extrabold">{t("plan.title")}</h1>
        <p className="mt-1 text-sm font-semibold text-muted">{t("plan.subtitle")}</p>
      </header>

      {!plan ? (
        <div role="status" aria-label={t("plan.loading")} className="h-40 rounded-3xl bg-surface-2" />
      ) : (
        <>
          <TodayBlock plan={plan} />
          <Summary plan={plan} examDate={examDate} />
          <div className="flex flex-col gap-3">
            {plan.weeks.map((w) => (
              <WeekSection
                key={w.n}
                week={w}
                open={override[w.n] ?? w.n === currentWeekOf(plan)?.n}
                onToggle={() => setOverride((o) => ({ ...o, [w.n]: !(o[w.n] ?? w.n === currentWeekOf(plan)?.n) }))}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

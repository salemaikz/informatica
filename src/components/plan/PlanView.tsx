"use client";

import { AlertTriangle, ArrowLeft, CalendarDays, Gauge, Hourglass, Target } from "lucide-react";
import { useState } from "react";
import { daysText, formatExamDate } from "@/lib/goals";
import { currentWeekOf, type Plan } from "@/lib/plan";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { pluralForm } from "@/components/learn/map";
import { usePlan } from "./usePlan";
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
          {plan.perWeekNeeded !== null && ` · ${t("plan.advice", { lessons: lessonsText(plan.perWeekNeeded) })}`}
        </Fact>
        {plan.lessonsLeft === 0 && plan.notReady === 0 && <Fact icon={<Gauge size={16} aria-hidden />}>{t("plan.advice.done")}</Fact>}
        {plan.lessonsLeft > 0 && plan.perWeekNeeded === null && (
          <Fact icon={<Hourglass size={16} aria-hidden />}>{t("plan.advice.late", { n: plan.lessonsLeft })}</Fact>
        )}
        {plan.overflow > 0 && (
          <Fact icon={<AlertTriangle size={16} aria-hidden />} tone="warning">
            {t("plan.overflow", { lessons: lessonsText(plan.overflow) })}
          </Fact>
        )}
        {plan.behind > 0 && (
          <Fact icon={<AlertTriangle size={16} aria-hidden />} tone="warning">
            {t("plan.behind", { n: plan.behind })}
          </Fact>
        )}
        {plan.notReady > 0 && <Fact icon={<Hourglass size={16} aria-hidden />}>{t("plan.notReady", { n: plan.notReady })}</Fact>}
      </div>

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

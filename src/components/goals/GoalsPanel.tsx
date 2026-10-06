"use client";

import { CalendarDays, ClipboardCheck, ClipboardList, Dumbbell, ListChecks, Play, Target } from "lucide-react";
import { useMemo } from "react";
import { lessonMeta } from "@/content/catalog";
import { UNITS } from "@/content/course-map";
import { ENT_TOPICS, entTopicById } from "@/content/ent-topics";
import { cn } from "@/lib/cn";
import { DIAGNOSTIC_MARGIN } from "@/lib/forecast";
import { PLAN_MASTERED, daysText, examTrend, formatDayMonth, formatExamDate, lessonsForTopic, weeklyPlan } from "@/lib/goals";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useGoalData, useWeekData } from "./useGoalData";

/** Высота области столбиков и подписей графика пробников, px. */
const CHART_H = 96;
const LABEL_H = 20;

const STATUS_TONE = { none: "muted", below: "warning", on: "success", above: "success" } as const;

function SectionHead({ icon, title, action }: { icon: React.ReactNode; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <p className="flex min-w-0 items-center gap-2 text-lg font-extrabold">
        <span className="text-primary">{icon}</span> {title}
      </p>
      {action}
    </div>
  );
}

/** Шкала 0–50: вероятный интервал, прогноз и цель (цель «пока не выбрана» — без отметки). */
function ForecastScale({ low, high, score, target }: { low: number; high: number; score: number; target: number | null }) {
  const pct = (v: number) => `${(Math.max(0, Math.min(50, v)) / 50) * 100}%`;
  return (
    <div className="relative mt-6 h-4" aria-hidden="true">
      <div className="absolute inset-0 rounded-full bg-surface-2" />
      <div className="absolute inset-y-0 rounded-full bg-primary/25" style={{ left: pct(low), width: `calc(${pct(high)} - ${pct(low)})` }} />
      <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-primary" style={{ left: pct(score) }} />
      {target !== null && <div className="absolute -top-1.5 bottom-[-6px] w-0.5 -translate-x-1/2 rounded-full bg-text" style={{ left: pct(target) }} />}
    </div>
  );
}

/**
 * Карточка «Неделя»: уроков за неделю против цели из профиля, точки по дням. Не про ЕНТ: в треке ЕНТ она — часть
 * панели целей, в школьном (#52) — вся панель на «Прогрессе» (`showEdit` добавляет ссылку на цель в профиле).
 */
export function WeekCard({ showEdit = false, className }: { showEdit?: boolean; className?: string }) {
  const { t } = useT();
  const week = useWeekData();
  const dayLabels = t("stats.days").split(",");
  const left = Math.max(0, week.goal - week.done);
  return (
    <Card className={className}>
      <SectionHead
        icon={<CalendarDays size={22} />}
        title={t("goals.week.title")}
        action={
          showEdit ? (
            <ButtonLink href="/profile#goals" variant="ghost" size="sm" className="h-10">
              {t("goals.panel.edit")}
            </ButtonLink>
          ) : undefined
        }
      />
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-2xl font-extrabold">{t("goals.week.progress", { done: week.done, goal: week.goal })}</p>
        <p className={cn("text-sm font-extrabold", week.reached ? "text-success-strong" : "text-muted")}>
          {week.reached ? t("goals.week.reached") : t("goals.week.left", { n: left })}
        </p>
      </div>
      <ProgressBar value={week.ratio} color={week.reached ? "var(--success)" : "var(--primary)"} height={12} className="mt-2" label={t("goals.week.title")} />
      <ul className="mt-4 grid grid-cols-7 gap-1.5">
        {week.days.map((d, i) => (
          <li key={d.key} className="flex flex-col items-center gap-1">
            <span className={cn("text-xs font-extrabold", d.today ? "text-primary" : "text-muted")}>{dayLabels[i]}</span>
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-extrabold",
                d.lessons > 0 ? "border-primary bg-action-primary text-white" : d.today ? "border-primary text-primary" : "border-border text-muted",
                d.future && "opacity-50",
              )}
              aria-label={`${dayLabels[i]}: ${d.lessons}`}
            >
              {d.lessons > 0 ? d.lessons : ""}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * Панель целей для страницы «Прогресс» (только трек ЕНТ): отсчёт до ЕНТ, прогноз с интервалом против цели,
 * неделя, план недели (3 темы) и история пробников. Школьному треку — только `WeekCard`.
 */
export function GoalsPanel({ className }: { className?: string }) {
  const { t, l, lang } = useT();
  const { daysLeft, examDate, forecast, goal, targetScore, targetScoreSet, diagnostic } = useGoalData();
  const lessons = useApp((s) => s.lessons);
  const exams = useApp((s) => s.exams);

  /** Предварительный прогноз: по входной диагностике, а не по ответам и пробникам. */
  const prelim = forecast.basis === "diagnostic";
  // Диагностика не делает тему «освоенной» (#70): пока оценка темы опирается на неё (`forecast.provisional` — весь
  // предварительный прогноз и темы, где своей практики ещё мало), план строим из значений не выше порога освоения —
  // иначе темы, которых в диагностике не было, молча считались бы освоенными, а при 10/10 план был бы пуст.
  const planBasis = useMemo(() => {
    if (!forecast.provisional.length) return forecast.byTopic;
    const cap = PLAN_MASTERED - 0.01;
    const shaky = new Set(forecast.provisional);
    return Object.fromEntries(ENT_TOPICS.map((tp) => [tp.id, shaky.has(tp.id) ? Math.min(forecast.byTopic[tp.id] ?? 0, cap) : (forecast.byTopic[tp.id] ?? 0)]));
  }, [forecast.provisional, forecast.byTopic]);
  const plan = useMemo(() => weeklyPlan(planBasis, 3), [planBasis]);
  const ready = useMemo(
    // Только готовые уроки: черновики «скоро» могут уже лежать в реестре.
    () => UNITS.flatMap((u) => u.lessons).flatMap((r) => (r.status === "available" && lessonMeta(r.id) ? [lessonMeta(r.id)!] : [])),
    [],
  );
  const trend = useMemo(() => examTrend(exams), [exams]);

  const dateText = examDate ? formatExamDate(examDate, lang) : "";
  const noData = forecast.basis === "none";

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Цель и прогноз */}
      <Card>
        <SectionHead
          icon={<Target size={22} />}
          title={t("goals.panel.title")}
          action={
            <ButtonLink href="/profile#goals" variant="ghost" size="sm" className="h-10">
              {t("goals.panel.edit")}
            </ButtonLink>
          }
        />
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{t("goals.panel.countdown")}</p>
            {daysLeft !== null && daysLeft >= 0 ? (
              <p className="text-3xl font-extrabold leading-tight">{daysText(daysLeft, lang)}</p>
            ) : (
              <p className="text-lg font-extrabold leading-tight text-muted">{daysLeft === null ? t("goals.panel.noDate") : t("goals.card.past")}</p>
            )}
            {examDate && <p className="text-sm font-bold text-muted">{t("goals.panel.examOn", { date: dateText })}</p>}
          </div>
          {daysLeft === null && (
            <ButtonLink href="/profile#goals" variant="secondary" size="sm" className="h-10">
              {t("goals.panel.setDate")}
            </ButtonLink>
          )}
        </div>

        <div className="mt-4 border-t-2 border-border pt-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{t("goals.forecast.title")}</p>
            {prelim && <Pill tone="muted">{t("goals.forecast.prelim")}</Pill>}
          </div>
          {forecast.basis === "none" ? (
            <p className="mt-1 font-semibold text-muted">{t("goals.forecast.none")}</p>
          ) : (
            <>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-3xl font-extrabold leading-tight">{t("goals.forecast.value", { score: forecast.score })}</p>
                {targetScoreSet && <Pill tone={STATUS_TONE[goal.status]}>{t(`goals.status.${goal.status}` as DictKey)}</Pill>}
              </div>
              <p className="text-sm font-bold text-muted">{t("goals.forecast.range", { low: forecast.low, high: forecast.high })}</p>
              <ForecastScale low={forecast.low} high={forecast.high} score={forecast.score} target={targetScoreSet ? targetScore : null} />
              {targetScoreSet ? (
                <div className="mt-2 flex items-center justify-between gap-2 text-sm font-bold">
                  <span className="text-muted">{t("goals.forecast.target", { target: targetScore })}</span>
                  {goal.status !== "on" && (
                    <span className={goal.gap > 0 ? "text-warning-strong" : "text-success-strong"}>
                      {goal.gap > 0 ? t("goals.forecast.gap", { n: goal.gap }) : t("goals.forecast.reserve", { n: -goal.gap })}
                    </span>
                  )}
                </div>
              ) : null}
              <p className="mt-2 text-xs font-semibold text-muted">{prelim ? t("goals.forecast.honestDiag", { n: DIAGNOSTIC_MARGIN }) : t("goals.forecast.honest")}</p>
            </>
          )}
          {!targetScoreSet && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="font-extrabold text-muted">{t("goals.target.unset")}</p>
              <ButtonLink href="/profile#goals" variant="secondary" size="sm" className="h-10">
                {t("goals.target.choose")}
              </ButtonLink>
            </div>
          )}
          {/* Диагностику можно пройти (заново), пока прогноз пустой или предварительный: по ответам и пробникам она его не меняет. */}
          {(noData || prelim) && (
            <ButtonLink href="/diagnostic" variant="ghost" size="sm" className="mt-3 h-10" icon={<ClipboardList size={16} aria-hidden />}>
              {t(diagnostic ? "goals.diag.again" : "goals.diag.first")}
            </ButtonLink>
          )}
        </div>
      </Card>

      {/* Неделя */}
      <WeekCard />

      {/* План недели */}
      <Card>
        <SectionHead icon={<ListChecks size={22} />} title={t("goals.plan.title")} />
        <p className="-mt-2 mb-3 text-sm font-semibold text-muted">{t(noData ? "goals.plan.hintStart" : "goals.plan.hint")}</p>
        {plan.length === 0 ? (
          // «Все темы освоены» — только по реальному освоению, не по предварительному прогнозу.
          prelim ? null : <p className="font-semibold text-success-strong">{t("goals.plan.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {plan.map((p) => {
              const topic = entTopicById(p.topic);
              const ids = lessonsForTopic(p.topic, ready);
              const lesson = ids.find((id) => !lessons[id]) ?? ids[0];
              const done = lesson ? !!lessons[lesson] : false;
              // По диагностике — настоящая доля верных по теме (не обрезанная для плана); тема без вопросов — «не проверялось».
              const diagTopic = prelim ? diagnostic?.byTopic?.[p.topic] : undefined;
              const tested = !!diagTopic && diagTopic.max > 0;
              const shown = prelim ? (tested ? Math.max(0, Math.min(1, diagTopic!.points / diagTopic!.max)) : null) : p.mastery;
              return (
                <li key={p.topic} className="rounded-2xl border-2 border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-extrabold leading-snug">{l(topic.title)}</p>
                    <Pill tone="primary" className="shrink-0">
                      {t("goals.plan.gain", { n: Math.max(1, Math.round(p.gain * 50)) })}
                    </Pill>
                  </div>
                  {noData ? (
                    <p className="mt-1 text-xs font-bold text-muted">{t("goals.plan.notStarted")}</p>
                  ) : shown === null ? (
                    <p className="mt-1 text-xs font-bold text-muted">{t("goals.plan.notTested")}</p>
                  ) : (
                    <>
                      <p className="mt-1 text-xs font-bold text-muted">{t(prelim ? "goals.plan.diagMastery" : "goals.plan.mastery", { n: Math.round(shown * 100) })}</p>
                      <ProgressBar value={shown} color={shown < 0.6 ? "var(--danger)" : shown < PLAN_MASTERED ? "var(--warning)" : "var(--primary)"} height={8} className="mt-1" label={l(topic.short)} />
                    </>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {lesson && (
                      <ButtonLink href={`/lesson/${lesson}`} size="sm" className="h-10" variant={done ? "secondary" : "primary"} icon={<Play size={16} fill="currentColor" />}>
                        {t("goals.plan.lesson")}
                      </ButtonLink>
                    )}
                    <ButtonLink href={`/drill?mode=topic&topic=${p.topic}`} size="sm" className="h-10" variant="secondary" icon={<Dumbbell size={16} />}>
                      {t("goals.plan.train")}
                    </ButtonLink>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* История пробников */}
      <Card>
        <SectionHead icon={<ClipboardCheck size={22} />} title={t("goals.history.title")} />
        {trend.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className="font-semibold text-muted">{t("goals.history.empty")}</p>
            <ButtonLink href="/exam" size="sm" className="h-10">
              {t("goals.history.start")}
            </ButtonLink>
          </div>
        ) : (
          <>
            <p className="text-sm font-bold text-muted">{t("goals.history.last", { score: trend[trend.length - 1].score })}</p>
            {/* Высоты в пикселях: столбик не сжимается, и линия цели стоит ровно на своём уровне. */}
            <div className="relative mt-3" style={{ height: CHART_H + LABEL_H * 2 + 8 }} role="img" aria-label={t("goals.history.chart")}>
              {/* линия цели — только когда цель выбрана (иначе это число по умолчанию, которое ученик не ставил) */}
              {targetScoreSet && (
                <div className="absolute inset-x-0 border-t-2 border-dashed border-muted/60" style={{ bottom: LABEL_H + 4 + (Math.min(50, targetScore) / 50) * CHART_H }} />
              )}
              <div className="relative flex h-full items-end justify-around gap-1.5">
                {trend.map((p, i) => (
                  <div key={`${p.at}-${i}`} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-sm font-extrabold leading-5" style={{ height: LABEL_H }}>
                      {p.score}
                    </span>
                    <div
                      className={cn("w-full max-w-9 shrink-0 rounded-t-lg", targetScoreSet && p.score >= targetScore ? "bg-success" : "bg-primary")}
                      style={{ height: Math.max(4, (p.score / 50) * CHART_H) }}
                    />
                    <span className="text-[11px] font-bold leading-5 text-muted" style={{ height: LABEL_H }}>
                      {formatDayMonth(p.at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}


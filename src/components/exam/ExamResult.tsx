"use client";

import { ArrowRight, BookOpen, Clock, Dumbbell, Lightbulb, RotateCcw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LESSON_META } from "@/content/catalog";
import { UNITS, lessonNumber } from "@/content/course-map";
import { entTopicById } from "@/content/ent-topics";
import { skillById } from "@/content/skills";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { aiErrorKey, lessonFeedback } from "@/lib/ai";
import { cn } from "@/lib/cn";
import { examAdvice, scoreExam, SEC_PER_QUESTION, starsFor, type ExamKind } from "@/lib/exam";
import { loadAttempt, saveAttemptState, type ExamAttempt } from "@/lib/exam-store";
import { forecastScore, MAX_SCORE } from "@/lib/forecast";
import { decaySkills } from "@/lib/mastery";
import { useApp } from "@/lib/store";
import { buildStudentContext } from "@/lib/student-context";
import type { EntTopicId } from "@/lib/types";
import { Markdown } from "@/components/Markdown";
import { AiCost } from "@/components/economy/AiCost";
import { NoChipsNotice } from "@/components/economy/NoChipsNotice";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { ProgressBar, Ring } from "@/components/ui/ProgressBar";
import { ExamShareActions } from "@/components/share/ExamShareActions";
import { useSkillStats } from "@/components/progress/useSkillStats";
import { ChallengeCompare } from "./ChallengeBanner";
import { ExamNotes } from "./ExamNotes";
import { aiMistakes, formatClock, formatDay, lessonsForTopic, onlyMistakes, ratioOf, reviewRows, slowestRows, toneOf, type Tone } from "./logic";
import { ReviewList } from "./ReviewList";
import { examTitle } from "./checkpoint";
import { StarRow } from "./StarRow";

const TONE_COLOR: Record<Tone, string> = {
  danger: "var(--danger)",
  warning: "var(--warning)",
  success: "var(--success)",
};
const KIND_ROWS = ["single", "multi", "match", "context"] as const;

// chips — не хватает чипов на разбор; limit — потолок обращений за день; key — особая причина сбоя (всплеск, общий запас сайта).
type AiState = { status: "idle" | "loading" | "failed" | "limit" | "chips"; key?: DictKey };

function Bar({ label, points, max, hint }: { label: string; points: number; max: number; hint?: string }) {
  const ratio = ratioOf(points, max);
  const tone = toneOf(ratio);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm font-bold">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 tabular-nums text-muted">
          {hint ?? `${points}/${max}`} ·{" "}
          <span className={cn(tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning-strong" : "text-success-strong")}>
            {Math.round(ratio * 100)}%
          </span>
        </span>
      </div>
      <ProgressBar value={ratio} color={TONE_COLOR[tone]} height={10} label={label} />
    </div>
  );
}

export function ExamResult({ id }: { id: string }) {
  const { t, l, lang } = useT();
  const summary = useApp((s) => s.exams.find((e) => e.id === id));
  const exams = useApp((s) => s.exams);
  // Освоение с затуханием (#45, #80): прогноз здесь тот же, что в «Целях» и «Прогрессе».
  const skills = useSkillStats();
  // Прогноз — тот же, что в «Целях» и «Прогрессе»: с опорой на входную диагностику (#70).
  const diagnostic = useApp((s) => s.profile.diagnostic);

  const [loaded, setLoaded] = useState<{
    done: boolean;
    attempt: ExamAttempt | null;
  }>({ done: false, attempt: null });
  const [now] = useState(() => Date.now());
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [ai, setAi] = useState<AiState>({ status: "idle" });

  useEffect(() => {
    let off = false;
    loadAttempt(id).then((a) => {
      if (!off) setLoaded({ done: true, attempt: a });
    });
    return () => {
      off = true;
    };
  }, [id]);

  const attempt = loaded.attempt?.finishedAt ? loaded.attempt : null;
  const result = useMemo(() => (attempt ? scoreExam(attempt.paper, attempt.answers) : null), [attempt]);
  const rows = useMemo(() => (attempt ? reviewRows(attempt.paper, attempt.answers) : []), [attempt]);
  const advice = useMemo(() => (result ? examAdvice(result) : null), [result]);
  const forecast = useMemo(
    () =>
      forecastScore({
        skills,
        exams: exams.map((e) => ({
          at: e.at,
          points: e.points,
          maxPoints: e.maxPoints,
          byTopic: e.byTopic,
          kind: e.kind,
        })),
        now,
        diagnostic,
      }),
    [skills, exams, now, diagnostic],
  );
  // Уроки на карте — в порядке курса (старые уроки вне карты не предлагаем).
  const lessons = useMemo(
    () =>
      Object.values(LESSON_META)
        .filter((x) => lessonNumber(x.id) > 0)
        .sort((a, b) => lessonNumber(a.id) - lessonNumber(b.id)),
    [],
  );

  if (!loaded.done) return <p className="py-20 text-center font-bold text-muted">{t("common.loading")}</p>;

  const kind: ExamKind | null = attempt?.kind ?? summary?.kind ?? null;
  // Контрольная по разделу: название раздела в заголовке итога, звёзды, возврат к разделу на карте.
  const unitId = kind === "unit" ? (attempt?.unit ?? summary?.unit) : undefined;
  const unitDef = unitId ? UNITS.find((u) => u.id === unitId) : undefined;
  const kindLabel = examTitle(kind ?? "mini", unitId, t, l);
  const points = result?.points ?? summary?.points;
  const maxPoints = result?.maxPoints ?? summary?.maxPoints;

  if (!kind || points === undefined || maxPoints === undefined) {
    const unfinished = loaded.attempt && !loaded.attempt.finishedAt;
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-lg font-extrabold">{unfinished ? t("exam.result.unfinished") : t("exam.result.notFound")}</p>
        <ButtonLink href={unfinished ? "/exam/run" : "/exam"}>{unfinished ? t("exam.resume.continue") : t("exam.run.toHub")}</ButtonLink>
      </div>
    );
  }

  const ratio = ratioOf(points, maxPoints);
  const tone = toneOf(ratio);
  const durationSec = result?.timeSec ?? summary?.durationSec ?? 0;
  const at = attempt?.finishedAt ?? summary?.at ?? 0;
  const topicRows = (
    result
      ? Object.entries(result.byTopic)
          .filter(([, v]) => v.max > 0)
          .map(([tp, v]) => ({
            topic: tp as EntTopicId,
            points: v.points,
            max: v.max,
          }))
      : Object.entries(summary?.byTopic ?? {}).map(([tp, v]) => ({
          topic: tp as EntTopicId,
          points: v!.points,
          max: v!.max,
        }))
  ).sort((a, b) => ratioOf(a.points, a.max) - ratioOf(b.points, b.max));

  const shown = onlyWrong ? onlyMistakes(rows) : rows;
  const mistakeCount = onlyMistakes(rows).length;

  const toggle = (key: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const jumpTo = (key: string) => {
    setOnlyWrong(false);
    setOpen((cur) => new Set(cur).add(key));
    requestAnimationFrame(() => document.getElementById(`rv-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const askAi = async () => {
    if (!attempt || !result || ai.status === "loading" || attempt.review) return;
    const app = useApp.getState();
    const receipt = app.spendAi("review");
    if (!receipt.ok) {
      setAi({ status: receipt.reason === "chips" ? "chips" : "limit" });
      return;
    }
    setAi({ status: "loading" });
    try {
      const weakSkills = [...new Set(onlyMistakes(rows).map((r) => r.q.item.skill))].slice(0, 10);
      // Освоение для ИИ — с затуханием, как у наставника (#80).
      const stats = decaySkills(app.skills, Date.now());
      const data = await lessonFeedback({
        context: buildStudentContext(app),
        lesson: t("exam.ai.lesson", {
          kind: kindLabel,
          points: result.points,
          max: result.maxPoints,
        }),
        accuracy: ratio,
        durationSec: result.timeSec,
        mistakes: aiMistakes(rows, attempt.answers, lang, 8),
        skills: weakSkills.map((sid) => ({
          title: skillById(sid) ? l(skillById(sid)!.title) : sid,
          mastery: stats[sid]?.mastery ?? 0,
        })),
      });
      if (!data.feedback?.trim()) throw new Error("empty");
      if (data.memory) app.setMemory(data.memory);
      const review = {
        feedback: data.feedback,
        focus: Array.isArray(data.focus) ? data.focus : [],
        at: Date.now(),
      };
      const { paper: _paper, ...state } = attempt;
      void _paper;
      await saveAttemptState({ ...state, review });
      setLoaded({ done: true, attempt: { ...attempt, review } });
      setAi({ status: "idle" });
    } catch (e) {
      useApp.getState().refundAi(receipt);
      // Общая ошибка — прежний текст раздела; отказ сервера по лимитам — свой текст (lib/ai.ts → aiErrorKey).
      const key = aiErrorKey(e);
      setAi({ status: "failed", key: key === "tutor.error" ? undefined : key });
    }
  };

  const weak = advice?.weakTopics.slice(0, 3) ?? [];
  // Ни одного ответа (время вышло, завершено сразу): темп и «отвечаешь быстро» ничего не значат.
  const answeredAny = !!result && !!attempt && result.unanswered < attempt.paper.items.length;
  const tips = advice ? (answeredAny ? advice.tips : advice.tips.filter((x) => x === "answer-everything")) : [];
  const pace = result && advice ? advice.pace : null;
  const avg = result?.avgSecPerQuestion ?? 0;
  const paceMax = Math.max(avg, SEC_PER_QUESTION, 1);
  const lessonFor = (tp: EntTopicId) => {
    const found = lessonsForTopic(lessons, tp, (sid) => skillById(sid)?.ent)[0];
    return found ? `/lesson/${found.id}` : "/learn";
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Итог */}
      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Ring value={ratio} size={96} stroke={10} color={TONE_COLOR[tone]}>
            <span className="text-xl font-black">{Math.round(ratio * 100)}%</span>
          </Ring>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-muted">{kindLabel}</p>
            <p className="text-4xl font-black leading-tight">
              {points}
              <span className="ml-1.5 text-lg font-extrabold text-muted">{t("exam.of", { max: maxPoints })}</span>
            </p>
            {kind === "unit" && <StarRow stars={starsFor(points, maxPoints)} size={20} className="mt-1" />}
            <p className="flex items-center gap-1.5 text-xs font-bold text-muted">
              <Clock size={13} aria-hidden />
              {formatDay(at, lang, false, now)}
              {durationSec > 0 ? ` · ${formatClock(durationSec)}` : ""}
            </p>
          </div>
        </div>
        {forecast.basis !== "none" && (
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-surface-2 px-3.5 py-2.5">
            <span className="text-sm font-bold">{t("exam.result.forecast")}</span>
            <span className="font-extrabold">
              ~{forecast.score}{" "}
              <span className="text-sm text-muted">
                ({forecast.low}–{forecast.high} {t("exam.of", { max: MAX_SCORE })})
              </span>
            </span>
          </div>
        )}
        {result && result.unanswered > 0 && (
          <Pill tone="warning" className="self-start">
            {t("exam.result.unanswered", { n: result.unanswered })}
          </Pill>
        )}
      </Card>

      {/* Вызов друга (#73): больше / столько же / меньше. Меньше — не ошибка, поэтому не красным. */}
      {attempt?.challenge && kind !== "unit" && (
        <ChallengeCompare challenge={attempt.challenge} points={points} max={maxPoints} pool={attempt.pool ?? summary?.pool} />
      )}

      {/* Поделиться результатом и вызвать друга (#72, #73); у контрольной раздела компонент сам ничего не рисует. */}
      <ExamShareActions
        kind={kind}
        seed={attempt?.seed ?? summary?.seed ?? 0}
        topics={attempt?.topics ?? summary?.topics ?? []}
        points={points}
        max={maxPoints}
        pool={attempt?.pool ?? summary?.pool}
        topicRows={topicRows}
      />

      {attempt && <ExamNotes paper={attempt.paper} />}

      {/* По темам */}
      {topicRows.length > 0 && (
        <section>
          <SectionTitle>{t("exam.result.byTopic")}</SectionTitle>
          <Card className="flex flex-col gap-3.5">
            {topicRows.map((r) => (
              <Bar key={r.topic} label={l(entTopicById(r.topic).short)} points={r.points} max={r.max} />
            ))}
          </Card>
        </section>
      )}

      {!result && <p className="rounded-2xl border-2 border-border bg-surface p-3.5 text-sm font-semibold text-muted">{t("exam.result.summaryOnly")}</p>}

      {result && advice && attempt && (
        <>
          {/* По видам */}
          <section>
            <SectionTitle>{t("exam.result.byKind")}</SectionTitle>
            <Card className="flex flex-col gap-3.5">
              {KIND_ROWS.filter((k) => result.byKind[k].max > 0).map((k) => (
                <Bar key={k} label={t(`exam.kind.${k}` as DictKey)} points={result.byKind[k].points} max={result.byKind[k].max} />
              ))}
            </Card>
          </section>

          {/* Темп */}
          {answeredAny && (
            <section>
              <SectionTitle>{t("exam.result.pace")}</SectionTitle>
              <Card className="flex flex-col gap-3">
                <p className="font-bold">
                  {t(`exam.pace.${pace}` as DictKey, {
                    avg: formatClock(avg),
                    norm: formatClock(SEC_PER_QUESTION),
                  })}
                </p>
                <div className="flex flex-col gap-2 text-sm font-bold">
                  <div>
                    <div className="mb-1 flex justify-between">
                      <span>{t("exam.pace.yours")}</span>
                      <span className="tabular-nums text-muted">{formatClock(avg)}</span>
                    </div>
                    <ProgressBar
                      value={avg / paceMax}
                      color={pace === "slow" ? "var(--warning)" : pace === "fast" ? "var(--primary)" : "var(--success)"}
                      height={10}
                      label={t("exam.pace.yours")}
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between">
                      <span>{t("exam.pace.norm")}</span>
                      <span className="tabular-nums text-muted">{formatClock(SEC_PER_QUESTION)}</span>
                    </div>
                    <ProgressBar value={SEC_PER_QUESTION / paceMax} color="var(--border)" height={10} label={t("exam.pace.norm")} />
                  </div>
                </div>
                {result.slowest.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-sm font-extrabold text-muted">{t("exam.pace.slowest")}</p>
                    <div className="flex flex-wrap gap-2">
                      {slowestRows(attempt.paper, attempt.answers, result.slowest).map((s) => (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => jumpTo(s.key)}
                          className="h-10 rounded-full border-2 border-border bg-surface px-3 text-sm font-extrabold hover:bg-surface-2"
                        >
                          {t("exam.pace.item", {
                            n: s.number,
                            time: formatClock(s.sec),
                          })}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </section>
          )}

          {/* Советы */}
          {tips.length > 0 && (
            <section>
              <SectionTitle>{t("exam.result.advice")}</SectionTitle>
              <div className="flex flex-col gap-2">
                {tips.map((tip) => (
                  <div key={tip} className="flex gap-3 rounded-2xl border-2 border-primary/30 bg-primary-soft p-3.5">
                    <Lightbulb size={22} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                    <div>
                      <p className="font-extrabold">{t(`exam.advice.${tip}` as DictKey)}</p>
                      <p className="text-sm font-semibold text-muted">{t(`exam.advice.${tip}.text` as DictKey)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Разбор от Бита */}
          <section>
            {attempt.review ? (
              <div className="rounded-3xl border-2 border-ai/40 bg-ai-soft p-4">
                <p className="mb-2 flex items-center gap-2 font-extrabold text-ai">
                  <Sparkles size={20} aria-hidden /> {t("exam.ai.title")}
                </p>
                <Markdown>{attempt.review.feedback}</Markdown>
                {attempt.review.focus.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {attempt.review.focus.map((f, i) => (
                      <Pill key={i} tone="ai">
                        {f}
                      </Pill>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded-3xl border-2 border-ai/40 bg-ai-soft p-4">
                <p className="flex items-center gap-2 font-extrabold text-ai">
                  <Sparkles size={20} aria-hidden /> {t("exam.ai.title")}
                </p>
                <p className="text-sm font-semibold text-muted">{t("exam.ai.desc")}</p>
                <Button variant="ai" block disabled={ai.status === "loading"} onClick={askAi} icon={<Sparkles size={18} aria-hidden />}>
                  {ai.status === "loading" ? t("exam.ai.loading") : t("exam.ai.button")}
                  {ai.status !== "loading" && <AiCost kind="review" variant="solid" />}
                </Button>
                {ai.status === "failed" && <p className="text-sm font-bold text-danger">{t(ai.key ?? "exam.ai.failed")}</p>}
                {ai.status === "limit" && <p className="text-sm font-bold text-warning-strong">{t("exam.ai.limit")}</p>}
                {ai.status === "chips" && <NoChipsNotice kind="review" />}
              </div>
            )}
          </section>

          {/* Что подтянуть */}
          <section>
            <SectionTitle>{t("exam.result.next")}</SectionTitle>
            {weak.length > 0 ? (
              <div className="flex flex-col gap-2">
                <ButtonLink href={`/drill?mode=topic&topic=${weak[0]}`} size="lg" block icon={<Dumbbell size={20} aria-hidden />}>
                  {t("exam.result.drillWeak")}
                </ButtonLink>
                {weak.map((tp) => (
                  <div key={tp} className="flex flex-col gap-2.5 rounded-2xl border-2 border-border bg-surface p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="min-w-0 font-extrabold">{l(entTopicById(tp).title)}</p>
                      <p className="shrink-0 text-sm font-extrabold text-danger">
                        {Math.round(ratioOf(result.byTopic[tp].points, result.byTopic[tp].max) * 100)}%
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <ButtonLink href={`/drill?mode=topic&topic=${tp}`} size="sm" variant="secondary" className="h-10">
                        <Dumbbell size={16} aria-hidden />
                        {t("exam.result.train")}
                      </ButtonLink>
                      <ButtonLink href={lessonFor(tp)} size="sm" variant="secondary" className="h-10">
                        <BookOpen size={16} aria-hidden />
                        {t("exam.result.lessons")}
                      </ButtonLink>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border-2 border-success/40 bg-success-soft p-3.5 font-bold text-success-strong">{t("exam.result.noWeak")}</p>
            )}
          </section>

          {/* Разбор заданий */}
          <section>
            <SectionTitle>{t("exam.review.title")}</SectionTitle>
            <div className="mb-3 flex gap-2">
              {([false, true] as const).map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  aria-pressed={onlyWrong === v}
                  onClick={() => setOnlyWrong(v)}
                  className={cn(
                    "h-10 rounded-full border-2 px-3.5 text-sm font-extrabold",
                    onlyWrong === v ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface hover:bg-surface-2",
                  )}
                >
                  {v ? t("exam.review.onlyWrong", { n: mistakeCount }) : t("exam.review.all", { n: rows.length })}
                </button>
              ))}
            </div>
            {shown.length === 0 ? (
              <p className="rounded-2xl border-2 border-success/40 bg-success-soft p-3.5 font-bold text-success-strong">{t("exam.review.none")}</p>
            ) : (
              <ReviewList rows={shown} answers={attempt.answers} open={open} onToggle={toggle} />
            )}
          </section>
        </>
      )}

      <div className="flex flex-col gap-2">
        <ButtonLink href="/exam" variant="secondary" block icon={<RotateCcw size={18} aria-hidden />}>
          {t("exam.result.again")}
        </ButtonLink>
        <Link href={unitDef ? `/learn#unit-${unitDef.id}` : "/learn"} className="flex items-center justify-center gap-1.5 py-2 font-extrabold text-primary">
          {t("exam.result.toLearn")} <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

"use client";

import { Check, Heart, Minus, Target, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnswerRecord, EntTopicId, QuestionStep } from "@/lib/types";
import type { QuizSummary } from "@/lib/chats";
import { evaluate, isReady, type Answer, type StepResult } from "@/lib/evaluate";
import { activeMs } from "@/lib/active-clock";
import { xpForAnswer } from "@/lib/gamification";
import { feedback as giveFeedback } from "@/lib/feedback";
import { decaySkills } from "@/lib/mastery";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/cn";
import {
  answerRecord,
  buildQuiz,
  nextCombo,
  normalizeQuizCount,
  QUIZ_COUNTS,
  quizSession,
  quizSummary,
  wrongReasonText,
  type QuizCount,
} from "@/lib/chat-quiz";
import { entTopicById } from "@/content/ent-topics";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { InlineMarkdown } from "@/components/Markdown";
import { Mascot } from "@/components/mascot/Mascot";
import { SceneView } from "@/components/scenes/SceneView";
import { QuizStepView } from "./QuizStepView";

export interface ChatQuizProps {
  /** Тема ЕНТ; нет — задания по пройденным урокам (как умная тренировка). */
  topic?: EntTopicId;
  /** Сколько заданий (5 или 10). Не задано — сначала спрашиваем. */
  count?: number;
  /** Итог: оценка, ошибки — чат сохранит карточку итога. */
  onDone: (summary: QuizSummary) => void;
  onCancel?: () => void;
}

type Phase = "answering" | "feedback" | "done";

/** Цвета панели ответа (токены, работают и в тёмной теме). */
const TONE_PANEL = {
  success: "border-success/30 bg-success-soft",
  danger: "border-danger/30 bg-danger-soft",
  warning: "border-warning/30 bg-warning-soft",
} as const;
const TONE_ICON = { success: "bg-success", danger: "bg-danger", warning: "bg-warning" } as const;
const PRAISE = ["fb.correct.1", "fb.correct.2", "fb.correct.3", "fb.correct.4"] as const;

/** Свежий набор заданий: освоение и пройденные уроки берём из прогресса ученика. */
function makeSteps(topic: EntTopicId | undefined, count: number): QuestionStep[] {
  const s = useApp.getState();
  const now = Date.now();
  // Выбор заданий — по освоению с затуханием (#45, #80): давние и слабые выпадают чаще.
  return buildQuiz({ topic, count, lessons: s.lessons, stats: decaySkills(s.skills, now), seed: now });
}

/**
 * «Дай задачи» прямо в ленте чата: карточка с заданием, проверка кодом (без ИИ), объяснение задания.
 * Ответы идут в прогресс (XP, освоение, ошибки), по завершении — тренировка в истории и итог через onDone.
 */
export function ChatQuiz({ topic, count, onDone, onCancel }: ChatQuizProps) {
  const { t, l, lang } = useT();
  const recordAnswer = useApp((s) => s.recordAnswer);
  const noteCombo = useApp((s) => s.noteCombo);
  const finishSession = useApp((s) => s.finishSession);

  const [steps, setSteps] = useState<QuestionStep[] | null>(() => (count ? makeSteps(topic, normalizeQuizCount(count)) : null));
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [phase, setPhase] = useState<Phase>("answering");
  const [result, setResult] = useState<StepResult | null>(null);
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [xp, setXp] = useState(0);
  const [gain, setGain] = useState(0);
  const [praise, setPraise] = useState(0);
  const [outcome, setOutcome] = useState<{ bonusXp: number; heart: boolean } | null>(null);
  const stepStartedAt = useRef(0);
  const finished = useRef(false);

  // Отсчёт времени первого задания — с момента, когда набор заданий готов. Время активное (#68), как в уроке: вкладка в фоне не считается.
  const ready0 = !!steps;
  useEffect(() => {
    stepStartedAt.current = activeMs();
  }, [ready0]);

  const step = steps?.[idx];
  const total = steps?.length ?? 0;
  const topicTitle = topic ? l(entTopicById(topic).short) : null;

  const start = (n: QuizCount) => setSteps(makeSteps(topic, n));

  const check = useCallback(
    (a: Answer | null = answer) => {
      if (!step || !a || phase !== "answering" || !isReady(step, a)) return;
      const res = evaluate(step, a, lang);
      const newCombo = nextCombo(combo, res.correct);
      const gained = xpForAnswer(res.correct, false, newCombo);
      const rec = answerRecord(step, res, lang, Math.max(0, activeMs() - stepStartedAt.current));
      recordAnswer(rec, gained);
      noteCombo(newCombo);
      setRecords((r) => [...r, rec]);
      setCombo(newCombo);
      setMaxCombo((m) => Math.max(m, newCombo));
      setXp((x) => x + gained);
      setGain(gained);
      setResult(res);
      setPhase("feedback");
      setPraise(Math.floor(Math.random() * PRAISE.length));
      if (res.correct) giveFeedback(newCombo >= 3 ? "combo" : "correct", { combo: newCombo });
      else giveFeedback("wrong");
    },
    [answer, step, phase, lang, combo, recordAnswer, noteCombo],
  );

  const onAnswer = useCallback(
    (a: Answer | null, opts?: { submit?: boolean }) => {
      setAnswer(a);
      if (opts?.submit) check(a);
    },
    [check],
  );

  const next = () => {
    if (!steps) return;
    if (idx + 1 < steps.length) {
      setIdx(idx + 1);
      setAnswer(null);
      setResult(null);
      setPhase("answering");
      stepStartedAt.current = activeMs();
      return;
    }
    if (finished.current) return;
    finished.current = true;
    const durationSec = records.reduce((s, r) => s + r.timeMs, 0) / 1000;
    const session = quizSession(records, xp, maxCombo, durationSec, t("quiz.title"));
    const out = finishSession(session);
    giveFeedback("complete");
    setOutcome(out);
    setPhase("done");
    onDone(quizSummary(records, topic));
  };

  const whyWrong = useMemo(
    () => (phase === "feedback" && step && result && !result.correct ? wrongReasonText(step, answer, lang) : null),
    [phase, step, result, answer, lang],
  );

  const cancelButton = onCancel && (
    <button
      type="button"
      onClick={onCancel}
      aria-label={t("quiz.cancel")}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2"
    >
      <X size={20} />
    </button>
  );

  // Выбор числа заданий.
  if (!steps) {
    return (
      <section className="flex flex-col gap-3 rounded-3xl border-2 border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold">{t("quiz.setup.title")}</h3>
            <p className="mt-0.5 text-sm font-semibold text-muted">{topicTitle ? t("quiz.setup.byTopic") : t("quiz.setup.smart")}</p>
          </div>
          {cancelButton}
        </div>
        {topicTitle && (
          <Pill tone="primary" className="self-start" icon={<Target size={14} />}>
            {topicTitle}
          </Pill>
        )}
        <div className="grid grid-cols-2 gap-3">
          {QUIZ_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => start(n)}
              className="flex flex-col items-center gap-0.5 rounded-2xl border-2 border-border bg-surface px-3 py-4 shadow-[0_3px_0_var(--border)] hover:bg-surface-2 active:translate-y-[2px] active:shadow-none"
            >
              <span className="text-3xl font-extrabold tabular-nums text-primary">{n}</span>
              <span className="text-sm font-extrabold">{t("quiz.count")}</span>
              <span className="text-xs font-semibold text-muted">{t(n === 5 ? "quiz.count.5" : "quiz.count.10")}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (!steps.length) {
    return (
      <section className="flex flex-col gap-3 rounded-3xl border-2 border-border bg-surface p-4">
        <p className="font-bold">{t("quiz.empty")}</p>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            {t("common.close")}
          </Button>
        )}
      </section>
    );
  }

  const segments = (
    <div className="flex flex-1 gap-1" role="list">
      {steps.map((s, i) => {
        const rec = records[i];
        const label = rec ? (rec.correct ? t("quiz.dot.ok") : rec.score > 0 ? t("quiz.dot.partial") : t("quiz.dot.bad")) : t("quiz.dot.todo");
        return (
          <span
            key={s.id}
            role="listitem"
            aria-label={label}
            title={label}
            className={cn(
              "h-2.5 min-w-0 flex-1 rounded-full",
              rec ? (rec.correct ? "bg-success" : rec.score > 0 ? "bg-warning" : "bg-danger") : "bg-surface-2",
              !rec && i === idx && phase !== "done" && "bg-primary/40",
            )}
          />
        );
      })}
    </div>
  );

  if (phase === "done") {
    return (
      <section className="flex flex-col gap-3 rounded-3xl border-2 border-border bg-surface p-4">
        {segments}
        <div className="flex items-center gap-3">
          <Mascot mood="happy" size={52} className="shrink-0" />
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold">{t("quiz.done.title")}</h3>
            <p className="text-sm font-semibold text-muted">{t("quiz.done.text")}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <Pill tone="gold">+{xp + (outcome?.bonusXp ?? 0)} XP</Pill>
              {outcome?.heart && (
                <span className="inline-flex items-center gap-1 rounded-full bg-heart-soft px-2.5 py-0.5 text-xs font-extrabold text-heart-strong">
                  <Heart size={14} fill="currentColor" aria-hidden />
                  {t("quiz.done.heart")}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!step) return null;
  const tone = result ? (result.correct ? "success" : result.score > 0 ? "warning" : "danger") : null;
  const ready = isReady(step, answer);
  const last = idx + 1 >= total;

  return (
    <section className="flex flex-col gap-4 rounded-3xl border-2 border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-sm font-extrabold tabular-nums text-muted">{t("quiz.progress", { n: idx + 1, total })}</span>
        {segments}
        {cancelButton}
      </div>

      {topicTitle && (
        <Pill tone="primary" className="self-start" icon={<Target size={14} />}>
          {topicTitle}
        </Pill>
      )}

      <h3 className="text-lg font-extrabold leading-snug">
        <InlineMarkdown>{l(step.prompt)}</InlineMarkdown>
      </h3>
      {step.scene && <SceneView scene={step.scene} />}

      <QuizStepView key={step.id} step={step} answer={answer} onAnswer={onAnswer} locked={phase !== "answering"} result={result} />

      {phase === "feedback" && result && step.reveal && <SceneView scene={step.reveal} />}

      {phase === "feedback" && result && tone && (
        <div role="status" className={cn("flex flex-col gap-1.5 rounded-2xl border-2 p-3", TONE_PANEL[tone])}>
          <p
            className={cn(
              "flex flex-wrap items-center gap-2 text-lg font-extrabold",
              tone === "success" && "text-success-strong",
              tone === "danger" && "text-danger",
              tone === "warning" && "text-warning-strong",
            )}
          >
            <span aria-hidden className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-white", TONE_ICON[tone])}>
              {result.correct ? <Check size={16} strokeWidth={3.5} /> : result.score > 0 ? <Minus size={16} strokeWidth={3.5} /> : <X size={16} strokeWidth={3.5} />}
            </span>
            {result.correct ? t(PRAISE[praise]) : result.score > 0 ? t("fb.partial") : t("fb.wrong")}
            {gain > 0 && <span className="text-sm text-warning-strong">+{gain} XP</span>}
          </p>
          {!result.correct && (
            <>
              {step.type !== "match" && step.type !== "cloze" && (
                <p className="font-bold">
                  {t("fb.correctAnswer")} <span className="font-mono">{result.expected}</span>
                </p>
              )}
              {whyWrong && (
                <p className="text-[15px] font-extrabold">
                  <InlineMarkdown>{whyWrong}</InlineMarkdown>
                </p>
              )}
              <p className="text-[15px] font-semibold opacity-90">
                <InlineMarkdown>{l(step.explanation)}</InlineMarkdown>
              </p>
            </>
          )}
        </div>
      )}

      {phase === "answering" ? (
        <Button block disabled={!ready} onClick={() => check()}>
          {t("common.check")}
        </Button>
      ) : (
        <Button block variant={result?.correct ? "success" : "primary"} onClick={next}>
          {last ? t("quiz.finish") : t("common.next")}
        </Button>
      )}
    </section>
  );
}

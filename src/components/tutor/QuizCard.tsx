"use client";

import { Check, CircleAlert, ListChecks, RotateCcw, Sparkles, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { useChats } from "@/lib/chat-store";
import {
  answerQuiz,
  checkQuizAnswer,
  explainMistakeText,
  LEVEL_LETTER,
  quizGrade,
  quizReady,
  quizSteps,
  scoreQuiz,
  streakBefore,
  type ChatQuiz,
  type QuizAnswer,
  type QuizSource,
  type QuizStep,
} from "@/lib/chat-quiz";
import { promptText, type Answer, type StepResult } from "@/lib/evaluate";
import { xpForAnswer } from "@/lib/gamification";
import { feedback } from "@/lib/feedback";
import type { AnswerRecord } from "@/lib/types";
import { useT } from "@/i18n/useT";
import { InlineMarkdown } from "@/components/Markdown";
import { SceneView } from "@/components/scenes/SceneView";
import { ChoiceView, MultiView } from "@/components/lesson/steps/ChoiceView";
import { InputView } from "@/components/lesson/steps/InputView";
import { Button } from "@/components/ui/Button";

/** Карточка задания: условие, схема и ответ теми же компонентами, что в уроке. */
function StepBody({
  step,
  answer,
  onAnswer,
  locked,
  result,
}: {
  step: QuizStep;
  answer: Answer | null;
  onAnswer: (a: Answer | null) => void;
  locked: boolean;
  result: StepResult | null;
}) {
  const { l } = useT();
  const props = { answer, onAnswer, locked, result };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-base font-extrabold leading-snug">
        <InlineMarkdown>{l(step.prompt)}</InlineMarkdown>
      </p>
      {step.scene && <SceneView scene={step.scene} />}
      {step.type === "choice" && <ChoiceView {...props} step={step} />}
      {step.type === "multi" && <MultiView {...props} step={step} />}
      {step.type === "input" && <InputView {...props} step={step} />}
    </div>
  );
}

const asQuizAnswer = (a: Answer | null): QuizAnswer | null => (a && (a.type === "choice" || a.type === "multi" || a.type === "input") ? a : null);

/** «Дай задачи» в ленте чата: 5 заданий по очереди, проверка кодом, итог с разбором ошибок. */
export function QuizCard({
  chatId,
  msgId,
  quiz,
  topicTitle,
  onExplain,
  onAgain,
  aiBusy,
}: {
  chatId: string;
  msgId: string;
  quiz: ChatQuiz;
  topicTitle: string;
  onExplain: (text: string) => void;
  onAgain: (source: QuizSource, level: ChatQuiz["level"]) => void;
  aiBusy: boolean;
}) {
  const { t, l, lang } = useT();
  const recordAnswer = useApp((s) => s.recordAnswer);
  const answerInStore = useChats((s) => s.answerQuiz);
  const { skills, level, seed, ids } = quiz;
  const steps = useMemo(() => quizSteps({ skills, level, seed, ids }), [skills, level, seed, ids]);
  const [draft, setDraft] = useState<QuizAnswer | null>(null);
  // Только что проверенное задание: показываем отклик до «Дальше».
  const [shown, setShown] = useState<{ index: number; result: StepResult; xp: number } | null>(null);
  const startedAt = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const header = (
    <div className="flex items-center gap-2">
      <ListChecks size={18} className="shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{t("chats.quiz.header", { topic: topicTitle })}</span>
      <span className="shrink-0 rounded-lg bg-surface-2 px-2 py-0.5 text-xs font-extrabold text-muted">{t("chats.quiz.levelBadge", { level: LEVEL_LETTER[level] })}</span>
    </div>
  );
  const frame = "w-full max-w-[34rem] self-start rounded-2xl border-2 border-primary/25 bg-surface p-3.5 sm:p-4";

  if (!steps) {
    return (
      <div className={frame}>
        {header}
        <p className="mt-2 text-sm font-semibold text-muted">{t("chats.quiz.stale")}</p>
      </div>
    );
  }

  const score = scoreQuiz(steps, quiz.answers, lang);
  const current = quiz.answers.findIndex((a) => !a);

  const check = () => {
    if (current < 0 || !quizReady(steps[current], draft) || !draft) return;
    const step = steps[current];
    const res = checkQuizAnswer(step, draft, lang);
    const combo = res.correct ? streakBefore(steps, quiz.answers, current, lang) + 1 : 0;
    const xp = xpForAnswer(res.correct, false, combo);
    const rec: AnswerRecord = {
      stepId: step.id,
      skill: step.skill,
      correct: res.correct,
      score: res.score,
      given: res.given,
      expected: res.expected,
      prompt: promptText(step, lang),
      retry: false,
      timeMs: startedAt.current ? Date.now() - startedAt.current : 0,
    };
    recordAnswer(rec, xp);
    answerInStore(chatId, msgId, answerQuiz(quiz, current, draft));
    feedback(res.correct ? (combo >= 3 ? "combo" : "correct") : "wrong", { combo });
    setShown({ index: current, result: res, xp });
    setDraft(null);
    startedAt.current = 0;
    // Кнопка «Проверить» исчезает — переводим фокус на «Дальше», чтобы не терять место с клавиатуры.
    requestAnimationFrame(() => cardRef.current?.querySelector<HTMLElement>("[data-quiz-next]")?.focus({ preventScroll: true }));
  };

  const progress = (
    <div className="flex gap-1" role="img" aria-label={t("chats.quiz.progress", { n: score.answered, total: score.total })}>
      {steps.map((s, i) => {
        const a = quiz.answers[i];
        const r = a ? checkQuizAnswer(s, a, lang) : null;
        return (
          <span
            key={s.id}
            className={cn("h-1.5 flex-1 rounded-full", !r ? "bg-surface-2" : r.correct ? "bg-success" : r.partial ? "bg-warning" : "bg-danger")}
          />
        );
      })}
    </div>
  );

  // Отклик на только что проверенное задание.
  if (shown) {
    const step = steps[shown.index];
    const a = quiz.answers[shown.index];
    const r = shown.result;
    const last = current < 0;
    return (
      <div className={frame} ref={cardRef}>
        <div className="flex flex-col gap-3">
          {header}
          {progress}
          <StepBody step={step} answer={a} onAnswer={() => {}} locked result={r} />
          <div
            className={cn(
              "flex flex-col gap-1.5 rounded-xl px-3 py-2.5",
              r.correct ? "bg-success-soft" : r.partial ? "bg-warning-soft" : "bg-danger-soft",
            )}
            role="status"
          >
            <p className={cn("flex items-center gap-1.5 font-extrabold", r.correct ? "text-success" : r.partial ? "text-warning" : "text-danger")}>
              {r.correct ? <Check size={18} /> : r.partial ? <CircleAlert size={18} /> : <X size={18} />}
              {r.correct ? t("chats.quiz.correct") : r.partial ? t("chats.quiz.partial") : t("chats.quiz.wrong")}
              {shown.xp > 0 && <span className="ml-auto text-sm text-gold">{t("chats.quiz.xp", { xp: shown.xp })}</span>}
            </p>
            {!r.correct && (
              <p className="text-sm font-semibold">
                {t("chats.quiz.rightAnswer")}: <span className="font-extrabold">{r.expected}</span>
              </p>
            )}
          </div>
          <Button onClick={() => setShown(null)} block data-quiz-next>
            {last ? t("chats.quiz.finish") : t("chats.quiz.next")}
          </Button>
        </div>
      </div>
    );
  }

  // Итог набора.
  if (current < 0) {
    const grade = quizGrade(score.correct, score.total);
    const tone = grade === "excellent" || grade === "good" ? "text-success" : grade === "ok" ? "text-warning" : "text-danger";
    return (
      <div className={frame}>
        <div className="flex flex-col gap-3">
          {header}
          {progress}
          <p className={cn("text-lg font-extrabold", tone)}>
            {t("chats.quiz.result", { n: score.correct, total: score.total, grade: t(`chats.quiz.grade.${grade}`) })}
          </p>
          {score.mistakes.length === 0 ? (
            <p className="text-sm font-semibold text-muted">{t("chats.quiz.allRight")}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{t("chats.quiz.mistakes")}</p>
              {score.mistakes.map((m) => (
                <div key={m.step.id} className="flex flex-col gap-1.5 rounded-xl border-2 border-border p-3">
                  <p className="line-clamp-3 text-sm font-bold">
                    <span className="text-muted">{m.index + 1}. </span>
                    <InlineMarkdown>{l(m.step.prompt)}</InlineMarkdown>
                  </p>
                  <p className="text-sm font-semibold">
                    {t("chats.quiz.yourAnswer")}: <span className={cn("font-extrabold", m.result.partial ? "text-warning" : "text-danger")}>{m.result.given || "—"}</span>
                  </p>
                  <p className="text-sm font-semibold">
                    {t("chats.quiz.rightAnswer")}: <span className="font-extrabold text-success">{m.result.expected}</span>
                  </p>
                  {m.whyWrong && (
                    <p className="text-sm text-muted">
                      <InlineMarkdown>{m.whyWrong}</InlineMarkdown>
                    </p>
                  )}
                  <p className="text-sm">
                    <InlineMarkdown>{m.explanation}</InlineMarkdown>
                  </p>
                  <button
                    type="button"
                    disabled={aiBusy}
                    onClick={() => onExplain(explainMistakeText(m.step, m.result, lang))}
                    className="flex min-h-11 items-center gap-1.5 self-start rounded-xl bg-ai-soft px-3 text-sm font-extrabold text-ai hover:brightness-95 disabled:opacity-50"
                  >
                    <Sparkles size={16} /> {t("chats.quiz.explain")}
                  </button>
                </div>
              ))}
            </div>
          )}
          <Button variant="secondary" icon={<RotateCcw size={16} />} onClick={() => onAgain(quiz.source, quiz.level)}>
            {t("chats.quiz.again")}
          </Button>
        </div>
      </div>
    );
  }

  // Текущее задание.
  const step = steps[current];
  return (
    <div className={frame} ref={cardRef}>
      <div
        className="flex flex-col gap-3"
        onKeyDown={(e) => {
          // Enter в поле ответа — «Проверить».
          if (e.key === "Enter" && e.target instanceof HTMLInputElement && quizReady(step, draft)) {
            e.preventDefault();
            check();
          }
        }}
      >
        {header}
        {progress}
        <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
          {t("chats.quiz.task", { n: current + 1, total: steps.length })}
        </p>
        <StepBody
          key={step.id}
          step={step}
          answer={draft}
          onAnswer={(a) => {
            if (!startedAt.current) startedAt.current = Date.now();
            setDraft(asQuizAnswer(a));
          }}
          locked={false}
          result={null}
        />
        <Button onClick={check} disabled={!quizReady(step, draft)} block>
          {t("chats.quiz.check")}
        </Button>
      </div>
    </div>
  );
}

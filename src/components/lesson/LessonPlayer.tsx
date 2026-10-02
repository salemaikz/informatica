"use client";

import clsx from "clsx";
import { BookOpen, Clapperboard, Flame, Lightbulb, RotateCcw, Sparkles, Target, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnswerRecord, QuestionStep, SessionResult, Step } from "@/lib/types";
import type { TaskContext } from "@/lib/ai-types";
import { evaluate, expectedText, isQuestion, isReady, promptText, type Answer, type StepResult } from "@/lib/evaluate";
import { xpForAnswer } from "@/lib/gamification";
import { useApp } from "@/lib/store";
import { playSound } from "@/lib/sound";
import { checkSolution } from "@/lib/ai";
import { buildStudentContext } from "@/lib/student-context";
import { plain, tx } from "@/lib/text";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Pill } from "@/components/ui/Pill";
import { Markdown } from "@/components/Markdown";
import { Mascot } from "@/components/mascot/Mascot";
import { AiPanel } from "@/components/ai/AiPanel";
import { Visual } from "@/components/visuals/Visuals";
import { LessonVideo } from "@/videos/LessonVideo";
import { ChoiceView, MultiView } from "./steps/ChoiceView";
import { InputView } from "./steps/InputView";
import { BitsView } from "./steps/BitsView";
import { LadderView } from "./steps/LadderView";
import { MatchView } from "./steps/MatchView";
import { OrderView } from "./steps/OrderView";
import { SolutionView } from "./steps/SolutionView";
import type { StepProps } from "./steps/types";
import { Results, requestLessonFeedback, type FeedbackState } from "./Results";

interface QueueItem {
  step: Step;
  retry: boolean;
  key: string;
}

export interface PlayerProps {
  kind: "lesson" | "drill";
  lessonId?: string;
  title: string;
  steps: Step[];
  /** Для работы над ошибками: id шага → id задания-ошибки, которую закрыть при верном ответе. */
  mistakeMap?: Record<string, string>;
}

const PRAISE: DictKey[] = ["fb.correct.1", "fb.correct.2", "fb.correct.3", "fb.correct.4"];

function QuestionView(props: StepProps<QuestionStep>) {
  const { step } = props;
  switch (step.type) {
    case "choice":
      return <ChoiceView {...props} step={step} />;
    case "multi":
      return <MultiView {...props} step={step} />;
    case "input":
      return <InputView {...props} step={step} />;
    case "bits":
      return <BitsView {...props} step={step} />;
    case "ladder":
      return <LadderView {...props} step={step} />;
    case "match":
      return <MatchView {...props} step={step} />;
    case "order":
      return <OrderView {...props} step={step} />;
    case "solution":
      return <SolutionView {...props} step={step} />;
  }
}

export function LessonPlayer({ kind, lessonId, title, steps, mistakeMap }: PlayerProps) {
  const router = useRouter();
  const { t, l, lang } = useT();
  const sound = useApp((s) => s.profile.sound);
  const recordAnswer = useApp((s) => s.recordAnswer);
  const noteCombo = useApp((s) => s.noteCombo);
  const finishSession = useApp((s) => s.finishSession);
  const dismissMistake = useApp((s) => s.dismissMistake);

  const total = steps.length;
  const [queue, setQueue] = useState<QueueItem[]>(() => steps.map((s) => ({ step: s, retry: false, key: s.id })));
  const [pos, setPos] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [phase, setPhase] = useState<"answering" | "checking" | "feedback">("answering");
  const [result, setResult] = useState<StepResult | null>(null);
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  const [done, setDone] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [xp, setXp] = useState(0);
  const [gain, setGain] = useState(0);
  const [praise, setPraise] = useState<DictKey>(PRAISE[0]);
  const [checkError, setCheckError] = useState<DictKey | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [ai, setAi] = useState<"hint" | "explain" | null>(null);
  const [session, setSession] = useState<{ result: SessionResult; bonusXp: number; achievements: string[] } | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>({ status: "loading" });
  const startedAt = useRef(0);
  const skippedRef = useRef(0);
  const stepStartedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
    stepStartedAt.current = Date.now();
  }, []);

  const item = queue[pos];
  const step = item?.step;
  const question = step && isQuestion(step) ? step : null;
  const noteKey = lessonId ?? "general";

  const finish = useCallback(
    (finalRecords: AnswerRecord[], finalXp: number, finalMaxCombo: number) => {
      const firstTries = finalRecords.filter((r) => !r.retry);
      const accuracy = firstTries.length ? firstTries.reduce((a, r) => a + r.score, 0) / firstTries.length : 1;
      const result: SessionResult = {
        kind,
        lessonId,
        title,
        answers: finalRecords,
        xp: finalXp,
        maxCombo: finalMaxCombo,
        durationSec: Math.round((Date.now() - startedAt.current) / 1000),
        accuracy,
        skipped: skippedRef.current,
      };
      const { bonusXp } = finishSession(result);
      const achievements = useApp.getState().consumeNewAchievements();
      if (sound) playSound("complete");
      setSession({ result, bonusXp, achievements });
      requestLessonFeedback(result, setFeedback);
    },
    [finishSession, kind, lessonId, sound, title],
  );

  const next = useCallback(() => {
    const isTheory = step && !isQuestion(step);
    const doneNow = isTheory ? done + 1 : done;
    if (isTheory) setDone(doneNow);
    if (pos + 1 >= queue.length) {
      finish(records, xp, maxCombo);
      return;
    }
    setPos(pos + 1);
    setAnswer(null);
    setResult(null);
    setCheckError(null);
    setAiNote(null);
    setPhase("answering");
    stepStartedAt.current = Date.now();
    window.scrollTo({ top: 0 });
  }, [step, done, pos, queue.length, finish, records, xp, maxCombo]);

  const apply = useCallback(
    (res: StepResult) => {
      if (!question) return;
      const newCombo = res.correct ? combo + 1 : 0;
      const gained = xpForAnswer(res.correct, item.retry, newCombo);
      const rec: AnswerRecord = {
        stepId: question.id,
        skill: question.skill,
        correct: res.correct,
        score: res.score,
        given: res.given,
        expected: res.expected,
        prompt: promptText(question, lang),
        retry: item.retry,
        timeMs: Date.now() - stepStartedAt.current,
      };
      recordAnswer(rec, gained, lessonId);
      if (res.correct && mistakeMap?.[question.id]) dismissMistake(mistakeMap[question.id]);
      noteCombo(newCombo);
      setRecords((r) => [...r, rec]);
      setCombo(newCombo);
      setMaxCombo((m) => Math.max(m, newCombo));
      setXp((x) => x + gained);
      setGain(gained);
      setResult(res);
      setPhase("feedback");
      setPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)]);
      if (res.correct || item.retry) setDone((d) => d + 1);
      // Ошибку повторяем один раз в конце («работа над ошибками»). Развёрнутые решения не повторяем — это дорого.
      if (!res.correct && !item.retry && question.type !== "solution") {
        setQueue((q) => [...q, { step: question, retry: true, key: `${question.id}:retry` }]);
      } else if (!res.correct && question.type === "solution") {
        setDone((d) => d + 1);
      }
      if (sound) playSound(res.correct ? "correct" : "wrong");
    },
    [question, combo, item, lang, recordAnswer, lessonId, mistakeMap, dismissMistake, noteCombo, sound],
  );

  const check = useCallback(
    async (a: Answer | null = answer) => {
      if (!question || !a || !isReady(question, a) || phase !== "answering") return;
      if (question.type === "solution" && a.type === "solution" && a.image) {
        setPhase("checking");
        setCheckError(null);
        setAiNote(null);
        const app = useApp.getState();
        if (!app.spendAi()) {
          // Лимит исчерпан: проверяем хотя бы введённый ответ, иначе просим ввести его.
          if (a.typed.trim()) apply(evaluate(question, a, lang));
          else {
            setPhase("answering");
            setCheckError("tutor.limit");
          }
          return;
        }
        try {
          const details = await checkSolution({
            lang,
            context: buildStudentContext(app),
            task: { prompt: tx(question.prompt, lang), reference: tx(question.reference, lang), answer: question.answer },
            typedAnswer: a.typed.trim() || undefined,
            image: a.image,
          });
          useApp.getState().unlock("solver");
          if (details.verdict === "unreadable") {
            // Не засчитываем как ошибку — просим переснять/переписать.
            setPhase("answering");
            setAiNote(details.feedback || t("sol.unreadable"));
            return;
          }
          apply({
            correct: details.verdict === "correct",
            score: details.verdict === "correct" ? 1 : details.verdict === "partial" ? 0.5 : 0,
            given: a.typed.trim() || t("sol.photoGiven"),
            expected: expectedText(question, lang),
            details,
          });
        } catch {
          useApp.getState().refundAi();
          if (a.typed.trim()) {
            apply(evaluate(question, a, lang));
          } else {
            setPhase("answering");
            setCheckError("tutor.error");
          }
        }
        return;
      }
      const res = evaluate(question, a, lang);
      apply(question.type === "solution" ? { ...res, offline: false } : res);
    },
    [answer, question, phase, lang, apply, t],
  );

  const onAnswer = useCallback(
    (a: Answer | null, opts?: { submit?: boolean }) => {
      setAnswer(a);
      if (opts?.submit) void check(a);
    },
    [check],
  );

  const skip = () => {
    if (!question) return;
    skippedRef.current += 1;
    setDone((d) => d + 1);
    next();
  };

  // Enter — проверить / продолжить.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.repeat || exitOpen || ai || session) return;
      const el = e.target as HTMLElement | null;
      if (el instanceof HTMLTextAreaElement) return;
      if (el instanceof HTMLInputElement && el.closest("[role=dialog]")) return;
      // Кнопки вне области задания (крестик, нижняя панель) обрабатывают Enter сами — без двойного срабатывания.
      // Внутри задания Enter = «Проверить», а вариант выбирается пробелом или кликом.
      if (el && (el.tagName === "BUTTON" || el.tagName === "A") && !el.closest("main")) return;
      e.preventDefault();
      if (phase === "feedback" || (step && !isQuestion(step))) next();
      else void check();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, step, next, check, exitOpen, ai, session]);

  const taskCtx = useMemo<TaskContext | null>(() => {
    if (!question) return null;
    return {
      prompt: promptText(question, lang),
      options: question.type === "choice" || question.type === "multi" ? question.options.map((o) => tx(o, lang)) : undefined,
      correct: expectedText(question, lang),
      given: result?.given,
      explanation: plain(tx(question.explanation, lang)),
    };
  }, [question, lang, result]);

  if (session) {
    return (
      <Results
        kind={kind}
        lessonId={lessonId}
        title={title}
        result={session.result}
        bonusXp={session.bonusXp}
        achievements={session.achievements}
        feedback={feedback}
      />
    );
  }
  if (!item || !step) return null;

  const progress = done / total;
  const ready = question ? isReady(question, answer) : true;
  const tone = result ? (result.correct ? "success" : result.score > 0 ? "warning" : "danger") : null;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Верхняя панель */}
      <header className="sticky top-0 z-20 bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => setExitOpen(true)}
            aria-label={t("lesson.exit")}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2"
          >
            <X size={24} />
          </button>
          <ProgressBar value={progress} className="flex-1" label={title} />
          <div
            className={clsx(
              "flex min-w-14 items-center justify-end gap-1 font-extrabold transition-all",
              combo >= 2 ? "text-streak" : "text-muted",
            )}
            title={t("res.combo")}
          >
            <Flame size={20} className={combo >= 3 ? "animate-pulse" : ""} fill={combo >= 2 ? "currentColor" : "none"} />
            {combo}
          </div>
        </div>
      </header>

      {/* Контент шага */}
      <main key={item.key} className="mx-auto w-full max-w-2xl flex-1 px-4 pb-48 pt-2 animate-fade-in">
        {item.retry && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-warning-soft px-3 py-2 text-sm font-bold text-warning-strong">
            <RotateCcw size={16} className="shrink-0" /> {t("lesson.review")} · {t("lesson.reviewHint")}
          </div>
        )}

        {step.type === "video" && (
          <div className="flex flex-col gap-4">
            <Pill tone="primary" className="self-start" icon={<Clapperboard size={14} />}>
              {t("lesson.video")}
            </Pill>
            <h1 className="text-2xl font-extrabold">{l(step.title)}</h1>
            <LessonVideo videoId={step.videoId} lang={lang} title={l(step.title)} />
          </div>
        )}

        {step.type === "theory" && (
          <div className="flex flex-col gap-4">
            <Pill tone="primary" className="self-start" icon={<BookOpen size={14} />}>
              {t("lesson.theory")}
            </Pill>
            <h1 className="text-2xl font-extrabold">{l(step.title)}</h1>
            {step.visual && <Visual id={step.visual} />}
            <Markdown className="text-[17px]">{l(step.body)}</Markdown>
          </div>
        )}

        {question && (
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {question.ent && (
                  <Pill tone="gold" icon={<Target size={14} />}>
                    {t("lesson.ent")}
                  </Pill>
                )}
              </div>
              {phase === "answering" && (
                <button
                  type="button"
                  onClick={() => setAi("hint")}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl bg-ai-soft px-3 py-1.5 text-sm font-extrabold text-ai hover:brightness-95"
                >
                  <Lightbulb size={16} /> {t("lesson.hint")}
                </button>
              )}
            </div>
            <h1 className="text-xl font-extrabold leading-snug sm:text-2xl">{l(question.prompt)}</h1>
            <QuestionView
              key={item.key}
              step={question}
              answer={answer}
              onAnswer={onAnswer}
              locked={phase !== "answering"}
              result={result}
            />
            {checkError && <p className="rounded-xl bg-danger-soft px-3 py-2 text-center text-sm font-bold text-danger">{t(checkError)}</p>}
            {aiNote && <p className="rounded-xl bg-warning-soft px-3 py-2 text-center text-sm font-bold text-warning-strong">{aiNote}</p>}
          </div>
        )}
      </main>

      {/* Нижняя панель: кнопка проверки или карточка обратной связи */}
      <footer
        className={clsx(
          "fixed inset-x-0 bottom-0 z-30 border-t-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4",
          tone === "success" && "border-success/30 bg-success-soft animate-slide-up",
          tone === "danger" && "border-danger/30 bg-danger-soft animate-slide-up",
          tone === "warning" && "border-warning/30 bg-warning-soft animate-slide-up",
          !tone && "border-border bg-bg",
        )}
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4">
          {phase === "feedback" && result && question && (
            <div className="flex items-start gap-3 animate-fade-in">
              <Mascot mood={result.correct ? "happy" : result.score > 0 ? "thinking" : "sad"} size={52} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p
                  className={clsx(
                    "text-xl font-extrabold",
                    tone === "success" && "text-success-strong",
                    tone === "danger" && "text-danger",
                    tone === "warning" && "text-warning-strong",
                  )}
                >
                  {result.correct ? t(praise) : result.score > 0 ? t("fb.partial") : t("fb.wrong")}
                  {gain > 0 && <span className="ml-2 text-base text-warning-strong">+{gain} XP</span>}
                </p>
                {!result.correct && (
                  <>
                    {question.type !== "match" && (
                      <p className="mt-1 font-bold">
                        {t("fb.correctAnswer")} <span className="font-mono">{result.expected}</span>
                      </p>
                    )}
                    <p className="mt-1 text-[15px] font-semibold opacity-90">{l(question.explanation)}</p>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            {phase === "feedback" && result && !result.correct && (
              <Button variant="ai" onClick={() => setAi("explain")} icon={<Sparkles size={18} />} className="shrink-0">
                <span className="hidden sm:inline">{t("fb.why")}</span>
                <span className="sm:hidden">{t("fb.ai.short")}</span>
              </Button>
            )}
            {phase === "answering" && question?.type === "solution" && (
              <Button variant="ghost" onClick={skip}>
                {t("common.skip")}
              </Button>
            )}
            <div className="flex-1" />
            {phase === "feedback" ? (
              <Button
                size="lg"
                className="w-full sm:w-56"
                variant={tone === "success" ? "success" : tone === "warning" ? "primary" : "danger"}
                onClick={next}
                autoFocus
              >
                {t("common.continue")}
              </Button>
            ) : question ? (
              <Button
                size="lg"
                className="w-full sm:w-56"
                variant={question.type === "solution" && answer?.type === "solution" && answer.image ? "ai" : "success"}
                disabled={!ready || phase === "checking"}
                onClick={() => void check()}
              >
                {phase === "checking"
                  ? t("sol.checking")
                  : question.type === "solution" && answer?.type === "solution" && answer.image
                    ? t("sol.checkAi")
                    : t("common.check")}
              </Button>
            ) : (
              <Button size="lg" className="w-full sm:w-56" onClick={next}>
                {t("common.continue")}
              </Button>
            )}
          </div>
        </div>
      </footer>

      <Modal open={exitOpen} onClose={() => setExitOpen(false)} label={t("lesson.exitTitle")}>
        <div className="flex flex-col items-center gap-3 text-center">
          <Mascot mood="sad" size={72} />
          <h3 className="text-xl font-extrabold">{t("lesson.exitTitle")}</h3>
          <p className="text-muted">{t("lesson.exitText")}</p>
          <div className="mt-2 flex w-full flex-col gap-3">
            <Button size="lg" block onClick={() => setExitOpen(false)}>
              {t("lesson.stay")}
            </Button>
            <Button variant="ghost" block onClick={() => router.push(kind === "lesson" ? "/learn" : "/practice")} className="text-danger">
              {t("lesson.exit")}
            </Button>
          </div>
        </div>
      </Modal>

      {ai && taskCtx && (
        <AiPanel key={`${item.key}:${ai}`} open onClose={() => setAi(null)} mode={ai} task={taskCtx} noteKey={noteKey} />
      )}
    </div>
  );
}

"use client";

import { Flame } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { InlineMarkdown } from "@/components/Markdown";
import { Mascot, type Mood } from "@/components/mascot/Mascot";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { OrderView } from "@/components/lesson/steps/OrderView";
import { Button } from "@/components/ui/Button";
import type { GameProps } from "@/games/types";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { evaluate, expectedText, isReady, type Answer, type StepResult } from "@/lib/evaluate";
import { feedback } from "@/lib/feedback";
import { fmt, tx } from "@/lib/text";
import {
  BLITZ_MS,
  applyResult,
  buildRound,
  initialState,
  resolveSkills,
  roundCount,
  taskBudgetMs,
  toResult,
  type BuildState,
  type BuildTask,
} from "./logic";
import { S } from "./strings";

type Phase = "answering" | "right" | "wrong" | "done";
interface Verdict {
  result: StepResult;
  timedOut: boolean;
  gained: number;
  bonus: number;
}

/** Блиц: сколько показываем верный порядок после проверки, мс. */
const BLITZ_RIGHT_MS = 900;
const BLITZ_WRONG_MS = 2600;
/** Пауза перед итогами по времени, мс. */
const END_DELAY = 1200;
/** Сообщение «нет разборов» висит столько, мс. */
const EMPTY_MS = 2600;

interface BuildProps extends GameProps {
  tasks: BuildTask[];
}

function BuildGame({ lang, mode, onFinish, tasks }: BuildProps) {
  const { t, l } = useT();
  const reduce = useReduceMotion();
  const total = roundCount(mode) === null ? tasks.length : Math.min(roundCount(mode) ?? 0, tasks.length);
  const [st, setSt] = useState<BuildState>(initialState);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [phase, setPhase] = useState<Phase>("answering");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [tick, setTick] = useState(mode === "blitz" ? BLITZ_MS : 0);
  const [announce, setAnnounce] = useState("");
  const [timeUp, setTimeUp] = useState(false);

  const phaseRef = useRef<Phase>("answering");
  const finishedRef = useRef(false);
  const remainRef = useRef(BLITZ_MS);
  const elapsedRef = useRef(0);
  const timersRef = useRef<Set<number>>(new Set());
  const apiRef = useRef<{ tick: (dt: number) => void; onKey: (e: KeyboardEvent) => void } | null>(null);

  const reviewRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const task = tasks[idx];
  const step = task.step;

  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
  };

  /** Ровно один вызов onFinish. */
  const finish = (state: BuildState, delay: number) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setSt(state);
    if (delay > 0) {
      setTimeUp(true);
      go("done");
      later(() => onFinish(toResult(state)), delay);
    } else onFinish(toResult(state));
  };

  const next = (state: BuildState) => {
    if (finishedRef.current || phaseRef.current === "answering") return;
    if (idx + 1 >= tasks.length) {
      finish(state, 0);
      return;
    }
    setIdx(idx + 1);
    setAnswer(null);
    setVerdict(null);
    setAnnounce("");
    elapsedRef.current = 0;
    setTick(mode === "blitz" ? Math.max(0, remainRef.current) : 0);
    go("answering");
  };

  /** Проверка (null — время на решение вышло). */
  const settle = (a: Answer | null, timedOut: boolean) => {
    if (phaseRef.current !== "answering" || finishedRef.current) return;
    const result: StepResult = a ? evaluate(step, a, lang) : { correct: false, score: 0, given: "", expected: expectedText(step, lang) };
    const out = applyResult(st, task, result.correct);
    setSt(out.state);
    setVerdict({ result, timedOut, gained: out.gained, bonus: out.bonus });
    feedback(result.correct ? "correct" : "wrong");
    setAnnounce(timedOut ? t("game.timeUp") : tx(result.correct ? S.announceRight : S.announceWrong, lang));
    go(result.correct ? "right" : "wrong");
    if (mode === "blitz") later(() => next(out.state), result.correct ? BLITZ_RIGHT_MS : BLITZ_WRONG_MS);
  };

  const onAnswer = (a: Answer | null) => {
    if (phaseRef.current === "answering") setAnswer(a);
  };
  const ready = isReady(step, answer);
  const check = () => {
    if (answer && ready) settle(answer, false);
  };

  // Свежие обработчики для таймера и клавиатуры (ref обновляется в layout-эффекте, не во время рендера).
  useLayoutEffect(() => {
    apiRef.current = {
      tick: (dt) => {
        if (finishedRef.current || document.visibilityState === "hidden") return;
        if (mode === "blitz") {
          remainRef.current -= dt;
          setTick(Math.max(0, remainRef.current));
          if (remainRef.current <= 0) finish(st, END_DELAY);
          return;
        }
        if (phaseRef.current !== "answering") return;
        elapsedRef.current += dt;
        setTick(elapsedRef.current);
        const budget = taskBudgetMs(mode, step.items.length);
        if (budget !== null && elapsedRef.current >= budget) settle(null, true);
      },
      onKey: (e) => {
        if (e.key !== "Enter" || e.repeat || e.ctrlKey || e.metaKey || e.altKey || finishedRef.current) return;
        const el = e.target as HTMLElement | null;
        if (el && el.tagName === "BUTTON") return;
        if (phaseRef.current === "answering" && answer && ready) {
          e.preventDefault();
          check();
        } else if ((phaseRef.current === "right" || phaseRef.current === "wrong") && mode !== "blitz") {
          e.preventDefault();
          next(st);
        }
      },
    };
  });

  useEffect(() => {
    const timers = timersRef.current;
    const id = mode === "calm" ? null : window.setInterval(() => apiRef.current?.tick(100), 100);
    return () => {
      if (id !== null) window.clearInterval(id);
      timers.forEach((x) => window.clearTimeout(x));
      timers.clear();
    };
  }, [mode]);

  // После проверки прокручиваем к разбору: верный порядок и итог лежат под длинной цепочкой шагов.
  useEffect(() => {
    if (phase === "right" || phase === "wrong") reviewRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, [phase, reduce]);

  // Новое решение: кнопка «Дальше» с фокусом исчезла — переносим фокус на заголовок (клавиатура и экранный диктор).
  useEffect(() => {
    if (idx > 0) titleRef.current?.focus({ preventScroll: true });
  }, [idx]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => apiRef.current?.onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ---------- рендер ----------
  const budgetMs = taskBudgetMs(mode, step.items.length);
  let barWidth = (st.done / Math.max(1, total)) * 100;
  let barColor = "bg-primary";
  if (mode === "blitz") {
    barWidth = (tick / BLITZ_MS) * 100;
    barColor = tick < 10_000 ? "bg-danger" : tick < 30_000 ? "bg-warning" : "bg-primary";
  } else if (mode === "normal" && budgetMs !== null) {
    const frac = verdict?.timedOut ? 0 : Math.max(0, 1 - tick / budgetMs);
    barWidth = frac * 100;
    barColor = frac < 0.3 ? "bg-warning" : "bg-primary";
  }

  const locked = phase !== "answering";
  const reviewed = (phase === "right" || phase === "wrong") && verdict !== null;
  const mood: Mood = phase === "right" ? "happy" : phase === "wrong" ? "sad" : "neutral";
  const remainSec = Math.ceil(tick / 1000);
  const isLast = idx + 1 >= tasks.length;

  return (
    <div className="relative isolate mx-auto flex h-[calc(100dvh-56px)] w-full max-w-[640px] touch-manipulation flex-col px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
      <div className="flex h-12 shrink-0 items-center gap-2">
        <div className="relative min-w-14">
          <span className="sr-only">{tx(S.score, lang)}</span>
          <span key={st.score} className="inline-block text-xl font-bold tabular-nums text-gold motion-safe:animate-pop">
            {st.score}
          </span>
        </div>
        <span className="min-w-0 truncate text-base font-extrabold">
          {mode === "blitz" ? (
            fmt(tx(S.solved, lang), { n: st.correct })
          ) : (
            <>
              <span className="sr-only sm:not-sr-only">{fmt(tx(S.roundOf, lang), { n: idx + 1, total })}</span>
              <span aria-hidden className="tabular-nums sm:hidden">
                {idx + 1}/{total}
              </span>
            </>
          )}
        </span>
        {st.streak >= 2 && (
          <span
            key={st.streak}
            title={tx(S.streak, lang)}
            aria-label={`${tx(S.streak, lang)}: ${st.streak}`}
            className="flex shrink-0 items-center gap-1 rounded-full bg-streak-soft px-2.5 py-1 text-sm font-extrabold text-streak motion-safe:animate-pop"
          >
            <Flame size={14} aria-hidden /> {st.streak}
          </span>
        )}
        <div className="flex-1" />
        {mode === "blitz" && (
          <span className={cn("text-lg font-bold tabular-nums", tick < 10_000 ? "text-danger-strong motion-safe:animate-pulse" : tick < 30_000 ? "text-warning-strong" : "text-text")}>
            {fmt(tx(S.seconds, lang), { n: remainSec })}
          </span>
        )}
        {mode === "normal" && budgetMs !== null && phase === "answering" && (
          <span className={cn("w-10 text-right text-base font-bold tabular-nums", budgetMs - tick < budgetMs * 0.3 ? "text-warning-strong" : "text-muted")}>
            {Math.max(0, Math.ceil((budgetMs - tick) / 1000))}
          </span>
        )}
      </div>

      <div className="h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className={cn("h-full rounded-full motion-safe:transition-[width] motion-safe:duration-200", barColor)} style={{ width: `${barWidth}%` }} />
      </div>

      <div key={step.id} className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-2 motion-safe:animate-fade-in">
        <h2 ref={titleRef} tabIndex={-1} className="text-lg font-extrabold leading-snug outline-none sm:text-xl">{l(task.title)}</h2>
        <OrderView step={step} answer={answer} onAnswer={onAnswer} locked={locked} result={verdict?.result ?? null} />
        {reviewed && verdict && (
          <div ref={reviewRef} className="flex scroll-mt-2 flex-col gap-2 motion-safe:animate-fade-in">
            {phase === "wrong" && (
              <div className="rounded-2xl border border-danger/30 bg-danger-soft p-3">
                <p className="text-base font-extrabold text-danger-strong">{verdict.timedOut ? t("game.timeUp") : tx(S.wrong, lang)}</p>
                <p className="mt-1 text-sm font-bold">{tx(S.correctOrder, lang)}:</p>
                <ol className="mt-1 flex flex-col gap-1">
                  {step.items.map((it, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-extrabold">{i + 1}</span>
                      <span className="pt-0.5">{l(it)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {task.result && (
              <div className="rounded-2xl border border-success/30 bg-success-soft p-3 text-sm">
                <span className="font-bold">{tx(S.resultLabel, lang)}: </span>
                <InlineMarkdown>{l(task.result)}</InlineMarkdown>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 flex shrink-0 flex-col gap-2">
        {phase === "right" && verdict && (
          <div className="flex items-center justify-center gap-2 motion-safe:animate-pop">
            <Mascot mood={mood} size={32} />
            <p className="text-lg font-extrabold text-success-strong">
              {tx(S.right, lang)} <span className="text-sm text-gold">+{verdict.gained}</span>
              {verdict.bonus > 0 && <span className="ml-2 text-sm text-streak">{fmt(tx(S.bonus, lang), { n: verdict.bonus })}</span>}
            </p>
          </div>
        )}
        {phase === "answering" && (
          <Button size="lg" variant="success" block disabled={!ready} onClick={check}>
            {t("common.check")}
          </Button>
        )}
        {reviewed && mode !== "blitz" && (
          <Button size="lg" block autoFocus onClick={() => next(st)}>
            {isLast ? tx(S.finish, lang) : t("common.next")}
          </Button>
        )}
      </div>

      <div className="sr-only" aria-live="polite">
        {announce}
      </div>

      {phase === "done" && timeUp && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-bg/85 px-4 text-center">
          <Mascot mood="neutral" size={96} />
          <p className="text-3xl font-black text-primary-strong motion-safe:animate-pop">{t("game.timeUp")}</p>
          <p className="text-lg font-bold text-muted">{fmt(tx(S.solved, lang), { n: st.correct })}</p>
        </div>
      )}
    </div>
  );
}

/** Нет разборов по навыкам: объясняем и выходим с нулём. */
function Empty({ lang, onFinish }: { lang: GameProps["lang"]; onFinish: GameProps["onFinish"] }) {
  const done = useRef(false);
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (done.current) return;
      done.current = true;
      onFinish(toResult(initialState()));
    }, EMPTY_MS);
    return () => window.clearTimeout(id);
  }, [onFinish]);
  return (
    <div role="status" className="mx-auto flex h-[calc(100dvh-56px)] w-full max-w-[640px] flex-col items-center justify-center gap-3 px-4 text-center">
      <Mascot mood="neutral" size={88} />
      <p className="text-lg font-extrabold">{tx(S.noWorked, lang)}</p>
      <p className="text-sm text-muted">{tx(S.noWorkedHint, lang)}</p>
    </div>
  );
}

export default function Game(props: GameProps) {
  const [tasks] = useState(() => {
    const seed = (Date.now() ^ Math.floor(Math.random() * 2 ** 32)) >>> 0;
    return buildRound(resolveSkills(props.skills), props.mode, seed);
  });
  if (tasks.length === 0) return <Empty lang={props.lang} onFinish={props.onFinish} />;
  return <BuildGame {...props} tasks={tasks} />;
}

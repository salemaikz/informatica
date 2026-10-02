"use client";

import { Flame, Trophy } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Mascot, type Mood } from "@/components/mascot/Mascot";
import { ChoiceView, MultiView } from "@/components/lesson/steps/ChoiceView";
import { InputView } from "@/components/lesson/steps/InputView";
import { MatchView } from "@/components/lesson/steps/MatchView";
import { OrderView } from "@/components/lesson/steps/OrderView";
import type { StepProps } from "@/components/lesson/steps/types";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { SceneView } from "@/components/scenes/SceneView";
import { Button } from "@/components/ui/Button";
import type { GameProps } from "@/games/types";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { evaluate, expectedText, isReady, type Answer, type StepResult } from "@/lib/evaluate";
import { feedback } from "@/lib/feedback";
import { fmt, tx } from "@/lib/text";
import {
  FLOORS,
  applyAnswer,
  canFiftyFifty,
  drawNext,
  fiftyFifty,
  initialState,
  isTop,
  resolveSkills,
  taskBudgetMs,
  taskLevel,
  toResult,
  BLITZ_MS,
  type TowerState,
  type TowerStep,
} from "./logic";
import { S } from "./strings";

type Phase = "answering" | "right" | "wrong" | "done";
type EndKind = "top" | "time" | "pool";
interface Verdict {
  result: StepResult;
  timedOut: boolean;
  gained: number;
  bonus: number;
}

/** Пауза на анимацию подъёма, мс. */
const CLIMB_MS = 900;
/** Блиц: сколько показываем верный ответ после ошибки, мс. */
const BLITZ_WRONG_MS = 1100;
/** Пауза перед итогами, мс. */
const END_DELAY = 1400;

/** Готовые компоненты шагов урока — по типу задания. */
function TaskStepView(props: StepProps<TowerStep>) {
  const { step } = props;
  switch (step.type) {
    case "choice":
      return <ChoiceView {...props} step={step} />;
    case "multi":
      return <MultiView {...props} step={step} />;
    case "input":
      return <InputView {...props} step={step} />;
    case "match":
      return <MatchView {...props} step={step} />;
    case "order":
      return <OrderView {...props} step={step} />;
  }
}

/** Башня сбоку: этажи снизу вверх, Бит стоит на текущем и поднимается пружиной. */
function Tower({ floor, mood, reduce, label }: { floor: number; mood: Mood; reduce: boolean; label: string }) {
  const idx = Math.min(floor, FLOORS - 1);
  return (
    <div role="img" aria-label={label} className="relative flex w-11 shrink-0 flex-col-reverse self-stretch sm:w-14">
      {Array.from({ length: FLOORS }, (_, i) => {
        const done = i < floor;
        const current = i === idx && floor < FLOORS;
        const isTopCell = i === FLOORS - 1;
        return (
          <div key={i} className="min-h-0 flex-1 p-0.5">
            <div
              className={cn(
                "flex h-full items-center justify-center rounded-lg text-[13px] font-extrabold transition-colors duration-200",
                done && "bg-success-soft text-success-strong",
                current && "bg-primary-soft ring-2 ring-primary",
                !done && !current && "bg-surface-2 text-muted",
              )}
            >
              {isTopCell && !current ? <Trophy size={16} aria-hidden className={done ? "text-gold" : "text-muted"} /> : current ? null : i + 1}
            </div>
          </div>
        );
      })}
      <m.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 z-10"
        style={{ height: `${100 / FLOORS}%` }}
        initial={false}
        animate={{ bottom: `${(idx * 100) / FLOORS}%` }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 170, damping: 15 }}
      >
        <Mascot mood={mood} size={36} className="h-full w-full" />
      </m.div>
    </div>
  );
}

interface TowerProps extends GameProps {
  first: { state: TowerState; step: TowerStep };
  skills: NonNullable<GameProps["skills"]>;
  seed: number;
}

function TowerGame({ lang, mode, onFinish, first, skills, seed }: TowerProps) {
  const { t, l } = useT();
  const reduce = useReduceMotion();
  const [st, setSt] = useState<TowerState>(first.state);
  const [step, setStep] = useState<TowerStep>(first.step);
  const [hinted, setHinted] = useState<TowerStep | null>(null);
  const [taskKey, setTaskKey] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [phase, setPhase] = useState<Phase>("answering");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [endKind, setEndKind] = useState<EndKind | null>(null);
  const [tick, setTick] = useState(mode === "blitz" ? BLITZ_MS : 0);
  const [announce, setAnnounce] = useState("");

  const phaseRef = useRef<Phase>("answering");
  const finishedRef = useRef(false);
  const remainRef = useRef(BLITZ_MS);
  const elapsedRef = useRef(0);
  const timersRef = useRef<Set<number>>(new Set());
  const apiRef = useRef<{ tick: (dt: number) => void; onKey: (e: KeyboardEvent) => void } | null>(null);

  const shown = hinted ?? step;
  const level = taskLevel(step, st.floor);
  const richReveal = mode !== "blitz";

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

  /** Ровно один вызов onFinish; перед ним — короткий экран «вершина / время». */
  const finish = (kind: EndKind, state: TowerState) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setSt(state);
    setEndKind(kind);
    go("done");
    later(() => onFinish(toResult(state)), END_DELAY);
  };

  /** Следующее задание того же (или нового) этажа. */
  const nextTask = (state: TowerState) => {
    if (finishedRef.current) return;
    const nxt = drawNext(state, skills, seed);
    if (!nxt) {
      finish("pool", state);
      return;
    }
    setSt(nxt.state);
    setStep(nxt.step);
    setHinted(null);
    setAnswer(null);
    setVerdict(null);
    setTaskKey((k) => k + 1);
    elapsedRef.current = 0;
    setTick(mode === "blitz" ? Math.max(0, remainRef.current) : 0);
    setAnnounce("");
    go("answering");
  };

  /** Проверка ответа (null — время на задание вышло). */
  const settle = (a: Answer | null, timedOut: boolean) => {
    if (phaseRef.current !== "answering" || finishedRef.current) return;
    const result: StepResult = a ? evaluate(shown, a, lang) : { correct: false, score: 0, given: "", expected: expectedText(shown, lang) };
    const out = applyAnswer(st, step, result.correct);
    setSt(out.state);
    setVerdict({ result, timedOut, gained: out.gained, bonus: out.bonus });
    if (result.correct) {
      feedback("correct");
      setAnnounce(tx(S.announceRight, lang));
      go("right");
      later(() => (isTop(out.state) ? finish("top", out.state) : nextTask(out.state)), CLIMB_MS);
      return;
    }
    feedback("wrong");
    setAnnounce(fmt(tx(timedOut ? S.announceTimeout : S.announceWrong, lang), { a: result.expected }));
    go("wrong");
    // Блиц — без остановки: верный ответ мелькает и идём дальше. В остальных темпах ждём «Дальше».
    if (!richReveal) later(() => nextTask(out.state), BLITZ_WRONG_MS);
  };

  const onAnswer: StepProps<TowerStep>["onAnswer"] = (a, opts) => {
    if (phaseRef.current !== "answering") return;
    setAnswer(a);
    // Выбор варианта и «пары» проверяются сразу, остальное — кнопкой «Проверить».
    if (a && (opts?.submit || (a.type === "choice" && a.index >= 0))) settle(a, false);
  };

  const ready = isReady(shown, answer);
  const check = () => {
    if (answer && ready) settle(answer, false);
  };

  const takeHint = () => {
    if (phaseRef.current !== "answering" || st.hintUsed || hinted || !canFiftyFifty(step)) return;
    const h = fiftyFifty(step);
    if (!h) return;
    feedback("pop");
    setHinted(h);
    setAnswer(null);
    setSt((s) => ({ ...s, hintUsed: true }));
  };

  // Свежие обработчики для таймера и клавиатуры (ref обновляется в эффекте, не во время рендера).
  useEffect(() => {
    apiRef.current = {
      tick: (dt) => {
        if (finishedRef.current || document.visibilityState === "hidden") return;
        if (mode === "blitz") {
          remainRef.current -= dt;
          setTick(Math.max(0, remainRef.current));
          if (remainRef.current <= 0) finish("time", st);
          return;
        }
        if (phaseRef.current !== "answering") return;
        elapsedRef.current += dt;
        setTick(elapsedRef.current);
        const budget = taskBudgetMs(mode, level);
        if (budget !== null && elapsedRef.current >= budget) settle(null, true);
      },
      onKey: (e) => {
        if (e.key !== "Enter" || e.repeat || e.ctrlKey || e.metaKey || e.altKey || finishedRef.current) return;
        const el = e.target as HTMLElement | null;
        // На кнопке Enter уже нажимает её сам; в панели инструментов — свой ввод.
        if (el && typeof el.closest === "function" && (el.closest("[data-toolbox]") || el.tagName === "BUTTON")) return;
        if (phaseRef.current === "answering" && answer && ready) {
          e.preventDefault();
          check();
        } else if (phaseRef.current === "wrong" && richReveal) {
          e.preventDefault();
          nextTask(st);
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => apiRef.current?.onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ---------- рендер ----------
  const budgetMs = taskBudgetMs(mode, level);
  let barWidth = (st.floor / FLOORS) * 100;
  let barColor = "bg-primary";
  if (mode === "blitz") {
    barWidth = (tick / BLITZ_MS) * 100;
    barColor = tick < 10_000 ? "bg-danger" : tick < 30_000 ? "bg-warning" : "bg-primary";
  } else if (mode === "normal" && budgetMs !== null) {
    const frac = verdict?.timedOut ? 0 : Math.max(0, 1 - tick / budgetMs);
    barWidth = frac * 100;
    barColor = frac < 0.3 ? "bg-warning" : "bg-primary";
  }

  const mood: Mood = phase === "right" ? "happy" : phase === "wrong" ? "sad" : phase === "done" && endKind === "top" ? "celebrate" : "neutral";
  const locked = phase !== "answering";
  const floorNo = Math.min(st.floor + 1, FLOORS);
  const manualCheck = shown.type === "multi" || shown.type === "input" || shown.type === "order";
  const wrongShown = phase === "wrong" && verdict !== null;
  const hintAvailable = mode !== "blitz" && canFiftyFifty(step) && !st.hintUsed && !hinted && phase === "answering";
  const remainSec = Math.ceil(tick / 1000);

  return (
    <div className="relative isolate mx-auto flex h-[calc(100dvh-56px)] w-full max-w-[640px] touch-manipulation flex-col px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
      <div className="flex h-12 shrink-0 items-center gap-2">
        <div className="relative min-w-14">
          <span className="sr-only">{tx(S.score, lang)}</span>
          <span key={st.score} className="inline-block text-xl font-bold tabular-nums motion-safe:animate-pop">
            {st.score}
          </span>
          {phase === "right" && verdict && verdict.gained > 0 && (
            <span key={taskKey} className="pointer-events-none absolute left-0 top-7 text-sm font-extrabold text-gold motion-safe:animate-slide-up">
              +{verdict.gained}
            </span>
          )}
        </div>
        <span className="min-w-0 truncate text-base font-extrabold">{fmt(tx(S.floorOf, lang), { n: floorNo, total: FLOORS })}</span>
        {st.cleanStreak >= 2 && (
          <span
            key={st.cleanStreak}
            title={tx(S.streak, lang)}
            aria-label={`${tx(S.streak, lang)}: ${st.cleanStreak}`}
            className="flex shrink-0 items-center gap-1 rounded-full bg-streak-soft px-2.5 py-1 text-sm font-extrabold text-streak motion-safe:animate-pop"
          >
            <Flame size={14} aria-hidden /> {st.cleanStreak}
          </span>
        )}
        <div className="flex-1" />
        {mode !== "blitz" && (
          <button
            type="button"
            onClick={takeHint}
            disabled={!hintAvailable}
            aria-label={tx(S.fiftyLabel, lang)}
            className="h-10 shrink-0 rounded-xl border-2 border-primary bg-primary-soft px-3 text-sm font-extrabold text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-2 disabled:text-muted"
          >
            {tx(S.fifty, lang)}
          </button>
        )}
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

      <div className="mt-3 flex min-h-0 flex-1 gap-3">
        <Tower floor={st.floor} mood={mood} reduce={reduce} label={fmt(tx(S.tower, lang), { n: floorNo, total: FLOORS })} />
        <div key={taskKey} className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto pb-2 motion-safe:animate-fade-in">
          <h2 className="text-lg font-extrabold leading-snug sm:text-xl">{l(shown.prompt)}</h2>
          {shown.scene && <SceneView scene={shown.scene} />}
          <TaskStepView step={shown} answer={answer} onAnswer={onAnswer} locked={locked} result={verdict?.result ?? null} />
        </div>
      </div>

      <div className="mt-2 flex shrink-0 flex-col gap-2">
        {phase === "right" && verdict && (
          <p className="text-center text-lg font-extrabold text-success-strong motion-safe:animate-pop">
            {tx(S.right, lang)}
            {verdict.bonus > 0 && <span className="ml-2 text-sm text-warning-strong">{fmt(tx(S.bonus, lang), { n: verdict.bonus })}</span>}
          </p>
        )}
        {wrongShown && verdict && (
          <div className="flex max-h-[40dvh] flex-col gap-1.5 overflow-y-auto rounded-2xl border border-danger/30 bg-danger-soft p-3 motion-safe:animate-fade-in">
            <p className="text-base font-extrabold text-danger-strong">{verdict.timedOut ? t("game.timeUp") : tx(S.wrong, lang)}</p>
            {shown.type !== "match" && (
              <p className="text-base font-bold">
                <span className="font-mono">{fmt(tx(S.answerWas, lang), { a: verdict.result.expected })}</span>
              </p>
            )}
            {richReveal && (
              <>
                <p className="text-sm">
                  <span className="font-bold">{t("game.why")}: </span>
                  {l(shown.explanation)}
                </p>
                <p className="text-sm text-muted">{tx(S.sameFloor, lang)}</p>
              </>
            )}
          </div>
        )}
        {phase === "answering" && manualCheck && (
          <Button size="lg" variant="success" block disabled={!ready} onClick={check}>
            {t("common.check")}
          </Button>
        )}
        {wrongShown && richReveal && (
          <Button size="lg" block autoFocus onClick={() => nextTask(st)}>
            {t("common.next")}
          </Button>
        )}
      </div>

      <div className="sr-only" aria-live="polite">
        {announce}
      </div>

      {phase === "done" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-bg/85 px-4 text-center">
          <Mascot mood={endKind === "top" ? "celebrate" : "neutral"} size={96} />
          <p className="text-3xl font-black text-primary-strong motion-safe:animate-pop">
            {endKind === "top" ? tx(S.top, lang) : endKind === "time" ? t("game.timeUp") : t("game.over")}
          </p>
          <p className="text-lg font-bold text-muted">{fmt(tx(S.stoppedAt, lang), { n: Math.min(st.floor + (endKind === "top" ? 0 : 1), FLOORS), total: FLOORS })}</p>
        </div>
      )}
    </div>
  );
}

/** Пустой пул (у навыков нет заданий нужной формы): оболочка такую игру не запустит, но защищаемся — сразу нули. */
function Empty({ onFinish }: { onFinish: GameProps["onFinish"] }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    onFinish(toResult(initialState()));
  }, [onFinish]);
  return null;
}

export default function Game(props: GameProps) {
  const [init] = useState(() => {
    const skills = resolveSkills(props.skills);
    const seed = (Date.now() ^ Math.floor(Math.random() * 2 ** 32)) >>> 0;
    return { skills, seed, first: drawNext(initialState(), skills, seed) };
  });
  if (!init.first) return <Empty onFinish={props.onFinish} />;
  return <TowerGame {...props} first={init.first} skills={init.skills} seed={init.seed} />;
}

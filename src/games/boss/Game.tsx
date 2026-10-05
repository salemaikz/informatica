"use client";

import { Binary, Braces, Calculator, CalendarDays, Cpu, Database, GitBranch, Globe, Network, Sheet, Skull, Sparkles, Swords, Table2, ToggleLeft, type LucideIcon } from "lucide-react";
import { m } from "motion/react";
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChoiceView, MultiView } from "@/components/lesson/steps/ChoiceView";
import { InputView } from "@/components/lesson/steps/InputView";
import { MatchView } from "@/components/lesson/steps/MatchView";
import { OrderView } from "@/components/lesson/steps/OrderView";
import type { StepProps } from "@/components/lesson/steps/types";
import { InlineMarkdown } from "@/components/Markdown";
import { Mascot, type Mood } from "@/components/mascot/Mascot";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { SceneView } from "@/components/scenes/SceneView";
import { Button } from "@/components/ui/Button";
import { liveSkills } from "@/games/live-mastery";
import type { GameProps } from "@/games/types";
import type { TowerStep } from "@/games/tower/logic";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { evaluate, expectedText, isReady, type Answer, type StepResult } from "@/lib/evaluate";
import { feedback } from "@/lib/feedback";
import { fmt, tx } from "@/lib/text";
import type { EntTopicId, SkillId } from "@/lib/types";
import {
  BLITZ_MS,
  applyAnswer,
  drawNext,
  initialState,
  isDefeated,
  maxTurns,
  outOfTurns,
  pickWeakSkills,
  resolveSkills,
  taskBudgetMs,
  taskLevel,
  toResult,
  topicOfSkill,
  weekNumber,
  weekOfYear,
  whyWrongOf,
  winBonus,
  type BossKind,
  type BossState,
  type EndKind,
} from "./logic";
import { BIG_BOSS_NAME, BOSS_NAMES, S } from "./strings";

type Phase = "answering" | "right" | "wrong" | "done";
interface Verdict {
  result: StepResult;
  timedOut: boolean;
  damage: number;
  healed: number;
}

/** Пауза на удар, мс. */
const HIT_MS = 900;
const BLITZ_WRONG_MS = 1100;
const END_DELAY = 1600;

/** Иконка босса по теме ЕНТ. */
const TOPIC_ICON: Record<EntTopicId, LucideIcon> = {
  t01: Cpu,
  t02: Network,
  t03: Binary,
  t04: Calculator,
  t05: ToggleLeft,
  t06: Braces,
  t07: GitBranch,
  t08: Sparkles,
  t09: Table2,
  t10: Database,
  t11: Skull,
  t12: Sheet,
  t13: Globe,
};

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

const TaskArea = memo(function TaskArea({ step, ...rest }: StepProps<TowerStep>) {
  const { l } = useT();
  return (
    <>
      <h2 className="text-lg font-extrabold leading-snug sm:text-xl"><InlineMarkdown>{l(step.prompt)}</InlineMarkdown></h2>
      {step.scene && <SceneView scene={step.scene} />}
      <TaskStepView step={step} {...rest} />
    </>
  );
});

/** Рисунок босса: тело-«монстр» с глазами и иконкой темы; дрожит от удара, раздувается при лечении. */
function BossArt({ Icon, hitNo, healNo, defeated, reduce }: { Icon: LucideIcon; hitNo: number; healNo: number; defeated: boolean; reduce: boolean }) {
  const anim = reduce
    ? { opacity: defeated ? 0.35 : 1 }
    : defeated
      ? { opacity: 0.35, rotate: 12, y: 8 }
      : hitNo > 0 && hitNo >= healNo
        ? { x: [0, 8, -8, 5, 0] }
        : { scale: [1, 1.08, 1] };
  return (
    <m.div key={`${hitNo}:${healNo}:${defeated}`} aria-hidden className="relative h-24 w-24 shrink-0" initial={false} animate={anim} transition={{ duration: 0.5 }}>
      <svg viewBox="0 0 96 96" className="absolute inset-0 h-full w-full">
        <path d="M18 12 l10 14 M78 12 l-10 14" className="stroke-danger" strokeWidth="6" strokeLinecap="round" fill="none" />
        <rect x="10" y="22" width="76" height="68" rx="22" className="fill-danger-soft stroke-danger" strokeWidth="4" />
        <path d="M26 38 l16 6 M70 38 l-16 6" className="stroke-danger-strong" strokeWidth="4" strokeLinecap="round" fill="none" />
        {defeated ? (
          <g className="stroke-danger-strong" strokeWidth="3.5" strokeLinecap="round">
            <path d="M30 46 l8 8 M38 46 l-8 8 M58 46 l8 8 M66 46 l-8 8" />
          </g>
        ) : (
          <g className="fill-danger-strong">
            <circle cx="34" cy="50" r="5" />
            <circle cx="62" cy="50" r="5" />
          </g>
        )}
      </svg>
      <Icon size={26} className="absolute bottom-3 left-1/2 -translate-x-1/2 text-danger-strong" />
    </m.div>
  );
}

interface BattleProps extends GameProps {
  kind: BossKind;
  skills: SkillId[];
  topic: EntTopicId;
  seed: number;
  first: { state: BossState; step: TowerStep };
}

function Battle({ lang, mode, onFinish, kind, skills, topic, seed, first }: BattleProps) {
  const { t, l } = useT();
  const reduce = useReduceMotion();
  const [st, setSt] = useState<BossState>(first.state);
  const [step, setStep] = useState<TowerStep>(first.step);
  const [taskKey, setTaskKey] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [phase, setPhase] = useState<Phase>("answering");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [endKind, setEndKind] = useState<EndKind | null>(null);
  const [tick, setTick] = useState(mode === "blitz" ? BLITZ_MS : 0);
  const [announce, setAnnounce] = useState("");
  const [hitNo, setHitNo] = useState(0);
  const [healNo, setHealNo] = useState(0);

  const phaseRef = useRef<Phase>("answering");
  const finishedRef = useRef(false);
  const remainRef = useRef(BLITZ_MS);
  const elapsedRef = useRef(0);
  const timersRef = useRef<Set<number>>(new Set());
  const apiRef = useRef<{ tick: (dt: number) => void; onKey: (e: KeyboardEvent) => void; onAnswer: StepProps<TowerStep>["onAnswer"] } | null>(null);

  const level = taskLevel(step, st.turn, kind);
  const richReveal = mode !== "blitz";
  const limit = maxTurns(mode);

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

  /** Ровно один onFinish; перед ним — экран «победа / босс отступил». */
  const finish = (k: EndKind, state: BossState) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const bonus = winBonus(state, mode, remainRef.current);
    setSt(state);
    setEndKind(k);
    setAnnounce(`${tx(k === "win" ? S.win : S.retreat, lang)} ${fmt(tx(S.dealt, lang), { n: state.dealt })}`);
    go("done");
    later(() => onFinish(toResult(state, bonus)), END_DELAY);
  };

  const nextTask = (state: BossState) => {
    if (finishedRef.current || phaseRef.current === "answering") return;
    if (isDefeated(state)) return finish("win", state);
    if (outOfTurns(state, mode)) return finish("retreat", state);
    const nxt = drawNext(state, skills, seed);
    if (!nxt) return finish("pool", state);
    setSt(nxt.state);
    setStep(nxt.step);
    setAnswer(null);
    setVerdict(null);
    setTaskKey((k) => k + 1);
    elapsedRef.current = 0;
    setTick(mode === "blitz" ? Math.max(0, remainRef.current) : 0);
    setAnnounce("");
    go("answering");
  };

  const settle = (a: Answer | null, timedOut: boolean) => {
    if (phaseRef.current !== "answering" || finishedRef.current) return;
    const result: StepResult = a ? evaluate(step, a, lang) : { correct: false, score: 0, given: "", expected: expectedText(step, lang) };
    const out = applyAnswer(st, step, result.correct);
    setSt(out.state);
    setVerdict({ result, timedOut, damage: out.damage, healed: out.healed });
    if (result.correct) {
      feedback("correct");
      setHitNo((n) => n + 1);
      setAnnounce(tx(S.announceRight, lang));
      go("right");
      later(() => nextTask(out.state), HIT_MS);
      return;
    }
    feedback("wrong");
    setHealNo((n) => n + 1);
    setAnnounce(fmt(tx(timedOut ? S.announceTimeout : S.announceWrong, lang), { a: result.expected }));
    go("wrong");
    if (!richReveal) later(() => nextTask(out.state), BLITZ_WRONG_MS);
  };

  const handleAnswer: StepProps<TowerStep>["onAnswer"] = (a, opts) => {
    if (phaseRef.current !== "answering") return;
    setAnswer(a);
    if (a && (opts?.submit || (a.type === "choice" && a.index >= 0))) settle(a, false);
  };

  const ready = isReady(step, answer);
  const check = () => {
    if (answer && ready) settle(answer, false);
  };

  useLayoutEffect(() => {
    apiRef.current = {
      onAnswer: handleAnswer,
      tick: (dt) => {
        if (finishedRef.current || document.visibilityState === "hidden") return;
        if (mode === "blitz") {
          remainRef.current -= dt;
          setTick(Math.max(0, remainRef.current));
          if (remainRef.current <= 0) finish(isDefeated(st) ? "win" : "time", st);
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

  const onAnswer = useCallback<StepProps<TowerStep>["onAnswer"]>((a, opts) => apiRef.current?.onAnswer(a, opts), []);

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
  const hpPct = (st.hp / st.maxHp) * 100;
  const name = kind === "big" ? BIG_BOSS_NAME : BOSS_NAMES[topic];
  const Icon = kind === "big" ? Swords : TOPIC_ICON[topic];
  const mood: Mood = phase === "right" ? "happy" : phase === "wrong" ? "sad" : phase === "done" && endKind === "win" ? "celebrate" : "neutral";
  const locked = phase !== "answering";
  const manualCheck = step.type === "multi" || step.type === "input" || step.type === "order";
  const wrongShown = phase === "wrong" && verdict !== null;
  // Разбор выбранного неверного варианта (choice / multi) — бесплатно, до ИИ.
  const whyWrong = wrongShown && !verdict.timedOut ? whyWrongOf(step, answer) : null;
  const remainSec = Math.ceil(tick / 1000);
  const turnNo = limit ? Math.min(st.turn + (phase === "answering" ? 1 : 0), limit) : st.turn + 1;

  return (
    <div className="relative isolate mx-auto flex h-[calc(100dvh-56px)] w-full max-w-[640px] touch-manipulation flex-col px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
      <div className="flex h-10 shrink-0 items-center gap-2">
        <div className="relative min-w-14">
          <span className="sr-only">{tx(S.score, lang)}</span>
          <span key={st.score} className="inline-block text-xl font-bold tabular-nums text-gold motion-safe:animate-pop">{st.score}</span>
        </div>
        {limit !== null && <span className="min-w-0 truncate text-base font-extrabold">{fmt(tx(S.turn, lang), { n: turnNo, total: limit })}</span>}
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

      {/* Арена: Бит слева, босс справа, полоса здоровья */}
      <div className="shrink-0 rounded-2xl border border-border bg-surface-2 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <m.div
            key={`bit${hitNo}`}
            aria-hidden
            className="relative z-10 shrink-0"
            initial={false}
            animate={reduce || hitNo === 0 ? { x: 0 } : { x: [0, 90, 0] }}
            transition={{ duration: 0.55 }}
          >
            <Mascot mood={mood} size={64} className="h-16 w-16" />
          </m.div>
          <div className="relative flex min-w-0 flex-1 items-center justify-center">
            {phase === "right" && verdict && verdict.damage > 0 && (
              <span key={taskKey} className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap text-lg font-black text-success-strong motion-safe:animate-slide-up">
                {fmt(tx(S.hit, lang), { n: verdict.damage })}
              </span>
            )}
            {wrongShown && verdict && verdict.healed > 0 && (
              <span className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap text-sm font-extrabold text-danger motion-safe:animate-slide-up">
                {fmt(tx(S.heal, lang), { n: verdict.healed })}
              </span>
            )}
          </div>
          <BossArt Icon={Icon} hitNo={hitNo} healNo={healNo} defeated={isDefeated(st)} reduce={reduce} />
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-2 text-sm font-extrabold">
          <span className="min-w-0 truncate">{l(name)}</span>
          <span className="shrink-0 tabular-nums text-danger-strong">{st.hp}/{st.maxHp}</span>
        </div>
        <div
          role="img"
          aria-label={fmt(tx(S.healthOf, lang), { hp: st.hp, max: st.maxHp })}
          className="mt-1 h-3 w-full overflow-hidden rounded-full bg-danger-soft"
        >
          <div className="h-full rounded-full bg-danger motion-safe:transition-[width] motion-safe:duration-500" style={{ width: `${hpPct}%` }} />
        </div>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <div key={taskKey} className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto pb-2 motion-safe:animate-fade-in">
          <TaskArea step={step} answer={answer} onAnswer={onAnswer} locked={locked} result={verdict?.result ?? null} />
        </div>
      </div>

      <div className="mt-2 flex shrink-0 flex-col gap-2">
        {phase === "right" && verdict && <p className="text-center text-lg font-extrabold text-success-strong motion-safe:animate-pop">{tx(S.right, lang)}</p>}
        {wrongShown && verdict && (
          <div className="flex max-h-[34dvh] flex-col gap-1.5 overflow-y-auto rounded-2xl border border-danger/30 bg-danger-soft p-3 motion-safe:animate-fade-in">
            <p className="text-base font-extrabold text-danger-strong">{verdict.timedOut ? t("game.timeUp") : tx(S.wrong, lang)}</p>
            {(step.type !== "match" || verdict.timedOut) && (
              <p className="text-base font-bold"><span className="font-mono">{fmt(tx(S.answerWas, lang), { a: verdict.result.expected })}</span></p>
            )}
            {richReveal && whyWrong && (
              <p className="text-sm"><InlineMarkdown>{l(whyWrong)}</InlineMarkdown></p>
            )}
            {richReveal && (
              <p className="text-sm">
                <span className="font-bold">{t("game.why")}: </span>
                <InlineMarkdown>{l(step.explanation)}</InlineMarkdown>
              </p>
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

      <div className="sr-only" aria-live="polite">{announce}</div>

      {phase === "done" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-bg/85 px-4 text-center">
          <Mascot mood={endKind === "win" ? "celebrate" : "neutral"} size={96} />
          <p className="text-3xl font-black text-primary-strong motion-safe:animate-pop">{endKind === "win" ? tx(S.win, lang) : tx(S.retreat, lang)}</p>
          <p className="text-lg font-bold text-gold">{fmt(tx(S.dealt, lang), { n: st.dealt })}</p>
        </div>
      )}
    </div>
  );
}

/** Выбор боя в начале: босс из слабых тем или большой босс недели. */
function Choose({ onPick, lang }: { onPick: (k: BossKind) => void; lang: GameProps["lang"] }) {
  const week = weekOfYear();
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-4 px-4 py-6">
      <Mascot mood="thinking" size={88} />
      <h2 className="text-2xl font-black">{tx(S.chooseTitle, lang)}</h2>
      <button
        type="button"
        onClick={() => onPick("weak")}
        className="flex w-full flex-col items-start gap-1 rounded-2xl border-2 border-danger bg-danger-soft p-4 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-0.5"
      >
        <span className="flex items-center gap-2 text-lg font-extrabold text-danger-strong"><Skull size={20} aria-hidden />{tx(S.weakTitle, lang)}</span>
        <span className="text-sm text-text">{tx(S.weakText, lang)}</span>
      </button>
      <button
        type="button"
        onClick={() => onPick("big")}
        className="flex w-full flex-col items-start gap-1 rounded-2xl border-2 border-gold bg-gold-soft p-4 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-0.5"
      >
        <span className="flex items-center gap-2 text-lg font-extrabold text-text"><CalendarDays size={20} aria-hidden />{tx(S.bigTitle, lang)}</span>
        <span className="text-sm text-text">{tx(S.bigText, lang)}</span>
        <span className="text-sm font-bold text-gold-strong">{fmt(tx(S.week, lang), { n: week })}</span>
      </button>
    </div>
  );
}

/** Пустой пул: сразу нули. */
function Empty({ onFinish }: { onFinish: GameProps["onFinish"] }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    onFinish(toResult(initialState("weak")));
  }, [onFinish]);
  return null;
}

interface Chosen {
  kind: BossKind;
  skills: SkillId[];
  topic: EntTopicId;
  seed: number;
  first: { state: BossState; step: TowerStep };
}

export default function Game(props: GameProps) {
  const all = resolveSkills(props.skills);
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [empty, setEmpty] = useState(false);

  // Выбор делаем по клику (а не при загрузке): к этому моменту прогресс из localStorage уже прочитан.
  const pick = (kind: BossKind) => {
    const rand = (Date.now() ^ Math.floor(Math.random() * 2 ** 32)) >>> 0;
    const seed = kind === "big" ? weekNumber() : rand;
    const skills = kind === "big" ? all : pickWeakSkills(all, liveSkills(), rand);
    const first = drawNext(initialState(kind), skills, seed);
    if (!first) {
      setEmpty(true);
      return;
    }
    setChosen({ kind, skills, topic: topicOfSkill(skills[0] ?? all[0]), seed, first });
  };

  if (!all.length || empty) return <Empty onFinish={props.onFinish} />;
  if (!chosen) return <Choose onPick={pick} lang={props.lang} />;
  return <Battle {...props} {...chosen} />;
}

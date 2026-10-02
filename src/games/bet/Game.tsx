"use client";

import { Coins } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { InlineMarkdown } from "@/components/Markdown";
import { Mascot, type Mood } from "@/components/mascot/Mascot";
import { ChoiceView } from "@/components/lesson/steps/ChoiceView";
import type { StepProps } from "@/components/lesson/steps/types";
import { SceneView } from "@/components/scenes/SceneView";
import { Button } from "@/components/ui/Button";
import type { GameProps } from "@/games/types";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { evaluate, expectedText, type Answer, type StepResult } from "@/lib/evaluate";
import { feedback } from "@/lib/feedback";
import { fmt, plainText, tx } from "@/lib/text";
import type { ChoiceStep } from "@/lib/types";
import {
  BETS,
  BLITZ_MS,
  applyAnswer,
  betDelta,
  confidenceMap,
  confidenceVerdict,
  drawNext,
  finalScore,
  initialState,
  questionLimit,
  questionLevel,
  resolveSkills,
  taskBudgetMs,
  toResult,
  type Bet,
  type BetState,
  type ConfidenceVerdict,
} from "./logic";
import { S } from "./strings";

type Phase = "answering" | "right" | "wrong" | "map";
interface Verdict {
  result: StepResult;
  bet: Bet;
  timedOut: boolean;
}

const RIGHT_MS = 900;
const BLITZ_RIGHT_MS = 450;
const BLITZ_WRONG_MS = 1100;
/** Знак минус из типографики, не дефис. */
const signed = (n: number) => (n < 0 ? `−${-n}` : String(n));

interface BetProps extends GameProps {
  first: { state: BetState; step: ChoiceStep };
  skills: NonNullable<GameProps["skills"]>;
  seed: number;
}

function BetGame({ lang, mode, onFinish, first, skills, seed }: BetProps) {
  const { t, l } = useT();
  const limit = questionLimit(mode);
  const planned = limit ?? 12;
  const [st, setSt] = useState<BetState>(first.state);
  const [step, setStep] = useState<ChoiceStep>(first.step);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [phase, setPhase] = useState<Phase>("answering");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [tick, setTick] = useState(mode === "blitz" ? BLITZ_MS : 0);
  const [announce, setAnnounce] = useState("");

  const phaseRef = useRef<Phase>("answering");
  const finishedRef = useRef(false);
  const remainRef = useRef(BLITZ_MS);
  const elapsedRef = useRef(0);
  const timersRef = useRef<Set<number>>(new Set());
  const apiRef = useRef<{ tick: (dt: number) => void; onAnswer: StepProps<ChoiceStep>["onAnswer"] } | null>(null);

  const idx = st.answers.length;
  const level = step.level ?? questionLevel(Math.min(idx, planned - 1), planned);
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

  /** Экран «Карта уверенности»: onFinish — только по кнопке «Дальше». */
  const toMap = (state: BetState) => {
    if (phaseRef.current === "map") return;
    setSt(state);
    setAnswer(null);
    go("map");
  };

  const nextTask = (state: BetState) => {
    if (phaseRef.current === "answering" || phaseRef.current === "map") return;
    if (limit !== null && state.answers.length >= limit) return toMap(state);
    const nxt = drawNext(state, skills, seed, planned);
    if (!nxt) return toMap(state);
    setSt(nxt.state);
    setStep(nxt.step);
    setAnswer(null);
    setVerdict(null);
    elapsedRef.current = 0;
    setTick(mode === "blitz" ? Math.max(0, remainRef.current) : 0);
    setAnnounce("");
    go("answering");
  };

  /** Проверка: bet — ставка, a — выбранный ответ (null — время вышло без ответа). */
  const settle = (a: Answer | null, bet: Bet, timedOut: boolean) => {
    if (phaseRef.current !== "answering") return;
    const result: StepResult = a ? evaluate(step, a, lang) : { correct: false, score: 0, given: "", expected: expectedText(step, lang) };
    const state = applyAnswer(st, step.skill ?? "", bet, result.correct, timedOut);
    setSt(state);
    setVerdict({ result, bet, timedOut });
    if (result.correct) {
      feedback("correct");
      setAnnounce(fmt(tx(S.announceRight, lang), { n: bet }));
      go("right");
      later(() => nextTask(state), mode === "blitz" ? BLITZ_RIGHT_MS : RIGHT_MS);
      return;
    }
    feedback("wrong");
    setAnnounce(fmt(tx(S.announceWrong, lang), { n: bet, a: plainText(result.expected) }));
    go("wrong");
    if (!richReveal) later(() => nextTask(state), BLITZ_WRONG_MS);
  };

  const handleAnswer: StepProps<ChoiceStep>["onAnswer"] = (a) => {
    if (phaseRef.current !== "answering") return;
    setAnswer(a);
  };
  const onAnswer = useCallback<StepProps<ChoiceStep>["onAnswer"]>((a, o) => apiRef.current?.onAnswer(a, o), []);

  const placeBet = (bet: Bet) => {
    if (answer?.type === "choice" && answer.index >= 0) settle(answer, bet, false);
  };

  useLayoutEffect(() => {
    apiRef.current = {
      onAnswer: handleAnswer,
      tick: (dt) => {
        if (phaseRef.current === "map" || document.visibilityState === "hidden") return;
        if (mode === "blitz") {
          remainRef.current -= dt;
          setTick(Math.max(0, remainRef.current));
          if (remainRef.current <= 0) toMap(st);
          return;
        }
        if (phaseRef.current !== "answering") return;
        elapsedRef.current += dt;
        setTick(elapsedRef.current);
        const budget = taskBudgetMs(mode, level);
        if (budget !== null && elapsedRef.current >= budget) {
          const had = answer?.type === "choice" && answer.index >= 0 ? answer : null;
          settle(had, 1, true);
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

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish(toResult(st));
  };

  // ---------- карта уверенности ----------
  if (phase === "map") {
    return <ConfidenceMap state={st} lang={lang} onNext={finish} />;
  }

  const budgetMs = taskBudgetMs(mode, level);
  let barWidth = limit ? (idx / limit) * 100 : (tick / BLITZ_MS) * 100;
  let barColor = "bg-gold";
  if (mode === "blitz") barColor = tick < 10_000 ? "bg-danger" : tick < 30_000 ? "bg-warning" : "bg-gold";
  else if (mode === "normal" && budgetMs !== null) {
    const frac = verdict?.timedOut ? 0 : Math.max(0, 1 - tick / budgetMs);
    barWidth = frac * 100;
    barColor = frac < 0.3 ? "bg-warning" : "bg-gold";
  }
  const locked = phase !== "answering";
  const picked = answer?.type === "choice" && answer.index >= 0;
  const wrongShown = phase === "wrong" && verdict !== null;
  const gain = verdict ? betDelta(verdict.bet, verdict.result.correct) : 0;
  const qLabel = limit ? fmt(tx(S.qOf, lang), { n: Math.min(idx + 1, limit), total: limit }) : fmt(tx(S.qNo, lang), { n: idx + 1 });

  return (
    <div className="relative isolate mx-auto flex h-[calc(100dvh-56px)] w-full max-w-[640px] touch-manipulation flex-col px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
      <div className="flex h-12 shrink-0 items-center gap-2">
        <div className="flex items-center gap-1.5 text-gold">
          <Coins size={20} aria-hidden />
          <span className="sr-only">{tx(S.score, lang)}</span>
          <span key={st.raw} className="inline-block text-xl font-bold tabular-nums motion-safe:animate-pop">
            {signed(st.raw)}
          </span>
        </div>
        <span className="min-w-0 truncate text-base font-extrabold">
          <span className="sr-only sm:not-sr-only">{qLabel}</span>
          <span aria-hidden className="tabular-nums sm:hidden">
            {limit ? `${Math.min(idx + 1, limit)}/${limit}` : `№${idx + 1}`}
          </span>
        </span>
        <div className="flex-1" />
        {mode === "blitz" && (
          <span className={cn("text-lg font-bold tabular-nums", tick < 10_000 ? "text-danger-strong motion-safe:animate-pulse" : tick < 30_000 ? "text-warning-strong" : "text-text")}>
            {fmt(tx(S.seconds, lang), { n: Math.ceil(tick / 1000) })}
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

      <div key={idx} className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-2 motion-safe:animate-fade-in">
        <h2 className="text-lg font-extrabold leading-snug sm:text-xl">
          <InlineMarkdown>{l(step.prompt)}</InlineMarkdown>
        </h2>
        {step.scene && <SceneView scene={step.scene} />}
        <ChoiceView step={step} answer={answer} onAnswer={onAnswer} locked={locked} result={verdict?.result ?? null} />
      </div>

      <div className="mt-2 flex shrink-0 flex-col gap-2">
        {phase === "right" && verdict && (
          <p className="text-center text-lg font-extrabold text-success-strong motion-safe:animate-pop">{fmt(tx(S.right, lang), { n: verdict.bet })}</p>
        )}
        {wrongShown && verdict && (
          <div className="flex max-h-[40dvh] flex-col gap-1.5 overflow-y-auto rounded-2xl border border-danger/30 bg-danger-soft p-3 motion-safe:animate-fade-in">
            <p className="text-base font-extrabold text-danger-strong">{fmt(tx(verdict.timedOut ? S.timeout : S.wrong, lang), { n: -gain })}</p>
            <p className="font-mono text-base font-bold">{fmt(tx(S.answerWas, lang), { a: verdict.result.expected })}</p>
            {richReveal && (
              <p className="text-sm">
                <span className="font-bold">{t("game.why")}: </span>
                <InlineMarkdown>{l(step.explanation)}</InlineMarkdown>
              </p>
            )}
          </div>
        )}
        {phase === "answering" && (
          <div className="flex flex-col gap-1.5">
            <p className={cn("text-center text-sm font-bold", picked ? "text-text" : "text-muted")}>{picked ? tx(S.placeBet, lang) : tx(S.pickFirst, lang)}</p>
            <div className="grid grid-cols-3 gap-2">
              {BETS.map((b) => (
                <button
                  key={b}
                  type="button"
                  disabled={!picked}
                  onClick={() => placeBet(b)}
                  aria-label={fmt(tx(S.betLabel, lang), { n: b })}
                  className="flex h-14 flex-col items-center justify-center rounded-2xl border-2 border-gold bg-gold-soft text-gold shadow-[0_3px_0_var(--gold)] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold active:translate-y-[2px] disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-2 disabled:text-muted disabled:shadow-none"
                >
                  <span className="text-2xl font-black leading-none tabular-nums">{b}</span>
                  <span className="text-[11px] font-bold leading-tight">{tx(S.betWord, lang)}</span>
                </button>
              ))}
            </div>
          </div>
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
    </div>
  );
}

const VERDICT_TEXT: Record<ConfidenceVerdict, keyof typeof S> = {
  few: "verdictFew",
  good: "verdictGood",
  over: "verdictOver",
  under: "verdictUnder",
};
/** Фон вывода по семантике: оправдано — success, перебор — warning, остальное — нейтрально. */
const VERDICT_TONE: Record<ConfidenceVerdict, string> = {
  few: "bg-surface-2",
  good: "bg-success-soft",
  over: "bg-warning-soft",
  under: "bg-primary-soft",
};

/** Экран «Карта уверенности»: точность по каждой ставке и вывод. */
function ConfidenceMap({ state, lang, onNext }: { state: BetState; lang: GameProps["lang"]; onNext: () => void }) {
  const { t } = useT();
  const rows = confidenceMap(state.answers);
  const verdict = confidenceVerdict(state.answers);
  const mood: Mood = verdict === "good" ? "celebrate" : verdict === "over" ? "sad" : "neutral";
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-56px)] w-full max-w-[520px] flex-col gap-4 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4">
      <div className="flex items-center gap-3">
        <Mascot mood={mood} size={64} />
        <div className="min-w-0">
          <h2 className="text-2xl font-black">{tx(S.mapTitle, lang)}</h2>
          <p className="flex items-center gap-1.5 text-base font-extrabold text-gold">
            <Coins size={18} aria-hidden />
            {fmt(tx(S.total, lang), { n: finalScore(state) })}
          </p>
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => {
          const frac = r.total ? r.right / r.total : 0;
          const tone = frac >= 0.7 ? "bg-success" : frac >= 0.4 ? "bg-warning" : "bg-danger";
          return (
            <li key={r.bet} className="rounded-2xl border border-border bg-surface p-3">
              <p className="text-base font-bold">{r.total ? fmt(tx(S.mapRow, lang), { n: r.bet, r: r.right, t: r.total }) : fmt(tx(S.mapNone, lang), { n: r.bet })}</p>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <div className={cn("h-full rounded-full", r.total ? tone : "bg-surface-2")} style={{ width: `${frac * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className={cn("rounded-2xl p-3 text-base font-bold leading-snug", VERDICT_TONE[verdict])}>{tx(S[VERDICT_TEXT[verdict]], lang)}</p>
      <div className="flex-1" />
      <Button size="lg" block autoFocus onClick={onNext}>
        {t("common.next")}
      </Button>
    </div>
  );
}

/** Пустой пул (у навыков нет choice-заданий): сразу нули. */
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
    const total = questionLimit(props.mode) ?? 12;
    return { skills, seed, first: drawNext(initialState(), skills, seed, total) };
  });
  if (!init.first) return <Empty onFinish={props.onFinish} />;
  return <BetGame {...props} first={init.first} skills={init.skills} seed={init.seed} />;
}

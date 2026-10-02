"use client";

import { KeyRound } from "lucide-react";
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { InlineMarkdown } from "@/components/Markdown";
import { ChoiceView, MultiView } from "@/components/lesson/steps/ChoiceView";
import { InputView } from "@/components/lesson/steps/InputView";
import { MatchView } from "@/components/lesson/steps/MatchView";
import { OrderView } from "@/components/lesson/steps/OrderView";
import type { StepProps } from "@/components/lesson/steps/types";
import { Mascot, type Mood } from "@/components/mascot/Mascot";
import { SceneView } from "@/components/scenes/SceneView";
import { Button } from "@/components/ui/Button";
import type { GameProps } from "@/games/types";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { evaluate, expectedText, isReady, type Answer, type StepResult } from "@/lib/evaluate";
import { feedback } from "@/lib/feedback";
import { fmt, tx } from "@/lib/text";
import {
  BLITZ_MS,
  GUESS_PENALTY,
  applyGuess,
  applyQuestion,
  chars,
  drawNext,
  emptyResult,
  fullyRevealed,
  guessAvailable,
  guessBonus,
  maskedText,
  phraseById,
  phraseText,
  resolveSkills,
  revealedSet,
  roundOver,
  roundQuestions,
  startRound,
  taskBudgetMs,
  taskLevel,
  toResult,
  rampFloor,
  type CipherState,
  type CipherStep,
} from "./logic";
import { S } from "./strings";

type Phase = "answering" | "right" | "wrong" | "roundEnd" | "done";
type EndKind = "guess" | "full" | "missed" | "time" | "pool";
interface Verdict {
  result: StepResult;
  timedOut: boolean;
  gained: number;
  opened: number;
}

/** Пауза после верного ответа (видно, как открылись буквы), мс. */
const OPEN_MS = 900;
/** Блиц: сколько показываем верный ответ после ошибки, мс. */
const BLITZ_WRONG_MS = 1100;
/** Блиц: сколько показываем открытую фразу перед следующей, мс. */
const ROUND_END_MS = 1700;
/** Пауза перед итогами, мс. */
const END_DELAY = 2200;

function TaskStepView(props: StepProps<CipherStep>) {
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

/** Задание. memo: таймер перерисовывает игру 10 раз в секунду, задание при этом не трогаем. */
const TaskArea = memo(function TaskArea({ step, ...rest }: StepProps<CipherStep>) {
  const { l } = useT();
  return (
    <>
      <h2 className="text-lg font-extrabold leading-snug sm:text-xl">
        <InlineMarkdown>{l(step.prompt)}</InlineMarkdown>
      </h2>
      {step.scene && <SceneView scene={step.scene} />}
      <TaskStepView step={step} {...rest} />
    </>
  );
});

/** Фраза: слова не рвутся посреди, скрытые буквы — пустые клетки, открытые «выскакивают». */
function CipherBoard({ state, showAll, tone, label }: { state: CipherState; showAll: boolean; tone: "idle" | "good" | "bad"; label: string }) {
  const open = revealedSet(state);
  const cs = chars(phraseText(state));
  // Разбиваем на слова по пробелам, сохраняя исходные индексы
  const words: { i: number; c: string }[][] = [[]];
  cs.forEach((c, i) => {
    if (/\s/.test(c)) {
      if (words[words.length - 1].length) words.push([]);
    } else words[words.length - 1].push({ i, c });
  });
  return (
    <div role="img" aria-label={label} className="shrink-0 rounded-2xl border border-border bg-surface p-3">
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-2" aria-hidden>
        {words
          .filter((w) => w.length)
          .map((w) => (
            <span key={w[0].i} className="inline-flex gap-0.5 whitespace-nowrap">
              {w.map(({ i, c }) => {
                if (!/[\p{L}\p{N}]/u.test(c)) {
                  return (
                    <span key={i} className="flex h-8 w-3.5 items-center justify-center text-lg font-extrabold text-muted">
                      {c}
                    </span>
                  );
                }
                const isOpen = open.has(i);
                const shown = isOpen || showAll;
                return (
                  <span
                    key={`${i}-${isOpen}`}
                    className={cn(
                      // min(24px, 5.5vw): слово из 13 букв помещается в строку и на 360 px
                      "flex h-8 w-[min(1.5rem,5.5vw)] items-center justify-center rounded-md text-lg font-extrabold uppercase",
                      isOpen && tone === "good" && "bg-success-soft text-success-strong",
                      isOpen && tone !== "good" && "bg-primary-soft text-primary-strong motion-safe:animate-pop",
                      !isOpen && shown && "bg-surface-2 text-muted",
                      !shown && "border-b-2 border-border bg-surface-2",
                    )}
                  >
                    {shown ? c : ""}
                  </span>
                );
              })}
            </span>
          ))}
      </div>
    </div>
  );
}

interface CipherProps extends GameProps {
  first: { state: CipherState; step: CipherStep };
  skills: NonNullable<GameProps["skills"]>;
  seed: number;
}

function CipherGame({ lang, mode, onFinish, first, skills, seed }: CipherProps) {
  const { t, l } = useT();
  const [st, setSt] = useState<CipherState>(first.state);
  const [step, setStep] = useState<CipherStep>(first.step);
  const [taskKey, setTaskKey] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [phase, setPhase] = useState<Phase>("answering");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [guessing, setGuessing] = useState(false);
  const [penalty, setPenalty] = useState<{ key: number; n: number } | null>(null);
  const [endKind, setEndKind] = useState<EndKind | null>(null);
  const [bonusShown, setBonusShown] = useState(0);
  const [tick, setTick] = useState(mode === "blitz" ? BLITZ_MS : 0);
  const [announce, setAnnounce] = useState("");

  const phaseRef = useRef<Phase>("answering");
  const guessingRef = useRef(false);
  const finishedRef = useRef(false);
  const remainRef = useRef(BLITZ_MS);
  const elapsedRef = useRef(0);
  const timersRef = useRef<Set<number>>(new Set());
  const guessHeadRef = useRef<HTMLHeadingElement>(null);
  const wasGuessingRef = useRef(false);
  const penaltyNoRef = useRef(0);
  const apiRef = useRef<{
    tick: (dt: number) => void;
    onKey: (e: KeyboardEvent) => void;
    onAnswer: StepProps<CipherStep>["onAnswer"];
  } | null>(null);

  const level = taskLevel(step, rampFloor(st));
  const richReveal = mode !== "blitz";

  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const setGuess = (v: boolean) => {
    guessingRef.current = v;
    setGuessing(v);
  };
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
  };

  /** Ровно один вызов onFinish; перед ним — экран с открытой фразой. */
  const finish = (kind: EndKind, state: CipherState) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setGuess(false);
    setSt(state);
    setEndKind(kind);
    go("done");
    later(() => onFinish(toResult(state)), END_DELAY);
  };

  /** Следующее задание в текущей фразе. */
  const nextTask = (state: CipherState) => {
    if (finishedRef.current || phaseRef.current === "answering") return;
    const nxt = drawNext(state, skills, seed);
    if (!nxt) {
      finish("pool", state);
      return;
    }
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

  /** Фраза закончилась: в блице показываем её и берём следующую, иначе — итоги. */
  const endRound = (kind: "guess" | "full" | "missed", state: CipherState, bonus = 0) => {
    if (finishedRef.current) return;
    if (mode !== "blitz") {
      setBonusShown(bonus);
      finish(kind, state);
      return;
    }
    setSt(state);
    setEndKind(kind);
    setBonusShown(bonus);
    setGuess(false);
    go("roundEnd");
    later(() => {
      if (finishedRef.current) return;
      const nr = startRound(state, { lang, mode, seed });
      if (!nr) {
        finish("pool", state);
        return;
      }
      setEndKind(null);
      setBonusShown(0);
      nextTask(nr);
    }, ROUND_END_MS);
  };

  const afterQuestion = (state: CipherState) => {
    if (roundOver(state)) endRound(fullyRevealed(state) ? "full" : "missed", state);
    else nextTask(state);
  };

  /** Проверка ответа (null — время на задание вышло). */
  const settle = (a: Answer | null, timedOut: boolean) => {
    if (phaseRef.current !== "answering" || finishedRef.current || guessingRef.current) return;
    const result: StepResult = a ? evaluate(step, a, lang) : { correct: false, score: 0, given: "", expected: expectedText(step, lang) };
    const out = applyQuestion(st, step, result.correct);
    setSt(out.state);
    setVerdict({ result, timedOut, gained: out.gained, opened: out.opened });
    if (result.correct) {
      feedback("correct");
      setAnnounce(tx(S.announceRight, lang));
      go("right");
      later(() => afterQuestion(out.state), OPEN_MS);
      return;
    }
    feedback("wrong");
    setAnnounce(fmt(tx(timedOut ? S.announceTimeout : S.announceWrong, lang), { a: result.expected }));
    go("wrong");
    // Блиц — без остановки. В остальных темпах ждём «Далее» (если вопросы кончились — это был последний).
    if (!richReveal) later(() => afterQuestion(out.state), BLITZ_WRONG_MS);
  };

  const handleAnswer: StepProps<CipherStep>["onAnswer"] = (a, opts) => {
    if (phaseRef.current !== "answering" || guessingRef.current) return;
    setAnswer(a);
    if (a && (opts?.submit || (a.type === "choice" && a.index >= 0))) settle(a, false);
  };

  const ready = isReady(step, answer);
  const check = () => {
    if (answer && ready) settle(answer, false);
  };

  const openGuess = () => {
    if (phaseRef.current !== "answering" || guessingRef.current || !guessAvailable(st)) return;
    feedback("pop");
    setGuess(true);
  };

  const pickGuess = (id: string) => {
    if (phaseRef.current !== "answering" || !guessingRef.current || finishedRef.current) return;
    const out = applyGuess(st, id);
    if (out.state === st) return;
    if (out.correct) {
      feedback("correct");
      setAnnounce(fmt(tx(S.announceGuess, lang), { n: out.delta }));
      setVerdict(null);
      endRound("guess", out.state, out.delta);
      return;
    }
    feedback("wrong");
    setSt(out.state);
    setGuess(false);
    const pKey = ++penaltyNoRef.current;
    setPenalty({ key: pKey, n: out.delta });
    later(() => setPenalty((p) => (p?.key === pKey ? null : p)), 1200);
    setAnnounce(fmt(tx(S.announcePenalty, lang), { p: out.delta }));
  };

  // Свежие обработчики для ответа, таймера и клавиатуры (обновляются в layout-эффекте, не во время рендера).
  useLayoutEffect(() => {
    apiRef.current = {
      onAnswer: handleAnswer,
      tick: (dt) => {
        if (finishedRef.current || document.visibilityState === "hidden") return;
        if (mode === "blitz") {
          remainRef.current -= dt;
          setTick(Math.max(0, remainRef.current));
          if (remainRef.current <= 0) finish("time", st);
          return;
        }
        // Пока выбираем фразу, время на вопрос стоит
        if (phaseRef.current !== "answering" || guessingRef.current) return;
        elapsedRef.current += dt;
        setTick(elapsedRef.current);
        const budget = taskBudgetMs(mode, level);
        if (budget !== null && elapsedRef.current >= budget) settle(null, true);
      },
      onKey: (e) => {
        if (e.key !== "Enter" || e.repeat || e.ctrlKey || e.metaKey || e.altKey || finishedRef.current) return;
        const el = e.target as HTMLElement | null;
        if (el && typeof el.closest === "function" && (el.closest("[data-toolbox]") || el.tagName === "BUTTON")) return;
        if (phaseRef.current === "answering" && !guessingRef.current && answer && ready) {
          e.preventDefault();
          check();
        } else if (phaseRef.current === "wrong" && richReveal) {
          e.preventDefault();
          afterQuestion(st);
        }
      },
    };
  });

  const onAnswer = useCallback<StepProps<CipherStep>["onAnswer"]>((a, opts) => apiRef.current?.onAnswer(a, opts), []);

  useEffect(() => {
    const timers = timersRef.current;
    const id = mode === "calm" ? null : window.setInterval(() => apiRef.current?.tick(100), 100);
    return () => {
      if (id !== null) window.clearInterval(id);
      timers.forEach((x) => window.clearTimeout(x));
      timers.clear();
    };
  }, [mode]);

  // Фокус не теряется, когда панель выбора фразы появляется и исчезает
  useEffect(() => {
    if (guessing) guessHeadRef.current?.focus();
    else if (wasGuessingRef.current) document.getElementById("cipher-know")?.focus();
    wasGuessingRef.current = guessing;
  }, [guessing]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => apiRef.current?.onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ---------- рендер ----------
  const qTotal = roundQuestions(mode);
  const qNo = Math.min(st.asked + (phase === "answering" ? 1 : 0), qTotal);
  const budgetMs = taskBudgetMs(mode, level);
  let barWidth = (st.revealed / Math.max(1, st.total)) * 100;
  let barColor = "bg-primary";
  if (mode === "blitz") {
    barWidth = (tick / BLITZ_MS) * 100;
    barColor = tick < 10_000 ? "bg-danger" : tick < 30_000 ? "bg-warning" : "bg-primary";
  } else if (mode === "normal" && budgetMs !== null) {
    const frac = verdict?.timedOut ? 0 : Math.max(0, 1 - tick / budgetMs);
    barWidth = frac * 100;
    barColor = frac < 0.3 ? "bg-warning" : "bg-primary";
  }

  const ended = phase === "done" || phase === "roundEnd";
  const boardTone = ended && (endKind === "guess" || endKind === "full") ? "good" : "idle";
  const mood: Mood = phase === "right" || (ended && (endKind === "guess" || endKind === "full")) ? "happy" : phase === "wrong" ? "sad" : "neutral";
  const locked = phase !== "answering" || guessing;
  const manualCheck = step.type === "multi" || step.type === "input" || step.type === "order";
  const wrongShown = phase === "wrong" && verdict !== null;
  const canGuess = phase === "answering" && !guessing && guessAvailable(st);
  const guessLockedHint = phase === "answering" && !guessing && !fullyRevealed(st) && !guessAvailable(st);
  const remainSec = Math.ceil(tick / 1000);
  const boardLabel = `${tx(S.cipher, lang)}. ${fmt(tx(S.cipherState, lang), { n: st.revealed, total: st.total })}. ${maskedText(st)}`;
  const bonusPerGuess = guessBonus(st);

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
          {penalty && (
            <span key={penalty.key} className="pointer-events-none absolute left-0 top-7 text-sm font-extrabold text-danger motion-safe:animate-slide-up">
              −{penalty.n}
            </span>
          )}
        </div>
        <span className="min-w-0 truncate text-base font-extrabold">
          {mode === "blitz" ? (
            <>
              <span className="sr-only sm:not-sr-only">{fmt(tx(S.phraseNo, lang), { n: st.rounds + 1 })}</span>
              <span aria-hidden className="tabular-nums sm:hidden">
                #{st.rounds + 1}
              </span>
            </>
          ) : (
            <>
              <span className="sr-only sm:not-sr-only">{fmt(tx(S.question, lang), { n: qNo, total: qTotal })}</span>
              <span aria-hidden className="tabular-nums sm:hidden">
                {qNo}/{qTotal}
              </span>
            </>
          )}
        </span>
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

      <div className="mt-3 shrink-0">
        <div className="mb-1.5 flex items-center justify-between gap-2 text-sm font-bold text-muted">
          <span className="flex items-center gap-1.5">
            <KeyRound size={16} aria-hidden /> {tx(S.cipher, lang)}
          </span>
          <span className="tabular-nums">{fmt(tx(S.openedOf, lang), { n: st.revealed, total: st.total })}</span>
        </div>
        <CipherBoard key={st.phraseId} state={st} showAll={ended} tone={boardTone} label={boardLabel} />
      </div>

      <div key={taskKey} className={cn("mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-2 motion-safe:animate-fade-in", (guessing || ended) && "hidden")}>
        <TaskArea step={step} answer={answer} onAnswer={onAnswer} locked={locked} result={verdict?.result ?? null} />
      </div>

      {guessing && (
        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-2 motion-safe:animate-fade-in">
          <h2 ref={guessHeadRef} tabIndex={-1} className="text-lg font-extrabold focus:outline-none">
            {tx(S.guessTitle, lang)}
          </h2>
          <p className="text-sm text-muted">{fmt(tx(S.guessHint, lang), { b: bonusPerGuess, p: GUESS_PENALTY })}</p>
          <div className="flex flex-col gap-2">
            {st.options.map((id) => {
              const rej = st.rejected.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  disabled={rej}
                  onClick={() => pickGuess(id)}
                  className="rounded-2xl border-2 border-border bg-surface px-4 py-3 text-left text-base font-bold leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary enabled:active:bg-primary-soft disabled:cursor-not-allowed disabled:border-danger/30 disabled:bg-danger-soft disabled:text-muted disabled:line-through"
                >
                  {phraseById(id).text[lang]}
                  {/* inline-block: зачёркивание кнопки не переходит на пометку */}
                  {rej && <span className="ml-2 inline-block text-xs font-bold">({tx(S.rejected, lang)})</span>}
                </button>
              );
            })}
          </div>
          <Button variant="secondary" block onClick={() => setGuess(false)}>
            {tx(S.back, lang)}
          </Button>
        </div>
      )}

      {ended && (
        <div className="mt-3 flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center motion-safe:animate-fade-in">
          <Mascot mood={mood} size={80} />
          <p
            className={cn(
              "text-2xl font-black motion-safe:animate-pop",
              endKind === "guess" || endKind === "full" ? "text-success-strong" : endKind === "missed" ? "text-warning-strong" : "text-primary-strong",
            )}
          >
            {endKind === "guess"
              ? fmt(tx(S.guessRight, lang), { n: bonusShown })
              : endKind === "full"
                ? tx(S.solvedFull, lang)
                : endKind === "missed"
                  ? tx(S.missed, lang)
                  : endKind === "time"
                    ? t("game.timeUp")
                    : t("game.over")}
          </p>
          <p className="text-base font-bold text-muted">{fmt(tx(S.openedOf, lang), { n: st.revealed, total: st.total })}</p>
        </div>
      )}

      <div className="mt-2 flex shrink-0 flex-col gap-2">
        {phase === "right" && verdict && (
          <p className="text-center text-lg font-extrabold text-success-strong motion-safe:animate-pop">{fmt(tx(S.right, lang), { n: verdict.opened })}</p>
        )}
        {wrongShown && verdict && !guessing && (
          <div className="flex max-h-[34dvh] flex-col gap-1.5 overflow-y-auto rounded-2xl border border-danger/30 bg-danger-soft p-3 motion-safe:animate-fade-in">
            <p className="text-base font-extrabold text-danger-strong">{verdict.timedOut ? t("game.timeUp") : tx(S.wrong, lang)}</p>
            {(step.type !== "match" || verdict.timedOut) && (
              <p className="text-base font-bold">
                <span className="font-mono">{fmt(tx(S.answerWas, lang), { a: verdict.result.expected })}</span>
              </p>
            )}
            {richReveal && (
              <>
                <p className="text-sm">
                  <span className="font-bold">{t("game.why")}: </span>
                  <InlineMarkdown>{l(step.explanation)}</InlineMarkdown>
                </p>
                <p className="text-sm text-muted">{tx(S.nothingOpened, lang)}</p>
              </>
            )}
          </div>
        )}
        {phase === "answering" && manualCheck && !guessing && (
          <Button size="lg" variant="success" block disabled={!ready} onClick={check}>
            {t("common.check")}
          </Button>
        )}
        {wrongShown && richReveal && (
          <Button size="lg" block autoFocus onClick={() => afterQuestion(st)}>
            {t("common.next")}
          </Button>
        )}
        {phase === "answering" && !guessing && !fullyRevealed(st) && (
          <Button id="cipher-know" variant="secondary" block disabled={!canGuess} onClick={openGuess} aria-describedby={guessLockedHint ? "cipher-guess-hint" : undefined}>
            {tx(S.know, lang)}
          </Button>
        )}
        {guessLockedHint && (
          <p id="cipher-guess-hint" className="text-center text-xs text-muted">
            {tx(S.guessLocked, lang)}
          </p>
        )}
      </div>

      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
    </div>
  );
}

/** Пустой пул (у навыков нет заданий нужной формы): сразу нули. */
function Empty({ onFinish }: { onFinish: GameProps["onFinish"] }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    onFinish(emptyResult());
  }, [onFinish]);
  return null;
}

export default function Game(props: GameProps) {
  const [init] = useState(() => {
    const skills = resolveSkills(props.skills);
    const seed = (Date.now() ^ Math.floor(Math.random() * 2 ** 32)) >>> 0;
    const round = startRound(null, { lang: props.lang, mode: props.mode, seed });
    return { skills, seed, first: round ? drawNext(round, skills, seed) : null };
  });
  if (!init.first) return <Empty onFinish={props.onFinish} />;
  return <CipherGame {...props} first={init.first} skills={init.skills} seed={init.seed} />;
}

"use client";

import { Check, Grid3x3 } from "lucide-react";
import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { InlineMarkdown } from "@/components/Markdown";
import { Mascot, type Mood } from "@/components/mascot/Mascot";
import { SceneView } from "@/components/scenes/SceneView";
import { Button } from "@/components/ui/Button";
import type { GameProps } from "@/games/types";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { feedback } from "@/lib/feedback";
import { fmt, tx } from "@/lib/text";
import {
  BLITZ_MS,
  applyAnswer,
  buildCard,
  currentCell,
  emptyResult,
  initialState,
  isDone,
  linesOf,
  resolveSkills,
  taskBudgetMs,
  toResult,
  type BingoState,
} from "./logic";
import { S } from "./strings";

type Phase = "answering" | "right" | "wrong" | "done";
type EndKind = "full" | "time" | "pool";
interface Verdict {
  correct: boolean;
  timedOut: boolean;
  tapped: number | null;
  gained: number;
  bonus: number;
  newLines: number;
  full: boolean;
}

/** Пауза после верного ответа, мс. */
const RIGHT_MS = 700;
/** Блиц: сколько показываем верную клетку после ошибки, мс. */
const BLITZ_WRONG_MS = 1000;
/** Пауза перед итогами, мс. */
const END_DELAY = 1400;

/** Вопрос: memo, чтобы таймер (10 раз в секунду) не перерисовывал условие. */
const Question = memo(function Question({ cellIdx, state }: { cellIdx: number; state: BingoState }) {
  const { l } = useT();
  const step = state.card.cells[cellIdx].step;
  return (
    <div className="flex flex-col gap-3 motion-safe:animate-fade-in">
      <h2 className="text-lg font-extrabold leading-snug sm:text-xl">
        <InlineMarkdown>{l(step.prompt)}</InlineMarkdown>
      </h2>
      {step.scene && <SceneView scene={step.scene} />}
    </div>
  );
});

/**
 * Типографика клетки: слова — обычным шрифтом (уже моноширинного), числа и код — моноширинным;
 * чем длиннее самое длинное слово, тем мельче шрифт — чтобы слово не рвалось посередине.
 */
function cellTextClass(answer: string, big: boolean): string {
  const longest = Math.max(...answer.split(/\s+/).map((w) => w.length));
  const words = /\p{L}{4,}/u.test(answer) && !/[<>()[\]{}=_"'`]/.test(answer);
  const size = big
    ? longest <= 6
      ? "text-[13px] sm:text-sm"
      : longest <= 8
        ? "text-xs sm:text-sm"
        : longest <= 10
          ? "text-[11px] sm:text-sm"
          : "text-[10px] sm:text-[13px]"
    : longest <= 9
      ? "text-sm sm:text-base"
      : "text-xs sm:text-sm";
  return cn(size, "tracking-tight", words ? "font-sans font-extrabold" : "font-mono font-bold");
}

interface BingoProps extends GameProps {
  first: BingoState;
}

function BingoGame({ lang, mode, onFinish, first }: BingoProps) {
  const { t, l } = useT();
  const [st, setSt] = useState<BingoState>(first);
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
  const gridRef = useRef<HTMLDivElement>(null);
  /** После «Дальше» кнопка исчезает — фокус переводим на карточку, чтобы клавиатура не теряла место. */
  const refocusRef = useRef(false);

  const { size, cells } = st.card;
  const cur = currentCell(st);
  const curCell = cur !== null ? cells[cur] : null;
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

  /** Ровно один вызов onFinish; перед ним — короткий экран итога игры. */
  const finish = (kind: EndKind, state: BingoState) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setSt(state);
    setEndKind(kind);
    go("done");
    later(() => onFinish(toResult(state)), END_DELAY);
  };

  const nextQuestion = (state: BingoState) => {
    // Двойной клик по «Дальше» / Enter до перерисовки не должен пропустить вопрос.
    if (finishedRef.current || phaseRef.current === "answering") return;
    if (isDone(state)) {
      finish(state.marked.every(Boolean) ? "full" : "pool", state);
      return;
    }
    setVerdict(null);
    elapsedRef.current = 0;
    setTick(mode === "blitz" ? Math.max(0, remainRef.current) : 0);
    setAnnounce("");
    refocusRef.current = phaseRef.current === "wrong" && richReveal;
    go("answering");
  };

  /** Ответ: номер нажатой клетки (null — время на вопрос вышло). */
  const settle = (tapped: number | null, timedOut: boolean) => {
    if (phaseRef.current !== "answering" || finishedRef.current || cur === null) return;
    const out = applyAnswer(st, tapped);
    setSt(out.state);
    const expected = cells[cur].answer;
    setVerdict({ correct: out.correct, timedOut, tapped, gained: out.gained, bonus: out.bonus, newLines: out.newLines.length, full: out.full });
    if (out.correct) {
      feedback("correct");
      setAnnounce(tx(S.announceRight, lang));
      go("right");
      later(() => (out.full ? finish("full", out.state) : nextQuestion(out.state)), RIGHT_MS);
      return;
    }
    feedback("wrong");
    setAnnounce(fmt(tx(timedOut ? S.announceTimeout : S.announceWrong, lang), { a: expected }));
    go("wrong");
    // Блиц — без остановки; иначе ждём «Дальше». Если вопросов больше нет, а ждать нечего — итог после разбора.
    if (!richReveal) later(() => nextQuestion(out.state), BLITZ_WRONG_MS);
  };

  // Свежие обработчики для таймера и клавиатуры (layout — чтобы клик сразу после перерисовки не попал в старый).
  useLayoutEffect(() => {
    apiRef.current = {
      tick: (dt) => {
        if (finishedRef.current || document.visibilityState === "hidden") return;
        if (mode === "blitz") {
          remainRef.current -= dt;
          setTick(Math.max(0, remainRef.current));
          if (remainRef.current <= 0) finish(st.marked.every(Boolean) ? "full" : "time", st);
          return;
        }
        if (phaseRef.current !== "answering") return;
        elapsedRef.current += dt;
        setTick(elapsedRef.current);
        const budget = curCell ? taskBudgetMs(mode, curCell.level) : null;
        if (budget !== null && elapsedRef.current >= budget) settle(null, true);
      },
      onKey: (e) => {
        if (e.key !== "Enter" || e.repeat || e.ctrlKey || e.metaKey || e.altKey || finishedRef.current) return;
        const el = e.target as HTMLElement | null;
        if (el && typeof el.closest === "function" && (el.closest("[data-toolbox]") || el.tagName === "BUTTON")) return;
        if (phaseRef.current === "wrong" && richReveal) {
          e.preventDefault();
          nextQuestion(st);
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
    if (phase !== "answering" || !refocusRef.current) return;
    refocusRef.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>("button:enabled")?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => apiRef.current?.onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ---------- рендер ----------
  const budgetMs = curCell ? taskBudgetMs(mode, curCell.level) : null;
  let barWidth = (st.pos / cells.length) * 100;
  let barColor = "bg-primary";
  if (mode === "blitz") {
    barWidth = (tick / BLITZ_MS) * 100;
    barColor = tick < 10_000 ? "bg-danger" : tick < 30_000 ? "bg-warning" : "bg-primary";
  } else if (mode === "normal" && budgetMs !== null) {
    const frac = verdict?.timedOut ? 0 : Math.max(0, 1 - tick / budgetMs);
    barWidth = frac * 100;
    barColor = frac < 0.3 ? "bg-warning" : "bg-primary";
  }

  const mood: Mood = phase === "right" ? "happy" : phase === "wrong" ? "sad" : phase === "done" && endKind === "full" ? "celebrate" : "neutral";
  const locked = phase !== "answering";
  const wrongShown = phase === "wrong" && verdict !== null;
  const questionNo = Math.min(phase === "answering" ? st.pos + 1 : st.pos, cells.length);
  const remainSec = Math.ceil(tick / 1000);
  // Клетки собранных линий — золотая рамка (награда).
  const lineCells = new Set(st.lines.flatMap((i) => linesOf(size)[i]));
  // Клетка текущего вопроса показывается только после ответа (подсвечиваем верный ответ при ошибке).
  const revealIdx = wrongShown ? (st.queue[st.pos - 1] ?? null) : null;
  const shownIdx = phase === "answering" ? cur : (st.queue[st.pos - 1] ?? null);

  return (
    <div className="relative isolate mx-auto flex h-[calc(100dvh-56px)] w-full max-w-[560px] touch-manipulation flex-col px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
      <div className="flex h-12 shrink-0 items-center gap-2">
        <div className="relative min-w-14">
          <span className="sr-only">{tx(S.score, lang)}</span>
          <span key={st.score} className="inline-block text-xl font-bold tabular-nums motion-safe:animate-pop">
            {st.score}
          </span>
          {phase === "right" && verdict && verdict.gained > 0 && (
            <span key={st.pos} className="pointer-events-none absolute left-0 top-7 text-sm font-extrabold text-gold motion-safe:animate-slide-up">
              +{verdict.gained}
            </span>
          )}
        </div>
        <span className="min-w-0 truncate text-base font-extrabold">
          <span className="sr-only sm:not-sr-only">{fmt(tx(S.progress, lang), { n: questionNo, total: cells.length })}</span>
          <span aria-hidden className="tabular-nums sm:hidden">
            {questionNo}/{cells.length}
          </span>
        </span>
        {st.lines.length > 0 && (
          <span
            key={st.lines.length}
            title={tx(S.linesLabel, lang)}
            aria-label={`${tx(S.linesLabel, lang)}: ${st.lines.length}`}
            className="flex shrink-0 items-center gap-1 rounded-full bg-gold-soft px-2.5 py-1 text-sm font-extrabold text-text motion-safe:animate-pop"
          >
            <Grid3x3 size={14} aria-hidden className="text-gold" /> {st.lines.length}
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

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {shownIdx !== null && <Question key={shownIdx} cellIdx={shownIdx} state={st} />}
        </div>

        <div className="flex shrink-0 items-end gap-2">
          <div
            ref={gridRef}
            role="group"
            aria-label={tx(S.card, lang)}
            className={cn("grid min-w-0 flex-1 gap-1.5", size === 4 ? "grid-cols-4" : "grid-cols-3")}
          >
            {cells.map((c, i) => {
              const marked = st.marked[i];
              const missed = st.missed[i];
              const isRight = revealIdx === i;
              const isTapped = wrongShown && verdict?.tapped === i;
              const inLine = lineCells.has(i);
              return (
                <button
                  key={i}
                  type="button"
                  lang={lang}
                  disabled={locked || marked || missed}
                  aria-label={marked ? fmt(tx(S.cellMarked, lang), { a: c.answer }) : missed ? fmt(tx(S.cellMissed, lang), { a: c.answer }) : c.answer}
                  onClick={() => settle(i, false)}
                  className={cn(
                    "relative flex items-center justify-center rounded-xl border-2 px-0.5 text-center leading-tight hyphens-auto wrap-anywhere transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    size === 4 ? "min-h-14 sm:min-h-16" : "min-h-[72px] sm:min-h-20",
                    cellTextClass(c.answer, size === 4),
                    !marked && !missed && "border-border bg-surface text-text enabled:active:scale-[0.97] enabled:hover:border-primary",
                    marked && "border-success bg-success-soft text-success-strong",
                    missed && "border-danger/40 bg-danger-soft text-danger-strong",
                    isRight && "border-success bg-success-soft text-success-strong ring-2 ring-success",
                    isTapped && "border-danger ring-2 ring-danger",
                    inLine && "ring-2 ring-gold",
                  )}
                >
                  {marked && <Check size={12} aria-hidden className="absolute right-1 top-1 text-success" />}
                  <span className={cn(marked && "opacity-80")}>{c.answer}</span>
                </button>
              );
            })}
          </div>
          <Mascot mood={mood} size={44} className="mb-1 hidden shrink-0 min-[430px]:block" />
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          {phase === "right" && verdict && (
            <p className="text-center text-lg font-extrabold text-success-strong motion-safe:animate-pop">
              {tx(S.right, lang)}
              {verdict.bonus > 0 && (
                <span className="ml-2 text-sm text-gold">
                  {fmt(tx(verdict.full ? S.fullBonus : S.lineBonus, lang), { n: verdict.bonus })}
                </span>
              )}
            </p>
          )}
          {wrongShown && verdict && (
            <div className="flex max-h-[34dvh] flex-col gap-1.5 overflow-y-auto rounded-2xl border border-danger/30 bg-danger-soft p-3 motion-safe:animate-fade-in">
              <p className="text-base font-extrabold text-danger-strong">{verdict.timedOut ? t("game.timeUp") : tx(S.wrong, lang)}</p>
              <p className="text-base font-bold">
                <span className="font-mono">{fmt(tx(S.answerWas, lang), { a: cells[revealIdx ?? 0].answer })}</span>
              </p>
              {richReveal && (
                <p className="text-sm">
                  <span className="font-bold">{t("game.why")}: </span>
                  <InlineMarkdown>{l(cells[revealIdx ?? 0].step.explanation)}</InlineMarkdown>
                </p>
              )}
            </div>
          )}
          {wrongShown && richReveal && (
            <Button size="lg" block autoFocus onClick={() => nextQuestion(st)}>
              {t("common.next")}
            </Button>
          )}
        </div>
      </div>

      <div className="sr-only" aria-live="polite">
        {announce}
      </div>

      {phase === "done" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-bg/85 px-4 text-center">
          <Mascot mood={endKind === "full" ? "celebrate" : "neutral"} size={96} />
          <p className="text-3xl font-black text-primary-strong motion-safe:animate-pop">
            {endKind === "full" ? tx(S.full, lang) : endKind === "time" ? t("game.timeUp") : tx(S.finished, lang)}
          </p>
          <p className="flex items-center gap-1.5 text-lg font-bold text-muted">
            <Grid3x3 size={18} aria-hidden className="text-gold" /> {fmt(tx(S.lines, lang), { n: st.lines.length })}
          </p>
        </div>
      )}
    </div>
  );
}

/** Карточку собрать не из чего: понятное сообщение и выход через onFinish с нулём. */
function TooFew({ lang, onFinish }: { lang: GameProps["lang"]; onFinish: GameProps["onFinish"] }) {
  const done = useRef(false);
  const leave = () => {
    if (done.current) return;
    done.current = true;
    onFinish(emptyResult());
  };
  return (
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-[420px] flex-col items-center justify-center gap-3 px-4 text-center">
      <Mascot mood="neutral" size={96} />
      <p className="text-xl font-extrabold">{tx(S.tooFew, lang)}</p>
      <p className="text-base text-muted">{tx(S.tooFewHint, lang)}</p>
      <Button size="lg" onClick={leave} autoFocus>
        {tx(S.leave, lang)}
      </Button>
    </div>
  );
}

export default function Game(props: GameProps) {
  const [init] = useState(() => {
    const skills = resolveSkills(props.skills);
    const seed = (Date.now() ^ Math.floor(Math.random() * 2 ** 32)) >>> 0;
    const card = buildCard(skills, props.lang, seed);
    return card ? initialState(card, seed) : null;
  });
  if (!init) return <TooFew lang={props.lang} onFinish={props.onFinish} />;
  return <BingoGame {...props} first={init} />;
}

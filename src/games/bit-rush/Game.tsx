"use client";

import { Check, Delete, Pause, Play, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { Mascot } from "@/components/mascot/Mascot";
import { Button } from "@/components/ui/Button";
import type { GameProps } from "@/games/types";
import { useT } from "@/i18n/useT";
import { checkInput } from "@/lib/check";
import { cn } from "@/lib/cn";
import { ignoreKey } from "@/lib/keys";
import { playSound } from "@/lib/sound";
import { useApp } from "@/lib/store";
import { fmt, tx } from "@/lib/text";
import type { Lang } from "@/lib/types";
import {
  appendKey,
  bonusMs,
  clockAfter,
  createStream,
  eraseKey,
  isFinished,
  isRoundOver,
  MODE_CONFIG,
  multiplier,
  nextQuestion,
  recordAnswer,
  remainingFraction,
  scoreFor,
  SKILLS,
  taskTimeMs,
  type Question,
  type RoundStep,
} from "./logic";
import { S } from "./strings";

type Judge = { chosen: number | null; correct: boolean; timedOut: boolean };
type Mood = "neutral" | "happy" | "sad" | "celebrate";
interface Float {
  id: number;
  text: string;
  kind: "pts" | "clock";
  good: boolean;
}

const END_DELAY = 700;
const TAP_GUARD = 400;

/** Числа и двоичные литералы в подсказке — моноширинным шрифтом. */
function Prompt({ text }: { text: string }) {
  return (
    <>
      {text.split(/([0-9]+[₀-₉]*)/u).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="font-mono">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function Ring({ frac }: { frac: number }) {
  const r = 11;
  const c = 2 * Math.PI * r;
  return (
    <svg width={28} height={28} viewBox="0 0 28 28" className="absolute right-3 top-3 -rotate-90" aria-hidden>
      <circle cx={14} cy={14} r={r} fill="none" strokeWidth={3} className="stroke-surface-2" />
      <circle
        cx={14}
        cy={14}
        r={r}
        fill="none"
        strokeWidth={3}
        strokeLinecap="round"
        className={frac > 0 ? "stroke-gold" : "stroke-transparent"}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - frac)}
      />
    </svg>
  );
}

function Keypad({
  mode,
  locked,
  canSubmit,
  onKey,
  onErase,
  onOk,
  lang,
}: {
  mode: "binary" | "number";
  locked: boolean;
  canSubmit: boolean;
  onKey: (k: string) => void;
  onErase: () => void;
  onOk: () => void;
  lang: Lang;
}) {
  const key =
    "flex h-14 items-center justify-center rounded-xl border-2 border-border bg-surface text-xl font-bold font-mono transition-transform active:scale-95 aria-disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [@media(max-height:700px)]:h-12";
  const digit = (d: string) => (
    <button key={d} type="button" aria-disabled={locked} onClick={() => onKey(d)} className={key}>
      {d}
    </button>
  );
  const erase = (
    <button key="erase" type="button" aria-disabled={locked} onClick={onErase} aria-label={tx(S.erase, lang)} className={cn(key, "text-muted")}>
      <Delete size={22} aria-hidden />
    </button>
  );
  const ok = (
    <button
      key="ok"
      type="button"
      aria-disabled={locked || !canSubmit}
      onClick={onOk}
      aria-label={tx(S.ok, lang)}
      className={cn(key, "border-primary bg-primary font-sans text-white")}
    >
      {tx(S.ok, lang)}
    </button>
  );
  if (mode === "binary") {
    return (
      <div className="grid grid-cols-4 gap-2">
        {digit("0")}
        {digit("1")}
        {erase}
        {ok}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(digit)}
      {erase}
      {digit("0")}
      {ok}
    </div>
  );
}

export default function Game({ lang, sound, mode, onFinish }: GameProps) {
  const { t } = useT();
  const cfg = MODE_CONFIG[mode];
  const [init] = useState(() => {
    const skills = useApp.getState().skills;
    const masteries: Record<string, number | undefined> = {};
    for (const s of SKILLS) masteries[s] = skills[s]?.mastery;
    return nextQuestion(createStream((Date.now() ^ Math.floor(Math.random() * 2 ** 32)) >>> 0, masteries, mode));
  });

  const streamRef = useRef(init.stream);
  const qRef = useRef<Question>(init.question);
  const remainRef = useRef(cfg.clockMs ?? 0);
  const activeRef = useRef(0);
  const qElRef = useRef(0);
  /** Пауза на время разбора ошибки (часы блица и таймер вопроса стоят). */
  const pausedRef = useRef(false);
  /** Пауза по кнопке (обычный темп). */
  const userPausedRef = useRef(false);
  const lockedRef = useRef(false);
  const finishedRef = useRef(false);
  const revealRef = useRef(false);
  const revealAtRef = useRef(0);
  const revealTimerRef = useRef<number | null>(null);
  const scoreRef = useRef(0);
  const typedRef = useRef("");
  const floatIdRef = useRef(0);
  const attemptsRef = useRef<{ skill: string; correct: boolean }[]>([]);
  const correctRef = useRef(0);
  const timersRef = useRef<Set<number>>(new Set());
  const apiRef = useRef<{ end: () => void; timeout: () => void; advance: (fromTap: boolean) => void; onKey: (e: KeyboardEvent) => void } | null>(null);

  const [q, setQ] = useState<Question>(init.question);
  const [qKey, setQKey] = useState(0);
  const [tick, setTick] = useState({ remain: cfg.clockMs ?? 0, qEl: 0 });
  const [answered, setAnswered] = useState(0);
  const [paused, setPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [typed, setTyped] = useState("");
  const [judge, setJudge] = useState<Judge | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [mood, setMood] = useState<Mood>("neutral");
  const [floats, setFloats] = useState<Float[]>([]);
  const [fast, setFast] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [announce, setAnnounce] = useState("");

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
    return id;
  };

  const addFloat = (text: string, kind: Float["kind"], good: boolean) => {
    const id = ++floatIdRef.current;
    setFloats((f) => [...f, { id, text, kind, good }]);
    later(() => setFloats((f) => f.filter((x) => x.id !== id)), 900);
  };

  const flashMood = (m: Mood) => {
    setMood(m);
    later(() => setMood("neutral"), 600);
  };

  const end = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    lockedRef.current = true;
    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
      timersRef.current.delete(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    setTimeUp(true);
    later(() => {
      const attempts = attemptsRef.current.slice();
      onFinish({ score: scoreRef.current, correct: correctRef.current, total: attempts.length, attempts });
    }, END_DELAY);
  };

  const showNext = () => {
    if (finishedRef.current) return;
    if (isRoundOver(mode, attemptsRef.current.length, remainRef.current, activeRef.current)) {
      end();
      return;
    }
    const { stream, question } = nextQuestion(streamRef.current);
    streamRef.current = stream;
    qRef.current = question;
    typedRef.current = "";
    revealRef.current = false;
    pausedRef.current = false;
    qElRef.current = 0;
    lockedRef.current = false;
    setTick((x) => ({ ...x, qEl: 0 }));
    setQ(question);
    setQKey((k) => k + 1);
    setTyped("");
    setJudge(null);
    setRevealing(false);
    setAnnounce("");
  };

  const advance = (fromTap: boolean) => {
    if (!revealRef.current || finishedRef.current) return;
    if (fromTap && performance.now() - revealAtRef.current < TAP_GUARD) return;
    if (revealRef.current && revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
      timersRef.current.delete(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    showNext();
  };

  const judgeAnswer = (correct: boolean, chosen: number | null, timedOut = false) => {
    if (lockedRef.current || finishedRef.current) return;
    lockedRef.current = true;
    const cur = qRef.current;
    const elapsedMs = qElRef.current;
    const prev = streamRef.current;
    const next = recordAnswer(prev, cur, correct);
    streamRef.current = next;
    attemptsRef.current.push({ skill: cur.step.skill ?? "", correct });
    setAnswered(attemptsRef.current.length);
    if (cfg.clockMs !== null) {
      remainRef.current = clockAfter(remainRef.current, correct, cur.tier);
      setTick((x) => ({ ...x, remain: Math.max(0, remainRef.current) }));
    }
    setJudge({ chosen, correct, timedOut });
    setStreak(next.streak);

    if (correct) {
      correctRef.current += 1;
      const pts = scoreFor(mode, cur.step, next.streak, elapsedMs, cur.tier);
      scoreRef.current += pts;
      setScore(scoreRef.current);
      addFloat(`+${pts}`, "pts", true);
      if (cfg.clockMs !== null) addFloat(fmt(tx(S.clockPlus, lang), { n: String(bonusMs(cur.tier) / 1000).replace(".", ",") }), "clock", true);
      if (mode === "blitz" && remainingFraction(cur.step, cur.tier, mode, elapsedMs) > 0.6) {
        setFast(true);
        later(() => setFast(false), 900);
      }
      flashMood(multiplier(next.streak) === 5 && multiplier(prev.streak) < 5 ? "celebrate" : "happy");
      setAnnounce(tx(S.announceRight, lang));
      if (sound) playSound("correct");
      later(showNext, cfg.nextDelayMs);
      return;
    }

    if (cfg.clockMs !== null) addFloat(tx(S.clockMinus, lang), "clock", false);
    flashMood("sad");
    setAnnounce(fmt(tx(timedOut ? S.announceTimeout : S.announceWrong, lang), { a: answerText(cur.step, lang) }));
    if (sound) playSound("wrong");
    if (cfg.clockMs !== null && isFinished(remainRef.current, activeRef.current)) {
      end();
      return;
    }
    pausedRef.current = true;
    revealRef.current = true;
    revealAtRef.current = performance.now();
    setRevealing(true);
    // Спокойный темп: ждём «Далее», само не уходит.
    if (cfg.revealAutoMs !== null) {
      revealTimerRef.current = later(() => {
        revealTimerRef.current = null;
        advance(false);
      }, cfg.revealAutoMs);
    }
  };

  /** Время на вопрос вышло (обычный темп) — это ошибка, показываем верный ответ. */
  const timeout = () => judgeAnswer(false, null, true);

  const pause = () => {
    if (!cfg.questionTimeout || lockedRef.current || finishedRef.current || userPausedRef.current) return;
    userPausedRef.current = true;
    setPaused(true);
  };

  const resume = () => {
    if (!userPausedRef.current) return;
    userPausedRef.current = false;
    setPaused(false);
  };

  const pickOption = (i: number) => {
    const step = qRef.current.step;
    if (step.type !== "choice") return;
    judgeAnswer(i === step.correct, i);
  };

  const typeKey = (k: string) => {
    if (lockedRef.current) return;
    const step = qRef.current.step;
    if (step.type !== "input") return;
    const v = appendKey(typedRef.current, k, step.mode);
    typedRef.current = v;
    setTyped(v);
    if (sound) playSound("tap");
  };

  const erase = () => {
    if (lockedRef.current) return;
    typedRef.current = eraseKey(typedRef.current);
    setTyped(typedRef.current);
  };

  const submit = () => {
    const step = qRef.current.step;
    if (lockedRef.current || step.type !== "input" || !typedRef.current) return;
    judgeAnswer(checkInput(typedRef.current, step.answers, step.mode), null);
  };

  const onKey = (e: KeyboardEvent) => {
    if (ignoreKey(e)) return;
    if (finishedRef.current || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (userPausedRef.current) {
      if (e.key === "Escape") resume();
      return;
    }
    if (revealRef.current) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        advance(true);
      }
      return;
    }
    if (lockedRef.current) return;
    const step = qRef.current.step;
    if (step.type === "choice") {
      if (/^[1-4]$/.test(e.key) && Number(e.key) <= step.options.length) {
        e.preventDefault();
        pickOption(Number(e.key) - 1);
      }
      return;
    }
    if (/^[0-9]$/.test(e.key)) typeKey(e.key);
    else if (e.key === "Backspace") erase();
    else if (e.key === "Enter") submit();
    else return;
    e.preventDefault();
  };

  // Свежие обработчики для rAF-цикла и клавиатуры (ref обновляется в эффекте, не во время рендера).
  useEffect(() => {
    apiRef.current = { end, timeout, advance, onKey };
  });

  useEffect(() => {
    const c = MODE_CONFIG[mode];
    const timers = timersRef.current;
    // В спокойном темпе таймеров нет совсем — цикл не нужен.
    if (c.clockMs === null && !c.questionTimeout) {
      return () => {
        timers.forEach((id) => window.clearTimeout(id));
        timers.clear();
      };
    }
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(now - last, 100);
      last = now;
      if (!finishedRef.current) {
        const running = !pausedRef.current && !userPausedRef.current && document.visibilityState !== "hidden";
        if (running) {
          if (c.clockMs !== null) {
            remainRef.current -= dt;
            activeRef.current += dt;
          }
          if (!lockedRef.current) qElRef.current += dt;
        }
        setTick({ remain: Math.max(0, remainRef.current), qEl: qElRef.current });
        if (c.clockMs !== null && isFinished(remainRef.current, activeRef.current)) {
          apiRef.current?.end();
          return;
        }
        if (c.questionTimeout && running && !lockedRef.current) {
          const budget = taskTimeMs(qRef.current.step, qRef.current.tier, mode);
          if (budget !== null && qElRef.current >= budget) apiRef.current?.timeout();
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
    };
  }, [mode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => apiRef.current?.onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ---------- рендер ----------
  const step = q.step;
  const mult = multiplier(streak);
  const locked = judge !== null || timeUp || paused;
  const wrongJudged = judge !== null && !judge.correct;
  /** В спокойном и обычном темпе ошибку разбираем подробно: карточка с ответом и «Почему так». */
  const richReveal = mode !== "blitz";
  const total = cfg.questions;
  const current = total === null ? 0 : Math.min(total, judge ? answered : answered + 1);

  // Блиц: общие часы и кольцо скорости. Обычный: полоса времени на вопрос. Спокойный: полоса прогресса.
  const remainSec = Math.ceil(tick.remain / 1000);
  const budgetMs = taskTimeMs(step, q.tier, mode);
  const qFrac = judge?.timedOut ? 0 : budgetMs === null ? 0 : Math.max(0, 1 - tick.qEl / budgetMs);
  const ringFrac = judge ? 0 : qFrac;
  let barColor = "bg-primary";
  let barWidth = 100;
  if (mode === "blitz") {
    barColor = tick.remain < 5000 ? "bg-danger" : tick.remain < 15000 ? "bg-warning" : "bg-primary";
    barWidth = (tick.remain / (cfg.clockMs ?? 1)) * 100;
  } else if (mode === "normal") {
    barColor = qFrac < 0.3 ? "bg-warning" : "bg-primary";
    barWidth = qFrac * 100;
  } else {
    barWidth = total ? (answered / total) * 100 : 0;
  }
  const bgOpacity = mult >= 5 ? 1 : mult === 4 ? 0.6 : 0;

  const nextButton = (
    <button
      type="button"
      onClick={() => apiRef.current?.advance(true)}
      className={cn(
        "w-full rounded-xl bg-primary px-4 text-base font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        richReveal ? "min-h-14 shrink-0" : "mt-1 min-h-12",
      )}
    >
      {t("common.next")}
      {cfg.revealAutoMs !== null && <span className="ml-1 text-sm font-medium opacity-80">· {tx(S.tapToContinue, lang)}</span>}
    </button>
  );

  return (
    <div
      onClick={cfg.revealAutoMs === null ? undefined : () => apiRef.current?.advance(true)}
      className="relative isolate mx-auto flex h-[calc(100dvh-56px)] w-full max-w-[640px] touch-manipulation select-none flex-col px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-primary-soft to-streak-soft motion-safe:transition-opacity motion-safe:duration-[400ms]"
        style={{ opacity: bgOpacity }}
      />

      <div className="relative flex h-12 shrink-0 items-center justify-between">
        <div className="relative min-w-20">
          <span className="sr-only">{tx(S.score, lang)}</span>
          <span key={score} className="inline-block text-xl font-bold tabular-nums motion-safe:animate-pop">
            {score}
          </span>
          {floats
            .filter((f) => f.kind === "pts")
            .map((f) => (
              <span key={f.id} className="pointer-events-none absolute left-0 top-7 hidden text-sm font-extrabold text-gold motion-safe:block motion-safe:animate-slide-up">
                {f.text}
              </span>
            ))}
        </div>
        <div className="flex items-center gap-2">
          {mult > 1 && (
            <span
              key={mult}
              aria-label={tx(S.combo, lang)}
              className="rounded-full bg-streak-soft px-3 py-1 text-base font-extrabold text-streak motion-safe:animate-pop"
            >
              x{mult}
            </span>
          )}
          {fast && (
            <span className="rounded-full bg-gold-soft px-2.5 py-1 text-sm font-extrabold text-warning-strong motion-safe:animate-pop">{tx(S.fast, lang)}</span>
          )}
        </div>
        <div className="relative flex items-center gap-2">
          {mode === "blitz" ? (
            <span
              className={cn(
                "text-lg font-bold tabular-nums",
                tick.remain < 5000 ? "text-danger-strong motion-safe:animate-pulse" : tick.remain < 15000 ? "text-warning-strong" : "text-text",
              )}
            >
              {fmt(tx(S.seconds, lang), { n: remainSec })}
            </span>
          ) : (
            <span className="text-lg font-bold tabular-nums" aria-label={fmt(tx(S.progress, lang), { n: current, total: total ?? 0 })}>
              {current}/{total}
            </span>
          )}
          {mode === "normal" && (
            <button
              type="button"
              onClick={pause}
              disabled={judge !== null || timeUp}
              aria-label={t("game.pause")}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
            >
              <Pause size={22} aria-hidden />
            </button>
          )}
          <Mascot mood={mood} size={36} />
          {floats
            .filter((f) => f.kind === "clock")
            .map((f) => (
              <span
                key={f.id}
                className={cn(
                  "pointer-events-none absolute right-10 top-8 hidden whitespace-nowrap text-sm font-extrabold motion-safe:block motion-safe:animate-slide-up",
                  f.good ? "text-success" : "text-danger",
                )}
              >
                {f.text}
              </span>
            ))}
        </div>
      </div>

      <div className={cn("w-full shrink-0 overflow-hidden rounded-full bg-surface-2", mode === "normal" ? "h-2" : "h-1.5")} aria-hidden>
        <div className={cn("h-full rounded-full", barColor, mode === "calm" && "motion-safe:transition-[width] motion-safe:duration-300")} style={{ width: `${barWidth}%` }} />
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2">
        <div
          key={qKey}
          className={cn(
            "relative flex min-h-24 flex-1 flex-col overflow-auto rounded-2xl border border-border bg-surface p-5 text-center motion-safe:animate-fade-in",
            wrongJudged && "motion-safe:animate-shake",
          )}
        >
          {mode === "blitz" && <Ring frac={ringFrac} />}
          {q.retry && <span className="absolute left-3 top-3 rounded-full bg-surface-2 px-2.5 py-0.5 text-sm font-bold text-muted">{tx(S.retryTag, lang)}</span>}
          <div className="my-auto">
            <p className="text-xl font-semibold sm:text-2xl">
              <Prompt text={tx(step.prompt, lang)} />
            </p>
          </div>
        </div>

        <div className={cn("shrink-0 text-center", !richReveal && "min-h-12")}>
          {judge?.correct && <p className="py-2 text-lg font-extrabold text-success-strong motion-safe:animate-pop">{tx(S.correct, lang)}</p>}
          {wrongJudged && richReveal && (
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-2 p-3 text-left motion-safe:animate-fade-in">
              <p className="text-base font-extrabold text-danger-strong">{judge.timedOut ? t("game.timeUp") : tx(S.wrong, lang)}</p>
              <p className="flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2 text-base font-bold text-success-strong">
                <Check size={18} className="shrink-0" aria-hidden />
                <span className="font-mono">{fmt(tx(S.answerWas, lang), { a: answerText(step, lang) })}</span>
              </p>
              <p className="text-sm text-text">
                <span className="font-bold">{t("game.why")}: </span>
                {tx(step.explanation, lang)}
              </p>
            </div>
          )}
          {wrongJudged && !richReveal && (
            <div className="flex flex-col items-center gap-1 motion-safe:animate-fade-in">
              <p className="text-lg font-extrabold text-danger-strong">
                {tx(S.wrong, lang)}
                {step.type === "input" && (
                  <>
                    {" · "}
                    <span className="font-mono">{fmt(tx(S.answerWas, lang), { a: answerText(step, lang) })}</span>
                  </>
                )}
              </p>
              <p className="text-sm text-muted">{tx(step.explanation, lang)}</p>
              {revealing && nextButton}
            </div>
          )}
        </div>

        {step.type === "choice" ? (
          <div className="grid shrink-0 grid-cols-2 gap-3">
            {step.options.map((o, i) => {
              const text = tx(o, lang);
              const isRight = judge !== null && i === step.correct;
              const isWrongPick = wrongJudged && judge.chosen === i;
              return (
                <button
                  key={`${qKey}-${i}`}
                  type="button"
                  aria-disabled={locked}
                  onClick={() => pickOption(i)}
                  className={cn(
                    "relative flex min-h-16 items-center justify-center rounded-xl border-2 px-3 text-lg font-semibold transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    step.options.length === 3 && i === 2 && "col-span-2",
                    /^[\d₀-₉]+$/u.test(text.replace(/\s/g, "")) || /[01]+₂/.test(text) ? "font-mono" : "",
                    isRight
                      ? "border-success bg-success-soft text-success-strong"
                      : isWrongPick
                        ? "border-danger bg-danger-soft text-danger-strong"
                        : "border-border bg-surface",
                    judge !== null && !isRight && !isWrongPick && "opacity-60",
                  )}
                >
                  {text}
                  {isRight && <Check size={20} className="absolute right-2 top-2" aria-hidden />}
                  {isWrongPick && <X size={20} className="absolute right-2 top-2" aria-hidden />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex shrink-0 flex-col gap-2">
            <div
              role="textbox"
              aria-readonly="true"
              aria-label={tx(S.typeAnswer, lang)}
              className={cn(
                "flex h-14 items-center justify-center rounded-xl border-2 bg-surface px-3 font-mono text-2xl font-bold [@media(max-height:700px)]:h-12",
                judge?.correct ? "border-success text-success-strong" : wrongJudged ? "border-danger text-danger-strong" : "border-primary",
              )}
            >
              {typed ? (
                <>
                  {typed}
                  <span className="ml-1 text-lg text-muted">{step.suffix}</span>
                </>
              ) : (
                <span className="font-sans text-base font-medium text-muted">{tx(S.typeAnswer, lang)}</span>
              )}
            </div>
            {/* При разборе ошибки клавиатуру убираем: место нужно под объяснение и кнопку. */}
            {!(richReveal && wrongJudged) && (
              <Keypad mode={step.mode === "binary" ? "binary" : "number"} locked={locked} canSubmit={typed.length > 0} onKey={typeKey} onErase={erase} onOk={submit} lang={lang} />
            )}
          </div>
        )}

        {richReveal && wrongJudged && revealing && nextButton}
      </div>

      <div className="sr-only" aria-live="polite">
        {announce}
      </div>

      {timeUp && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/80 px-4">
          <p className="text-center text-4xl font-black text-primary-strong motion-safe:animate-pop">{mode === "blitz" ? tx(S.timeUp, lang) : t("game.over")}</p>
        </div>
      )}

      {paused && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-bg px-4">
          <Mascot mood="neutral" size={96} />
          <p className="text-2xl font-extrabold">{t("game.paused")}</p>
          <Button size="lg" onClick={resume} icon={<Play size={20} fill="currentColor" />} autoFocus>
            {t("common.continue")}
          </Button>
        </div>
      )}
    </div>
  );
}

function answerText(step: RoundStep, lang: Lang): string {
  return step.type === "choice" ? tx(step.options[step.correct], lang) : `${step.answers[0]}${step.suffix ?? ""}`;
}

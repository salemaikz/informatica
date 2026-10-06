"use client";

import { Check, Pause, Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { liveMastery } from "@/games/live-mastery";
import type { GameAttempt, GameProps } from "@/games/types";
import { Mascot } from "@/components/mascot/Mascot";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { ignoreKey } from "@/lib/keys";
import { playSound } from "@/lib/sound";
import { fmt, tx } from "@/lib/text";
import type { SkillId } from "@/lib/types";
import { S } from "./strings";
import {
  MODE_CONFIG,
  RoundEngine,
  bitsOf,
  breakdown,
  evaluate,
  goalExpr,
  isPerfect,
  newSeed,
  onWeights,
  pointsFor,
  taskTimeMs,
  valueOfBits,
  weights,
  whyParts,
  type Goal,
  type Reason,
  type Task,
} from "./logic";

interface Feedback {
  correct: boolean;
  points: number;
  perfect: boolean;
  timedOut: boolean;
  requeued: boolean;
  reason: Reason | null;
  picked: number | null;
  /** Комбинация ученика в момент ответа. */
  mine: number[];
}

type Phase = "play" | "feedback";

const masteryOf = (skill: SkillId) => liveMastery(skill) ?? 0.3;

export default function Game({ lang, sound, mode, onFinish }: GameProps) {
  const { t } = useT();
  const cfg = MODE_CONFIG[mode];
  const [init] = useState(() => {
    const engine = new RoundEngine(newSeed(), mode);
    return { engine, first: engine.next(masteryOf) as Task };
  });
  const engine = init.engine;

  const [task, setTask] = useState<Task>(init.first);
  const [bits, setBits] = useState<number[]>(() => startBits(init.first));
  const [flips, setFlips] = useState(0);
  const [phase, setPhase] = useState<Phase>("play");
  const [fb, setFb] = useState<Feedback | null>(null);
  const [score, setScore] = useState(0);
  const [index, setIndex] = useState(1);
  const [clock, setClock] = useState({ round: cfg.roundSeconds ?? 0, task: limitSecOf(init.first, mode) ?? 0 });
  const [timeUp, setTimeUp] = useState(false);
  const [paused, setPaused] = useState(false);
  const [live, setLive] = useState("");
  const [lastFlip, setLastFlip] = useState({ i: -1, n: 0 });

  // Изменяемое состояние раунда живёт в рефах: его читают таймеры и обработчики.
  const phaseRef = useRef<Phase>("play");
  const pausedRef = useRef(false);
  /** Ждём явного нажатия «Далее» (спокойный темп после ошибки). */
  const hold = useRef(false);
  const roundLeft = useRef(cfg.roundSeconds ?? 0);
  /** Остаток времени на задание; null — задание без таймера. */
  const taskLeft = useRef<number | null>(limitSecOf(init.first, mode));
  const shownClock = useRef({ r: -1, t: -1 });
  const scoreRef = useRef(0);
  const correctRef = useRef(0);
  const attemptsRef = useRef<GameAttempt[]>([]);
  const finishedRef = useRef(false);
  const nextLocked = useRef(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zw = useRef(false);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFinishRef = useRef(onFinish);
  const handlers = useRef<{ key: (e: KeyboardEvent) => void; frame: (dt: number) => void }>({
    key: () => {},
    frame: () => {},
  });

  const B = task.bits;
  const limitSec = limitSecOf(task, mode);
  const timed = limitSec !== null;
  const blind = cfg.blind && task.tier === 2 && (task.mode === "build" || task.mode === "read");
  const inFeedback = phase === "feedback";
  const locked = inFeedback || timeUp;

  const finish = (withOverlay: boolean) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    phaseRef.current = "feedback";
    if (autoTimer.current) clearTimeout(autoTimer.current);
    const done = () => {
      const attempts = attemptsRef.current;
      onFinishRef.current({ score: scoreRef.current, correct: correctRef.current, total: attempts.length, attempts });
    };
    if (withOverlay) {
      setTimeUp(true);
      endTimer.current = setTimeout(done, 700);
    } else {
      done();
    }
  };

  const announce = (text: string, delay = 0) => {
    if (liveTimer.current) clearTimeout(liveTimer.current);
    zw.current = !zw.current;
    const t = zw.current ? `${text}\u200b` : text;
    if (delay === 0) setLive(t);
    else liveTimer.current = setTimeout(() => setLive(t), delay);
  };

  const flip = (i: number) => {
    if (phaseRef.current !== "play" || task.mode === "read") return;
    if (sound) playSound("tap");
    const nb = bits.map((b, j) => (j === i ? 1 - b : b));
    setBits(nb);
    setFlips((f) => f + 1);
    setLastFlip((p) => ({ i, n: p.n + 1 }));
    announce(blind ? tx(S.sumHiddenShort, lang) : fmt(tx(S.ariaSum, lang), { n: valueOfBits(nb) }), 300);
  };

  const reset = () => {
    if (phaseRef.current !== "play" || task.mode === "read") return;
    if (sound) playSound("tap");
    setBits(Array.from({ length: B }, () => 0));
  };

  const resolve = (value: number | null, timedOut: boolean) => {
    if (phaseRef.current !== "play" || finishedRef.current) return;
    phaseRef.current = "feedback";
    nextLocked.current = true;
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => {
      nextLocked.current = false;
    }, 250);
    const check = value === null ? { ok: false } : evaluate(task, value);
    const perfect = check.ok && isPerfect(task, flips);
    const points = check.ok ? pointsFor(mode, taskLeft.current ?? 0, limitSec, perfect) : 0;
    const requeued = engine.resolve(task, check.ok);
    attemptsRef.current.push({ skill: task.skill, correct: check.ok });
    scoreRef.current += points;
    if (check.ok) correctRef.current++;
    if (sound) playSound(check.ok ? "correct" : "wrong");
    setScore(scoreRef.current);
    setPhase("feedback");
    const reason = "reason" in check && check.reason ? check.reason : null;
    setFb({ correct: check.ok, points, perfect, timedOut, requeued, reason, picked: task.mode === "read" ? value : null, mine: bits });
    const why = whyParts(task);
    announce(check.ok ? `${tx(S.correct, lang)} +${points}` : `${tx(S.wrong, lang)}. ${why.lead} ${why.answer}`);
    const advance = check.ok ? cfg.correctAdvanceMs : cfg.wrongAdvanceMs;
    hold.current = advance === null;
    if (advance !== null) autoTimer.current = setTimeout(next, advance);
  };

  const next = () => {
    if (phaseRef.current !== "feedback" || finishedRef.current) return;
    if (autoTimer.current) clearTimeout(autoTimer.current);
    const t = engine.next(masteryOf);
    if (!t) {
      finish(false);
      return;
    }
    const lim = limitSecOf(t, mode);
    phaseRef.current = "play";
    hold.current = false;
    taskLeft.current = lim;
    setTask(t);
    setBits(startBits(t));
    setFlips(0);
    setFb(null);
    setIndex((i) => i + 1);
    setClock((c) => ({ ...c, task: lim ?? 0 }));
    setPhase("play");
    setLive("");
  };

  // Тап пользователя по «Дальше» игнорируется первые 250 мс после ответа (двойной тап).
  const userNext = () => {
    if (nextLocked.current) return;
    next();
  };

  const submit = () => resolve(task.mode === "read" ? null : valueOfBits(bits), false);
  const pick = (v: number) => resolve(v, false);

  const pause = () => {
    if (!cfg.pausable || phaseRef.current !== "play" || finishedRef.current || pausedRef.current) return;
    pausedRef.current = true;
    setPaused(true);
  };
  const resume = () => {
    pausedRef.current = false;
    setPaused(false);
  };

  useEffect(() => {
    handlers.current.key = (e) => {
      if (ignoreKey(e)) return;
      if (e.ctrlKey || e.metaKey || e.altKey || finishedRef.current) return;
      if (pausedRef.current) {
        if (e.key === "p" || e.key === "P" || e.key === "Escape") {
          e.preventDefault();
          resume();
        }
        return;
      }
      if (phaseRef.current === "feedback") {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!e.repeat) userNext();
        }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (!e.repeat && task.mode !== "read") submit();
      } else if ((e.key === "p" || e.key === "P") && cfg.pausable) {
        e.preventDefault();
        pause();
      } else if (e.key === "Backspace" || e.key === "Escape") {
        e.preventDefault();
        reset();
      } else if (/^[1-9]$/.test(e.key)) {
        const n = Number(e.key);
        if (task.mode === "read") {
          const opt = task.options?.[n - 1];
          if (opt !== undefined && !e.repeat) pick(opt);
        } else if (n <= B && !e.repeat) flip(n - 1);
      }
    };
    handlers.current.frame = (dt) => {
      if (document.hidden || pausedRef.current || phaseRef.current !== "play" || finishedRef.current) return;
      const tl = taskLeft.current;
      if (tl !== null) taskLeft.current = tl - dt;
      if (cfg.roundSeconds !== null) roundLeft.current -= dt;
      const r = Math.max(0, Math.round(roundLeft.current * 20));
      const tk = taskLeft.current === null ? 0 : Math.max(0, Math.round(taskLeft.current * 20));
      if (r !== shownClock.current.r || tk !== shownClock.current.t) {
        shownClock.current = { r, t: tk };
        setClock({ round: Math.max(0, roundLeft.current), task: Math.max(0, taskLeft.current ?? 0) });
      }
      if (cfg.roundSeconds !== null && roundLeft.current <= 0) finish(true);
      else if (taskLeft.current !== null && taskLeft.current <= 0) resolve(null, true);
    };
  });

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => handlers.current.key(e);
    window.addEventListener("keydown", onKey);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      handlers.current.frame(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      if (autoTimer.current) clearTimeout(autoTimer.current);
      if (liveTimer.current) clearTimeout(liveTimer.current);
      if (endTimer.current) clearTimeout(endTimer.current);
      if (lockTimer.current) clearTimeout(lockTimer.current);
    };
  }, []);

  const ws = weights(B);
  const correctBits = task.mode === "read" ? null : bitsOf(task.answer, B);
  const roundMode = cfg.roundSeconds !== null;
  const roundFrac = cfg.roundSeconds ? clock.round / cfg.roundSeconds : 1;
  const taskFrac = limitSec ? clock.task / limitSec : 1;
  const lowTime = taskFrac <= 0.25;
  const hideWeights = blind && task.mode === "read" && !inFeedback;
  const hideSum = blind && task.mode === "build" && !inFeedback;
  // После ошибки на самих переключателях показываем правильную комбинацию (спокойный и обычный темп).
  const revealing = !!fb && !fb.correct && cfg.revealOnSwitches && task.mode !== "read";
  const shownBits = revealing && correctBits ? correctBits : bits;
  const mine = fb ? fb.mine : bits;
  const sum = valueOfBits(shownBits);
  const parts = onWeights(shownBits);
  const why = whyParts(task);

  const mood = paused ? "neutral" : fb ? (fb.correct ? (fb.perfect ? "celebrate" : "happy") : "sad") : "neutral";

  return (
    <div
      className="relative mx-auto flex h-[calc(100dvh-56px)] w-full max-w-[640px] touch-manipulation select-none flex-col px-4 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]"
      onClick={() => {
        if (phaseRef.current === "feedback" && !hold.current) userNext();
      }}
    >
      {/* Доска целиком: на паузе скрыта и недоступна */}
      <div inert={paused} className="flex min-h-0 flex-1 flex-col">
        {/* Верхняя строка */}
        <div className="flex h-11 shrink-0 items-center justify-between gap-2">
          <span className="text-sm font-semibold tabular-nums text-muted">
            {fmt(tx(S.progress, lang), { i: Math.min(index, engine.total), n: engine.total })}
          </span>
          <span className="text-base font-extrabold tabular-nums">
            <span className="mr-1 text-sm font-semibold text-muted">{tx(S.score, lang)}</span>
            {score}
          </span>
          {roundMode && (
            <span className={cn("w-10 text-right text-base font-bold tabular-nums", clock.round <= 10 ? "text-warning-strong" : "text-muted")}>
              {Math.ceil(clock.round)}
            </span>
          )}
          {!roundMode && timed && (
            <span className={cn("w-9 text-right text-base font-bold tabular-nums", lowTime && !inFeedback ? "text-warning-strong" : "text-muted")}>
              {Math.ceil(clock.task)}
            </span>
          )}
          {cfg.pausable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                pause();
              }}
              disabled={inFeedback}
              aria-label={t("game.pause")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40"
            >
              <Pause size={22} />
            </button>
          )}
          <Mascot mood={mood} size={32} />
        </div>
        {roundMode ? (
          <Bar frac={roundFrac} className="h-1.5" warn={clock.round <= 10} />
        ) : timed ? (
          <Bar frac={taskFrac} className="h-1.5" warn={lowTime} />
        ) : null}

        {/* Карточка задания */}
        <div className="mt-3 shrink-0 rounded-2xl border border-border bg-surface px-4 py-3 text-center">
          {task.mode === "read" ? (
            <div className="flex min-h-[64px] items-center justify-center text-xl font-semibold">{tx(S.read, lang)}</div>
          ) : (
            <>
              <div className="text-sm text-muted">{tx(task.mode === "build" ? S.build : S.property, lang)}</div>
              {task.mode === "build" ? (
                <div className="font-mono text-5xl font-bold tabular-nums">{task.answer}</div>
              ) : (
                <div className="flex min-h-[48px] items-center justify-center text-xl font-semibold">
                  {task.goal ? goalText(task.goal, lang) : ""}
                </div>
              )}
            </>
          )}
          {roundMode && timed && <Bar frac={taskFrac} className="mt-2 h-1" warn={taskFrac <= 0.3} />}
        </div>

        {/* Считывание */}
        <div className="mt-3 shrink-0 text-center">
          <div className="font-mono text-2xl font-bold tracking-widest">{shownBits.join("")}</div>
          {task.mode !== "read" && (
            <div className="text-3xl font-bold tabular-nums">
              {tx(S.sum, lang)} = {hideSum ? "?" : sum}
            </div>
          )}
          {cfg.runningSum && task.mode !== "read" && (
            <div className="font-mono text-sm tabular-nums text-muted">{parts.length > 0 ? parts.join(" + ") : "—"}</div>
          )}
          {blind && task.mode === "build" && !inFeedback && <div className="text-xs text-muted">{tx(S.sumHidden, lang)}</div>}
          {task.mode !== "read" &&
            (revealing ? (
              <div className="text-xs font-semibold text-success-strong">{tx(task.mode === "property" ? S.exampleLead : S.correctPattern, lang)}</div>
            ) : (
              <div className="text-xs text-muted tabular-nums">{fmt(tx(S.flips, lang), { n: flips })}</div>
            ))}
        </div>

        {/* Переключатели */}
        <div
          role="group"
          aria-label={tx(S.switchesAria, lang)}
          className="mx-auto mt-3 grid w-full shrink-0 gap-0.5"
          style={{ gridTemplateColumns: `repeat(${B}, minmax(0, 1fr))`, maxWidth: B * 64 }}
        >
          {shownBits.map((b, i) => {
            const on = b === 1;
            const wrongBit =
              !!fb && !fb.correct && correctBits !== null && (!revealing || task.mode === "build") && mine[i] !== correctBits[i];
            const stateText = tx(on ? S.bitOn : S.bitOff, lang);
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "tabular-nums",
                    cfg.runningSum
                      ? cn("text-base font-bold", on ? ((fb?.correct || revealing) ? "text-success-strong" : "text-primary") : "text-muted")
                      : "text-[11px] text-muted",
                  )}
                >
                  {hideWeights ? "?" : ws[i]}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-disabled={locked || task.mode === "read"}
                  aria-label={
                    hideWeights
                      ? fmt(tx(S.bitAriaHidden, lang), { state: stateText })
                      : fmt(tx(S.bitAria, lang), { w: ws[i], state: stateText })
                  }
                  onClick={(e) => {
                    if (phaseRef.current === "play") e.stopPropagation();
                    flip(i);
                  }}
                  style={(fb?.correct || revealing) && on ? { transitionDelay: `${i * 40}ms` } : undefined}
                  className={cn(
                    "flex h-16 w-full items-center justify-center rounded-xl border font-mono text-xl font-bold transition-[background-color,color,transform] duration-150 motion-reduce:transition-none motion-reduce:delay-0! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.92] motion-reduce:active:scale-100",
                    on ? "border-transparent bg-action-primary text-white shadow-md shadow-primary/30" : "border-border bg-surface-2 text-muted",
                    (fb?.correct || revealing) && on && "bg-success",
                    wrongBit && "outline-2 outline-offset-1 outline-danger",
                    (locked || task.mode === "read") && "cursor-default",
                  )}
                >
                  <span key={i === lastFlip.i ? lastFlip.n : 0} className={cn(i === lastFlip.i && !inFeedback && "animate-pop motion-reduce:animate-none")}>
                    {b}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Обратная связь */}
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {fb && (
            <div className="animate-fade-in flex flex-col items-center gap-1.5 text-center motion-reduce:animate-none">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-3 py-1 text-base font-bold",
                    fb.correct ? "bg-success-soft text-success-strong" : "bg-danger-soft text-danger-strong",
                  )}
                >
                  {fb.correct ? <Check size={18} /> : <X size={18} />}
                  {tx(fb.correct ? S.correct : fb.timedOut ? S.taskTimeUp : S.wrong, lang)}
                </span>
                {fb.correct && (
                  <span className="animate-pop text-2xl font-extrabold tabular-nums text-gold motion-reduce:animate-none">+{fb.points}</span>
                )}
                {fb.perfect && (
                  <span className="rounded-full bg-gold-soft px-3 py-1 text-sm font-bold text-text">{tx(S.perfectChip, lang)}</span>
                )}
              </div>
              {task.mode === "read" && (
                <div className="flex justify-center gap-2" aria-hidden>
                  {task.options?.map((o) => (
                    <span
                      key={o}
                      className={cn(
                        "flex h-9 min-w-14 items-center justify-center gap-1 rounded-lg px-2 font-mono text-base font-bold",
                        o === task.answer ? "bg-success-soft text-success-strong" : o === fb.picked ? "bg-danger-soft text-danger-strong" : "bg-surface-2 text-muted",
                      )}
                    >
                      {o === task.answer ? <Check size={14} /> : o === fb.picked ? <X size={14} /> : null}
                      {o}
                    </span>
                  ))}
                </div>
              )}
              {!fb.correct && cfg.revealOnSwitches && (
                <div className="w-full rounded-2xl border border-border bg-surface-2 px-3 py-2">
                  <div className="text-xs font-semibold text-muted">{t("game.why")}</div>
                  {fb.reason && <div className="text-sm text-text">{fmt(tx(S[fb.reason.key], lang), fb.reason.params)}</div>}
                  <div className="font-mono text-sm tabular-nums">
                    {task.mode === "property" && <span className="font-sans text-muted">{tx(S.exampleLead, lang)} </span>}
                    {why.lead} <span className="font-bold text-success-strong">{why.answer}</span>
                  </div>
                  {fb.requeued && (
                    <span className="mt-1 inline-block rounded-full bg-warning-soft px-3 py-0.5 text-xs font-semibold text-warning-strong">
                      {tx(S.retryLater, lang)}
                    </span>
                  )}
                </div>
              )}
              {!fb.correct && !cfg.revealOnSwitches && (
                <>
                  {fb.reason && <div className="text-sm text-text">{fmt(tx(S[fb.reason.key], lang), fb.reason.params)}</div>}
                  <div className="text-xs text-muted">{tx(task.mode === "property" ? S.exampleLead : S.correctPattern, lang)}</div>
                  <div className="flex gap-1" aria-hidden>
                    {bitsOf(task.answer, B).map((b, i) => (
                      <span
                        key={i}
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-md font-mono text-sm font-bold",
                          b ? "bg-action-success text-white" : "bg-surface-2 text-muted",
                        )}
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                  <div className="font-mono text-sm tabular-nums">
                    {task.mode === "property"
                      ? `${bitsOf(task.answer, B).join("")}₂ = ${task.answer}`
                      : breakdown(task.answer)}
                  </div>
                  {fb.requeued && <span className="rounded-full bg-warning-soft px-3 py-0.5 text-xs font-semibold text-warning-strong">{tx(S.retryLater, lang)}</span>}
                </>
              )}
            </div>
          )}
        </div>

        {/* Нижний ряд */}
        {inFeedback ? (
          <div className="h-14 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                userNext();
              }}
              className="h-full w-full rounded-xl bg-action-primary text-lg font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t("common.next")}
            </button>
          </div>
        ) : task.mode === "read" ? (
          <div role="group" aria-label={tx(S.optionsAria, lang)} className="grid shrink-0 grid-cols-3 gap-2">
            {task.options?.map((o) => (
              <button
                key={o}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  pick(o);
                }}
                className="h-16 rounded-xl border border-border bg-surface font-mono text-2xl font-bold tabular-nums transition-transform hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95"
              >
                {o}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex h-14 shrink-0 gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                reset();
              }}
              className="h-full flex-1 rounded-xl border border-border bg-surface-2 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {tx(S.reset, lang)}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                submit();
              }}
              className="h-full flex-[2] rounded-xl bg-action-primary text-lg font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {tx(S.submit, lang)}
            </button>
          </div>
        )}
      </div>

      <div aria-live="polite" className="sr-only">
        {live}
      </div>

      {paused && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("game.paused")}
          onClick={(e) => e.stopPropagation()}
          className="animate-fade-in absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-bg motion-reduce:animate-none"
        >
          <Mascot mood="neutral" size={72} />
          <p className="text-2xl font-extrabold">{t("game.paused")}</p>
          <button
            type="button"
            autoFocus
            onClick={resume}
            className="flex h-14 min-w-52 items-center justify-center gap-2 rounded-xl bg-action-primary px-8 text-lg font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Play size={20} fill="currentColor" /> {t("common.continue")}
          </button>
        </div>
      )}

      {timeUp && (
        <div className="animate-fade-in absolute inset-0 z-10 flex items-center justify-center bg-bg/85 motion-reduce:animate-none">
          <span className="animate-pop text-5xl font-extrabold text-warning-strong motion-reduce:animate-none">{tx(S.timeUp, lang)}</span>
        </div>
      )}
    </div>
  );
}

/** Секунд на задание в текущем темпе; null — без таймера. */
function limitSecOf(task: Task, mode: GameProps["mode"]): number | null {
  const ms = taskTimeMs(task, mode);
  return ms === null ? null : ms / 1000;
}

function startBits(t: Task): number[] {
  return t.mode === "read" ? bitsOf(t.answer, t.bits) : Array.from({ length: t.bits }, () => 0);
}

function goalText(goal: Goal, lang: GameProps["lang"]): string {
  switch (goal.kind) {
    case "evenOnes":
      return fmt(tx(S.goalEvenOnes, lang), { k: goal.k });
    case "pow":
    case "powMinus":
      return fmt(tx(S.goalNumber, lang), { expr: goalExpr(goal) });
    case "smallest":
      return fmt(tx(S.goalSmallest, lang), { n: goal.n });
    case "oddGreater":
      return fmt(tx(S.goalOddGreater, lang), { m: goal.m });
  }
}

function Bar({ frac, className, warn }: { frac: number; className?: string; warn: boolean }) {
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-surface-2", className)} aria-hidden>
      <div
        className={cn("h-full rounded-full", warn ? "bg-warning" : "bg-primary")}
        style={{ width: `${Math.max(0, Math.min(1, frac)) * 100}%` }}
      />
    </div>
  );
}

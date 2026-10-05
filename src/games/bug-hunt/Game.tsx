"use client";

import { Check, Flame, Pause, Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Mascot } from "@/components/mascot/Mascot";
import { liveMastery } from "@/games/live-mastery";
import type { GameAttempt, GameMode, GameProps } from "@/games/types";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { ignoreKey } from "@/lib/keys";
import { playSound } from "@/lib/sound";
import { fmt, seeded, tx } from "@/lib/text";
import type { Lang } from "@/lib/types";
import {
  FIX_BONUS,
  MODE_CONFIG,
  bonusSeconds,
  findPoints,
  generatePuzzle,
  isCorrectFind,
  multiplier,
  pickTemplate,
  startTierState,
  taskTimeMs,
  tierFor,
  updateTier,
  wantNoFault,
  type Puzzle,
  type TemplateId,
  type TierState,
} from "./logic";
import { S } from "./strings";

type Phase = "boot" | "play" | "fix" | "reveal" | "end";
type Outcome = "clean" | "found" | "fixed" | "fixFailed" | "wrong" | "timeout" | null;

const NEXT_GRACE_MS = 400;
const END_MS = 700;

interface View {
  phase: Phase;
  puzzle: Puzzle | null;
  picked: number | "none" | null;
  outcome: Outcome;
  fixPicked: number | null;
  score: number;
  streak: number;
  roundLeft: number;
  puzzleLeft: number;
  puzzleTotal: number;
  fixLeft: number;
  gain: number;
  gainKey: number;
  key: number;
  /** Номер текущего задания, с 1 (0 — ещё не началось). */
  index: number;
  paused: boolean;
}

interface Game extends View {
  wall: number;
  revealLeft: number;
  revealStart: number;
  endLeft: number;
  attempts: GameAttempt[];
  tier: TierState;
  prevTemplate: TemplateId | null;
  prevNoFault: boolean;
  rand: () => number;
  last: number | null;
  finished: boolean;
}

interface Api {
  pick: (c: number | "none") => void;
  fix: (i: number) => void;
  next: () => void;
  pause: (on: boolean) => void;
}

function initialView(mode: GameMode): View {
  const cfg = MODE_CONFIG[mode];
  return {
    phase: "boot",
    puzzle: null,
    picked: null,
    outcome: null,
    fixPicked: null,
    score: 0,
    streak: 0,
    roundLeft: cfg.roundMs ?? 0,
    puzzleLeft: 0,
    puzzleTotal: 0,
    fixLeft: cfg.fixMs ?? 0,
    gain: 0,
    gainKey: 0,
    key: 0,
    index: 0,
    paused: false,
  };
}

function makeGame(mode: GameMode): Game {
  return {
    ...initialView(mode),
    wall: 0,
    revealLeft: 0,
    revealStart: 0,
    endLeft: END_MS,
    attempts: [],
    tier: startTierState(mode),
    prevTemplate: null,
    // Первое задание — с ошибкой, если режим этого требует.
    prevNoFault: MODE_CONFIG[mode].firstFault,
    rand: Math.random,
    last: null,
    finished: false,
  };
}

function snapshot(g: Game): View {
  return {
    phase: g.phase,
    puzzle: g.puzzle,
    picked: g.picked,
    outcome: g.outcome,
    fixPicked: g.fixPicked,
    score: g.score,
    streak: g.streak,
    roundLeft: g.roundLeft,
    puzzleLeft: g.puzzleLeft,
    puzzleTotal: g.puzzleTotal,
    fixLeft: g.fixLeft,
    gain: g.gain,
    gainKey: g.gainKey,
    key: g.key,
    index: g.index,
    paused: g.paused,
  };
}

export default function BugHuntGame({ lang, sound, mode, onFinish }: GameProps) {
  const { t } = useT();
  const cfg = MODE_CONFIG[mode];
  const [v, setV] = useState<View>(() => initialView(mode));
  const [initial] = useState(() => makeGame(mode));
  const gameRef = useRef<Game>(initial);
  const apiRef = useRef<Api | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef({ sound, onFinish });

  useEffect(() => {
    propsRef.current = { sound, onFinish };
  }, [sound, onFinish]);

  useEffect(() => {
    const g = gameRef.current;
    const wallOver = () => cfg.wallCapMs !== null && g.wall >= cfg.wallCapMs;
    const roundOver = () => cfg.roundMs !== null && g.roundLeft <= 0;
    let raf = 0;
    let lastSync = 0;
    let focusRaf = 0;
    // Прокрутить строку с ошибкой (или выбранную) в видимую область после отрисовки.
    const focusLine = () => {
      cancelAnimationFrame(focusRaf);
      focusRaf = requestAnimationFrame(() => {
        focusRaf = requestAnimationFrame(() => {
          const el = scrollRef.current?.querySelector("[data-focus-line]");
          if (el) el.scrollIntoView({ block: "nearest" });
        });
      });
    };
    const sync = () => setV(snapshot(g));
    const snd = (n: "correct" | "wrong" | "complete") => {
      if (propsRef.current.sound) playSound(n);
    };

    const startPuzzle = () => {
      if (g.key === 0) g.rand = seeded((Date.now() ^ 0x5bd1e995) >>> 0);
      const mastery = (skill: string) => liveMastery(skill) ?? 0.3;
      const tier = tierFor(mode, g.index, g.tier);
      const template = pickTemplate(g.rand, mastery, g.prevTemplate);
      const noFault = wantNoFault(g.rand, tier, g.prevNoFault);
      const p = generatePuzzle(g.rand, tier, template, !noFault);
      g.prevTemplate = p.template;
      g.prevNoFault = p.fault === null;
      g.puzzle = p;
      g.index += 1;
      g.puzzleTotal = taskTimeMs(tier, p.lines.length, mode) ?? 0;
      g.puzzleLeft = g.puzzleTotal;
      g.picked = null;
      g.outcome = null;
      g.fixPicked = null;
      g.gain = 0;
      g.key += 1;
      g.phase = "play";
    };

    const endRound = () => {
      if (g.phase === "end") return;
      g.phase = "end";
      g.endLeft = END_MS;
      snd("complete");
      sync();
    };

    const miss = (outcome: "wrong" | "timeout") => {
      const p = g.puzzle;
      if (!p) return;
      g.attempts.push({ skill: p.skill, correct: false });
      g.streak = 0;
      g.tier = updateTier(g.tier, false);
      g.outcome = outcome;
      g.gain = 0;
      g.phase = "reveal";
      g.revealLeft = cfg.revealMs ?? Infinity;
      g.revealStart = g.wall;
      snd("wrong");
      sync();
      focusLine();
    };

    const pick = (choice: number | "none") => {
      const p = g.puzzle;
      if (g.phase !== "play" || !p) return;
      g.picked = choice;
      if (!isCorrectFind(p, choice)) return miss("wrong");
      g.attempts.push({ skill: p.skill, correct: true });
      const pts = findPoints(bonusSeconds(mode, g.puzzleLeft, g.puzzleTotal), g.streak);
      g.score += pts;
      g.gain = pts;
      g.gainKey += 1;
      g.streak += 1;
      g.tier = updateTier(g.tier, true);
      snd("correct");
      if (p.fault) {
        g.outcome = "found";
        g.phase = "fix";
        g.fixLeft = cfg.fixMs ?? 0;
      } else {
        g.outcome = "clean";
        g.phase = "reveal";
        g.revealLeft = cfg.cleanMs ?? Infinity;
        g.revealStart = g.wall;
      }
      sync();
      if (p.fault) focusLine();
    };

    const resolveFix = (i: number | null) => {
      const p = g.puzzle;
      if (g.phase !== "fix" || !p?.fault) return;
      const ok = i === p.fault.fixCorrect;
      g.attempts.push({ skill: p.skill, correct: ok });
      g.fixPicked = i;
      g.outcome = ok ? "fixed" : "fixFailed";
      if (ok) {
        g.score += FIX_BONUS;
        g.gain += FIX_BONUS;
        g.gainKey += 1;
      }
      snd(ok ? "correct" : "wrong");
      g.phase = "reveal";
      g.revealLeft = cfg.revealMs ?? Infinity;
      g.revealStart = g.wall;
      sync();
      focusLine();
    };

    const next = (auto = false) => {
      if (g.phase !== "reveal") return;
      if (!auto && g.wall - g.revealStart < NEXT_GRACE_MS) return;
      if (roundOver() || wallOver() || (cfg.puzzles !== null && g.index >= cfg.puzzles)) return endRound();
      startPuzzle();
      sync();
    };

    const setPaused = (on: boolean) => {
      if (on === g.paused || g.phase === "end") return;
      // Пауза — только пока идёт отсчёт (поиск или правка).
      if (on && !(cfg.pause && (g.phase === "play" || g.phase === "fix"))) return;
      g.paused = on;
      sync();
    };

    const finish = () => {
      if (g.finished) return;
      g.finished = true;
      const attempts = g.attempts.slice();
      propsRef.current.onFinish({
        score: g.score,
        correct: attempts.filter((a) => a.correct).length,
        total: attempts.length,
        attempts,
      });
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (g.finished) return;
      // Скрытая вкладка: dt ограничен, время «замирает».
      const dt = g.last == null ? 0 : Math.min(100, Math.max(0, now - g.last));
      g.last = now;
      if (g.phase === "boot") {
        startPuzzle();
        sync();
        return;
      }
      // На паузе время стоит.
      if (g.paused) return;
      if (g.phase !== "end") g.wall += dt;
      if (g.phase === "play") {
        if (cfg.roundMs !== null) g.roundLeft = Math.max(0, g.roundLeft - dt);
        if (g.puzzleTotal > 0) g.puzzleLeft = Math.max(0, g.puzzleLeft - dt);
        if (roundOver() || wallOver()) return endRound();
        if (g.puzzleTotal > 0 && g.puzzleLeft <= 0) return miss("timeout");
      } else if (g.phase === "fix") {
        if (cfg.fixMs !== null) g.fixLeft = Math.max(0, g.fixLeft - dt);
        if (wallOver()) return endRound();
        if (cfg.fixMs !== null && g.fixLeft <= 0) return resolveFix(null);
      } else if (g.phase === "reveal") {
        g.revealLeft -= dt;
        if (g.revealLeft <= 0) return next(true);
        if (wallOver()) return endRound();
      } else if (g.phase === "end") {
        g.endLeft -= dt;
        if (g.endLeft <= 0) return finish();
      }
      if (now - lastSync >= 50) {
        lastSync = now;
        sync();
      }
    };

    apiRef.current = { pick, fix: (i) => resolveFix(i), next: () => next(), pause: setPaused };

    const onKey = (e: KeyboardEvent) => {
      if (ignoreKey(e)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const k = e.key;
      if (g.paused) {
        if (k === "p" || k === "P" || k === "Escape") setPaused(false);
        return;
      }
      if ((k === "p" || k === "P") && cfg.pause) {
        setPaused(true);
        return;
      }
      if (g.phase === "play") {
        if (k === "0" || k === "n" || k === "N") pick("none");
        else if (/^[1-8]$/.test(k)) {
          const i = Number(k) - 1;
          if (g.puzzle && i < g.puzzle.lines.length) pick(i);
        }
      } else if (g.phase === "fix") {
        const f = g.puzzle?.fault;
        if (f && /^[1-3]$/.test(k) && Number(k) <= f.fixOptions.length) resolveFix(Number(k) - 1);
      } else if (g.phase === "reveal" && (k === "Enter" || k === " ")) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(focusRaf);
      window.removeEventListener("keydown", onKey);
      apiRef.current = null;
    };
  }, [mode, cfg]);

  const p = v.puzzle;
  const fault = p?.fault ?? null;
  const playing = v.phase === "play";
  const revealed = v.phase === "reveal" || v.phase === "fix";
  const missed = v.outcome === "wrong" || v.outcome === "timeout";
  const mult = multiplier(v.streak);
  const blitz = mode === "blitz";
  const timedTask = v.puzzleTotal > 0;
  const fixDone = v.outcome === "fixed" || v.outcome === "fixFailed";
  const showSheet = !!fault && (v.phase === "fix" || (v.phase === "reveal" && fixDone));

  // Блиц: общие часы раунда. «Обычный»: секунды текущего этапа (поиск или правка).
  const roundFrac = cfg.roundMs ? Math.max(0, Math.min(1, v.roundLeft / cfg.roundMs)) : 0;
  const stageLeft = v.phase === "play" ? v.puzzleLeft : v.phase === "fix" && cfg.fixMs ? v.fixLeft : null;
  const stageTotal = v.phase === "play" ? v.puzzleTotal : (cfg.fixMs ?? 1);
  const stageFrac = stageLeft === null ? 1 : Math.max(0, Math.min(1, stageLeft / stageTotal));
  const timerLow = blitz ? roundFrac < 0.17 : stageFrac < 0.3;
  const timerSecs = blitz ? Math.ceil(v.roundLeft / 1000) : stageLeft === null ? null : Math.ceil(stageLeft / 1000);
  const puzzleFrac = playing && timedTask ? Math.max(0, Math.min(1, v.puzzleLeft / v.puzzleTotal)) : 0;

  // Прогресс по заданиям (спокойный и обычный режимы).
  const total = cfg.puzzles ?? 0;
  const doneCount = Math.max(0, v.index - (v.phase === "reveal" || v.phase === "end" ? 0 : 1));
  const progressFrac = total ? Math.min(1, doneCount / total) : 0;
  const taskNo = Math.min(total, Math.max(1, v.index));

  // В спокойном и обычном режимах разбор ошибки — карточкой «Почему так».
  const whyCard = !blitz && (missed || v.outcome === "fixFailed");

  const mood =
    v.phase === "play" || v.phase === "boot"
      ? "thinking"
      : v.phase === "end"
        ? "neutral"
        : v.outcome === "wrong" || v.outcome === "timeout"
          ? "sad"
          : v.streak >= 6
            ? "celebrate"
            : "happy";

  const message = (() => {
    if (!p) return null;
    const explain = fault ? tx(fault.explain, lang) : "";
    switch (v.outcome) {
      case "clean":
        return { ok: true, text: tx(S.noneWas, lang) };
      case "found":
        return { ok: true, text: tx(S.found, lang) };
      case "fixed":
        return { ok: true, text: `${tx(S.fixed, lang)}. ${explain}` };
      case "fixFailed":
        return { ok: false, text: `${tx(S.found, lang)} ${explain}` };
      case "wrong":
      case "timeout": {
        const head = v.outcome === "timeout" ? `${tx(S.puzzleTimeUp, lang)}. ` : "";
        return { ok: false, text: head + (fault ? explain : tx(S.noneWas, lang)) };
      }
      default:
        return null;
    }
  })();

  const lineState = (i: number) => {
    if (!p || v.phase === "play" || v.phase === "boot" || v.phase === "end") return "idle" as const;
    if (v.outcome === "clean") return "clean" as const;
    if (fault && i === fault.line) return missed ? ("missed" as const) : ("found" as const);
    if (missed && v.picked === i) return "false" as const;
    return "idle" as const;
  };

  const canPause = cfg.pause && (playing || v.phase === "fix");

  return (
    <div className="relative mx-auto flex h-[calc(100dvh-56px)] w-full max-w-[640px] touch-manipulation select-none flex-col px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
      {/* На паузе всё поле скрыто (visibility), чтобы нельзя было думать «в паузе». */}
      <div className={cn("flex min-h-0 flex-1 flex-col", v.paused && "invisible")} aria-hidden={v.paused}>
        <div className="flex h-11 shrink-0 items-center gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs text-muted">{tx(S.score, lang)}</span>
            <span className="font-mono text-xl font-bold tabular-nums text-text">{v.score}</span>
            {v.gain > 0 && revealed && (
              <span
                key={v.gainKey}
                className="animate-pop rounded-md bg-gold-soft px-1.5 font-mono text-sm font-bold text-gold motion-reduce:animate-none"
              >
                +{v.gain}
              </span>
            )}
          </div>
          <div className="flex-1" />
          {v.streak > 0 && (
            <span
              className="flex items-center gap-1 rounded-full bg-streak-soft px-2 py-0.5 text-sm font-bold text-streak"
              aria-label={`${tx(S.streak, lang)} ${v.streak}`}
            >
              <Flame size={14} aria-hidden />
              <span className="font-mono tabular-nums">{v.streak}</span>
              {mult > 1 && <span className="font-mono">×{mult}</span>}
            </span>
          )}
          {(blitz || cfg.fixMs !== null) && (
            <span
              className={cn(
                "min-w-9 text-right font-mono text-base font-semibold tabular-nums",
                timerLow ? "text-warning-strong" : "text-muted",
              )}
            >
              {timerSecs === null ? "" : fmt(tx(S.seconds, lang), { n: timerSecs })}
            </span>
          )}
          <Mascot mood={mood} size={32} />
        </div>
        {blitz ? (
          <div className="h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn("h-full rounded-full", roundFrac < 0.17 ? "bg-warning" : "bg-primary")}
              style={{ width: `${roundFrac * 100}%` }}
            />
          </div>
        ) : (
          <div className="flex h-10 shrink-0 items-center gap-2">
            <div
              role="progressbar"
              aria-label={fmt(tx(S.taskOf, lang), { i: taskNo, n: total })}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={doneCount}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${progressFrac * 100}%` }}
              />
            </div>
            <span className="font-mono text-sm tabular-nums text-muted">
              {taskNo} / {total}
            </span>
            {cfg.pause && (
              <button
                type="button"
                disabled={!canPause}
                aria-label={t("game.pause")}
                onClick={() => apiRef.current?.pause(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-border bg-surface text-muted transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 disabled:hover:bg-surface"
              >
                <Pause size={18} aria-hidden />
              </button>
            )}
          </div>
        )}

        <div
          key={v.key}
          ref={scrollRef}
          className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-surface p-3"
        >
          {p && (
            <div className="animate-slide-up motion-reduce:animate-none">
              <p className="text-sm text-muted">
                <Mono text={tx(p.header, lang)} />
              </p>
              <p className="mt-0.5 text-base font-semibold text-text">{tx(S.findPrompt, lang)}</p>
              {timedTask ? (
                <div className="mb-3 mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={cn("h-full rounded-full", puzzleFrac < 0.3 ? "bg-warning" : "bg-primary")}
                    style={{ width: `${puzzleFrac * 100}%` }}
                  />
                </div>
              ) : (
                <div className="h-3" aria-hidden />
              )}
              <ol className="flex flex-col gap-1.5">
                {p.lines.map((line, i) => {
                  const st = lineState(i);
                  const fixedText =
                    v.outcome === "fixed" && fault && i === fault.line
                      ? tx(fault.fixOptions[fault.fixCorrect], lang)
                      : null;
                  const text = fixedText ?? tx(line, lang);
                  // После промаха (не в блице) под неверной строкой показываем верный вариант.
                  const rightText = !blitz && st === "missed" && fault ? tx(fault.fixOptions[fault.fixCorrect], lang) : null;
                  return (
                    <li
                      key={i}
                      data-focus-line={st === "found" || st === "missed" || st === "false" ? "" : undefined}
                    >
                      <button
                        type="button"
                        disabled={!playing}
                        aria-label={fmt(tx(S.lineAria, lang), { i: i + 1, text })}
                        onClick={() => apiRef.current?.pick(i)}
                        className={cn(
                          "flex min-h-11 w-full items-start gap-2 rounded-lg border-2 px-2 py-2 text-left whitespace-normal transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          st === "idle" && "border-transparent hover:bg-surface-2 disabled:hover:bg-transparent",
                          st === "found" && "border-success bg-success-soft",
                          st === "clean" && "border-transparent bg-success-soft",
                          st === "missed" && "animate-shake border-danger bg-danger-soft motion-reduce:animate-none",
                          st === "false" && "border-border bg-surface-2",
                        )}
                      >
                        <span className="w-6 shrink-0 pt-1 text-xs text-muted">{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block break-words font-mono text-[17px] leading-snug",
                              fixedText ? "text-success-strong" : st === "missed" ? "text-danger-strong" : "text-text",
                            )}
                          >
                            {text}
                          </span>
                          {st === "missed" && (
                            <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-danger-strong">
                              <X size={14} aria-hidden /> {tx(S.missedHere, lang)}
                            </span>
                          )}
                          {st === "false" && (
                            <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-muted">
                              <Check size={14} aria-hidden /> {tx(S.falseAlarm, lang)}
                            </span>
                          )}
                        </span>
                        {(st === "found" || fixedText) && (
                          <Check size={20} className="mt-0.5 shrink-0 text-success-strong" aria-hidden />
                        )}
                      </button>
                      {rightText && (
                        <div className="ml-6 mt-1 flex items-center gap-2 rounded-lg border-2 border-success bg-success-soft px-2 py-1.5">
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-semibold text-success-strong">
                              {tx(S.shouldBe, lang)}
                            </span>
                            <span className="block break-words font-mono text-[17px] leading-snug text-success-strong">
                              {rightText}
                            </span>
                          </span>
                          <Check size={20} className="shrink-0 text-success-strong" aria-hidden />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>

        <div className="shrink-0 py-1" aria-live="polite">
          {whyCard && p ? (
            <div className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text">
              {v.outcome === "timeout" && (
                <span className="mr-1 font-semibold text-danger-strong">{tx(S.puzzleTimeUp, lang)}.</span>
              )}
              {v.outcome === "fixFailed" && v.fixPicked === null && (
                <span className="mr-1 font-semibold text-danger-strong">{t("game.timeUp")}.</span>
              )}
              {fault ? (
                <>
                  <span className="font-semibold text-muted">{t("game.why")}: </span>
                  <Mono text={tx(fault.explain, lang)} />
                </>
              ) : (
                <span className="font-semibold text-success-strong">
                  <Mono text={tx(S.noneWas, lang)} />
                </span>
              )}
            </div>
          ) : (
            <div className="flex min-h-8 items-center gap-2 text-sm">
              {message && (
                <>
                  {message.ok ? (
                    <Check size={18} className="shrink-0 text-success-strong" aria-hidden />
                  ) : (
                    <X size={18} className="shrink-0 text-danger-strong" aria-hidden />
                  )}
                  <span className={message.ok ? "text-success-strong" : "text-danger-strong"}>
                    <Mono text={message.text} />
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0">
          {playing || v.phase === "boot" ? (
            <button
              type="button"
              disabled={!playing}
              onClick={() => apiRef.current?.pick("none")}
              className="h-14 w-full rounded-xl border-2 border-border bg-surface font-semibold text-text transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {tx(S.noError, lang)}
            </button>
          ) : showSheet && fault ? (
            <FixSheet
              lang={lang}
              options={fault.fixOptions}
              correct={fault.fixCorrect}
              picked={v.fixPicked}
              done={v.phase !== "fix"}
              frac={cfg.fixMs ? Math.max(0, v.fixLeft / cfg.fixMs) : null}
              nextLabel={t("common.next")}
              onPick={(i) => apiRef.current?.fix(i)}
              onNext={() => apiRef.current?.next()}
            />
          ) : (
            <button
              type="button"
              disabled={v.phase !== "reveal"}
              onClick={() => apiRef.current?.next()}
              className="h-14 w-full rounded-xl bg-primary font-semibold text-white transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {t("common.next")}
            </button>
          )}
        </div>
      </div>

      {v.paused && (
        <div
          role="dialog"
          aria-label={t("game.paused")}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-bg px-6"
        >
          <Pause size={44} className="text-muted" aria-hidden />
          <p className="text-2xl font-extrabold text-text">{t("game.paused")}</p>
          <button
            type="button"
            autoFocus
            onClick={() => apiRef.current?.pause(false)}
            className="flex h-14 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-white transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Play size={20} fill="currentColor" aria-hidden /> {t("common.continue")}
          </button>
        </div>
      )}

      {v.phase === "end" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/80">
          <span className="animate-pop text-4xl font-extrabold text-text motion-reduce:animate-none">
            {tx(blitz ? S.timeUp : S.done, lang)}
          </span>
        </div>
      )}
    </div>
  );
}

function FixSheet({
  lang,
  options,
  correct,
  picked,
  done,
  frac,
  nextLabel,
  onPick,
  onNext,
}: {
  lang: Lang;
  options: { ru: string; kk: string }[];
  correct: number;
  picked: number | null;
  done: boolean;
  /** Доля оставшегося времени на правку; null — без таймера. */
  frac: number | null;
  nextLabel: string;
  onPick: (i: number) => void;
  onNext: () => void;
}) {
  return (
    <div className="animate-slide-up rounded-2xl border border-border bg-surface p-3 shadow-lg motion-reduce:animate-none">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-base font-semibold text-text">{tx(S.fixPrompt, lang)}</p>
        {frac !== null && (
          <div className="h-1 w-16 overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn("h-full rounded-full", frac < 0.3 ? "bg-warning" : "bg-primary")}
              style={{ width: done ? 0 : `${frac * 100}%` }}
            />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {options.map((o, i) => {
          const isRight = done && i === correct;
          const isWrong = done && picked === i && i !== correct;
          const text = tx(o, lang);
          return (
            <button
              key={i}
              type="button"
              disabled={done}
              aria-label={fmt(tx(S.fixAria, lang), { i: i + 1, text })}
              onClick={() => onPick(i)}
              className={cn(
                "flex min-h-12 w-full items-center gap-2 rounded-xl border-2 px-3 py-2 text-left font-mono text-[16px] whitespace-normal transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                !done && "border-border bg-surface hover:bg-surface-2",
                isRight && "border-success bg-success-soft text-success-strong",
                isWrong && "animate-shake border-danger bg-danger-soft text-danger-strong motion-reduce:animate-none",
                done && !isRight && !isWrong && "border-border bg-surface text-muted",
              )}
            >
              <span className="min-w-0 flex-1 break-words">{text}</span>
              {isRight && <Check size={18} className="shrink-0" aria-hidden />}
              {isWrong && <X size={18} className="shrink-0" aria-hidden />}
            </button>
          );
        })}
      </div>
      {done && (
        <button
          type="button"
          onClick={onNext}
          className="mt-2 h-12 w-full rounded-xl bg-primary font-semibold text-white transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {nextLabel}
        </button>
      )}
    </div>
  );
}

/** Числа и двоичные записи — моноширинным шрифтом. */
function Mono({ text }: { text: string }) {
  return (
    <>
      {text.split(/([0-9][0-9₀-₉]*)/u).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="font-mono">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

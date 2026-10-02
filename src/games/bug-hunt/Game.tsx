"use client";

import { Check, Flame, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Mascot } from "@/components/mascot/Mascot";
import type { GameAttempt, GameProps } from "@/games/types";
import { cn } from "@/lib/cn";
import { playSound } from "@/lib/sound";
import { useApp } from "@/lib/store";
import { fmt, seeded, tx } from "@/lib/text";
import type { Lang } from "@/lib/types";
import {
  FIX_BONUS,
  FIX_MS,
  ROUND_MS,
  START_TIER,
  WALL_CAP_MS,
  findPoints,
  generatePuzzle,
  isCorrectFind,
  multiplier,
  pickTemplate,
  puzzleTimeMs,
  updateTier,
  wantNoFault,
  type Puzzle,
  type TemplateId,
  type TierState,
} from "./logic";
import { S } from "./strings";

type Phase = "boot" | "play" | "fix" | "reveal" | "end";
type Outcome = "clean" | "found" | "fixed" | "fixFailed" | "wrong" | "timeout" | null;

const REVEAL_MS = 4000;
const CLEAN_MS = 900;
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
}

const INITIAL: View = {
  phase: "boot",
  puzzle: null,
  picked: null,
  outcome: null,
  fixPicked: null,
  score: 0,
  streak: 0,
  roundLeft: ROUND_MS,
  puzzleLeft: 0,
  puzzleTotal: 1,
  fixLeft: FIX_MS,
  gain: 0,
  gainKey: 0,
  key: 0,
};

function makeGame(): Game {
  return {
    ...INITIAL,
    wall: 0,
    revealLeft: 0,
    revealStart: 0,
    endLeft: END_MS,
    attempts: [],
    tier: START_TIER,
    prevTemplate: null,
    prevNoFault: false,
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
  };
}

export default function BugHuntGame({ lang, sound, onFinish }: GameProps) {
  const [v, setV] = useState<View>(INITIAL);
  const gameRef = useRef<Game>(makeGame());
  const apiRef = useRef<Api | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef({ sound, onFinish });

  useEffect(() => {
    propsRef.current = { sound, onFinish };
  }, [sound, onFinish]);

  useEffect(() => {
    const g = gameRef.current;
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
      const mastery = (skill: string) => useApp.getState().skills[skill]?.mastery ?? 0.3;
      const template = pickTemplate(g.rand, mastery, g.prevTemplate);
      const noFault = wantNoFault(g.rand, g.tier.tier, g.prevNoFault);
      const p = generatePuzzle(g.rand, g.tier.tier, template, !noFault);
      g.prevTemplate = p.template;
      g.prevNoFault = p.fault === null;
      g.puzzle = p;
      g.puzzleTotal = puzzleTimeMs(g.tier.tier, p.lines.length);
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
      g.revealLeft = REVEAL_MS;
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
      const pts = findPoints(g.puzzleLeft / 1000, g.streak);
      g.score += pts;
      g.gain = pts;
      g.gainKey += 1;
      g.streak += 1;
      g.tier = updateTier(g.tier, true);
      snd("correct");
      if (p.fault) {
        g.outcome = "found";
        g.phase = "fix";
        g.fixLeft = FIX_MS;
      } else {
        g.outcome = "clean";
        g.phase = "reveal";
        g.revealLeft = CLEAN_MS;
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
      g.revealLeft = REVEAL_MS;
      g.revealStart = g.wall;
      sync();
      focusLine();
    };

    const next = (auto = false) => {
      if (g.phase !== "reveal") return;
      if (!auto && g.wall - g.revealStart < NEXT_GRACE_MS) return;
      if (g.roundLeft <= 0 || g.wall >= WALL_CAP_MS) return endRound();
      startPuzzle();
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
      if (g.phase !== "end") g.wall += dt;
      if (g.phase === "play") {
        g.roundLeft = Math.max(0, g.roundLeft - dt);
        g.puzzleLeft = Math.max(0, g.puzzleLeft - dt);
        if (g.roundLeft <= 0 || g.wall >= WALL_CAP_MS) return endRound();
        if (g.puzzleLeft <= 0) return miss("timeout");
      } else if (g.phase === "fix") {
        g.fixLeft = Math.max(0, g.fixLeft - dt);
        if (g.wall >= WALL_CAP_MS) return endRound();
        if (g.fixLeft <= 0) return resolveFix(null);
      } else if (g.phase === "reveal") {
        g.revealLeft -= dt;
        if (g.revealLeft <= 0) return next(true);
        if (g.wall >= WALL_CAP_MS) return endRound();
      } else if (g.phase === "end") {
        g.endLeft -= dt;
        if (g.endLeft <= 0) return finish();
      }
      if (now - lastSync >= 50) {
        lastSync = now;
        sync();
      }
    };

    apiRef.current = { pick, fix: (i) => resolveFix(i), next: () => next() };

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const k = e.key;
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
  }, []);

  const p = v.puzzle;
  const fault = p?.fault ?? null;
  const playing = v.phase === "play";
  const revealed = v.phase === "reveal" || v.phase === "fix";
  const missed = v.outcome === "wrong" || v.outcome === "timeout";
  const mult = multiplier(v.streak);
  const secs = Math.ceil(v.roundLeft / 1000);
  const roundFrac = Math.max(0, Math.min(1, v.roundLeft / ROUND_MS));
  const puzzleFrac = playing ? Math.max(0, Math.min(1, v.puzzleLeft / v.puzzleTotal)) : 0;
  const fixDone = v.outcome === "fixed" || v.outcome === "fixFailed";
  const showSheet = !!fault && (v.phase === "fix" || (v.phase === "reveal" && fixDone));

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

  return (
    <div className="relative mx-auto flex h-[calc(100dvh-56px)] w-full max-w-[640px] touch-manipulation select-none flex-col px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
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
        <span
          className={cn(
            "font-mono text-base font-semibold tabular-nums",
            roundFrac < 0.17 ? "text-warning-strong" : "text-muted",
          )}
        >
          {fmt(tx(S.seconds, lang), { n: secs })}
        </span>
        <Mascot mood={mood} size={32} />
      </div>
      <div className="h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn("h-full rounded-full", roundFrac < 0.17 ? "bg-warning" : "bg-primary")}
          style={{ width: `${roundFrac * 100}%` }}
        />
      </div>

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
            <div className="mb-3 mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className={cn("h-full rounded-full", puzzleFrac < 0.3 ? "bg-warning" : "bg-primary")}
                style={{ width: `${puzzleFrac * 100}%` }}
              />
            </div>
            <ol className="flex flex-col gap-1.5">
              {p.lines.map((line, i) => {
                const st = lineState(i);
                const fixedText =
                  v.outcome === "fixed" && fault && i === fault.line ? tx(fault.fixOptions[fault.fixCorrect], lang) : null;
                const text = fixedText ?? tx(line, lang);
                return (
                  <li key={i} data-focus-line={st === "found" || st === "missed" || st === "false" ? "" : undefined}>
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
                            fixedText ? "text-success-strong" : "text-text",
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
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>

      <div className="flex min-h-10 shrink-0 items-center gap-2 py-1 text-sm" aria-live="polite">
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
            frac={Math.max(0, v.fixLeft / FIX_MS)}
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
            {tx(S.next, lang)}
          </button>
        )}
      </div>

      {v.phase === "end" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/80">
          <span className="animate-pop text-4xl font-extrabold text-text motion-reduce:animate-none">
            {tx(S.timeUp, lang)}
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
  onPick,
  onNext,
}: {
  lang: Lang;
  options: { ru: string; kk: string }[];
  correct: number;
  picked: number | null;
  done: boolean;
  frac: number;
  onPick: (i: number) => void;
  onNext: () => void;
}) {
  return (
    <div className="animate-slide-up rounded-2xl border border-border bg-surface p-3 shadow-lg motion-reduce:animate-none">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-base font-semibold text-text">{tx(S.fixPrompt, lang)}</p>
        <div className="h-1 w-16 overflow-hidden rounded-full bg-surface-2">
          <div
            className={cn("h-full rounded-full", frac < 0.3 ? "bg-warning" : "bg-primary")}
            style={{ width: done ? 0 : `${frac * 100}%` }}
          />
        </div>
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
          {tx(S.next, lang)}
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

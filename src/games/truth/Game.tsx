"use client";

import { animate, m, useMotionValue, useTransform } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Flame, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Mascot } from "@/components/mascot/Mascot";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import type { GameProps } from "@/games/types";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { feedback } from "@/lib/feedback";
import { ignoreKey } from "@/lib/keys";
import { fmt, tx } from "@/lib/text";
import type { Statement } from "@/lib/bank";
import { STREAK_FOR_DOUBLE, TruthEngine, isFormula, multiplierFor, newSeed, swipeDecision, type Verdict } from "./logic";
import { S } from "./strings";

type Phase = "ask" | "reveal" | "over";

interface Ui {
  phase: Phase;
  st: Statement | null;
  /** Ключ карточки — меняется на каждом утверждении. */
  cardKey: number;
  verdict: Verdict | null;
  /** Показывать панель «почему» (блиц после верного ответа — нет). */
  panel: boolean;
  score: number;
  streak: number;
  done: number;
  secs: number;
  pop: { id: number; text: string } | null;
  live: string;
  lastOk: boolean | null;
}

const FLY_PX = 480;
const FLY_MS = 0.18;
const QUICK_MS = 240;
const OVER_MS = 700;
const TICK_MS = 50;

interface Api {
  /** false — ответ не принят (не та фаза). */
  answer: (value: boolean | null, viaSwipe?: boolean) => boolean;
  advance: () => void;
  settle: () => void;
}

export default function Game({ lang, mode, skills, onFinish }: GameProps) {
  const { t } = useT();
  const reduced = useReduceMotion();
  const [init] = useState(() => {
    const engine = new TruthEngine({ skills, mode, seed: newSeed() });
    const st = engine.current();
    const ui: Ui = {
      phase: st ? "ask" : "over",
      st,
      cardKey: 1,
      verdict: null,
      panel: false,
      score: 0,
      streak: 0,
      done: 0,
      secs: Math.ceil((engine.cfg.clockMs ?? 0) / 1000),
      pop: null,
      live: "",
      lastOk: null,
    };
    return { engine, ui };
  });
  const cfg = init.engine.cfg;
  const clock = cfg.clockMs !== null;
  const calm = mode === "calm";
  const total = init.engine.total ?? 0;

  const [ui, setUi] = useState<Ui>(init.ui);
  const uiRef = useRef<Ui>(init.ui);
  const propsRef = useRef({ lang, onFinish, reduced });
  const finishedRef = useRef(false);
  const api = useRef<Api | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const cardBarRef = useRef<HTMLDivElement>(null);
  const nextBarRef = useRef<HTMLDivElement>(null);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-10, 0, 10]);
  const opacity = useTransform(x, [-FLY_PX, -240, 0, 240, FLY_PX], [0, 1, 1, 1, 0]);
  const yesTint = useTransform(x, [0, 90], [0, 1]);
  const noTint = useTransform(x, [-90, 0], [1, 0]);

  useEffect(() => {
    propsRef.current = { lang, onFinish, reduced };
  });

  useEffect(() => {
    const { engine } = init;
    let cancelled = false;
    let last = 0;
    const m0 = {
      clockMs: cfg.clockMs ?? 0,
      cardMs: 0,
      cardLimit: null as number | null,
      revealLeft: null as number | null,
      revealTotal: 0,
      overT: 0,
    };
    m0.cardLimit = engine.currentTimeMs();
    m0.cardMs = m0.cardLimit ?? 0;

    const commit = (patch: Partial<Ui>) => {
      uiRef.current = { ...uiRef.current, ...patch };
      setUi(uiRef.current);
    };

    const endRound = () => {
      if (uiRef.current.phase === "over") return;
      m0.overT = 0;
      commit({ phase: "over", panel: false, live: tx(clock ? S.timeUp : S.done, propsRef.current.lang) });
    };

    const advance = () => {
      const u = uiRef.current;
      if (u.phase !== "reveal") return;
      if (clock && m0.clockMs <= 0) return endRound();
      const st = engine.next();
      if (!st) return endRound();
      // jump, а не set: останавливает недоигранный «вылет» прошлой карточки (быстрое «Далее»)
      x.jump(0);
      m0.cardLimit = engine.currentTimeMs();
      m0.cardMs = m0.cardLimit ?? 0;
      m0.revealLeft = null;
      commit({ phase: "ask", st, cardKey: u.cardKey + 1, verdict: null, panel: false, pop: null, live: "" });
    };

    const answer = (value: boolean | null, viaSwipe = false) => {
      const u = uiRef.current;
      if (u.phase !== "ask") return false;
      const v = engine.answer(value);
      if (!v) return false;
      const { lang: lg, reduced: red } = propsRef.current;
      if (v.correct) feedback(engine.streak >= STREAK_FOR_DOUBLE ? "combo" : "correct", { combo: engine.streak });
      else feedback("wrong");

      // карточка улетает в сторону ответа; при таймауте остаётся на месте
      if (value !== null) {
        const target = (value ? 1 : -1) * FLY_PX;
        if (red) x.set(target);
        else animate(x, target, { duration: viaSwipe ? FLY_MS : FLY_MS * 1.2, ease: "easeIn" });
      } else x.jump(0);

      const quick = cfg.skipRevealOnCorrect && v.correct;
      m0.revealLeft = quick ? QUICK_MS : cfg.revealMs;
      m0.revealTotal = m0.revealLeft ?? 0;
      const why = tx(v.statement.explanation, lg);
      commit({
        phase: "reveal",
        verdict: v,
        panel: !quick,
        score: engine.score,
        streak: engine.streak,
        done: engine.done,
        lastOk: v.correct,
        pop: v.correct ? { id: u.cardKey, text: `+${v.points}` } : null,
        live: v.correct ? tx(S.announceRight, lg) : fmt(tx(v.timedOut ? S.announceTimeout : S.announceWrong, lg), { why }),
      });
      return true;
    };

    const tick = () => {
      if (cancelled) return;
      const now = performance.now();
      if (!last) last = now;
      let dt = now - last;
      last = now;
      if (document.hidden) dt = 0;
      dt = Math.min(dt, 250);
      const p = uiRef.current.phase;

      if (clock && p !== "over") {
        m0.clockMs -= dt;
        const secs = Math.max(0, Math.ceil(m0.clockMs / 1000));
        if (secs !== uiRef.current.secs) commit({ secs });
        if (barRef.current) barRef.current.style.width = `${Math.max(0, (m0.clockMs / (cfg.clockMs ?? 1)) * 100)}%`;
        if (m0.clockMs <= 0) {
          endRound();
          return;
        }
      }

      if (p === "ask") {
        if (m0.cardLimit !== null) {
          m0.cardMs -= dt;
          if (cardBarRef.current) cardBarRef.current.style.width = `${Math.max(0, (m0.cardMs / m0.cardLimit) * 100)}%`;
          if (m0.cardMs <= 0) answer(null);
        }
      } else if (p === "reveal") {
        if (m0.revealLeft !== null) {
          m0.revealLeft -= dt;
          if (nextBarRef.current && m0.revealTotal > 0) {
            nextBarRef.current.style.width = `${Math.max(0, (m0.revealLeft / m0.revealTotal) * 100)}%`;
          }
          if (m0.revealLeft <= 0) advance();
        }
      } else if (p === "over") {
        m0.overT += dt;
        if (m0.overT >= OVER_MS && !finishedRef.current) {
          finishedRef.current = true;
          propsRef.current.onFinish(engine.result());
        }
      }
    };

    const timer = window.setInterval(tick, TICK_MS);
    api.current = {
      answer,
      advance,
      settle() {
        // жест не дотянул до порога — карточка возвращается на место
        if (propsRef.current.reduced) x.jump(0);
        else animate(x, 0, { type: "spring", stiffness: 420, damping: 32 });
      },
    };

    const onKey = (e: KeyboardEvent) => {
      // удержание клавиши не должно отвечать и листать карточки само
      if (ignoreKey(e) || e.repeat) return;
      const p = uiRef.current.phase;
      if (p === "ask") {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          answer(true);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          answer(false);
        }
      } else if (p === "reveal" && (e.key === "Enter" || e.key === " " || e.key === "ArrowRight")) {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("keydown", onKey);
      api.current = null;
    };
  }, [init, cfg, clock, x]);

  const mult = multiplierFor(ui.streak);
  const v = ui.verdict;
  const st = ui.st;
  const text = st ? tx(st.text, lang) : "";
  const formula = isFormula(text);
  const mood = ui.lastOk === false ? "sad" : ui.streak >= 5 ? "celebrate" : ui.lastOk ? "happy" : "neutral";
  const urgent = clock && ui.secs <= 10;
  const asking = ui.phase === "ask";
  const showNext = ui.phase === "reveal" && ui.panel && !clock;
  const progress = total > 0 ? (ui.done / total) * 100 : 0;
  // номер утверждения на экране: во время разбора — то, которое разбираем
  const shown = Math.min(asking ? ui.done + 1 : ui.done, total);

  return (
    <div className="mx-auto flex h-[calc(100dvh-56px)] w-full max-w-[640px] touch-manipulation select-none flex-col px-4 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="flex h-11 shrink-0 items-center gap-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-bold text-muted">{tx(S.score, lang)}</span>
          <span key={ui.score} className="animate-pop font-mono text-xl font-extrabold text-gold">
            {ui.score}
          </span>
        </div>
        {mult > 1 && (
          <span
            title={tx(S.streakDouble, lang)}
            className="flex animate-pop items-center gap-0.5 rounded-full bg-streak-soft px-2 py-0.5 text-sm font-extrabold text-streak"
          >
            <Flame size={14} aria-hidden /> ×{mult}
          </span>
        )}
        <div className="flex-1" />
        {clock ? (
          <span className={cn("font-mono text-lg font-extrabold", urgent ? "text-warning-strong" : "text-text")}>
            {ui.secs}
            {tx(S.secShort, lang)}
          </span>
        ) : (
          <span className="font-mono text-lg font-extrabold text-text">
            {shown}/{total}
          </span>
        )}
        <Mascot mood={mood} size={32} />
      </div>
      <div className="h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-surface-2">
        <div
          ref={barRef}
          style={clock ? undefined : { width: `${progress}%` }}
          className={cn(
            "h-full rounded-full",
            clock ? "w-full" : "bg-primary transition-[width] duration-300",
            clock && (urgent ? "bg-warning" : "bg-primary"),
          )}
        />
      </div>

      <div className="relative mt-3 min-h-0 flex-1">
        {st && ui.phase !== "over" && (
          <m.div
            key={ui.cardKey}
            role="group"
            aria-label={text}
            drag={asking ? "x" : false}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              const dir = swipeDecision(info.offset.x, info.velocity.x);
              // ответ не принят (например, время вышло во время жеста) — карточка возвращается
              if (!dir || !api.current?.answer(dir === "believe", true)) api.current?.settle();
            }}
            initial={reduced ? false : { scale: 0.94, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            style={{ x, rotate, opacity }}
            className={cn(
              "absolute inset-0 flex touch-pan-y cursor-grab flex-col rounded-3xl border-2 border-border bg-surface px-4 py-5 shadow-md active:cursor-grabbing",
            )}
          >
            {cfg.perCardMs && (
              <div className="absolute inset-x-5 top-3 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <div ref={cardBarRef} className="h-full w-full rounded-full bg-primary" />
              </div>
            )}
            <m.div
              aria-hidden
              style={{ opacity: yesTint }}
              className="pointer-events-none absolute inset-0 flex items-start justify-start rounded-3xl border-2 border-primary bg-primary-soft p-4"
            >
              <span className="flex items-center gap-1.5 rounded-xl border-2 border-primary px-2.5 py-1 text-lg font-extrabold text-primary">
                <ThumbsUp size={20} aria-hidden /> {tx(S.believe, lang)}
              </span>
            </m.div>
            <m.div
              aria-hidden
              style={{ opacity: noTint }}
              className="pointer-events-none absolute inset-0 flex items-start justify-end rounded-3xl border-2 border-primary bg-primary-soft p-4"
            >
              <span className="flex items-center gap-1.5 rounded-xl border-2 border-primary px-2.5 py-1 text-lg font-extrabold text-primary">
                <ThumbsDown size={20} aria-hidden /> {tx(S.disbelieve, lang)}
              </span>
            </m.div>
            {/* relative — текст поверх подсветки «Верю/Не верю», утверждение видно во время жеста */}
            <div className="relative my-auto flex min-h-0 items-center justify-center overflow-y-auto px-1 py-8 text-center">
              <p
                className={cn(
                  "leading-snug font-bold [overflow-wrap:anywhere] text-text",
                  formula ? "font-mono text-3xl" : text.length > 90 ? "text-lg" : "text-xl",
                )}
              >
                {text}
              </p>
            </div>
          </m.div>
        )}

        {ui.pop && ui.phase === "reveal" && !ui.panel && (
          <div key={ui.pop.id} className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center" aria-hidden>
            <span className="animate-pop rounded-full bg-gold-soft px-3 py-1 font-mono text-xl font-extrabold text-gold">
              {ui.pop.text}
            </span>
          </div>
        )}

        {ui.phase === "reveal" && ui.panel && v && (
          <div
            onClick={clock ? () => api.current?.advance() : undefined}
            className={cn(
              "absolute inset-0 z-10 flex animate-fade-in flex-col gap-3 overflow-y-auto rounded-3xl border-2 bg-surface px-4 py-5",
              v.correct ? "border-success" : "border-danger",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  v.correct ? "bg-success-soft text-success-strong" : "bg-danger-soft text-danger-strong",
                )}
              >
                {v.correct ? <Check size={22} strokeWidth={3} aria-hidden /> : <X size={22} strokeWidth={3} aria-hidden />}
              </span>
              <span className={cn("text-xl font-extrabold", v.correct ? "text-success-strong" : "text-danger-strong")}>
                {tx(v.correct ? S.correct : v.timedOut ? S.timeoutHead : S.wrong, lang)}
              </span>
              <div className="flex-1" />
              {ui.pop && (
                <span key={ui.pop.id} className="animate-pop rounded-full bg-gold-soft px-3 py-1 font-mono text-lg font-extrabold text-gold">
                  {ui.pop.text}
                </span>
              )}
            </div>
            <div className="rounded-2xl bg-surface-2 px-3 py-2.5">
              <p className={cn("leading-snug font-semibold text-text", formula && "font-mono text-lg")}>{text}</p>
              <p className={cn("mt-1 text-sm font-extrabold", v.statement.value ? "text-success-strong" : "text-danger-strong")}>
                {tx(v.statement.value ? S.claimTrue : S.claimFalse, lang)}
              </p>
            </div>
            <p className="leading-snug text-text">
              <span className="text-xs font-bold text-muted">{t("game.why")}: </span>
              <span className="font-semibold">{tx(v.statement.explanation, lang)}</span>
            </p>
          </div>
        )}

        {ui.phase === "over" && (
          <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-bg/80">
            <span className="animate-pop text-4xl font-extrabold text-text">{tx(clock ? S.timeUp : S.done, lang)}</span>
          </div>
        )}
      </div>

      <p className="mt-2 h-5 shrink-0 text-center text-sm text-muted">{asking ? tx(calm ? S.calmHint : S.swipeHint, lang) : ""}</p>

      <div aria-live="polite" className="sr-only">
        {ui.live}
      </div>

      <div className="mt-1 h-16 shrink-0">
        {showNext ? (
          <button
            type="button"
            autoFocus
            onClick={() => api.current?.advance()}
            className="relative flex h-full w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-primary text-lg font-extrabold text-white focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:outline-none active:scale-[0.98]"
          >
            {cfg.revealMs !== null && (
              <div ref={nextBarRef} className="absolute inset-y-0 left-0 w-full bg-white/20" aria-hidden />
            )}
            <span className="relative">{t("common.next")}</span>
            <ArrowRight size={20} className="relative" aria-hidden />
          </button>
        ) : (
          <div className="grid h-full grid-cols-2 gap-3">
            <button
              type="button"
              disabled={!asking}
              onClick={() => api.current?.answer(false)}
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-border bg-surface-2 text-lg font-extrabold text-text transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none active:scale-[0.98] disabled:opacity-60"
            >
              <ArrowLeft size={18} className="text-muted" aria-hidden />
              <ThumbsDown size={20} aria-hidden /> {tx(S.disbelieve, lang)}
            </button>
            <button
              type="button"
              disabled={!asking}
              onClick={() => api.current?.answer(true)}
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-border bg-surface-2 text-lg font-extrabold text-text transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none active:scale-[0.98] disabled:opacity-60"
            >
              <ThumbsUp size={20} aria-hidden /> {tx(S.believe, lang)}
              <ArrowRight size={18} className="text-muted" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

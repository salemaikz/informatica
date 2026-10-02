"use client";

import { m } from "motion/react";
import { ArrowLeftRight, ArrowRight, Check, Layers, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { InlineMarkdown } from "@/components/Markdown";
import { Mascot } from "@/components/mascot/Mascot";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import type { GameProps } from "@/games/types";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { feedback } from "@/lib/feedback";
import { fmt, plainText, tx } from "@/lib/text";
import type { Lang } from "@/lib/types";
import {
  BLITZ_WALL_CAP_MS,
  MISS_CLOSE_MS,
  MemoEngine,
  cardTextClass,
  columnsFor,
  isFormula,
  newSeed,
  type CardView,
  type PairOutcome,
  type RoundSummary,
} from "./logic";
import { S } from "./strings";

type Phase = "play" | "review" | "over";

interface Ui {
  phase: Phase;
  cards: CardView[];
  score: number;
  found: number;
  pairCount: number;
  round: number;
  roundsCleared: number;
  /** Блиц: секунд до конца игры. */
  secs: number;
  /** Обычный темп: секунд до конца раунда. */
  roundSecs: number;
  summary: RoundSummary | null;
  /** Надпись поверх поля в конце игры: «Время!» только когда действительно вышло время. */
  overText: "timeUp" | "done";
  live: string;
  pop: { id: number; text: string } | null;
  lastOk: boolean | null;
}

const PAUSE_MS = 650;
const OVER_MS = 700;
const TICK_MS = 50;

interface Api {
  flip: (index: number) => void;
  next: () => void;
}

const clock = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

export default function Game({ lang, mode, skills, onFinish }: GameProps) {
  const { t } = useT();
  const reduced = useReduceMotion();
  const [init] = useState(() => {
    const engine = new MemoEngine({ skills, mode, seed: newSeed() });
    const ui: Ui = {
      phase: engine.active ? "play" : "over",
      cards: engine.active ? engine.view() : [],
      score: 0,
      found: 0,
      pairCount: engine.pairCount,
      round: engine.round,
      roundsCleared: 0,
      secs: Math.ceil((engine.cfg.clockMs ?? 0) / 1000),
      roundSecs: Math.ceil((engine.roundLimit ?? 0) / 1000),
      summary: null,
      overText: "done",
      live: "",
      pop: null,
      lastOk: null,
    };
    return { engine, ui };
  });
  const cfg = init.engine.cfg;
  const timed = cfg.clockMs !== null;
  const roundTimed = cfg.perPairMs !== null;

  const [ui, setUi] = useState<Ui>(init.ui);
  const uiRef = useRef<Ui>(init.ui);
  const propsRef = useRef({ lang, onFinish });
  const finishedRef = useRef(false);
  const api = useRef<Api | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  /** После «Дальше» вернуть фокус на поле (кнопка «Дальше» исчезает — иначе фокус уходит в body). */
  const focusGrid = useRef(false);

  useEffect(() => {
    propsRef.current = { lang, onFinish };
  });

  useEffect(() => {
    const { engine } = init;
    let cancelled = false;
    let last = 0;
    const m0 = {
      clockMs: cfg.clockMs ?? 0,
      wallMs: 0,
      roundMs: engine.roundLimit ?? 0,
      roundLimit: engine.roundLimit,
      missLeft: null as number | null,
      pauseLeft: null as number | null,
      overT: 0,
      popId: 0,
    };

    const commit = (patch: Partial<Ui>) => {
      uiRef.current = { ...uiRef.current, ...patch };
      setUi(uiRef.current);
    };

    const endGame = (timeUp = false) => {
      if (uiRef.current.phase === "over") return;
      m0.overT = 0;
      m0.missLeft = null;
      m0.pauseLeft = null;
      const overText = timeUp ? "timeUp" : "done";
      commit({ phase: "over", overText, score: engine.score, live: tx(S[overText], propsRef.current.lang) });
    };

    /** Показать поле нового раунда. */
    const startRoundUi = () => {
      m0.roundLimit = engine.roundLimit;
      m0.roundMs = engine.roundLimit ?? 0;
      m0.missLeft = null;
      m0.pauseLeft = null;
      commit({
        phase: "play",
        cards: engine.view(),
        found: 0,
        pairCount: engine.pairCount,
        round: engine.round,
        roundSecs: Math.ceil(m0.roundMs / 1000),
        summary: null,
        live: "",
      });
    };

    const onRoundEnd = (timedOut: boolean) => {
      if (uiRef.current.phase !== "play") return;
      const summary = timedOut ? engine.timeoutRound() : engine.finishRound();
      m0.missLeft = null;
      m0.pauseLeft = null;
      if (cfg.review) {
        feedback(timedOut ? "wrong" : "complete");
        commit({
          phase: "review",
          summary,
          cards: engine.view(),
          score: engine.score,
          roundsCleared: engine.roundsCleared,
          pop: summary.bonus ? { id: ++m0.popId, text: `+${summary.bonus}` } : null,
          live: tx(timedOut ? S.roundTimeout : S.roundDone, propsRef.current.lang),
        });
        return;
      }
      // блиц: сразу следующий раунд
      feedback("combo", { combo: engine.roundsCleared });
      if (!engine.nextRound()) {
        commit({ score: engine.score, roundsCleared: engine.roundsCleared });
        endGame();
        return;
      }
      startRoundUi();
      commit({
        score: engine.score,
        roundsCleared: engine.roundsCleared,
        pop: summary.bonus ? { id: ++m0.popId, text: `+${summary.bonus}` } : null,
      });
    };

    const flip = (index: number) => {
      const u = uiRef.current;
      if (u.phase !== "play" || m0.pauseLeft !== null) return;
      const r = engine.flip(index);
      if (r.kind === "ignored") return;
      const cards = engine.view();
      const lg = propsRef.current.lang;
      if (!engine.hasPendingMiss) m0.missLeft = null;

      if (r.kind === "first") {
        feedback("tap");
        commit({ cards, live: "", pop: null });
        return;
      }
      if (r.kind === "match") {
        feedback(r.roundComplete ? "combo" : "correct", { combo: engine.foundCount });
        const pair = cards.filter((c) => c.pairIndex === r.pairIndex);
        const [a, b] = pair.map((c) => plainText(tx(c.text, lg)));
        if (r.roundComplete) m0.pauseLeft = PAUSE_MS;
        commit({
          cards,
          score: engine.score,
          found: engine.foundCount,
          lastOk: true,
          pop: { id: ++m0.popId, text: `+${r.points}` },
          live: fmt(tx(S.announceMatch, lg), { a, b }),
        });
        return;
      }
      // не пара
      feedback("wrong");
      m0.missLeft = MISS_CLOSE_MS;
      const [a, b] = cards.filter((c) => c.status === "miss").map((c) => plainText(tx(c.text, lg)));
      commit({
        cards,
        score: engine.score,
        lastOk: false,
        pop: r.penalty ? { id: ++m0.popId, text: `−${r.penalty}` } : null,
        live: fmt(tx(S.announceMiss, lg), { a, b }),
      });
    };

    const next = () => {
      if (uiRef.current.phase !== "review") return;
      if (engine.moreRounds && engine.nextRound()) {
        focusGrid.current = true;
        startRoundUi();
      } else endGame();
    };

    const tick = () => {
      if (cancelled) return;
      const now = performance.now();
      if (!last) last = now;
      let dt = now - last;
      last = now;
      if (document.hidden) dt = 0;
      dt = Math.min(dt, 250);
      m0.wallMs += dt;
      const p = uiRef.current.phase;

      if (p === "play") {
        if (timed) {
          m0.clockMs -= dt;
          const secs = Math.max(0, Math.ceil(m0.clockMs / 1000));
          if (secs !== uiRef.current.secs) commit({ secs });
          if (barRef.current) barRef.current.style.width = `${Math.max(0, (m0.clockMs / (cfg.clockMs ?? 1)) * 100)}%`;
          if (m0.clockMs <= 0 || m0.wallMs >= BLITZ_WALL_CAP_MS) {
            endGame(true);
            return;
          }
        }
        if (m0.pauseLeft !== null) {
          m0.pauseLeft -= dt;
          if (m0.pauseLeft <= 0) {
            m0.pauseLeft = null;
            onRoundEnd(false);
          }
          return;
        }
        if (m0.roundLimit !== null) {
          m0.roundMs -= dt;
          const secs = Math.max(0, Math.ceil(m0.roundMs / 1000));
          if (secs !== uiRef.current.roundSecs) commit({ roundSecs: secs });
          if (barRef.current) barRef.current.style.width = `${Math.max(0, (m0.roundMs / m0.roundLimit) * 100)}%`;
          if (m0.roundMs <= 0) {
            onRoundEnd(true);
            return;
          }
        }
        if (m0.missLeft !== null) {
          m0.missLeft -= dt;
          if (m0.missLeft <= 0) {
            m0.missLeft = null;
            engine.closeMiss();
            commit({ cards: engine.view() });
          }
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
    api.current = { flip, next };

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      api.current = null;
    };
  }, [init, cfg, timed]);

  // фокус — побочный эффект в DOM, не setState
  useEffect(() => {
    if (!focusGrid.current || ui.phase !== "play") return;
    focusGrid.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [ui.phase, ui.round]);

  const playing = ui.phase === "play";
  const mood = ui.lastOk === false ? "sad" : ui.phase === "review" && ui.summary?.perfect ? "celebrate" : ui.lastOk ? "happy" : "neutral";
  const urgent = timed && ui.secs <= 10;
  const cols = columnsFor(ui.pairCount);
  const roundLabel = timed
    ? fmt(tx(S.roundsCleared, lang), { n: ui.roundsCleared })
    : cfg.rounds && cfg.rounds > 1
      ? fmt(tx(S.roundOf, lang), { n: ui.round, total: cfg.rounds })
      : "";
  const barStatic = !timed && !roundTimed;

  return (
    <div className="mx-auto flex h-[calc(100dvh-56px)] w-full max-w-[640px] touch-manipulation select-none flex-col px-3 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="flex h-11 shrink-0 items-center gap-2 px-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-bold text-muted">{tx(S.score, lang)}</span>
          <span key={ui.score} className="animate-pop font-mono text-xl font-extrabold text-gold">
            {ui.score}
          </span>
        </div>
        {ui.pop && playing && (
          <span
            key={ui.pop.id}
            className={cn(
              "animate-pop rounded-full px-2 py-0.5 font-mono text-sm font-extrabold",
              ui.pop.text.startsWith("+") ? "bg-gold-soft text-gold" : "bg-danger-soft text-danger-strong",
            )}
          >
            {ui.pop.text}
          </span>
        )}
        <div className="flex-1" />
        {timed ? (
          <span className={cn("font-mono text-lg font-extrabold", urgent ? "text-warning-strong" : "text-text")}>
            {ui.secs}
            {tx(S.secShort, lang)}
          </span>
        ) : roundTimed ? (
          <span className="font-mono text-lg font-extrabold text-text">{clock(ui.roundSecs)}</span>
        ) : (
          <span className="font-mono text-lg font-extrabold text-text">
            {ui.found}/{ui.pairCount}
          </span>
        )}
        <Mascot mood={mood} size={32} />
      </div>
      <div className="h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-surface-2">
        <div
          ref={barRef}
          style={barStatic ? { width: `${ui.pairCount ? (ui.found / ui.pairCount) * 100 : 0}%` } : undefined}
          className={cn(
            "h-full rounded-full",
            barStatic ? "bg-primary transition-[width] duration-300" : "w-full",
            !barStatic && (urgent ? "bg-warning" : "bg-primary"),
          )}
        />
      </div>
      <div className="mt-2 flex h-5 shrink-0 items-center justify-between px-1 text-xs font-bold text-muted">
        <span>
          {tx(S.pairs, lang)} {ui.found}/{ui.pairCount}
        </span>
        <span>{roundLabel}</span>
      </div>

      <div className="relative mt-2 min-h-0 flex-1">
        {ui.phase !== "over" && (
          // высота поля 4×3 ≈ его ширине: на низких экранах сужаем поле, чтобы оно не налезало на подсказку
          <div className="mx-auto flex h-full w-full max-w-[min(420px,max(220px,calc(100dvh_-_232px)))] items-center">
            <div ref={gridRef} className="grid w-full gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {ui.cards.map((c, i) => (
                <MemoCard
                  key={c.key}
                  card={c}
                  index={i}
                  lang={lang}
                  reduced={reduced}
                  disabled={!playing}
                  onFlip={() => api.current?.flip(i)}
                />
              ))}
            </div>
          </div>
        )}

        {ui.phase === "review" && ui.summary && <Review summary={ui.summary} lang={lang} pop={ui.pop} />}

        {ui.phase === "over" && (
          <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-bg/80">
            <span className="animate-pop text-4xl font-extrabold text-text">{tx(S[ui.overText], lang)}</span>
          </div>
        )}
      </div>

      <div aria-live="polite" className="sr-only">
        {ui.live}
      </div>

      <div className="mt-2 shrink-0">
        {ui.phase === "review" ? (
          <button
            type="button"
            autoFocus
            onClick={() => api.current?.next()}
            className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-extrabold text-white focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:outline-none active:scale-[0.98]"
          >
            {t("common.next")}
            <ArrowRight size={20} aria-hidden />
          </button>
        ) : (
          <>
            <div className="flex h-6 items-center justify-center gap-4 text-xs font-bold text-muted" aria-hidden>
              <span className="flex items-center gap-1.5">
                <span className="h-4 w-3 rounded-[4px] border-2 border-primary bg-surface" />
                {tx(S.legendTerm, lang)}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="relative h-4 w-3 overflow-hidden rounded-[4px] border-2 border-primary bg-surface-2">
                  <span className="absolute top-0 right-0 h-2 w-2 bg-primary [clip-path:polygon(0_0,100%_0,100%_100%)]" />
                </span>
                {tx(S.legendValue, lang)}
              </span>
            </div>
            <p className="h-9 text-center text-xs leading-snug text-muted">{tx(mode === "calm" ? S.calmHint : S.playHint, lang)}</p>
          </>
        )}
      </div>
    </div>
  );
}

function MemoCard({
  card,
  index,
  lang,
  reduced,
  disabled,
  onFlip,
}: {
  card: CardView;
  index: number;
  lang: Lang;
  reduced: boolean;
  disabled: boolean;
  onFlip: () => void;
}) {
  const text = tx(card.text, lang);
  // text — с разметкой (показ через InlineMarkdown); для озвучки, длины и «формулы» — без неё
  const plain = plainText(text);
  const up = card.status !== "down";
  const right = card.side === "right";
  const mono = isFormula(plain);
  const base = fmt(tx(card.side === "left" ? S.termCard : S.valueCard, lang), { text: plain });
  const label =
    card.status === "down"
      ? fmt(tx(S.closedCard, lang), { n: index + 1 })
      : card.status === "matched"
        ? fmt(tx(S.foundCard, lang), { card: base })
        : base;
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={disabled || card.status === "matched"}
      onClick={onFlip}
      className="block w-full rounded-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none active:scale-[0.97]"
    >
      <div className="aspect-[3/4] w-full" style={{ perspective: 700 }}>
        <m.div
          className="relative h-full w-full"
          style={{ transformStyle: "preserve-3d" }}
          initial={false}
          animate={{ rotateY: up ? 180 : 0 }}
          transition={{ duration: reduced ? 0 : 0.28, ease: "easeOut" }}
        >
          <div
            aria-hidden
            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
            className="absolute inset-0 flex items-center justify-center rounded-xl border-2 border-primary bg-primary-soft text-primary"
          >
            <Layers size={22} aria-hidden />
          </div>
          <div
            aria-hidden
            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            className={cn(
              "absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl border-2 p-1 text-center font-bold",
              card.status === "matched"
                ? "border-success bg-success-soft text-success-strong"
                : card.status === "miss"
                  ? "border-danger bg-danger-soft text-danger-strong"
                  : cn("border-primary text-text", right ? "bg-surface-2" : "bg-surface"),
            )}
          >
            {right && (
              <span
                className={cn(
                  "absolute top-0 right-0 h-4 w-4 [clip-path:polygon(0_0,100%_0,100%_100%)]",
                  card.status === "matched" ? "bg-success" : card.status === "miss" ? "bg-danger" : "bg-primary",
                )}
              />
            )}
            <span
              lang={lang}
              className={cn("leading-tight", mono ? "font-mono break-all" : "hyphens-auto break-words", cardTextClass(plain, mono))}
            >
              <InlineMarkdown>{text}</InlineMarkdown>
            </span>
          </div>
        </m.div>
      </div>
    </button>
  );
}

const OUTCOME_ICON: Record<PairOutcome, { Icon: typeof Check; cls: string; label: typeof S.clean }> = {
  clean: { Icon: Check, cls: "bg-success-soft text-success-strong", label: S.clean },
  missed: { Icon: RotateCcw, cls: "bg-warning-soft text-warning-strong", label: S.missed },
  notFound: { Icon: X, cls: "bg-danger-soft text-danger-strong", label: S.notFound },
};

function Review({ summary, lang, pop }: { summary: RoundSummary; lang: Lang; pop: Ui["pop"] }) {
  return (
    <div className="absolute inset-0 z-10 flex animate-fade-in flex-col gap-2 overflow-y-auto rounded-3xl border-2 border-border bg-surface px-3 py-4">
      <div className="flex items-center gap-2 px-1">
        <span className="text-lg font-extrabold text-text">{tx(summary.timedOut ? S.roundTimeout : S.roundDone, lang)}</span>
        <div className="flex-1" />
        {pop && (
          <span key={pop.id} className="animate-pop rounded-full bg-gold-soft px-3 py-0.5 font-mono text-base font-extrabold text-gold">
            {pop.text}
          </span>
        )}
      </div>
      <p className="px-1 text-sm font-bold text-muted">
        {summary.perfect ? tx(S.perfect, lang) : fmt(tx(S.extraMisses, lang), { n: summary.extraMisses })}
      </p>
      <p className="px-1 text-xs font-bold text-muted">{tx(S.review, lang)}</p>
      <ul className="flex flex-col gap-1.5">
        {summary.pairs.map(({ pair, outcome }, i) => {
          const l = tx(pair.left, lang);
          const r = tx(pair.right, lang);
          const { Icon, cls, label } = OUTCOME_ICON[outcome];
          return (
            <li key={i} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 rounded-xl bg-surface-2 px-2.5 py-2">
              <span className={cn("text-sm leading-tight font-bold text-text", isFormula(plainText(l)) && "font-mono")}>
                <InlineMarkdown>{l}</InlineMarkdown>
              </span>
              <ArrowLeftRight size={14} className="text-muted" aria-hidden />
              <span className={cn("text-sm leading-tight font-bold text-text", isFormula(plainText(r)) && "font-mono")}>
                <InlineMarkdown>{r}</InlineMarkdown>
              </span>
              <span
                title={tx(label, lang)}
                className={cn("flex h-7 w-7 items-center justify-center rounded-full", cls)}
              >
                <Icon size={16} strokeWidth={3} aria-hidden />
                <span className="sr-only">{tx(label, lang)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

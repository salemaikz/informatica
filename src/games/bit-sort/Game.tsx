"use client";

import { Check, Flame, Pause, Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { liveMastery } from "@/games/live-mastery";
import type { GameAttempt, GameProps } from "@/games/types";
import { Mascot } from "@/components/mascot/Mascot";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { ignoreKey } from "@/lib/keys";
import { playSound } from "@/lib/sound";
import { fmt, tx } from "@/lib/text";
import { S } from "./strings";
import {
  BANNER_SKIP_AFTER_MS,
  MODE_CONFIG,
  SortEngine,
  multiplierFor,
  newSeed,
  type Card,
  type Session,
} from "./logic";

type Phase = "banner" | "play" | "flying" | "gap" | "explain" | "over";

interface Ui {
  phase: Phase;
  paused: boolean;
  session: Session;
  /** Номер правила (с 1) — для объявления в обычном/спокойном режимах. */
  ruleNo: number;
  card: Card | null;
  /** Карточка улетела в корзину (иначе после ошибки остаётся на месте — к ней разбор). */
  cardGone: boolean;
  score: number;
  streak: number;
  secs: number;
  /** Сколько карточек разобрано. */
  done: number;
  binFx: { ok: number | null; bad: number | null; target: number | null };
  explainHead: string | null;
  explainBody: string | null;
  explainBin: string | null;
  pop: { id: number; text: string } | null;
  live: string;
  hint: boolean;
  lastOk: boolean | null;
}

const CARD_W = 168;
const CARD_H = 76;
const FLY_MS = 180;
const GAP_MS = 250;
const OVER_MS = 700;
const SWIPE_PX = 40;
const NO_FX = { ok: null, bad: null, target: null };

const masteryOf = (skill: string) => liveMastery(skill) ?? 0.3;
const prefersReduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Api {
  decide: (bin: number) => void;
  advance: () => void;
  fieldTap: () => void;
  startRule: () => void;
  setPause: (on: boolean) => void;
  down: (e: React.PointerEvent<HTMLDivElement>) => void;
  move: (e: React.PointerEvent<HTMLDivElement>) => void;
  up: (e: React.PointerEvent<HTMLDivElement>) => void;
  cancel: () => void;
}

export default function Game({ lang, sound, mode, onFinish }: GameProps) {
  const { t } = useT();
  const [init] = useState(() => {
    const engine = new SortEngine(newSeed(), masteryOf, mode);
    const cfg = MODE_CONFIG[mode];
    const ui: Ui = {
      phase: "banner",
      paused: false,
      session: engine.session,
      ruleNo: engine.ruleNo,
      card: null,
      cardGone: false,
      score: 0,
      streak: 0,
      secs: cfg.roundSeconds,
      done: 0,
      binFx: NO_FX,
      explainHead: null,
      explainBody: null,
      explainBin: null,
      pop: null,
      live: `${tx(S.newRule, lang)}: ${tx(engine.session.title, lang)}`,
      hint: true,
      lastOk: null,
    };
    return { engine, cfg, ui };
  });
  const cfg = init.cfg;
  const clock = cfg.roundSeconds > 0; // блиц: общие часы
  const calm = !cfg.falls; // спокойно: карточка не падает
  const total = init.engine.cardsTotal;

  const [ui, setUi] = useState<Ui>(init.ui);
  const [reduced] = useState(prefersReduced);

  const uiRef = useRef<Ui>(init.ui);
  const propsRef = useRef({ lang, sound, onFinish });
  const finishedRef = useRef(false);
  const api = useRef<Api | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const drainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    propsRef.current = { lang, sound, onFinish };
  });

  useEffect(() => {
    const { engine, cfg } = init;
    const clock = cfg.roundSeconds > 0;
    const reducedMotion = prefersReduced();
    const attempts: GameAttempt[] = [];
    let correctCount = 0;
    let raf = 0;
    let last = 0;
    let cancelled = false;
    const m = {
      phaseT: 0,
      roundMs: cfg.roundSeconds * 1000,
      wallMs: 0,
      fallMs: 0,
      fallDur: engine.fallMs(),
      after: "gap" as "gap" | "explain",
      drag: null as null | { id: number; x0: number; y0: number; dx: number; dy: number },
    };

    const L = () => propsRef.current.lang;
    const commit = (patch: Partial<Ui>) => {
      uiRef.current = { ...uiRef.current, ...patch };
      setUi(uiRef.current);
    };
    const go = (phase: Phase, patch: Partial<Ui> = {}) => {
      m.phaseT = 0;
      commit({ ...patch, phase });
    };
    const snd = (n: "correct" | "wrong" | "tap") => {
      if (propsRef.current.sound) playSound(n);
    };

    const endRound = () => {
      if (uiRef.current.phase === "over") return;
      m.drag = null;
      go("over", { paused: false, live: tx(clock ? S.timeUp : S.done, L()) });
    };

    const startCard = () => {
      const card = engine.draw();
      m.fallMs = 0;
      m.fallDur = engine.fallMs();
      go("play", {
        card,
        cardGone: false,
        binFx: NO_FX,
        explainHead: null,
        explainBody: null,
        explainBin: null,
        pop: null,
      });
    };

    const openRule = () => {
      const session = engine.startSession();
      go("banner", {
        session,
        ruleNo: engine.ruleNo,
        card: null,
        cardGone: false,
        binFx: NO_FX,
        explainHead: null,
        explainBody: null,
        explainBin: null,
        pop: null,
        live: `${tx(S.newRule, L())}: ${tx(session.title, L())}`,
      });
    };

    const advance = () => {
      const u = uiRef.current;
      if (u.paused || (u.phase !== "explain" && u.phase !== "gap")) return;
      if (clock && m.roundMs <= 0) return endRound();
      if (engine.gameDone()) return endRound();
      if (engine.sessionDone()) return openRule();
      startCard();
    };

    const resolve = (chosen: number | null) => {
      const u = uiRef.current;
      const card = u.card;
      if (!card || u.phase !== "play" || u.paused) return;
      // в спокойном режиме карточка не падает → бонуса за скорость нет
      const fp = cfg.falls ? Math.min(1, m.fallMs / m.fallDur) : 1;
      const correct = chosen === card.bin;
      const res = engine.resolve(card, correct, fp);
      attempts.push({ skill: card.skill, correct });
      if (correct) correctCount++;
      m.drag = null;
      m.after = correct ? "gap" : "explain";
      snd(correct ? "correct" : "wrong");

      // Карточка улетает в корзину. Ошибку в спокойном режиме и таймаут оставляем на месте — к ним разбор.
      const flies = chosen !== null && (correct || cfg.falls);
      const el = cardRef.current;
      const field = fieldRef.current;
      if (flies && el && field) {
        const n = u.session.bins.length;
        const dx = ((chosen + 0.5) / n - 0.5) * field.clientWidth;
        el.style.transition = reducedMotion ? "none" : `transform ${FLY_MS}ms ease-in, opacity ${FLY_MS}ms ease-in`;
        el.style.transform = `translate(${dx}px, ${field.clientHeight}px) scale(0.5)`;
        el.style.opacity = "0";
      }

      const lang = L();
      const head = tx(chosen === null ? S.cardTimeout : S.wrong, lang);
      const body = tx(card.explain, lang);
      go(flies ? "flying" : "explain", {
        score: engine.score,
        streak: engine.streak,
        done: engine.resolvedTotal,
        hint: false,
        lastOk: correct,
        pop: correct ? { id: card.id, text: `+${res.points}${res.mult > 1 ? ` ×${res.mult}` : ""}` } : null,
        binFx: correct ? { ok: chosen, bad: null, target: null } : { ok: null, bad: chosen, target: card.bin },
        explainHead: correct ? null : head,
        explainBody: correct ? null : body,
        explainBin: correct ? null : tx(u.session.bins[card.bin], lang),
        live: correct ? tx(S.correct, lang) : `${head}. ${body}`,
      });
    };

    const decide = (bin: number) => {
      const u = uiRef.current;
      if (u.phase !== "play" || u.paused || bin < 0 || bin >= u.session.bins.length) return;
      resolve(bin);
    };

    const setPause = (on: boolean) => {
      const u = uiRef.current;
      if (!cfg.pausable || u.paused === on) return;
      if (on) {
        if (u.phase === "over") return;
        m.drag = null;
        // полёт карточки (0,18 с) на паузе не нужен: сразу доигрываем его
        if (u.phase === "flying") go(m.after === "explain" ? "explain" : "gap", { cardGone: true, paused: true });
        else commit({ paused: true });
      } else commit({ paused: false });
    };

    const canSkipBanner = () => uiRef.current.phase === "banner" && cfg.bannerSkippable && m.phaseT >= BANNER_SKIP_AFTER_MS;

    const applyCard = () => {
      const u = uiRef.current;
      const el = cardRef.current;
      const field = fieldRef.current;
      const shown = u.phase === "play" || (u.phase === "explain" && !u.cardGone);
      if (!el || !field || !shown || u.paused || !u.card || el.dataset.id !== String(u.card.id)) return;
      const fp = cfg.falls ? Math.min(1, m.fallMs / m.fallDur) : 0;
      const y = reducedMotion ? 0 : fp * Math.max(0, field.clientHeight - CARD_H);
      const x = m.drag ? m.drag.dx : 0;
      el.style.transform = `translate(${x}px, ${y}px)`;
      const drain = drainRef.current;
      if (drain) drain.style.width = `${(1 - fp) * 100}%`;
    };

    const tick = (now: number) => {
      if (cancelled) return;
      if (!last) last = now;
      let dt = now - last;
      last = now;
      if (document.hidden || uiRef.current.paused) dt = 0;
      dt = Math.min(dt, 100);
      m.wallMs += dt;
      const p = uiRef.current.phase;

      if (cfg.wallCapSeconds > 0 && p !== "over" && m.wallMs >= cfg.wallCapSeconds * 1000) {
        endRound();
      } else if (p === "banner") {
        m.phaseT += dt;
        if (cfg.bannerMs !== null && m.phaseT >= cfg.bannerMs) startCard();
      } else if (p === "play") {
        if (clock) m.roundMs -= dt;
        if (cfg.falls) m.fallMs += dt;
        if (clock && m.roundMs <= 0) endRound();
        else if (cfg.falls && m.fallMs >= m.fallDur) resolve(null);
      } else if (p === "flying") {
        if (clock) m.roundMs -= dt;
        m.phaseT += dt;
        if (clock && m.roundMs <= 0) endRound();
        else if (m.phaseT >= (reducedMotion ? 0 : FLY_MS)) {
          go(m.after === "explain" ? "explain" : "gap", { cardGone: true });
        }
      } else if (p === "gap") {
        if (clock) m.roundMs -= dt;
        m.phaseT += dt;
        if (clock && m.roundMs <= 0) endRound();
        else if (m.phaseT >= GAP_MS) advance();
      } else if (p === "explain") {
        m.phaseT += dt;
        if (cfg.explainMs !== null && m.phaseT >= cfg.explainMs) advance();
      } else if (p === "over") {
        m.phaseT += dt;
        if (m.phaseT >= OVER_MS) {
          if (!finishedRef.current) {
            finishedRef.current = true;
            propsRef.current.onFinish({ score: engine.score, correct: correctCount, total: attempts.length, attempts });
          }
          return;
        }
      }

      if (clock) {
        const secs = Math.max(0, Math.ceil(m.roundMs / 1000));
        if (secs !== uiRef.current.secs) commit({ secs });
        if (barRef.current) barRef.current.style.width = `${Math.max(0, m.roundMs / (cfg.roundSeconds * 10))}%`;
      }
      applyCard();
      raf = requestAnimationFrame(tick);
    };

    api.current = {
      decide,
      advance,
      fieldTap() {
        const u = uiRef.current;
        if (u.paused) return;
        if (u.phase === "banner") {
          if (canSkipBanner()) startCard();
        } else if (cfg.explainMs !== null) advance(); // автоматические режимы: тап продолжает
      },
      startRule() {
        const u = uiRef.current;
        if (u.phase === "banner" && !u.paused) startCard();
      },
      setPause,
      down(e) {
        const u = uiRef.current;
        if (u.phase !== "play" || u.paused) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        m.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 };
      },
      move(e) {
        if (!m.drag || m.drag.id !== e.pointerId) return;
        m.drag.dx = e.clientX - m.drag.x0;
        m.drag.dy = e.clientY - m.drag.y0;
      },
      up(e) {
        const d = m.drag;
        if (!d || d.id !== e.pointerId) return;
        m.drag = null;
        const n = uiRef.current.session.bins.length;
        if (d.dx < -SWIPE_PX) decide(0);
        else if (d.dx > SWIPE_PX) decide(n - 1);
        else if (n === 3 && d.dy > SWIPE_PX) decide(1);
      },
      cancel() {
        m.drag = null;
      },
    };

    const onKey = (e: KeyboardEvent) => {
      if (ignoreKey(e)) return;
      const u = uiRef.current;
      const p = u.phase;
      if (cfg.pausable && p !== "over" && (e.key === "Escape" || e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setPause(!u.paused);
        return;
      }
      if (u.paused) return;
      const isGo = e.key === "Enter" || e.key === " ";
      if (p === "banner") {
        if (isGo && canSkipBanner()) {
          e.preventDefault();
          startCard();
        }
        return;
      }
      if (p === "explain" && isGo) {
        e.preventDefault();
        advance();
        return;
      }
      if (p !== "play") return;
      if (isGo) {
        e.preventDefault();
        return;
      }
      const n = u.session.bins.length;
      let bin = -1;
      if (e.key === "ArrowLeft") bin = 0;
      else if (e.key === "ArrowRight") bin = n - 1;
      else if (e.key === "ArrowDown" && n === 3) bin = 1;
      else if (/^[1-3]$/.test(e.key)) bin = Number(e.key) - 1;
      if (bin >= 0 && bin < n) {
        e.preventDefault();
        decide(bin);
      }
    };
    window.addEventListener("keydown", onKey);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      api.current = null;
    };
  }, [init]);

  const n = ui.session.bins.length;
  const mult = multiplierFor(ui.streak);
  const arrows = n === 3 ? ["←", "↓", "→"] : ["←", "→"];
  const mood =
    ui.lastOk === false ? "sad" : ui.streak >= 4 ? "celebrate" : ui.lastOk ? "happy" : ui.phase === "banner" ? "thinking" : "neutral";
  const label = ui.card?.item.label ?? "";
  const ruleTitle = tx(ui.session.title, lang);
  const urgent = clock && ui.secs <= 10;
  // карточка со штрафным видом: осталась на месте после ошибки/таймаута
  const wrongCard = ui.phase === "explain" && !ui.cardGone;

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
          <span className="flex animate-pop items-center gap-0.5 rounded-full bg-streak-soft px-2 py-0.5 text-sm font-extrabold text-streak">
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
            {ui.done}/{total}
          </span>
        )}
        {cfg.pausable && (
          <button
            type="button"
            onClick={() => api.current?.setPause(!ui.paused)}
            aria-label={t(ui.paused ? "common.continue" : "game.pause")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            {ui.paused ? <Play size={22} aria-hidden /> : <Pause size={22} aria-hidden />}
          </button>
        )}
        <Mascot mood={mood} size={32} />
      </div>
      <div className="h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-surface-2">
        <div
          ref={barRef}
          style={clock ? undefined : { width: `${(ui.done / total) * 100}%` }}
          className={cn(
            "h-full rounded-full",
            clock ? "w-full" : "bg-primary transition-[width] duration-300",
            clock && (urgent ? "bg-warning" : "bg-primary"),
          )}
        />
      </div>

      {ui.paused ? (
        // на паузе поле скрыто, чтобы нельзя было думать «в долг»
        <div className="flex min-h-0 flex-1 animate-fade-in flex-col items-center justify-center gap-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-muted">
            <Pause size={32} aria-hidden />
          </span>
          <p className="text-xl font-extrabold text-text">{t("game.paused")}</p>
          <button
            type="button"
            autoFocus
            onClick={() => api.current?.setPause(false)}
            className="flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-6 py-2 text-base font-bold text-white focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:outline-none"
          >
            <Play size={18} aria-hidden /> {t("common.continue")}
          </button>
        </div>
      ) : (
        <>
          <div className="mt-2 flex shrink-0 justify-center">
            <span className="rounded-full bg-primary-soft px-3 py-1 text-center text-sm font-semibold text-primary">
              {fmt(tx(S.rule, lang), { title: ruleTitle })}
            </span>
          </div>

          <div
            ref={fieldRef}
            onClick={() => api.current?.fieldTap()}
            className="relative mt-2 min-h-0 flex-1 overflow-hidden"
          >
            {!calm && <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t-2 border-dashed border-border" />}

            {ui.card && ui.phase !== "banner" && !ui.cardGone && (
              <>
                <div
                  key={ui.card.id}
                  ref={cardRef}
                  data-id={ui.card.id}
                  role="img"
                  aria-label={label}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => api.current?.down(e)}
                  onPointerMove={(e) => api.current?.move(e)}
                  onPointerUp={(e) => api.current?.up(e)}
                  onPointerCancel={() => api.current?.cancel()}
                  // спокойно: карточка ждёт чуть выше середины поля, падения нет
                  style={{
                    width: CARD_W,
                    height: CARD_H,
                    marginLeft: -CARD_W / 2,
                    top: calm ? `calc(45% - ${CARD_H / 2}px)` : undefined,
                  }}
                  className={cn(
                    "absolute top-0 left-1/2 flex touch-none cursor-grab items-center justify-center rounded-2xl border-2 bg-surface font-mono font-bold text-text shadow-md active:cursor-grabbing",
                    wrongCard ? "border-danger" : "border-border",
                    label.length > 7 ? "text-2xl" : "text-3xl",
                  )}
                >
                  {label}
                </div>
                {reduced && cfg.falls && ui.phase === "play" && (
                  <div
                    style={{ width: CARD_W, marginLeft: -CARD_W / 2, top: CARD_H + 8 }}
                    className="absolute left-1/2 h-1.5 overflow-hidden rounded-full bg-surface-2"
                  >
                    <div ref={drainRef} className="h-full w-full rounded-full bg-primary" />
                  </div>
                )}
              </>
            )}

            {ui.pop && (
              <div
                key={ui.pop.id}
                className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center"
                aria-hidden
              >
                <span className="animate-pop rounded-full bg-gold-soft px-3 py-1 font-mono text-xl font-extrabold text-gold">
                  {ui.pop.text}
                </span>
              </div>
            )}

            {ui.phase === "banner" && (
              <div
                key={ui.session.id}
                className="absolute inset-0 flex animate-fade-in flex-col items-center justify-center gap-2 px-2 text-center"
              >
                {total > 0 && (
                  <span className="text-xs font-bold text-muted">
                    {fmt(tx(S.ruleNum, lang), { i: ui.ruleNo, n: init.engine.rulesTotal })}
                  </span>
                )}
                <span className="text-xs font-extrabold tracking-wide text-muted uppercase">{tx(S.newRule, lang)}</span>
                <span className="text-xl font-extrabold text-primary">{ruleTitle}</span>
                {total > 0 && (
                  <div className="mt-1 flex flex-wrap justify-center gap-2">
                    {ui.session.bins.map((b, i) => (
                      <span
                        key={i}
                        className="rounded-xl border-2 border-border bg-surface-2 px-3 py-1.5 text-sm font-semibold text-text"
                      >
                        <span className="mr-1 font-bold text-muted" aria-hidden>
                          {arrows[i]}
                        </span>
                        {tx(b, lang)}
                      </span>
                    ))}
                  </div>
                )}
                {calm && (
                  <button
                    type="button"
                    autoFocus
                    onClick={(e) => {
                      e.stopPropagation();
                      api.current?.startRule();
                    }}
                    className="mt-3 min-h-12 rounded-2xl bg-primary px-6 py-2 text-base font-bold text-white focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:outline-none"
                  >
                    {tx(S.gotIt, lang)}
                  </button>
                )}
              </div>
            )}

            {ui.phase === "over" && (
              <div className="absolute inset-0 flex items-center justify-center bg-bg/80">
                <span className="animate-pop text-4xl font-extrabold text-text">{tx(clock ? S.timeUp : S.done, lang)}</span>
              </div>
            )}
          </div>

          <div className={cn("mt-2 flex shrink-0 items-center gap-2 text-sm", clock ? "h-20" : "mb-1 min-h-24")}>
            {ui.explainBody ? (
              <>
                {clock ? (
                  <p className="flex-1 animate-fade-in leading-snug text-text">
                    <span className="font-extrabold text-danger-strong">{ui.explainHead}. </span>
                    <span className="font-mono">{ui.explainBody}</span>
                  </p>
                ) : (
                  // обычный и спокойный: что неверно, какая корзина верная и «почему так»
                  <div className="min-w-0 flex-1 animate-fade-in rounded-2xl border border-border bg-surface-2 px-3 py-2 leading-snug">
                    <p>
                      <span className="font-extrabold text-danger-strong">{ui.explainHead}. </span>
                      <span className="font-extrabold text-success-strong">
                        {fmt(tx(S.rightBin, lang), { bin: ui.explainBin ?? "" })}
                      </span>
                    </p>
                    <p className="mt-0.5 text-text">
                      <span className="text-xs font-bold text-muted">{t("game.why")}: </span>
                      <span className="font-semibold">{ui.explainBody}</span>
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => api.current?.advance()}
                  className="min-h-11 min-w-11 shrink-0 rounded-xl bg-primary px-3 py-1.5 text-sm font-bold text-white focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:outline-none"
                >
                  {t("common.next")}
                </button>
              </>
            ) : ui.hint && ui.phase !== "banner" ? (
              <p className="flex-1 text-center text-muted">{tx(calm ? S.calmHint : S.swipeHint, lang)}</p>
            ) : null}
          </div>

          <div key={`${ui.card?.id ?? 0}-${ui.phase}`} aria-live="polite" className="sr-only">
            {ui.live}
          </div>

          <div className="mt-1 grid h-24 shrink-0 gap-2" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {ui.session.bins.map((b, i) => {
              const ok = ui.binFx.ok === i;
              const bad = ui.binFx.bad === i;
              const target = ui.binFx.target === i;
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={tx(b, lang)}
                  onClick={(e) => {
                    e.stopPropagation();
                    api.current?.decide(i);
                  }}
                  className={cn(
                    "relative flex items-center justify-center rounded-2xl border-2 px-2 text-center leading-tight font-semibold text-text transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none active:scale-[0.98]",
                    n === 3 ? "text-sm" : "text-base",
                    ok && "border-success bg-success-soft",
                    bad && "border-danger bg-danger-soft animate-shake motion-reduce:animate-none",
                    !ok && !bad && "border-border bg-surface-2",
                    target && "border-success outline-2 outline-success",
                  )}
                >
                  <span className="absolute top-1 left-2 text-xs font-bold text-muted" aria-hidden>
                    {arrows[i]}
                  </span>
                  {ok && <Check size={16} className="absolute top-1 right-1.5 text-success-strong" aria-hidden />}
                  {bad && <X size={16} className="absolute top-1 right-1.5 text-danger-strong" aria-hidden />}
                  {target && <Check size={16} className="absolute top-1 right-1.5 text-success-strong" aria-hidden />}
                  {tx(b, lang)}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

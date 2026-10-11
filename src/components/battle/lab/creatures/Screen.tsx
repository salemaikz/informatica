"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, m, useAnimationControls } from "motion/react";
import { Clock, Database, Flame, Network, Puzzle, CodeXml, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { BattleScreenProps, Fighter } from "../types";
import { ARENA_H, ARENA_W, ArenaBg, OPP_SPOT, YOU_SPOT } from "./arena";
import { Creature, type CreatureMood } from "./art";
import { SKINS } from "./skins";

// Экран боя «Существа»: раскладка как в классических битвах карманных монстров.

const OPP_SIZE = 140;
const YOU_SIZE = 178;
const pctX = (x: number) => `${(x / ARENA_W) * 100}%`;
const pctY = (y: number) => `${(y / ARENA_H) * 100}%`;
/** Центр существа (тело) над площадкой. */
const OPP_C = { x: OPP_SPOT.x, y: OPP_SPOT.y - OPP_SIZE * 0.42 };
const YOU_C = { x: YOU_SPOT.x, y: YOU_SPOT.y - YOU_SIZE * 0.4 };

const IDLE = { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1, filter: "brightness(1) grayscale(0)" };

const MOVES: { name: string; color: string; Icon: LucideIcon }[] = [
  { name: "Логика", color: "#e0559c", Icon: Puzzle },
  { name: "Код", color: "#3b82f6", Icon: CodeXml },
  { name: "Сеть", color: "#14b8a6", Icon: Network },
  { name: "Данные", color: "#c98a1b", Icon: Database },
];

const OUTLINE = { WebkitTextStroke: "4px #fff", paintOrder: "stroke fill" } as const;

function starPoints(spikes: number, outer: number, inner: number) {
  let s = "";
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    s += `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)} `;
  }
  return s;
}

function Burst({ at, crit, nonce }: { at: { x: number; y: number }; crit: boolean; nonce: number }) {
  return (
    <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: pctX(at.x), top: pctY(at.y) }}>
      <m.svg
        key={nonce}
        viewBox="-50 -50 100 100"
        className={crit ? "size-40" : "size-28"}
        initial={{ scale: 0.2, opacity: 0, rotate: -10 }}
        animate={{ scale: [0.2, 1.1, 1.25], opacity: [0, 1, 0], rotate: [-10, 6, 12] }}
        transition={{ duration: crit ? 0.6 : 0.45, delay: crit ? 0.34 : 0.28, times: [0, 0.35, 1] }}
      >
        <polygon points={starPoints(crit ? 12 : 9, 46, 21)} fill={crit ? "#ff7a1a" : "#ffb21a"} stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
        <polygon points={starPoints(crit ? 12 : 9, 33, 15)} fill="#ffe46b" />
        <circle r="11" fill="#fff" />
      </m.svg>
    </div>
  );
}

function Float({ at, nonce, delay, children, className, big }: { at: { x: number; y: number }; nonce: number; delay: number; children: React.ReactNode; className?: string; big?: boolean }) {
  return (
    <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: pctX(at.x), top: pctY(at.y) }}>
      <m.div
        key={nonce}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0], y: [0, -12, -38, -58], scale: big ? [0.4, 1.35, 1.1, 1] : [0.5, 1.2, 1, 1] }}
        transition={{ duration: 1.15, delay, times: [0, 0.16, 0.72, 1] }}
        className={cn("font-black tabular-nums", big ? "text-5xl" : "text-4xl", className)}
        style={OUTLINE}
      >
        {children}
      </m.div>
    </div>
  );
}

function Stars({ at }: { at: { x: number; y: number } }) {
  const N = 16;
  const orbit = (phase: number, axis: "cos" | "sin") =>
    Array.from({ length: N + 1 }, (_, i) => {
      const a = (i / N) * Math.PI * 2 + phase;
      return axis === "cos" ? Math.cos(a) * 44 : Math.sin(a) * 11;
    });
  return (
    <div className="pointer-events-none absolute" style={{ left: pctX(at.x), top: pctY(at.y) }}>
      {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((ph) => (
        <m.svg
          key={ph}
          viewBox="-12 -12 24 24"
          className="absolute -left-3 -top-3 size-6"
          animate={{ x: orbit(ph, "cos"), y: orbit(ph, "sin"), rotate: [0, 360] }}
          transition={{ x: { duration: 1.3, repeat: Infinity, ease: "linear" }, y: { duration: 1.3, repeat: Infinity, ease: "linear" }, rotate: { duration: 2, repeat: Infinity, ease: "linear" } }}
        >
          <polygon points={starPoints(5, 11, 5)} fill="#ffd23f" stroke="#a86a00" strokeWidth="1.6" strokeLinejoin="round" />
        </m.svg>
      ))}
    </div>
  );
}

function Sparkles({ at }: { at: { x: number; y: number } }) {
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <div key={i} className="pointer-events-none absolute" style={{ left: pctX(at.x), top: pctY(at.y) }}>
            <m.svg
              viewBox="-12 -12 24 24"
              className="absolute -left-2.5 -top-2.5 size-5"
              initial={{ opacity: 0, scale: 0.3, x: 0, y: 0 }}
              animate={{ opacity: [0, 1, 0], scale: [0.3, 1.1, 0.5], x: Math.cos(a) * 92, y: Math.sin(a) * 52 - 14 }}
              transition={{ duration: 1.4, delay: 0.5 + i * 0.04, ease: "easeOut" }}
            >
              <polygon points={starPoints(4, 11, 3.5)} fill={i % 2 ? "#ffd23f" : "#fff7c2"} stroke="#fff" strokeWidth="1" />
            </m.svg>
          </div>
        );
      })}
    </>
  );
}

function Plate({ f, you, sub }: { f: Fighter; you?: boolean; sub: string }) {
  const tone = f.hp > 50 ? "bg-success" : f.hp >= 25 ? "bg-warning" : "bg-danger";
  return (
    <div className="rounded-2xl border-[3px] px-3 pb-2 pt-1.5" style={{ background: "#fffaf0", borderColor: "#3b3a52", color: "#2b2a40", boxShadow: "0 3px 0 #3b3a52" }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[15px] font-extrabold leading-tight">{f.name}</span>
        <span className="shrink-0 text-xs font-extrabold">ур. {f.level}</span>
      </div>
      <div className="truncate text-[11px] font-semibold leading-none" style={{ color: "#6a6880" }}>
        {sub}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="rounded px-1 text-[10px] font-black leading-4 text-white" style={{ background: "#3b3a52" }}>
          HP
        </span>
        <div className="h-3 flex-1 overflow-hidden rounded-full border-2" style={{ background: "#e4e0d0", borderColor: "#3b3a52" }}>
          <m.div className={cn("h-full rounded-full", tone)} initial={false} animate={{ width: `${f.hp}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
        </div>
      </div>
      {you && <div className="mt-0.5 text-right text-[13px] font-extrabold tabular-nums">{Math.round(f.hp)}/100</div>}
    </div>
  );
}

const skinName = (id: string) => SKINS.find((s) => s.id === id)?.name ?? "";

export default function CreaturesScreen({ you, opp, combo, event, question, picked, stunned, onAnswer, timeLeftMs }: BattleScreenProps) {
  const youC = useAnimationControls();
  const oppC = useAnimationControls();
  const arenaC = useAnimationControls();
  const [fx, setFx] = useState({ oppHurt: false, youHurt: false, oppDown: false, youDown: false });

  const nonce = event?.nonce;
  const kind = event?.kind;

  useEffect(() => {
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const set = (p: Partial<typeof fx>) => setFx((s) => ({ ...s, ...p }));

    if (!kind) {
      youC.set(IDLE);
      oppC.set(IDLE);
      arenaC.set({ x: 0, y: 0 });
      at(0, () => setFx({ oppHurt: false, youHurt: false, oppDown: false, youDown: false }));
      return () => timers.forEach(clearTimeout);
    }
    at(0, () => setFx({ oppHurt: false, youHurt: false, oppDown: false, youDown: false }));

    const dx = OPP_C.x - YOU_C.x;
    const dy = OPP_C.y - YOU_C.y;
    const lunge = (c: typeof youC, sx: number, sy: number, big: boolean) =>
      c.start({ x: [0, -sx * 0.1, sx * (big ? 0.78 : 0.7), 0], y: [0, -sy * 0.06, sy * (big ? 0.78 : 0.7), 0], scale: [1, 1.03, big ? 1.14 : 1.08, 1], transition: { duration: big ? 0.72 : 0.58, times: [0, 0.24, 0.5, 1], ease: "easeInOut" } });
    const hurt = (c: typeof youC, strong: boolean) =>
      c.start({
        x: strong ? [0, 16, -15, 12, -9, 5, 0] : [0, 9, -9, 6, -4, 0],
        opacity: [1, 0.15, 1, 0.15, 1, 0.15, 1],
        filter: strong ? ["brightness(1) grayscale(0)", "brightness(3) grayscale(0)", "brightness(1) grayscale(0)"] : "brightness(1) grayscale(0)",
        transition: { duration: strong ? 0.75 : 0.55 },
      });
    const sink = (c: typeof youC) => c.start({ y: 34, scale: 0.9, opacity: 0.45, filter: "brightness(1.15) grayscale(1)", transition: { duration: 0.9, ease: "easeIn" } });

    switch (kind) {
      case "hit":
        lunge(youC, dx, dy, false);
        at(290, () => {
          hurt(oppC, false);
          set({ oppHurt: true });
        });
        at(900, () => set({ oppHurt: false }));
        break;
      case "crit":
      case "ko":
        lunge(youC, dx, dy, true);
        at(360, () => {
          hurt(oppC, true);
          arenaC.start({ x: [0, -9, 9, -7, 6, -3, 0], y: [0, 5, -5, 3, -2, 0], transition: { duration: 0.5 } });
          set({ oppHurt: true });
        });
        if (kind === "ko") {
          at(1000, () => {
            set({ oppHurt: false, oppDown: true });
            sink(oppC);
          });
        } else at(1050, () => set({ oppHurt: false }));
        break;
      case "taken":
      case "lose":
        lunge(oppC, -dx, -dy, false);
        at(290, () => {
          hurt(youC, kind === "lose");
          set({ youHurt: true });
        });
        if (kind === "lose") {
          at(1000, () => {
            set({ youHurt: false, youDown: true });
            sink(youC);
          });
        } else at(900, () => set({ youHurt: false }));
        break;
      case "miss":
        youC.start({ x: [0, -6, 6, -6, 6, -5, 5, 0], rotate: [0, -6, 6, -6, 6, -4, 4, 0], transition: { duration: 1.5, ease: "easeInOut" } });
        break;
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- запуск строго по новому событию
  }, [nonce, kind]);

  const oppMood: CreatureMood = fx.oppHurt ? "hurt" : fx.oppDown ? "ko" : "idle";
  const youMood: CreatureMood = fx.youHurt ? "hurt" : fx.youDown ? "ko" : stunned ? "stun" : "idle";

  const secs = Math.ceil(timeLeftMs / 1000);
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const crit = kind === "crit" || kind === "ko";
  const dmg = event?.dmg ?? 0;
  const showHit = kind === "hit" || kind === "crit" || kind === "ko";
  const showTaken = kind === "taken" || kind === "lose";

  return (
    <div className="flex flex-col bg-bg">
      <m.div animate={arenaC} className="relative w-full overflow-hidden" style={{ aspectRatio: `${ARENA_W} / ${ARENA_H}` }}>
        <ArenaBg />

        {/* соперник справа вверху */}
        <div className="absolute" style={{ left: pctX(OPP_SPOT.x - OPP_SIZE / 2), top: pctY(OPP_SPOT.y - OPP_SIZE * 0.93), width: pctX(OPP_SIZE) }}>
          <m.div animate={oppC} initial={false} style={{ transformOrigin: "50% 90%" }}>
            <Creature skin={opp.skin} size={OPP_SIZE} mood={oppMood} shadow />
          </m.div>
        </div>

        {/* вы слева внизу, крупнее и зеркально */}
        <div className="absolute" style={{ left: pctX(YOU_SPOT.x - YOU_SIZE / 2), top: pctY(YOU_SPOT.y - YOU_SIZE * 0.93), width: pctX(YOU_SIZE) }}>
          <m.div animate={youC} initial={false} style={{ transformOrigin: "50% 90%" }}>
            <Creature skin={you.skin} size={YOU_SIZE} mood={youMood} flip shadow />
          </m.div>
        </div>

        {/* эффекты */}
        {event && showHit && (
          <>
            <Burst at={OPP_C} crit={crit} nonce={event.nonce} />
            <Float at={{ x: OPP_C.x + 34, y: OPP_C.y - 40 }} nonce={event.nonce} delay={crit ? 0.36 : 0.3} className={crit ? "text-streak" : "text-danger"} big={crit}>
              −{dmg}
            </Float>
          </>
        )}
        {event && crit && (
          <>
            <m.div key={`f${event.nonce}`} className="pointer-events-none absolute inset-0 bg-white" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.8, 0] }} transition={{ duration: 0.4, delay: 0.34 }} />
            <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: "36%", top: "40%" }}>
              <m.div
                key={`c${event.nonce}`}
                initial={{ opacity: 0, scale: 0.3, rotate: -14 }}
                animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.5, 1.15, 1.1], rotate: [-14, -6, -8, -8] }}
                transition={{ duration: 1.3, delay: 0.3, times: [0, 0.18, 0.75, 1] }}
                className="text-5xl font-black text-streak"
                style={OUTLINE}
              >
                Крит!
              </m.div>
            </div>
          </>
        )}
        {event && showTaken && (
          <>
            <Burst at={YOU_C} crit={false} nonce={event.nonce} />
            <Float at={{ x: YOU_C.x + 10, y: YOU_C.y - 44 }} nonce={event.nonce} delay={0.3} className="text-danger">
              −{dmg}
            </Float>
          </>
        )}
        {stunned && youMood === "stun" && <Stars at={{ x: YOU_C.x, y: YOU_SPOT.y - YOU_SIZE * 0.93 + YOU_SIZE * 0.2 }} />}

        {/* итог боя */}
        <AnimatePresence>
          {kind === "ko" && opp.hp <= 0 && (
            <div className="pointer-events-none absolute inset-0">
              <Sparkles at={{ x: ARENA_W / 2, y: ARENA_H * 0.45 }} />
              <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2">
                <m.div
                  key={`v${nonce}`}
                  initial={{ opacity: 0, scale: 0.2, rotate: -8 }}
                  animate={{ opacity: 1, scale: 1, rotate: -4 }}
                  transition={{ type: "spring", stiffness: 180, damping: 11, delay: 0.9 }}
                  className="whitespace-nowrap rounded-3xl border-4 px-5 py-1.5 text-5xl font-black text-gold"
                  style={{ background: "#2b2a40", borderColor: "#ffd23f", WebkitTextStroke: "0", textShadow: "0 3px 0 #8a5a00", boxShadow: "0 6px 0 rgba(0,0,0,.25)" }}
                >
                  Победа!
                </m.div>
              </div>
            </div>
          )}
          {kind === "lose" && you.hp <= 0 && (
            <div className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2">
              <m.div
                key={`l${nonce}`}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.4 }}
                className="whitespace-nowrap rounded-3xl border-4 px-5 py-1.5 text-4xl font-black text-white"
                style={{ background: "#2b2a40", borderColor: "#8a879f" }}
              >
                Поражение
              </m.div>
            </div>
          )}
        </AnimatePresence>

        {/* таблички */}
        <div className="absolute left-[3%] top-[3.5%] flex w-[47%] flex-col items-start gap-2">
          <div className="w-full">
            <Plate f={opp} sub={skinName(opp.skin)} />
          </div>
          {combo > 0 && (
            <m.div
              key={combo}
              initial={{ scale: 1.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 14 }}
              className="flex items-center gap-1 rounded-full bg-streak px-3 py-1 text-sm font-extrabold text-white shadow-md"
            >
              <Flame className="size-4" />
              Комбо ×{combo}
            </m.div>
          )}
        </div>
        <div className="absolute bottom-[3.5%] right-[3%] flex w-[46%] flex-col items-end gap-2">
          <div className="w-full">
            <Plate f={you} you sub={skinName(you.skin)} />
          </div>
        </div>
      </m.div>

      {/* окно реплики и приёмы */}
      <div className="flex flex-col gap-2.5 p-3">
        <div className="flex items-center gap-2 rounded-2xl border-2 border-border bg-surface px-3 py-2.5">
          <p className="flex-1 text-[15px] font-bold leading-snug text-text">{question.prompt}</p>
          {stunned ? (
            <span className="shrink-0 rounded-full bg-warning-soft px-2 py-1 text-xs font-extrabold text-ink-warning">Оглушён</span>
          ) : (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-bg px-2 py-1 text-xs font-extrabold tabular-nums text-muted">
              <Clock className="size-3.5" />
              {clock}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {question.options.map((o, i) => {
            const mv = MOVES[i % MOVES.length];
            const st = picked === null ? "idle" : i === question.correct ? "ok" : i === picked ? "bad" : "dim";
            return (
              <button
                key={i}
                type="button"
                disabled={stunned || picked !== null}
                onClick={() => onAnswer(i)}
                className={cn(
                  "flex min-h-14 items-center gap-2.5 rounded-2xl border-2 px-2.5 py-2 text-left transition-colors active:translate-y-px",
                  st === "idle" && "border-border bg-surface",
                  st === "ok" && "border-success bg-success-soft",
                  st === "bad" && "border-danger bg-danger-soft",
                  st === "dim" && "border-border bg-surface opacity-60",
                  stunned && picked === null && "opacity-50",
                )}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-xl text-white" style={{ background: mv.color }}>
                  <mv.Icon className="size-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold leading-none text-muted">{mv.name}</span>
                  <span className="block truncate text-lg font-extrabold leading-tight text-text">{o}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

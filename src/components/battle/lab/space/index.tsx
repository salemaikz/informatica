"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence, m, useAnimationControls } from "motion/react";
import { Shield, Timer, Zap } from "lucide-react";
import { cn } from "@/lib/cn";
import type { BattleScreenProps, BattleVariant, Fighter } from "../types";
import { Ship, SHIP_H, SHIP_W } from "./ships";
import { ARENA_H, ARENA_W, CX, Effects, OPP_Y, YOU_Y } from "./effects";

// «Космобой»: вертикальная дуэль кораблей. Соперник сверху носом вниз, вы снизу носом вверх.
// Арена — своя картинка (одинакова в обеих темах), консоль с вопросом ниже — на токенах.

const SCALE = 0.72;
const DEBRIS_COLORS: Record<string, [string, string]> = {
  shuttle: ["#aebfe0", "#ff6b57"],
  scout: ["#7fd9b6", "#ffd447"],
  interceptor: ["#e0503f", "#ffb02e"],
  barys: ["#a9bdd6", "#2b3350"],
  cruiser: ["#7b6bd6", "#ffcf4a"],
  tulpar: ["#fff3cf", "#ffbf2e"],
};

// ---------- фон ----------

/** Детерминированный ГПСЧ — одинаковые звёзды на сервере и клиенте. */
function stars(n: number, seed: number) {
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return Array.from({ length: n }, () => ({ x: rnd() * ARENA_W, y: rnd() * ARENA_H, r: 0.5 + rnd() }));
}

function StarLayer({ n, seed, size, speed, opacity, color }: { n: number; seed: number; size: number; speed: number; opacity: number; color: string }) {
  const list = useMemo(() => stars(n, seed), [n, seed]);
  const dots = (
    <g fill={color} opacity={opacity}>
      {list.map((st, i) => (
        <circle key={i} cx={st.x} cy={st.y} r={st.r * size} />
      ))}
    </g>
  );
  return (
    <m.g animate={{ y: [0, ARENA_H] }} transition={{ duration: speed, repeat: Infinity, ease: "linear" }}>
      {dots}
      <g transform={`translate(0 ${-ARENA_H})`}>{dots}</g>
    </m.g>
  );
}

function Backdrop() {
  return (
    <>
      <defs>
        <linearGradient id="sp-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#060a22" />
          <stop offset="0.5" stopColor="#0f1448" />
          <stop offset="1" stopColor="#1d0f4e" />
        </linearGradient>
        <radialGradient id="sp-neb1" cx="0.2" cy="0.3" r="0.6">
          <stop offset="0" stopColor="#7a4dff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#7a4dff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sp-neb2" cx="0.85" cy="0.75" r="0.55">
          <stop offset="0" stopColor="#1fb6d6" stopOpacity="0.35" />
          <stop offset="1" stopColor="#1fb6d6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sp-planet" cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#ffb98a" />
          <stop offset="0.5" stopColor="#c0507a" />
          <stop offset="1" stopColor="#2a1060" />
        </radialGradient>
      </defs>
      <rect width={ARENA_W} height={ARENA_H} fill="url(#sp-bg)" />
      <rect width={ARENA_W} height={ARENA_H} fill="url(#sp-neb1)" />
      <rect width={ARENA_W} height={ARENA_H} fill="url(#sp-neb2)" />
      {/* дальняя планета с кольцом */}
      <g opacity="0.9">
        <circle cx={338} cy={196} r={44} fill="url(#sp-planet)" />
        <ellipse cx={338} cy={196} rx={74} ry={14} fill="none" stroke="#ffd9b8" strokeWidth={4} opacity={0.5} transform="rotate(-18 338 196)" />
        <path d="M296 176 a44 44 0 0 1 84 4" fill="none" stroke="#fff" strokeOpacity="0.15" strokeWidth="3" />
      </g>
      <StarLayer n={46} seed={7} size={0.8} speed={42} opacity={0.55} color="#b9c6ff" />
      <StarLayer n={26} seed={21} size={1.2} speed={24} opacity={0.8} color="#ffffff" />
      <StarLayer n={12} seed={99} size={1.9} speed={13} opacity={0.95} color="#cfe8ff" />
      {/* полоса боевой оси */}
      <rect x={CX - 1} y={0} width={2} height={ARENA_H} fill="#7be9ff" opacity="0.05" />
    </>
  );
}

// ---------- интерфейс на арене ----------

const barColor = (hp: number) => (hp > 50 ? "bg-success" : hp >= 25 ? "bg-warning" : "bg-danger");

function ShieldBar({ hp }: { hp: number }) {
  const lit = Math.ceil(Math.max(0, hp) / 10);
  return (
    <div className="flex items-center gap-1.5" role="meter" aria-valuenow={Math.round(hp)} aria-valuemin={0} aria-valuemax={100} aria-label="Щит">
      <Shield className={cn("size-4 shrink-0", hp > 50 ? "text-success" : hp >= 25 ? "text-warning" : "text-danger")} strokeWidth={2.4} />
      <div className="flex flex-1 gap-[3px]">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className={cn("h-2.5 flex-1 -skew-x-12 rounded-[2px] transition-colors duration-300", i < lit ? barColor(hp) : "bg-white/15")} />
        ))}
      </div>
      <span className="w-9 text-right text-xs font-extrabold tabular-nums text-white">{Math.round(hp)}%</span>
    </div>
  );
}

function Plate({ f, className, children }: { f: Fighter; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("absolute z-10 flex gap-3 rounded-2xl border border-white/15 bg-[#080c26]/75 px-3 py-1.5 backdrop-blur-sm", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2 text-white">
          <span className="truncate text-[13px] font-extrabold">{f.name}</span>
          <span className="shrink-0 text-[11px] font-bold text-white/60">Ур. {f.level}</span>
        </div>
        <ShieldBar hp={f.hp} />
      </div>
      {children}
    </div>
  );
}

function ComboCharge({ combo }: { combo: number }) {
  const full = combo >= 5;
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-end gap-1">
      <span className="text-[11px] font-bold text-white/60">Заряд залпа</span>
      <div className="flex items-center gap-1.5">
      <Zap className={cn("size-4 shrink-0 text-streak", full && "motion-safe:animate-pulse")} strokeWidth={2.4} fill={full ? "currentColor" : "none"} />
      <div className="flex flex-1 gap-[3px]">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={cn("h-2 flex-1 -skew-x-12 rounded-[2px] transition-colors duration-200", i < combo ? "bg-streak" : "bg-white/15")} />
        ))}
      </div>
      <span className={cn("w-9 text-right text-xs font-extrabold tabular-nums", combo > 0 ? "text-streak" : "text-white/40")}>{full ? "МАКС" : `×${combo}`}</span>
      </div>
    </div>
  );
}

// ---------- экран ----------

const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function Screen({ you, opp, combo, event, question, picked, stunned, onAnswer, timeLeftMs }: BattleScreenProps) {
  const arena = useAnimationControls();
  const youC = useAnimationControls();
  const oppC = useAnimationControls();
  const nonce = event?.nonce;
  const kind = event?.kind;

  useEffect(() => {
    if (!kind) return;
    const wob = (a: number) => ({ x: [0, -a, a, -a * 0.6, a * 0.4, 0] });
    const shake = (c: typeof arena, amp: number, delay: number, dur = 0.45) => c.start({ ...wob(amp), transition: { duration: dur, delay } });
    if (kind === "hit") {
      shake(oppC, 6, 0.18);
      youC.start({ y: [0, 7, 0], transition: { duration: 0.28 } });
    } else if (kind === "crit") {
      shake(oppC, 10, 0.4, 0.6);
      shake(arena, 5, 0.42, 0.55);
      youC.start({ y: [0, 10, 0], transition: { duration: 0.34 } });
    } else if (kind === "taken") {
      shake(youC, 8, 0.17);
      shake(arena, 3, 0.17, 0.4);
      oppC.start({ y: [0, -6, 0], transition: { duration: 0.28 } });
    } else if (kind === "miss") {
      youC.start({ x: [0, -3, 3, -2, 2, 0, -3, 3, 0], y: [0, 3, 6, 3, 8, 4, 6, 2, 0], transition: { duration: 1.5 } });
    } else if (kind === "ko") {
      shake(arena, 8, 0.2, 0.7);
      youC.start({ scaleX: [1, 0.12, -1, 0.12, 1], y: [0, -10, -16, -10, 0], transition: { duration: 0.9, delay: 0.7, times: [0, 0.25, 0.5, 0.75, 1] } });
    } else if (kind === "lose") {
      shake(arena, 8, 0.2, 0.7);
      oppC.start({ y: [0, -8, 0], transition: { duration: 0.5, delay: 0.4 } });
    }
  }, [nonce, kind, arena, youC, oppC]);

  const oppDown = opp.hp <= 0;
  const youDown = you.hp <= 0;
  const gone = { opacity: 0, scale: 0.5, transition: { delay: 0.28, duration: 0.18 } };
  const here = { opacity: 1, scale: 1, transition: { duration: 0.3 } };
  const dim = stunned ? "saturate(0.35) brightness(0.8)" : "none";

  return (
    <div className="flex flex-col bg-bg" data-battle-variant="space">
      <m.div animate={arena} className="relative w-full overflow-hidden bg-[#060a22]" style={{ aspectRatio: `${ARENA_W} / ${ARENA_H}` }}>
        <svg viewBox={`0 0 ${ARENA_W} ${ARENA_H}`} className="absolute inset-0 size-full" role="img" aria-label="Космическая дуэль кораблей">
          <Backdrop />

          {/* соперник: нос вниз */}
          <m.g animate={oppC}>
            <g transform={`translate(${CX + (SHIP_W * SCALE) / 2} ${OPP_Y + (SHIP_H * SCALE) / 2}) rotate(180) scale(${SCALE})`}>
              <m.g animate={oppDown ? gone : here} style={{ originX: 0.5, originY: 0.5, transformBox: "fill-box" }}>
                <m.g animate={{ y: [0, -3, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}>
                  <Ship skin={opp.skin} />
                </m.g>
              </m.g>
            </g>
          </m.g>

          {/* вы: нос вверх */}
          <m.g animate={youC} style={{ originX: 0.5, originY: 0.5 }}>
            <g transform={`translate(${CX - (SHIP_W * SCALE) / 2} ${YOU_Y - (SHIP_H * SCALE) / 2}) scale(${SCALE})`}>
              <m.g animate={youDown ? gone : here} style={{ originX: 0.5, originY: 0.5, transformBox: "fill-box" }}>
                <m.g animate={{ y: [0, 3, 0] }} transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }} style={{ filter: dim }}>
                  <Ship skin={you.skin} stalled={stunned} />
                </m.g>
              </m.g>
            </g>
          </m.g>

          {event && <Effects key={event.nonce} ev={event} oppSkinDebris={DEBRIS_COLORS[opp.skin] ?? DEBRIS_COLORS.shuttle} youSkinDebris={DEBRIS_COLORS[you.skin] ?? DEBRIS_COLORS.shuttle} />}

          <AnimatePresence>
            {(oppDown || youDown) && (
              <m.g key="end" initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.7 }} style={{ originX: 0.5, originY: 0.5, transformOrigin: `${CX}px 194px` }}>
                <text x={CX} y={208} textAnchor="middle" fontSize={54} fontWeight={900} fill={oppDown ? "#ffd24a" : "#ff5a64"} stroke="#0a1226" strokeWidth={10} strokeLinejoin="round" style={{ paintOrder: "stroke" }}>
                  {oppDown ? "Победа!" : "Поражение"}
                </text>
              </m.g>
            )}
          </AnimatePresence>
        </svg>

        <Plate f={opp} className="left-3 right-[88px] top-3" />
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full border border-white/15 bg-[#080c26]/70 px-2.5 py-1.5 text-xs font-extrabold tabular-nums text-white backdrop-blur-sm">
          <Timer className="size-3.5 text-white/70" strokeWidth={2.4} />
          {clock(timeLeftMs)}
        </div>
        <Plate f={you} className="inset-x-3 bottom-3">
          <ComboCharge combo={combo} />
        </Plate>
      </m.div>

      <Console question={question} picked={picked} stunned={stunned} onAnswer={onAnswer} disabled={oppDown || youDown} />
    </div>
  );
}

function Console({ question, picked, stunned, onAnswer, disabled }: Pick<BattleScreenProps, "question" | "picked" | "stunned" | "onAnswer"> & { disabled: boolean }) {
  const locked = stunned || disabled || picked !== null;
  return (
    <div className="flex flex-col gap-2.5 border-t-4 border-primary bg-surface px-3 pb-4 pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[15px] font-extrabold leading-snug text-text">{question.prompt}</p>
      </div>
      {stunned && <p className="text-xs font-bold text-warning-strong">Двигатели перезапускаются...</p>}
      <div className="grid grid-cols-2 gap-2">
        {question.options.map((o, i) => {
          const isPicked = picked === i;
          const right = picked !== null && i === question.correct;
          const wrong = isPicked && i !== question.correct;
          return (
            <button
              key={i}
              type="button"
              disabled={locked}
              onClick={() => onAnswer(i)}
              className={cn(
                "flex h-14 items-center gap-2.5 rounded-2xl border-2 px-3 text-left font-bold text-text transition-colors",
                "border-border bg-bg active:translate-y-px",
                right && "border-success bg-success-soft",
                wrong && "border-danger bg-danger-soft",
                stunned && "opacity-50",
              )}
            >
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold", right ? "bg-success text-white" : wrong ? "bg-danger text-white" : "bg-primary-soft text-primary")}>{"ABCD"[i]}</span>
              <span className="truncate text-base">{o}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- витрина скинов ----------

function SkinPreview({ skin, size }: { skin: string; size: number }) {
  const legend = skin === "tulpar";
  return (
    <svg width={size} height={size} viewBox="-18 -14 156 172" role="img" aria-label="Корабль" className="rounded-xl">
      <defs>
        <radialGradient id={`sp-prev-${skin}`} cx="0.5" cy="0.45" r="0.8">
          <stop offset="0" stopColor={legend ? "#3a2a6e" : "#1c2468"} />
          <stop offset="1" stopColor="#070b26" />
        </radialGradient>
      </defs>
      <rect x="-18" y="-14" width="156" height="172" fill={`url(#sp-prev-${skin})`} />
      {[[-4, 10, 1], [112, 4, 1.4], [8, 132, 1.2], [122, 118, 1], [100, 60, 0.8], [2, 70, 0.9], [60, 150, 1]].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity="0.8" />
      ))}
      <m.g animate={{ y: [0, -2.5, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
        <Ship skin={skin} />
      </m.g>
    </svg>
  );
}

export const variant: BattleVariant = {
  id: "space",
  title: "Космобой",
  pitch: "Дуэль кораблей в вертикальном космосе: лазеры, щиты, взрывы. Скины — корабли с силуэтом и характером, вершина коллекции — крылатый конь Тұлпар.",
  skins: [
    { id: "shuttle", name: "Шаттл", rarity: "common" },
    { id: "scout", name: "Разведчик", rarity: "common" },
    { id: "interceptor", name: "Перехватчик", rarity: "rare" },
    { id: "barys", name: "Звёздный барыс", rarity: "rare" },
    { id: "cruiser", name: "Крейсер", rarity: "epic" },
    { id: "tulpar", name: "Тұлпар", rarity: "legendary" },
  ],
  Screen,
  SkinPreview,
};

"use client";

import { m } from "motion/react";
import type { BattleEvent } from "../types";

// Эффекты боя «Космобоя»: лучи, вспышки, взрывы, обломки. Координаты — в системе арены 390×376.
// Эффект монтируется заново на каждый nonce (key), поэтому анимации идут от initial к animate один раз.

export const ARENA_W = 390;
export const ARENA_H = 392;
export const CX = 195;
export const OPP_Y = 117; // центр корабля соперника
export const YOU_Y = 266; // центр вашего корабля
const OPP_NOSE = 167;
const YOU_NOSE = 216;
const OPP_FRONT = 161; // куда бьёт ваш луч (носовая часть соперника)
const YOU_FRONT = 222;

const CYAN = "#7be9ff";
const RED = "#ff4d5a";
const ORANGE = "#ff9a2e";
const GOLD = "#ffd24a";
const PIXEL = { originX: 0.5, originY: 0.5 } as const;
const BASE = { originX: 0.5, originY: 0.5 } as const;

/** Число урона / надпись, всплывающая и гаснущая. */
function Pop({ x, y, text, fill, size, delay, rise = 34 }: { x: number; y: number; text: string; fill: string; size: number; delay: number; rise?: number }) {
  return (
    <m.text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={size}
      fontWeight={900}
      fill={fill}
      stroke="#0a1226"
      strokeWidth={size / 5}
      strokeLinejoin="round"
      style={{ paintOrder: "stroke", ...PIXEL }}
      initial={{ opacity: 0, y: 0, scale: 0.5 }}
      animate={{ opacity: [0, 1, 1, 0], y: [-2, -rise * 0.5, -rise, -rise - 10], scale: [0.5, 1.25, 1, 1] }}
      transition={{ duration: 1.1, delay, times: [0, 0.2, 0.7, 1], ease: "easeOut" }}
    >
      {text}
    </m.text>
  );
}

/** Лазерный луч вдоль оси x от y0 к y1. */
function Beam({ x, y0, y1, color, delay = 0, w = 9 }: { x: number; y0: number; y1: number; color: string; delay?: number; w?: number }) {
  const top = Math.min(y0, y1);
  const h = Math.abs(y1 - y0);
  const up = y1 < y0;
  return (
    <m.g
      initial={{ opacity: 0, scaleY: 0 }}
      animate={{ opacity: [0, 1, 1, 0], scaleY: [0, 1, 1, 1], scaleX: [1, 1, 0.7, 0.2] }}
      transition={{ duration: 0.7, delay, times: [0, 0.15, 0.6, 1], ease: "easeOut" }}
      style={{ originX: 0.5, originY: up ? 1 : 0 }}
    >
      <rect x={x - w * 1.6} y={top} width={w * 3.2} height={h} rx={w * 1.6} fill={color} opacity="0.22" />
      <rect x={x - w / 2} y={top} width={w} height={h} rx={w / 2} fill={color} />
      <rect x={x - w / 5} y={top} width={w / 2.5} height={h} rx={w / 5} fill="#fff" />
    </m.g>
  );
}

/** Круговая вспышка: расширяется и гаснет. */
function Flash({ x, y, r, color, delay, core = "#fff" }: { x: number; y: number; r: number; color: string; delay: number; core?: string }) {
  return (
    <m.g initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: [0.2, 1, 1.25], opacity: [0, 1, 0] }} transition={{ duration: 0.55, delay, times: [0, 0.3, 1], ease: "easeOut" }} style={{ ...BASE, transformOrigin: `${x}px ${y}px` }}>
      <circle cx={x} cy={y} r={r} fill={color} opacity="0.55" />
      <circle cx={x} cy={y} r={r * 0.62} fill={color} />
      <circle cx={x} cy={y} r={r * 0.32} fill={core} />
    </m.g>
  );
}

/** Кольцо ударной волны. */
function Ring({ x, y, r, color, delay, width = 4 }: { x: number; y: number; r: number; color: string; delay: number; width?: number }) {
  return (
    <m.circle
      cx={x}
      cy={y}
      r={r}
      fill="none"
      stroke={color}
      strokeWidth={width}
      initial={{ scale: 0.1, opacity: 0 }}
      animate={{ scale: [0.1, 1], opacity: [0.9, 0] }}
      transition={{ duration: 0.7, delay, ease: "easeOut" }}
      style={{ transformOrigin: `${x}px ${y}px` }}
    />
  );
}

/** Искры, разлетающиеся лучами. */
function Sparks({ x, y, n, len, color, delay }: { x: number; y: number; n: number; len: number; color: string; delay: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + 0.3;
        const l = len * (0.7 + ((i * 37) % 10) / 20);
        return (
          <m.line
            key={i}
            x1={x}
            y1={y}
            x2={x + Math.cos(a) * 6}
            y2={y + Math.sin(a) * 6}
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0], x: [0, Math.cos(a) * l], y: [0, Math.sin(a) * l] }}
            transition={{ duration: 0.6, delay, ease: "easeOut" }}
          />
        );
      })}
    </>
  );
}

/** Взрыв: огненный шар, ударные волны, искры. */
function Boom({ x, y, size = 1, delay }: { x: number; y: number; size?: number; delay: number }) {
  return (
    <>
      <Flash x={x} y={y} r={34 * size} color={ORANGE} delay={delay} core="#fff6c8" />
      <Flash x={x + 14 * size} y={y - 10 * size} r={20 * size} color={GOLD} delay={delay + 0.08} />
      <Ring x={x} y={y} r={58 * size} color="#fff" delay={delay} width={5} />
      <Ring x={x} y={y} r={44 * size} color={ORANGE} delay={delay + 0.1} width={3} />
      <Sparks x={x} y={y} n={12} len={62 * size} color={GOLD} delay={delay} />
    </>
  );
}

/** Обломки корабля. */
const DEBRIS: [number, number, number, string][] = [
  [-62, -48, 220, "-6,-9 8,-4 3,8 -7,5"],
  [58, -54, -260, "-8,-4 7,-8 9,5 -3,8"],
  [-74, 10, 300, "-9,-3 5,-8 8,6 -4,7"],
  [76, 18, -200, "-7,-7 8,-2 4,8 -8,4"],
  [-34, 58, -330, "-5,-8 9,-1 2,8 -8,3"],
  [42, 60, 240, "-8,-5 6,-8 8,6 -5,6"],
  [4, -72, 180, "-4,-9 6,-3 4,8 -6,4"],
  [-14, 72, -150, "-7,-5 7,-4 6,7 -6,6"],
];

function Debris({ x, y, delay, colors }: { x: number; y: number; delay: number; colors: [string, string] }) {
  return (
    <>
      {DEBRIS.map(([dx, dy, rot, pts], i) => (
        <m.polygon
          key={i}
          points={pts}
          fill={colors[i % 2]}
          stroke="#0a1226"
          strokeWidth={2}
          strokeLinejoin="round"
          initial={{ opacity: 0, x, y, scale: 0.6 }}
          animate={{ opacity: [0, 1, 1, 0], x: [x, x + dx * 0.6, x + dx], y: [y, y + dy * 0.6, y + dy + 14], rotate: [0, rot], scale: [0.6, 1.5, 1.1] }}
          transition={{ duration: 1.3, delay: delay + (i % 3) * 0.03, ease: "easeOut", times: [0, 0.2, 1] }}
        />
      ))}
    </>
  );
}

/** Рябь щита на вашем корабле. */
function ShieldRipple({ delay }: { delay: number }) {
  return (
    <m.g initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.6, 0] }} transition={{ duration: 0.9, delay, times: [0, 0.15, 0.5, 1] }}>
      <defs>
        <radialGradient id="sp-shield" cx="50%" cy="25%" r="75%">
          <stop offset="0" stopColor="#bff4ff" stopOpacity="0.85" />
          <stop offset="0.6" stopColor="#4cc3ff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#4cc3ff" stopOpacity="0.1" />
        </radialGradient>
      </defs>
      <ellipse cx={CX} cy={YOU_Y - 4} rx={56} ry={62} fill="url(#sp-shield)" stroke={CYAN} strokeWidth={3} />
      {[0, 1, 2].map((i) => (
        <m.path
          key={i}
          d={`M${CX - 46} ${YOU_FRONT + 3} Q${CX} ${YOU_FRONT - 12} ${CX + 46} ${YOU_FRONT + 3}`}
          fill="none"
          stroke="#fff"
          strokeWidth={3 - i * 0.7}
          strokeLinecap="round"
          animate={{ y: [0, 14 + i * 12], opacity: [0.9, 0], scaleX: [0.6, 1.1] }}
          transition={{ duration: 0.7, delay: delay + i * 0.09, ease: "easeOut" }}
          style={{ originX: 0.5, originY: 0.5 }}
        />
      ))}
    </m.g>
  );
}

/** Электрические разряды вокруг оглушённого корабля. */
function Zaps() {
  const bolts = [
    "M150 250 l8 -10 l-4 -2 l10 -12",
    "M244 262 l-9 -9 l5 -3 l-11 -13",
    "M168 318 l9 8 l-5 3 l10 11",
    "M226 312 l-8 9 l5 2 l-9 12",
  ];
  return (
    <>
      {bolts.map((d, i) => (
        <m.path
          key={i}
          d={d}
          fill="none"
          stroke="#ffe36a"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ opacity: [0, 1, 0, 1, 0, 0.9, 0], scale: [0.9, 1.1, 1, 1.15, 0.95, 1.1, 1] }}
          transition={{ duration: 0.6, delay: i * 0.12, repeat: 2, repeatDelay: 0.1 }}
        />
      ))}
    </>
  );
}

export function Effects({ ev, oppSkinDebris, youSkinDebris }: { ev: BattleEvent; oppSkinDebris: [string, string]; youSkinDebris: [string, string] }) {
  const dmg = `−${ev.dmg}`;
  switch (ev.kind) {
    case "hit":
      return (
        <g>
          <Flash x={CX} y={YOU_NOSE - 4} r={13} color={CYAN} delay={0} />
          <Beam x={CX} y0={YOU_NOSE - 8} y1={OPP_FRONT} color={CYAN} />
          <Flash x={CX} y={OPP_FRONT} r={26} color="#c9f6ff" delay={0.16} />
          <Sparks x={CX} y={OPP_FRONT} n={8} len={34} color="#fff" delay={0.16} />
          <Pop x={CX + 60} y={OPP_NOSE - 4} text={dmg} fill="#ff5a64" size={28} delay={0.2} />
        </g>
      );
    case "crit":
      return (
        <g>
          <Flash x={CX - 22} y={YOU_NOSE - 4} r={12} color={ORANGE} delay={0} />
          <Flash x={CX + 22} y={YOU_NOSE - 4} r={12} color={ORANGE} delay={0.1} />
          <Beam x={CX - 22} y0={YOU_NOSE - 8} y1={OPP_FRONT + 6} color={ORANGE} />
          <Beam x={CX + 22} y0={YOU_NOSE - 8} y1={OPP_FRONT + 6} color={ORANGE} delay={0.1} />
          <Torpedo />
          <Boom x={CX} y={OPP_FRONT + 6} delay={0.42} size={1.1} />
          <Pop x={CX} y={206} text="КРИТ!" fill="#ff9a2e" size={46} delay={0.3} rise={22} />
          <Pop x={CX + 78} y={OPP_NOSE - 4} text={dmg} fill="#ff5a64" size={34} delay={0.45} />
        </g>
      );
    case "taken":
      return (
        <g>
          <Flash x={CX} y={OPP_NOSE + 6} r={13} color={RED} delay={0} />
          <Beam x={CX} y0={OPP_NOSE + 8} y1={YOU_FRONT} color={RED} />
          <ShieldRipple delay={0.17} />
          <Flash x={CX} y={YOU_FRONT} r={22} color="#ffb3b8" delay={0.17} />
          <Pop x={CX + 62} y={YOU_NOSE + 6} text={dmg} fill="#ff5a64" size={28} delay={0.2} />
        </g>
      );
    case "miss":
      return (
        <g>
          <g transform={`translate(0 ${YOU_Y - 281})`}><Zaps /></g>
          <m.g initial={{ opacity: 0, y: 8 }} animate={{ opacity: [0, 1, 1, 1, 0], y: [8, 0, 0, 0, -4] }} transition={{ duration: 1.5, times: [0, 0.1, 0.5, 0.88, 1] }}>
            <rect x={CX - 100} y={178} width={200} height={32} rx={16} fill="#2a1a05" stroke="#ffb42e" strokeWidth={2.4} />
            <text x={CX} y={199} textAnchor="middle" fontSize={15} fontWeight={800} fill="#ffcf5a">
              Системы перегружены
            </text>
          </m.g>
        </g>
      );
    case "ko":
      return (
        <g>
          <Flash x={CX} y={YOU_NOSE - 4} r={14} color={GOLD} delay={0} />
          <Beam x={CX} y0={YOU_NOSE - 8} y1={OPP_FRONT} color={GOLD} w={10} />
          <Boom x={CX} y={OPP_Y} delay={0.2} size={1.5} />
          <Debris x={CX} y={OPP_Y} delay={0.22} colors={oppSkinDebris} />
        </g>
      );
    case "lose":
      return (
        <g>
          <Flash x={CX} y={OPP_NOSE + 6} r={14} color={RED} delay={0} />
          <Beam x={CX} y0={OPP_NOSE + 8} y1={YOU_FRONT} color={RED} w={10} />
          <Boom x={CX} y={YOU_Y} delay={0.2} size={1.5} />
          <Debris x={CX} y={YOU_Y} delay={0.22} colors={youSkinDebris} />
        </g>
      );
  }
}

/** Торпеда: летит от вас к сопернику с огненным хвостом. */
function Torpedo() {
  return (
    <m.g initial={{ opacity: 0, y: 0 }} animate={{ opacity: [0, 1, 1, 0], y: [0, 0, -(YOU_NOSE - OPP_FRONT - 10), -(YOU_NOSE - OPP_FRONT - 4)] }} transition={{ duration: 0.45, delay: 0.1, times: [0, 0.05, 0.95, 1], ease: "easeIn" }}>
      <path d={`M${CX} ${YOU_NOSE - 6} q-7 18 0 34 q7 -16 0 -34 z`} fill={ORANGE} opacity="0.85" />
      <path d={`M${CX - 5} ${YOU_NOSE - 8} q5 -14 10 0 v10 h-10 z`} fill="#e9eef8" stroke="#0a1226" strokeWidth={2} strokeLinejoin="round" />
      <circle cx={CX} cy={YOU_NOSE - 6} r={2.4} fill={RED} />
    </m.g>
  );
}

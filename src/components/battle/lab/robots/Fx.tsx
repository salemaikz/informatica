"use client";

import { m } from "motion/react";
import { cn } from "@/lib/cn";

// Эффекты боя: искра попадания, короткое замыкание, числа урона, «КРИТ!», «K.O.», линии скорости.

const VB = "0 0 168 240";
const OUTLINE = { WebkitTextStroke: "7px #0b0f2a", paintOrder: "stroke fill", textShadow: "0 5px 0 rgba(0,0,0,0.4)" } as const;

function burst(r1: number, r2: number, n: number) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n;
    const r = i % 2 === 0 ? r1 : r2;
    pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
  }
  return pts.join(" ");
}
const STAR = burst(30, 12, 8);
const STAR_BIG = burst(44, 17, 10);
const STAR_IN = burst(17, 7, 8);

/** Искра попадания у лица пострадавшего (в системе координат робота, лицом вправо). */
export function ImpactFx({ crit, delay }: { crit: boolean; delay: number }) {
  const s = crit ? 1.45 : 1;
  return (
    <svg viewBox={VB} className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
      <g transform="translate(136 118)">
        <m.g
          initial={{ scale: 0, opacity: 0, rotate: -20 }}
          animate={{ scale: [0, 1.15 * s, 1.35 * s], opacity: [0, 1, 0], rotate: [-20, 0, 12] }}
          transition={{ duration: crit ? 0.5 : 0.36, delay, times: [0, 0.35, 1], ease: "easeOut" }}
        >
          <polygon points={crit ? STAR_BIG : STAR} fill={crit ? "#ff8a1f" : "#ffd23f"} stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
          <polygon points={STAR_IN} fill="#fff" />
        </m.g>
        {Array.from({ length: crit ? 10 : 6 }).map((_, i) => {
          const a = (i / (crit ? 10 : 6)) * Math.PI * 2 + 0.3;
          return (
            <m.line
              key={i}
              x1={Math.cos(a) * 20}
              y1={Math.sin(a) * 20}
              x2={Math.cos(a) * 20}
              y2={Math.sin(a) * 20}
              stroke={crit ? "#ffb347" : "#fff"}
              strokeWidth="3.4"
              strokeLinecap="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0], x2: Math.cos(a) * (crit ? 66 : 48), y2: Math.sin(a) * (crit ? 66 : 48), x1: Math.cos(a) * (crit ? 38 : 28), y1: Math.sin(a) * (crit ? 38 : 28) }}
              transition={{ duration: 0.4, delay, ease: "easeOut" }}
            />
          );
        })}
        {crit && (
          <m.circle
            r="10"
            fill="none"
            stroke="#fff"
            strokeWidth="4"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 0], scale: [0.4, 3.4] }}
            transition={{ duration: 0.5, delay, ease: "easeOut" }}
          />
        )}
      </g>
    </svg>
  );
}

const BOLT = ["M0 0 L6 -9 L2 -9 L9 -20", "M0 0 L-7 -8 L-3 -9 L-10 -19", "M0 0 L8 6 L3 6 L11 14"];

/** Короткое замыкание: искры вокруг головы, пока персонаж оглушён. */
export function ShortCircuit({ loop = true }: { loop?: boolean }) {
  const spots: [number, number, number, number][] = [
    [30, 36, 0, 0],
    [112, 30, 1, 0.18],
    [20, 74, 2, 0.34],
    [124, 70, 0, 0.5],
    [70, 18, 1, 0.1],
  ];
  return (
    <svg viewBox={VB} className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
      <g transform="translate(14 34)">
      {spots.map(([x, y, k, d], i) => (
        <m.g key={i} transform={`translate(${x} ${y})`} initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0, 1, 0] }} transition={{ duration: 0.7, delay: d, repeat: loop ? Infinity : 0, ease: "linear" }}>
          <path d={BOLT[k]} stroke="#7fe3ff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.5" />
          <path d={BOLT[k]} stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </m.g>
      ))}
      {[34, 70, 106].map((x, i) => (
        <m.circle
          key={x}
          cx={x}
          cy="14"
          r="6"
          fill="#9aa6b8"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.55, 0], y: [0, -22], scale: [0.6, 1.5] }}
          transition={{ duration: 1.2, delay: i * 0.35, repeat: loop ? Infinity : 0, ease: "easeOut" }}
        />
      ))}
      </g>
    </svg>
  );
}

/** Число урона над пострадавшим. */
export function DamageNumber({ dmg, crit, x, delay }: { dmg: number; crit: boolean; x: number; delay: number }) {
  return (
    <m.div
      className={cn(
        "pointer-events-none absolute top-[132px] z-40 -translate-x-1/2 font-black italic leading-none",
        crit ? "text-[46px] text-streak" : "text-[34px] text-danger",
      )}
      style={{ left: x, ...OUTLINE, WebkitTextStroke: crit ? "8px #0b0f2a" : "6px #0b0f2a" }}
      initial={{ opacity: 0, y: 14, scale: 0.5 }}
      animate={{ opacity: [0, 1, 1, 0], y: [14, -10, -34, -64], scale: crit ? [0.5, 1.4, 1.1, 1.1] : [0.5, 1.2, 1, 1] }}
      transition={{ duration: 1.05, delay, times: [0, 0.18, 0.7, 1], ease: "easeOut" }}
    >
      −{dmg}
    </m.div>
  );
}

export function CritBanner({ delay }: { delay: number }) {
  return (
    <>
      <svg viewBox="0 0 390 380" className="pointer-events-none absolute inset-0 z-30 size-full" aria-hidden>
        <m.g
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.9, 0] }}
          transition={{ duration: 0.5, delay, ease: "easeOut" }}
          stroke="#fff"
          strokeLinecap="round"
        >
          {Array.from({ length: 28 }).map((_, i) => {
            const a = (i / 28) * Math.PI * 2;
            const r1 = 90 + (i % 3) * 22;
            return <line key={i} x1={195 + Math.cos(a) * r1} y1={200 + Math.sin(a) * r1} x2={195 + Math.cos(a) * 330} y2={200 + Math.sin(a) * 330} strokeWidth={i % 2 ? 2 : 4} opacity={i % 2 ? 0.5 : 0.8} />;
          })}
        </m.g>
      </svg>
      <m.div
        className="pointer-events-none absolute left-1/2 top-[96px] z-40 -translate-x-1/2 whitespace-nowrap text-[54px] font-black italic leading-none tracking-tight text-streak"
        style={OUTLINE}
        initial={{ opacity: 0, scale: 1.9, rotate: -12 }}
        animate={{ opacity: [0, 1, 1, 1, 0], scale: [1.9, 1, 1.1, 1, 1], rotate: [-12, -6, -6, -6, -6] }}
        transition={{ duration: 1.2, delay, times: [0, 0.14, 0.3, 0.8, 1], ease: "easeOut" }}
      >
        КРИТ!
      </m.div>
    </>
  );
}

export function KoBanner({ win, delay }: { win: boolean; delay: number }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[84px] z-40 flex flex-col items-center">
      <m.div
        className="text-[84px] font-black italic leading-[0.9] tracking-tighter text-danger"
        style={{ ...OUTLINE, WebkitTextStroke: "10px #0b0f2a" }}
        initial={{ opacity: 0, scale: 2.2, rotate: -8 }}
        animate={{ opacity: [0, 1, 1], scale: [2.2, 0.92, 1], rotate: [-8, -5, -5] }}
        transition={{ duration: 0.5, delay, times: [0, 0.6, 1], ease: "easeOut" }}
      >
        K.O.
      </m.div>
      <m.div
        className={cn("-mt-0.5 text-[26px] font-black uppercase italic tracking-wide", win ? "text-gold" : "text-white")}
        style={{ ...OUTLINE, WebkitTextStroke: "6px #0b0f2a" }}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: delay + 0.45, ease: "easeOut" }}
      >
        {win ? "Победа!" : "Поражение"}
      </m.div>
    </div>
  );
}

export function GlitchTag({ x }: { x: number }) {
  return (
    <m.div
      className="pointer-events-none absolute top-[100px] z-40 -translate-x-1/2 -skew-x-[8deg] rounded-md border-2 border-white/85 bg-warning px-2.5 py-0.5 text-[15px] font-black uppercase tracking-wider text-black shadow-[0_3px_0_rgba(0,0,0,0.5)]"
      style={{ left: x }}
      initial={{ opacity: 0, y: 10, scale: 0.6 }}
      animate={{ opacity: [0, 1, 1, 1, 0], y: [10, 0, 0, 0, -4], scale: [0.6, 1.1, 1, 1, 1] }}
      transition={{ duration: 1.5, times: [0, 0.1, 0.2, 0.85, 1], ease: "easeOut" }}
    >
      Замыкание!
    </m.div>
  );
}

export function Flash({ delay, peak = 0.7 }: { delay: number; peak?: number }) {
  return (
    <m.div
      className="pointer-events-none absolute inset-0 z-30 bg-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, peak, 0] }}
      transition={{ duration: 0.38, delay, times: [0, 0.2, 1], ease: "easeOut" }}
    />
  );
}

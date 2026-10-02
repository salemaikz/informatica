"use client";

import { m } from "motion/react";
import type { ReactNode } from "react";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { monoFit } from "../logic";

// Общие детали иллюстраций «квест-комнаты». Плоская графика, холст 320×200, цвета — токены.

/** Ночное стекло окна: тёмно-синее в обеих темах. */
export const NIGHT = "color-mix(in srgb, var(--primary-strong) 22%, #070d1c)";

export function ArtSvg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 320 200" className="block h-auto w-full" aria-hidden focusable="false">
      {children}
    </svg>
  );
}

export function Wall({ height = 200 }: { height?: number }) {
  return <rect width="320" height={height} className="fill-primary-soft" />;
}

/** Пол: полоса, плинтус и пара досок. */
export function Floor({ y = 152 }: { y?: number }) {
  return (
    <g>
      <rect y={y} width="320" height={200 - y} className="fill-surface-2" />
      <rect y={y - 4} width="320" height="5" className="fill-border" />
      <path d={`M0 ${y + 20} H320 M0 ${y + 38} H320`} className="stroke-border" strokeWidth="1.5" opacity="0.7" />
      <path d={`M70 ${y + 20} V${y + 38} M230 ${y + 20} V${y + 38} M150 ${y} V${y + 20} M290 ${y} V${y + 20}`} className="stroke-border" strokeWidth="1.5" opacity="0.7" />
    </g>
  );
}

/** Табличка с кодом над дверью (моноширинный шрифт, кегль подбирается под длину). */
export function CodePlate({ code, x, y, w, h = 24, maxFont = 20 }: { code?: string; x: number; y: number; w: number; h?: number; maxFont?: number }) {
  if (!code) return null;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="8" className="fill-surface stroke-border" strokeWidth="2" />
      <circle cx={x + 7} cy={y + h / 2} r="1.8" className="fill-muted/60" />
      <circle cx={x + w - 7} cy={y + h / 2} r="1.8" className="fill-muted/60" />
      <text
        x={x + w / 2}
        y={y + h / 2 + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={monoFit(code.length, w - 26, maxFont)}
        fontWeight={800}
        className="fill-text font-mono"
        letterSpacing="1"
      >
        {code}
      </text>
    </g>
  );
}

/** Кодовая панель замка 34×54. Светодиод: красный мигает (закрыто) или зелёный (открыто). */
export function Keypad({ x, y, scale = 1, ok = false }: { x: number; y: number; scale?: number; ok?: boolean }) {
  const reduce = useReduceMotion();
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect width="34" height="54" rx="7" className="fill-text" />
      <rect x="2" y="2" width="30" height="50" rx="5.5" className="fill-surface/10" />
      {ok ? (
        <circle cx="17" cy="9" r="3.4" className="fill-success" />
      ) : (
        <m.circle
          cx="17"
          cy="9"
          r="3.4"
          className="fill-danger"
          animate={reduce ? undefined : { opacity: [1, 0.35, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {[0, 1, 2, 3].flatMap((r) =>
        [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={5.5 + c * 8.5} y={17 + r * 8.7} width="7" height="6.2" rx="1.6" className="fill-surface" opacity="0.9" />),
      )}
    </g>
  );
}

/** Четырёхконечная искорка. */
export function Sparkle({ x, y, s = 7, delay = 0 }: { x: number; y: number; s?: number; delay?: number }) {
  const reduce = useReduceMotion();
  const d = `M0 ${-s} Q0 0 ${s} 0 Q0 0 0 ${s} Q0 0 ${-s} 0 Q0 0 0 ${-s}Z`;
  return (
    <g transform={`translate(${x} ${y})`}>
      <m.path
        d={d}
        className="fill-gold"
        animate={reduce ? undefined : { opacity: [0.35, 1, 0.35] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay }}
      />
    </g>
  );
}

/** Зелёная отметка «получилось». */
export function SuccessBadge({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="15" className="fill-success" />
      <path d="M-7 0.5 L-2 5.5 L7.5 -5" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/** Ночное окно со звёздами: стекло и пара звёздочек, рамка — снаружи. */
export function Stars({ points }: { points: [number, number, number][] }) {
  return (
    <g>
      {points.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={0.55 + (i % 3) * 0.15} />
      ))}
    </g>
  );
}

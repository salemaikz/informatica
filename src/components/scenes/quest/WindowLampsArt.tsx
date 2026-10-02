"use client";

import { m } from "motion/react";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { LampGlyph } from "../primitives";
import { parseBits } from "../logic";
import { ArtSvg, NIGHT, Stars, Wall } from "./parts";

const DEFAULT_CODE = "1011";
const OFF_FILL = "color-mix(in srgb, var(--muted) 50%, #0a1020)";

/** Ночное окно с гирляндой из 4–6 ламп (до 8). Лампы горят по цифрам `code`; без кода — узор 1011. */
export function WindowLampsArt({ code }: { code?: string }) {
  const reduce = useReduceMotion();
  let bits = parseBits(code ?? "").slice(0, 8);
  if (bits.length === 0) bits = parseBits(DEFAULT_CODE);
  const n = bits.length;
  const s = n <= 6 ? 0.9 : 0.78;
  const left = 48;
  const width = 224;

  return (
    <ArtSvg>
      <Wall />
      {/* окно */}
      <rect x="36" y="16" width="248" height="148" rx="16" className="fill-surface stroke-border" strokeWidth="3" />
      <rect x="48" y="28" width="224" height="124" rx="9" style={{ fill: NIGHT }} />
      <Stars points={[[68, 40, 1.4], [112, 36, 1.2], [150, 40, 1.6], [198, 36, 1.2], [236, 42, 1.4], [258, 36, 1.1], [92, 48, 1]]} />
      <path d="M76 33 a8 8 0 1 0 6 12 a6.5 6.5 0 1 1 -6 -12z" className="fill-gold" />
      {/* провод гирлянды */}
      <path d="M48 58 Q160 78 272 58" fill="none" className="stroke-muted" strokeWidth="2.2" strokeLinecap="round" />
      {bits.map((b, i) => {
        const t = (i + 1) / (n + 1);
        const x = left + width * t;
        const y = 58 + 40 * t * (1 - t);
        const on = b === "1";
        return (
          <g key={i}>
            <path d={`M${x} ${y} V${y + 10}`} className="stroke-muted" strokeWidth="2" strokeLinecap="round" />
            {on && (
              <m.circle
                cx={x}
                cy={y + 10 + 30 * s}
                r={23 * s}
                className="fill-gold"
                animate={reduce ? { opacity: 0.2 } : { opacity: [0.12, 0.3, 0.12] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: (i % 3) * 0.4 }}
              />
            )}
            {/* лампа висит цоколем вверх: отражаем по вертикали */}
            <g transform={`translate(${x - 24 * s} ${y + 10 + 58 * s}) scale(${s} ${-s})`}>
              <LampGlyph on={on} offFill={OFF_FILL} />
            </g>
            <text x={x} y="143" textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight={800} className={on ? "fill-gold font-mono" : "fill-muted font-mono"}>
              {b}
            </text>
          </g>
        );
      })}
      {/* подоконник */}
      <rect x="26" y="162" width="268" height="12" rx="6" className="fill-border" />
    </ArtSvg>
  );
}

"use client";

import { m } from "motion/react";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { springSoft } from "@/components/motion/presets";
import { useT } from "@/i18n/useT";
import type { Scene } from "@/lib/types";
import { layoutNumberline, numberlineAria, toneColor, type NlDot, type NlInput } from "./numberline";

type NumberlineSceneData = Extract<Scene, { kind: "numberline" }>;

const DOT_R = 5.5;

/**
 * Числовая ось (SVG): 1–3 строки над общей шкалой. Промежуток — толстая линия, конец входит — закрашенный кружок,
 * не входит — выколотый; луч — со стрелкой; прыжки range — дуги над строкой. Раскладка — в numberline.ts.
 */
export function NumberlineScene({ scene }: { scene: NumberlineSceneData }) {
  const { t, l } = useT();
  const reduce = useReduceMotion();
  const input: NlInput = {
    min: scene.min,
    max: scene.max,
    ticks: scene.ticks,
    rows: scene.rows.map((r) => ({
      label: r.label !== undefined ? l(r.label) : undefined,
      tone: r.tone,
      ranges: r.ranges,
      points: r.points?.map((p) => ({ at: p.at, open: p.open, label: p.label !== undefined ? l(p.label) : undefined })),
      jumps: r.jumps,
    })),
  };
  const L = layoutNumberline(input);
  const aria = numberlineAria(input, t);
  const move = reduce ? { duration: 0 } : springSoft;

  const dot = (key: string, d: NlDot, y: number, color: string, r = DOT_R) => (
    <m.circle
      key={key}
      initial={false}
      animate={{ cx: d.x, cy: y, r }}
      transition={move}
      fill={d.open ? "var(--surface)" : color}
      stroke={color}
      strokeWidth={2.5}
    />
  );

  return (
    <div className="mx-auto w-full max-w-xl">
      <svg viewBox={`0 0 ${L.w} ${L.h}`} role="img" aria-label={aria} className="block h-auto w-full">
        <g aria-hidden="true" fontFamily="inherit">
          {/* пунктиры от концов промежутков к оси (под всем остальным) */}
          {L.rows.map((row, ri) =>
            row.ranges.flatMap((g, gi) =>
              g.drops.map((x, di) => (
                <m.line
                  key={`drop-${ri}-${gi}-${di}`}
                  initial={false}
                  animate={{ x1: x, x2: x, y1: row.y, y2: L.axisY }}
                  transition={move}
                  stroke={toneColor(row.tone)}
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  opacity={0.55}
                />
              )),
            ),
          )}

          {/* ось и деления */}
          <line x1={L.x0 - 12} x2={L.x1 + 12} y1={L.axisY} y2={L.axisY} stroke="var(--muted)" strokeWidth={2} strokeLinecap="round" />
          {L.ticks.map((tk) => (
            <g key={`tick-${tk.v}`}>
              <line x1={tk.x} x2={tk.x} y1={L.axisY - (tk.label ? 5 : 3)} y2={L.axisY + (tk.label ? 5 : 3)} stroke="var(--muted)" strokeWidth={tk.label ? 2 : 1.2} />
              {tk.label && (
                <text x={tk.x} y={L.axisY + 19} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--text)" className="tabular-nums">
                  {tk.label}
                </text>
              )}
            </g>
          ))}

          {L.rows.map((row, ri) => {
            const color = toneColor(row.tone);
            return (
              <g key={`row-${ri}`}>
                <line x1={row.base[0]} x2={row.base[1]} y1={row.y} y2={row.y} stroke="var(--border)" strokeWidth={2} strokeLinecap="round" />
                {row.label && (
                  <text x={row.label.x} y={row.label.y} textAnchor={row.label.anchor} fontSize={row.label.font} fontWeight={800} fill="var(--text)">
                    {row.label.text}
                  </text>
                )}

                {row.ranges.map((g, gi) => (
                  <g key={`range-${gi}`}>
                    <m.line
                      initial={false}
                      animate={{ x1: g.x1, x2: g.x2, y1: row.y, y2: row.y }}
                      transition={move}
                      stroke={color}
                      strokeWidth={5}
                    />
                    {g.heads.map((p, hi) => (
                      <polygon key={`head-${hi}`} points={p} fill={color} />
                    ))}
                    {g.dots.map((d, di) => dot(`rd-${di}`, d, row.y, color))}
                  </g>
                ))}

                {row.jumps && (
                  <g>
                    {row.jumps.arcs.map((a, ai) => (
                      <m.g key={`arc-${ai}`} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={move}>
                        <path d={a.d} fill="none" stroke={color} strokeWidth={2} strokeDasharray={a.dashed ? "3 3" : undefined} strokeLinecap="round" />
                        <polygon points={a.head} fill={color} />
                      </m.g>
                    ))}
                    {row.jumps.dots.map((d, di) => dot(`jd-${di}`, d, row.y, color, 5))}
                  </g>
                )}

                {row.points.map((p, pi) => (
                  <g key={`pt-${pi}`}>
                    {dot("dot", { x: p.x, open: p.open }, row.y, color, 6)}
                    {p.label && (
                      <text x={p.label.x} y={p.label.y} textAnchor={p.label.anchor} fontSize={p.label.font} fontWeight={800} fill="var(--text)">
                        {p.label.text}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

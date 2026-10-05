"use client";

import { m } from "motion/react";
import { useId } from "react";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { springSoft } from "@/components/motion/presets";
import { useT } from "@/i18n/useT";
import type { Scene } from "@/lib/types";
import { gridAria, gridLayout, pathArrow, toneVar } from "./grid";

type GridSceneData = Extract<Scene, { kind: "grid" }>;

/**
 * Сетка (SVG): квадратные клетки со значениями, оси с номерами, слои подсветки (клетки, строки, столбцы, области),
 * путь обхода со стрелкой, номера шагов, объединённые клетки и штриховка «съеденных» мест.
 */
export function GridScene({ scene }: { scene: GridSceneData }) {
  const { t } = useT();
  const reduce = useReduceMotion();
  const uid = `grid${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const L = gridLayout(scene);
  const arrow = pathArrow(L.path, L.cell);
  const pts = (p: { x: number; y: number }[]) => p.map((q) => `${q.x},${q.y}`).join(" ");
  const fade = (i: number) => (reduce ? { initial: false as const } : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { ...springSoft, delay: i * 0.02 } });

  return (
    <div className="mx-auto w-full" style={{ maxWidth: Math.round(L.w * 1.3) }}>
      <svg viewBox={`0 0 ${L.w} ${L.h}`} role="img" aria-label={gridAria(scene, t)} className="block h-auto w-full">
        <defs>
          <pattern id={`${uid}-hatch`} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={6} stroke="var(--muted)" strokeWidth={1.6} strokeOpacity={0.55} />
          </pattern>
        </defs>
        <g aria-hidden="true">
          {/* оси */}
          {L.colName && (
            <text x={L.colName.x} y={L.colName.y} textAnchor="middle" dy="0.35em" fontSize={13} fontWeight={800} fill="var(--muted)" className="font-mono">
              {L.colName.text}
            </text>
          )}
          {L.rowName && (
            <text x={L.rowName.x} y={L.rowName.y} textAnchor="middle" dy="0.35em" fontSize={13} fontWeight={800} fill="var(--muted)" className="font-mono">
              {L.rowName.text}
            </text>
          )}
          {L.colNums.map((q) => (
            <text key={`cn${q.n}`} x={q.x} y={q.y} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--muted)" className="tabular-nums">
              {q.n}
            </text>
          ))}
          {L.rowNums.map((q) => (
            <text key={`rn${q.n}`} x={q.x} y={q.y} textAnchor="end" dy="0.35em" fontSize={11} fontWeight={700} fill="var(--muted)" className="tabular-nums">
              {q.n}
            </text>
          ))}

          {/* клетки и объединения */}
          {L.blocks.map((b) => (
            <g key={b.key}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.merged ? 5 : 3} fill="var(--surface)" stroke={b.merged ? "var(--muted)" : "var(--border)"} strokeWidth={b.merged ? 1.6 : 1.2} />
              {b.eaten.map((e) => (
                <rect key={e.key} x={e.x + 1} y={e.y + 1} width={e.w - 2} height={e.h - 2} rx={2} fill={`url(#${uid}-hatch)`} stroke="var(--muted)" strokeOpacity={0.5} strokeDasharray="3 2" strokeWidth={1} />
              ))}
              {b.tones.map((tn, i) => (
                <m.rect
                  key={`${tn.layer}-${tn.tone}`}
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                  rx={b.merged ? 5 : 3}
                  fill={toneVar(tn.tone)}
                  fillOpacity={0.24}
                  stroke={toneVar(tn.tone)}
                  strokeOpacity={0.55}
                  strokeWidth={1.2}
                  {...fade(i)}
                />
              ))}
            </g>
          ))}

          {/* путь обхода */}
          {arrow && (
            <g stroke="var(--primary-strong)" strokeOpacity={0.85} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none">
              <polyline points={pts(arrow.line)} />
              {arrow.head.length === 3 && <polygon points={pts(arrow.head)} fill="var(--primary-strong)" fillOpacity={0.85} strokeWidth={1} />}
            </g>
          )}
          {L.path.length === 1 && <circle cx={L.path[0].x} cy={L.path[0].y} r={L.cell * 0.18} fill="var(--primary-strong)" fillOpacity={0.85} />}

          {/* значения */}
          {L.blocks.map(
            (b) =>
              b.value !== "" && (
                <text key={`v${b.key}`} x={b.textX} y={b.textY} textAnchor="middle" dy="0.35em" fontSize={b.fontSize} fontWeight={800} fill="var(--text)" className="tabular-nums">
                  {b.value}
                </text>
              ),
          )}

          {/* номера обхода — в левом верхнем углу клетки */}
          {[...L.numbers.entries()].map(([k, ns]) => {
            const [r, c] = k.split(":").map(Number);
            return (
              <text key={`n${k}`} x={L.ox + c * L.cell + 2.5} y={L.oy + r * L.cell + 2 + L.numFont * 0.85} fontSize={L.numFont} fontWeight={800} fill="var(--primary-strong)" className="tabular-nums">
                {ns.join(",")}
              </text>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import type { PcPart, Scene } from "@/lib/types";
import { CaseShell, PC_PART_ART, toneStyle } from "./pc-inside-art";
import { PC_GEO, PC_INSIDE_TEXT, PC_PARTS, layoutCallouts, pcInsideAria, pcPartName } from "./pc-inside";

/** Прозрачность приглушённых деталей и подписей, когда что-то подсвечено. */
const DIM = 0.28;
const DIM_LABEL = 0.5;

/**
 * Открытый системный блок сбоку: плата, процессор под кулером, ОЗУ, видеокарта, SSD и HDD, блок питания,
 * вентиляторы, порты. Выноски с подписями — в колонках слева и справа; highlight — детали в primary, остальное приглушено.
 */
export function PcInsideScene({ scene }: { scene: Extract<Scene, { kind: "pc-inside" }> }) {
  const { l } = useT();
  const reduce = useReduceMotion();
  const highlight = useMemo(() => scene.highlight ?? [], [scene.highlight]);
  const labels = scene.labels !== false;
  const lit = (p: PcPart) => highlight.includes(p);
  const dimmed = (p: PcPart) => highlight.length > 0 && !lit(p);

  const callouts = useMemo(() => {
    const names = Object.fromEntries(PC_PARTS.map((p) => [p, l(pcPartName(p))])) as Record<PcPart, string>;
    return layoutCallouts(names);
  }, [l]);

  const aria = pcInsideAria((p) => l(pcPartName(p)), l(PC_INSIDE_TEXT.title), l(PC_INSIDE_TEXT.highlighted), highlight);
  const g = PC_GEO;
  // Без подписей — только корпус, крупнее.
  const viewBox = labels ? `0 0 ${g.vw} ${g.vh}` : `${g.caseX - 4} 0 ${g.caseW * g.scale + 10} ${g.vh}`;
  const fade = reduce ? undefined : "opacity 300ms ease";

  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-label={aria}
      className={cn("mx-auto block h-auto w-full", labels ? "max-w-[460px]" : "max-h-[50vh] max-w-[220px]")}
    >
      <g transform={`translate(${g.caseX} ${g.caseY}) scale(${+g.scale.toFixed(4)})`}>
        <CaseShell />
        {PC_PARTS.map((p) => {
          const Art = PC_PART_ART[p];
          return (
            <g key={p} data-part={p} style={{ ...toneStyle(p, lit(p)), opacity: dimmed(p) ? DIM : 1, transition: fade }}>
              <Art />
            </g>
          );
        })}
      </g>
      {labels &&
        callouts.map((c) => {
          const on = lit(c.part);
          const color = on ? "var(--primary)" : "var(--muted)";
          const left = c.side === "left";
          const tx = left ? g.leftEdge : g.rightEdge;
          const mid = c.top + c.height / 2;
          const elbow = left ? tx + 4 : tx - 4;
          return (
            <g key={c.part} aria-hidden="true" style={{ opacity: dimmed(c.part) ? DIM_LABEL : 1, transition: fade }}>
              <polyline
                points={`${c.anchor.x},${c.anchor.y} ${elbow},${mid} ${tx + (left ? 2 : -2)},${mid}`}
                fill="none"
                stroke={color}
                strokeWidth={on ? 1.4 : 1}
                strokeLinejoin="round"
              />
              <circle cx={c.anchor.x} cy={c.anchor.y} r={on ? 3 : 2.4} fill={color} stroke="var(--surface)" strokeWidth={1.2} />
              <text
                x={tx}
                textAnchor={left ? "end" : "start"}
                fontSize={g.fontSize}
                fontWeight={on ? 800 : 700}
                fill={on ? "var(--ink-primary)" : "var(--text)"}
                dominantBaseline="central"
              >
                {c.lines.map((line, i) => (
                  <tspan key={i} x={tx} y={c.top + g.lineH * (i + 0.5)}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
    </svg>
  );
}

"use client";

import { m } from "motion/react";
import { useMemo } from "react";
import { springSoft } from "@/components/motion/presets";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import type { Scene } from "@/lib/types";
import { EDGE_FILL, EDGE_STROKE, NODE_TEXT, NODE_TONE, PILL_TEXT, graphAria, layoutGraph, type GraphInput } from "./graph";

type GraphSceneData = Extract<Scene, { kind: "graph" }>;

/**
 * Граф и дерево (SVG). Раскладка и подрезка рёбер считаются в graph.ts; здесь только рисование.
 * Слои: рёбра, стрелки, подписи весов, вершины, значки степеней. Смена параметров между шагами — пружина (позиции),
 * плавная перекраска (цвета); «Меньше анимаций» — без движения.
 */
export function GraphScene({ scene }: { scene: GraphSceneData }) {
  const { t, l } = useT();
  const reduce = useReduceMotion();
  const spring = reduce ? { duration: 0 } : springSoft;

  const input = useMemo<GraphInput>(
    () => ({
      nodes: scene.nodes.map((v) => ({ id: v.id, label: v.label !== undefined ? l(v.label) : v.id, x: v.x, y: v.y, tone: v.tone })),
      edges: scene.edges.map((e) => ({ from: e.from, to: e.to, weight: e.weight, tone: e.tone })),
      layout: scene.layout ?? "free",
      root: scene.root,
      directed: !!scene.directed,
      path: scene.path ?? [],
      highlight: scene.highlight ?? [],
      degrees: !!scene.degrees,
    }),
    [scene, l],
  );
  const lay = useMemo(() => layoutGraph(input), [input]);
  const aria = graphAria(input, t);
  const fade = reduce ? { duration: 0 } : { duration: 0.25 };

  return (
    <div className="mx-auto w-full max-w-[440px]">
      <svg viewBox={`0 0 ${lay.width} ${lay.height}`} role="img" aria-label={aria} className="block h-auto w-full">
        <g aria-hidden="true">
          {lay.edges.map((e) => {
            const key = e.tone ?? "none";
            return (
              <g key={`e:${e.key}`}>
                <m.path
                  initial={{ opacity: 0, d: e.d }}
                  animate={{ opacity: 1, d: e.d }}
                  transition={{ d: spring, opacity: fade }}
                  fill="none"
                  strokeWidth={e.onPath ? 4 : 2}
                  strokeLinecap="butt"
                  strokeLinejoin="round"
                  className={cn("transition-[stroke,stroke-width] duration-300", EDGE_STROKE[key])}
                />
                {e.arrow && (
                  <m.path
                    initial={{ opacity: 0, d: e.arrow }}
                    animate={{ opacity: 1, d: e.arrow }}
                    transition={{ d: spring, opacity: fade }}
                    strokeWidth={1}
                    strokeLinejoin="round"
                    className={cn("transition-[fill,stroke] duration-300", EDGE_FILL[key], EDGE_STROKE[key])}
                  />
                )}
              </g>
            );
          })}

          {lay.edges.map((e) =>
            e.pill?.anchor ? (
              <m.line
                key={`l:${e.key}`}
                initial={{ opacity: 0, x1: e.pill.anchor[0], y1: e.pill.anchor[1], x2: e.pill.x, y2: e.pill.y }}
                animate={{ opacity: 1, x1: e.pill.anchor[0], y1: e.pill.anchor[1], x2: e.pill.x, y2: e.pill.y }}
                transition={{ x1: spring, y1: spring, x2: spring, y2: spring, opacity: fade }}
                strokeWidth={1.5}
                className={cn("transition-[stroke] duration-300", EDGE_STROKE[e.tone ?? "none"])}
              />
            ) : null,
          )}

          {lay.edges.map((e) =>
            e.pill ? (
              <m.g
                key={`p:${e.key}`}
                initial={{ opacity: 0, x: e.pill.x, y: e.pill.y }}
                animate={{ opacity: 1, x: e.pill.x, y: e.pill.y }}
                transition={{ x: spring, y: spring, opacity: fade }}
              >
                <rect
                  x={-e.pill.w / 2}
                  y={-e.pill.h / 2}
                  width={e.pill.w}
                  height={e.pill.h}
                  rx={e.pill.h / 2}
                  strokeWidth={e.onPath ? 2 : 1.5}
                  className={cn("fill-surface transition-[stroke] duration-300", EDGE_STROKE[e.tone ?? "none"])}
                />
                <text textAnchor="middle" dy="0.35em" fontSize={e.pill.fontPx} fontWeight={700} className={cn("tabular-nums", PILL_TEXT[e.tone ?? "none"])}>
                  {e.pill.text}
                </text>
              </m.g>
            ) : null,
          )}

          {lay.nodes.map((v) => {
            const key = v.tone ?? "none";
            const sw = v.onPath ? 3.5 : 2;
            return (
              <m.g key={`n:${v.id}`} initial={{ opacity: 0, x: v.cx, y: v.cy }} animate={{ opacity: 1, x: v.cx, y: v.cy }} transition={{ x: spring, y: spring, opacity: fade }}>
                {v.shape === "circle" ? (
                  <circle r={v.r} strokeWidth={sw} className={cn("transition-[fill,stroke] duration-300", NODE_TONE[key])} />
                ) : (
                  <rect x={-v.w / 2} y={-v.h / 2} width={v.w} height={v.h} rx={v.r} strokeWidth={sw} className={cn("transition-[fill,stroke] duration-300", NODE_TONE[key])} />
                )}
                {v.lines.map((line, i) => (
                  <text
                    key={i}
                    y={(i - (v.lines.length - 1) / 2) * v.lineH}
                    dy="0.35em"
                    textAnchor="middle"
                    fontSize={v.fontPx}
                    fontWeight={700}
                    className={cn("transition-[fill] duration-300", NODE_TEXT[key])}
                  >
                    {line}
                  </text>
                ))}
              </m.g>
            );
          })}

          {lay.badges.map((b) => (
            <m.g key={`b:${b.id}`} initial={{ opacity: 0, x: b.x, y: b.y }} animate={{ opacity: 1, x: b.x, y: b.y }} transition={{ x: spring, y: spring, opacity: fade }}>
              <circle r={b.r} strokeWidth={1.5} className="fill-surface-2 stroke-border" />
              <text textAnchor="middle" dy="0.35em" fontSize={b.fontPx} fontWeight={800} className="fill-text tabular-nums">
                {b.text}
              </text>
            </m.g>
          ))}
        </g>
      </svg>
      {/* значки степени без пояснения непонятны: подпись под рисунком */}
      {lay.badges.length > 0 && <p className="mt-1 text-center text-xs font-bold text-muted">{t("scene.graph.degreesNote")}</p>}
    </div>
  );
}

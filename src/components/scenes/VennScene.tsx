"use client";

import { Fragment, useId } from "react";
import type { ReactNode } from "react";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { useT } from "@/i18n/useT";
import type { Scene, VennRegion } from "@/lib/types";
import {
  VENN_SET_COLORS,
  isVennRegion,
  labelFontSize,
  outsideClipPath,
  regionColor,
  regionMembership,
  regionOpacity,
  valueFontSize,
  vennAria,
  vennCount,
  vennLayout,
  vennRegions,
} from "./venn";

type VennData = Extract<Scene, { kind: "venn" }>;

/**
 * Круги Эйлера на 2–3 множества (SVG). Каждая область заливается отдельно (clipPath по кругам), поэтому
 * выделение закрашивает ровно свою область. Числа — по центру областей, названия множеств — у кругов,
 * рамка универсума рисуется, если нужна область «вне кругов».
 */
export function VennScene({ scene }: { scene: VennData }) {
  const { t, l } = useT();
  const reduce = useReduceMotion();
  // id для clipPath: у каждой сцены на странице свои (useId даёт двоеточия/скобки — убираем).
  const uid = `venn${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const n = vennCount(scene.sets.length);
  const names = scene.sets.slice(0, n).map((s) => l(s));
  const universe = scene.universe !== undefined ? l(scene.universe) : undefined;
  const values = scene.values ?? {};
  const highlight = (scene.highlight ?? []).filter((r) => isVennRegion(r, n));
  const hl = new Set<VennRegion>(highlight);
  const framed = universe !== undefined || (values.out ?? "") !== "" || hl.has("out");
  const L = vennLayout(n, framed);
  const fade = reduce ? undefined : "fill-opacity 250ms ease";
  const aria = vennAria({ names, values, highlight, universe }, t);

  /** Заливка области: прямоугольник, обрезанный по кругам (внутри — круг, снаружи — «всё, кроме круга»). */
  const region = (r: VennRegion): ReactNode => {
    const { inside, outside } = regionMembership(r, n);
    const opacity = regionOpacity(r, hl.has(r), hl.size > 0);
    const fill = { fill: regionColor(r), fillOpacity: opacity, transition: fade };
    let node: ReactNode =
      r === "out" && L.frame ? (
        <rect x={L.frame.x} y={L.frame.y} width={L.frame.w} height={L.frame.h} rx={14} style={fill} />
      ) : (
        <rect x={0} y={0} width={L.w} height={L.h} style={fill} />
      );
    const clips = [...inside.map((i) => `${uid}-in-${i}`), ...outside.map((i) => `${uid}-out-${i}`)];
    for (const id of clips.reverse()) node = <g clipPath={`url(#${id})`}>{node}</g>;
    return <Fragment key={r}>{node}</Fragment>;
  };

  return (
    <div className="mx-auto w-full max-w-[420px]">
      <svg viewBox={`0 0 ${L.w} ${L.h}`} role="img" aria-label={aria} className="block h-auto w-full">
        <defs>
          {L.circles.map((c, i) => (
            <Fragment key={i}>
              <clipPath id={`${uid}-in-${i}`}>
                <circle cx={c.cx} cy={c.cy} r={c.r} />
              </clipPath>
              <clipPath id={`${uid}-out-${i}`}>
                <path clipRule="evenodd" d={outsideClipPath(c, L.w, L.h)} />
              </clipPath>
            </Fragment>
          ))}
        </defs>

        <g aria-hidden="true">
          {/* универсум: рамка и подпись */}
          {L.frame && (
            <>
              <rect x={L.frame.x} y={L.frame.y} width={L.frame.w} height={L.frame.h} rx={14} fill="var(--surface)" stroke="var(--muted)" strokeWidth={1.5} />
              {universe && (
                <text x={L.universe.x} y={L.universe.y} fontSize={14} fontWeight={700} fill="var(--muted)">
                  {universe}
                </text>
              )}
            </>
          )}

          {/* заливки областей */}
          {vennRegions(n).filter((r) => r !== "out" || L.frame).map(region)}

          {/* контуры кругов */}
          {L.circles.map((c, i) => (
            <circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill="none" stroke={VENN_SET_COLORS[i]} strokeWidth={2.4} />
          ))}

          {/* числа в областях */}
          {vennRegions(n).map((r) => {
            const v = values[r];
            if (v === undefined || v === "" || (r === "out" && !L.frame)) return null;
            const a = L.anchors[r];
            return (
              <text
                key={r}
                x={a.x}
                y={a.y}
                dy="0.35em"
                textAnchor="middle"
                fontSize={valueFontSize(v.length, a.room)}
                fontWeight={800}
                fill="var(--text)"
                className="tabular-nums"
              >
                {v}
              </text>
            );
          })}

          {/* названия множеств: цветная точка у внешнего края круга */}
          {names.map((name, i) => {
            const lb = L.labels[i];
            const dot = (
              <tspan fill={VENN_SET_COLORS[i]} fontSize={13}>
                ●
              </tspan>
            );
            return (
              <text key={i} x={lb.x} y={lb.y} textAnchor={lb.anchor} fontSize={labelFontSize(name.length)} fontWeight={700} fill="var(--text)">
                {lb.anchor === "end" ? (
                  <>
                    {name} {dot}
                  </>
                ) : (
                  <>
                    {dot} {name}
                  </>
                )}
              </text>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

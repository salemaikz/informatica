"use client";

import { m } from "motion/react";
import type { ReactNode } from "react";
import { springSoft } from "@/components/motion/presets";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { useT } from "@/i18n/useT";
import type { Scene } from "@/lib/types";
import {
  DEFAULT_TONES,
  chartAria,
  chartLayout,
  toneVar,
  type BarChartLayout,
  type ChartInput,
  type Legend,
  type LineChartLayout,
  type PieChartLayout,
} from "./chart";

type ChartData = Extract<Scene, { kind: "chart" }>;

const HALO = { paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 3, strokeLinejoin: "round" } as const;

/**
 * Диаграммы (SVG): столбчатая (с группами, порогом, воронкой), линейная и круговая.
 * Раскладка — в chart.ts; здесь только рисуем. Смена значений между шагами — пружина, при «Меньше анимаций» — сразу.
 */
export function ChartScene({ scene }: { scene: ChartData }) {
  const { t, l } = useT();
  const reduce = useReduceMotion();

  const input: ChartInput = {
    type: scene.type,
    labels: scene.labels.map((x) => l(x)),
    series: scene.series.map((s, i) => ({
      name: s.name !== undefined ? l(s.name) : undefined,
      values: s.values,
      tone: s.tone ?? DEFAULT_TONES[i % DEFAULT_TONES.length],
    })),
    values: !!scene.values,
    unit: scene.unit,
    threshold: scene.threshold ? { value: scene.threshold.value, label: scene.threshold.label !== undefined ? l(scene.threshold.label) : undefined } : undefined,
    highlight: scene.highlight ?? [],
    funnel: !!scene.funnel,
    axes: scene.axes ? { x: scene.axes.x !== undefined ? l(scene.axes.x) : undefined, y: scene.axes.y !== undefined ? l(scene.axes.y) : undefined } : undefined,
    funnelFrom: t("scene.chart.funnelFrom"),
    funnelNote: t("scene.chart.funnelNote"),
  };
  const lay = chartLayout(input);
  const tr = reduce ? { duration: 0 } : springSoft;

  return (
    <div className="mx-auto w-full max-w-[480px]">
      <svg viewBox={`0 0 ${lay.w} ${lay.h}`} role="img" aria-label={chartAria(input, t)} className="block h-auto w-full">
        <g aria-hidden="true">
          {lay.type === "pie" ? <Pie lay={lay} /> : <Cartesian lay={lay} tr={tr} />}
          {"legend" in lay && lay.legend && <LegendView legend={lay.legend} />}
        </g>
      </svg>
    </div>
  );
}

function LegendView({ legend }: { legend: Legend }) {
  return (
    <>
      {legend.items.map((it, i) => (
        <g key={i}>
          <rect x={it.x} y={it.y + 1} width={10} height={10} rx={3} fill={it.swatch} />
          <text x={it.x + 15} y={it.y + 10} fontSize={it.text.font} fontWeight={700} fill="var(--text)">
            {it.text.lines.map((ln, k) => (
              <tspan key={k} x={it.x + 15} dy={k === 0 ? 0 : it.text.font + 3}>
                {ln}
              </tspan>
            ))}
          </text>
        </g>
      ))}
    </>
  );
}

type Tr = { duration: number } | typeof springSoft;

function Cartesian({ lay, tr }: { lay: BarChartLayout | LineChartLayout; tr: Tr }) {
  const right = lay.padL + lay.plotW;
  const baseY = lay.plotTop + lay.plotH;
  const rot = lay.cats.rotate;
  return (
    <>
      {/* подсветка категорий у линии: бледная полоса на всю высоту */}
      {lay.type === "line" &&
        lay.band.map((b, i) =>
          lay.highlight.has(i) ? <rect key={i} x={b.x} y={lay.plotTop} width={b.w} height={lay.plotH} rx={6} fill="var(--primary)" fillOpacity={0.12} /> : null,
        )}

      {/* сетка и метки оси Y */}
      {lay.ticks.map((tk, i) => (
        <g key={i}>
          <line x1={lay.padL} x2={right} y1={tk.y} y2={tk.y} stroke="var(--border)" strokeWidth={i === 0 ? 1.5 : 1} />
          <text x={lay.padL - 6} y={tk.y} dy="0.35em" textAnchor="end" fontSize={11} fontWeight={700} fill="var(--muted)" className="tabular-nums">
            {tk.text}
          </text>
        </g>
      ))}
      {lay.yTitle && (
        <text x={4} y={11} textAnchor="start" fontSize={11} fontWeight={700} fill="var(--muted)">
          {lay.yTitle}
        </text>
      )}

      {lay.type === "bar" && <Bars lay={lay} tr={tr} />}
      {lay.type === "line" && <Lines lay={lay} tr={tr} />}

      {/* порог: линия — под подписями значений (они с обводкой цвета фона и «разрывают» линию), подпись порога — поверх всего */}
      {lay.threshold && (
        <m.line
          initial={false}
          animate={{ y1: lay.threshold.y, y2: lay.threshold.y }}
          transition={tr}
          x1={lay.padL}
          x2={right}
          stroke="var(--text)"
          strokeWidth={1.8}
          strokeDasharray="6 4"
        />
      )}
      {lay.type === "bar" && <BarTexts lay={lay} tr={tr} />}
      {lay.type === "line" && <LineTexts lay={lay} tr={tr} />}
      {lay.threshold && (
        <m.text
          initial={false}
          animate={{ x: lay.threshold.x, y: lay.threshold.ty }}
          transition={tr}
          textAnchor={lay.threshold.anchor}
          fontSize={lay.threshold.font}
          fontWeight={800}
          fill="var(--text)"
          {...HALO}
        >
          {lay.threshold.text}
        </m.text>
      )}

      {/* подписи категорий */}
      {lay.cats.labels.map((c, i) => {
        const y0 = baseY + lay.cats.font + 5;
        const dim = lay.highlight.size > 0 && !lay.highlight.has(i);
        const common = { fontSize: lay.cats.font, fontWeight: lay.highlight.has(i) ? 800 : 700, fill: dim ? "var(--muted)" : "var(--text)" };
        return rot ? (
          <text key={i} x={c.x + 3} y={baseY + 8} textAnchor="end" transform={`rotate(-45 ${c.x + 3} ${baseY + 8})`} {...common}>
            {c.lines[0]}
          </text>
        ) : (
          <text key={i} x={c.x} y={y0} textAnchor="middle" {...common}>
            {c.lines.map((ln, k) => (
              <tspan key={k} x={c.x} dy={k === 0 ? 0 : lay.cats.font + 3}>
                {ln}
              </tspan>
            ))}
          </text>
        );
      })}
      {lay.xTitle && (
        <text x={lay.padL + lay.plotW / 2} y={lay.xTitle.y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--muted)">
          {lay.xTitle.text}
        </text>
      )}
      {lay.type === "bar" && lay.funnelNote && (
        <text x={lay.w / 2} y={lay.funnelNote.y} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--muted)">
          {lay.funnelNote.text}
        </text>
      )}
    </>
  );
}

function Bars({ lay, tr }: { lay: BarChartLayout; tr: Tr }) {
  return (
    <>
      {lay.bars.map((b) => (
        <m.rect
          key={b.key}
          initial={false}
          animate={{ x: b.x, y: b.y, width: b.w, height: b.h, opacity: b.dim ? 0.35 : 1 }}
          transition={tr}
          rx={Math.min(4, b.w / 2)}
          fill={toneVar(b.tone)}
        />
      ))}
    </>
  );
}

/** Подписи столбцов: значения и проценты воронки (поверх линии порога). */
function BarTexts({ lay, tr }: { lay: BarChartLayout; tr: Tr }) {
  return (
    <>
      {lay.valueLabels.map((v) => (
        <m.text key={v.key} initial={false} animate={{ x: v.x, y: v.y, opacity: v.dim ? 0.5 : 1 }} transition={tr} textAnchor="middle" fontSize={v.font} fontWeight={800} fill="var(--text)" className="tabular-nums" {...HALO}>
          {v.text}
        </m.text>
      ))}
      {lay.funnelChips.map((c) => (
        // x и y у m.text — это сдвиг (transform), поэтому строки (tspan) стоят от нуля: свой x у них дал бы двойное смещение
        <m.text key={c.i} initial={false} animate={{ x: c.x, y: c.y }} transition={tr} textAnchor="middle" fontSize={c.font} fontWeight={800} fill="var(--text)">
          {c.lines.map((ln, k) => (
            <tspan key={k} x={0} dy={k === 0 ? 0 : c.font + 2} fontWeight={k === 0 ? 800 : 700} fill={k === 0 ? "var(--primary-strong)" : "var(--muted)"}>
              {ln}
            </tspan>
          ))}
        </m.text>
      ))}
    </>
  );
}

function Lines({ lay, tr }: { lay: LineChartLayout; tr: Tr }) {
  return (
    <>
      {lay.lines.map((ln) => (
        <m.path key={ln.s} initial={false} animate={{ d: ln.d }} transition={tr} fill="none" stroke={toneVar(ln.tone)} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {lay.points.map((p) => (
        <m.circle key={p.key} initial={false} animate={{ cx: p.x, cy: p.y, r: p.r }} transition={tr} fill={toneVar(p.tone)} stroke="var(--surface)" strokeWidth={1.5} />
      ))}
    </>
  );
}

/** Подписи точек линий (поверх линии порога). */
function LineTexts({ lay, tr }: { lay: LineChartLayout; tr: Tr }) {
  return (
    <>
      {lay.valueLabels.map((v) => (
        <m.text key={v.key} initial={false} animate={{ x: v.x, y: v.y }} transition={tr} textAnchor="middle" fontSize={v.font} fontWeight={800} fill="var(--text)" className="tabular-nums" {...HALO}>
          {v.text}
        </m.text>
      ))}
    </>
  );
}

function Pie({ lay }: { lay: PieChartLayout }): ReactNode {
  return (
    <>
      {lay.sectors.map((s) => {
        const style = { transform: `translate(${s.dx}px, ${s.dy}px)`, opacity: s.dim ? 0.4 : 1, transition: "transform 250ms ease, opacity 250ms ease" };
        if (!s.path && !(lay.full && s.label)) return null;
        return lay.full ? (
          <circle key={s.i} cx={lay.cx} cy={lay.cy} r={lay.r} fill={s.color} stroke="var(--surface)" strokeWidth={2} style={style} />
        ) : (
          <path key={s.i} d={s.path} fill={s.color} stroke="var(--surface)" strokeWidth={2} strokeLinejoin="round" style={style} />
        );
      })}
      {lay.sectors.map((s) =>
        s.label && s.leader ? (
          <g key={s.i}>
            <polyline points={s.leader.pts.map((q) => `${Math.round(q[0] * 10) / 10},${Math.round(q[1] * 10) / 10}`).join(" ")} fill="none" stroke="var(--muted)" strokeWidth={1} />
            <text x={s.label.x} y={s.label.y} dy="0.35em" textAnchor={s.label.anchor} fontSize={lay.labelFont} fontWeight={800} fill="var(--text)" className="tabular-nums">
              {s.label.text}
            </text>
          </g>
        ) : null,
      )}
    </>
  );
}

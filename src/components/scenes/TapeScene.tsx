"use client";

import { m } from "motion/react";
import { springSoft } from "@/components/motion/presets";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { useT } from "@/i18n/useT";
import type { Scene, SceneTone } from "@/lib/types";
import { tapeAria, tapeLayout, type TapeArc, type TapeCell } from "./tape";

type TapeSceneData = Extract<Scene, { kind: "tape" }>;

const TONE_VAR: Record<SceneTone, string> = {
  primary: "var(--primary)",
  success: "var(--success)",
  danger: "var(--danger)",
  warning: "var(--warning)",
  ai: "var(--ai)",
  gold: "var(--gold)",
  muted: "var(--muted)",
};

/** Путь дуги над лентой: от (xa, y) до (xb, y), вершина на высоте height. */
function arcPath(a: TapeArc): string {
  const k = a.height / 0.75;
  return `M ${a.xa} ${a.y} C ${a.xa} ${a.y - k}, ${a.xb} ${a.y - k}, ${a.xb} ${a.y}`;
}

/** Наконечник стрелки, направленной вниз, в точке (x, y). */
const head = (x: number, y: number) => `M ${x - 3.5} ${y - 5} L ${x} ${y} L ${x + 3.5} ${y - 5}`;

/**
 * Лента ячеек (SVG): строка/список Python, диапазон Excel, байты символа. Срезы, указатели, обмены, группы, кадр «после».
 * Раскладка — в tape.ts; если содержимое шире 360 px, рисунок целиком уменьшается (viewBox растёт), ничего не обрезается.
 */
export function TapeScene({ scene }: { scene: TapeSceneData }) {
  const { t, l } = useT();
  const reduce = useReduceMotion();
  const L = tapeLayout(scene, l, t);
  const aria = tapeAria(scene, l, t);
  const fade = reduce ? undefined : "fill 250ms ease, stroke 250ms ease, opacity 250ms ease";
  const appear = reduce ? { initial: false as const } : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: springSoft };
  const monoCls = L.mono ? "font-mono" : undefined;

  const cell = (c: TapeCell, prefix: string) => {
    const fill =
      c.state === "slice" || c.state === "sliceHl" ? "var(--primary-soft)" : c.state === "highlight" ? "var(--warning-soft)" : "var(--surface)";
    const stroke =
      c.state === "slice" ? "var(--primary)" : c.state === "highlight" || c.state === "sliceHl" ? "var(--warning)" : "var(--border)";
    const dimmed = c.state === "dim";
    return (
      <g key={`${prefix}${c.i}`} style={{ transition: fade }} opacity={dimmed ? 0.4 : 1}>
        <rect
          x={c.x + 0.75}
          y={c.y + 0.75}
          width={L.cellW - 1.5}
          height={L.cellH - 1.5}
          rx={Math.min(6, L.cellW / 4)}
          fill={fill}
          stroke={stroke}
          strokeWidth={c.state === "slice" || c.state === "highlight" || c.state === "sliceHl" ? 2 : 1.5}
          style={{ transition: fade }}
        />
        <text
          x={c.x + L.cellW / 2}
          y={c.y + L.cellH / 2}
          dy="0.35em"
          textAnchor="middle"
          fontSize={L.cellFs}
          fontWeight={L.mono ? 700 : 800}
          fill={c.state === "slice" || c.state === "sliceHl" ? "var(--primary-strong)" : c.state === "highlight" ? "var(--warning-strong)" : "var(--text)"}
          className={monoCls}
        >
          {c.text}
        </text>
      </g>
    );
  };

  return (
    <div className="mx-auto w-full max-w-xl">
      <svg viewBox={`0 0 ${L.vbW} ${L.vbH}`} role="img" aria-label={aria} className="block h-auto w-full">
        <g aria-hidden="true">
          {/* имена слева */}
          {L.names.map((n, i) => (
            <text key={`n${i}`} x={n.x} y={n.y} dy="0.35em" textAnchor="end" fontSize={13} fontWeight={700} fill="var(--muted)" className="font-mono">
              {n.text}
            </text>
          ))}
          {L.nameArrows.map((a, i) => (
            <g key={`na${i}`} stroke="var(--muted)" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d={`M ${a.x1} ${a.y} L ${a.x2} ${a.y}`} />
              <path d={`M ${a.x2 - 4} ${a.y - 3.5} L ${a.x2} ${a.y} L ${a.x2 - 4} ${a.y + 3.5}`} />
            </g>
          ))}

          {/* индексы */}
          {L.indexTop.map((x, i) => (
            <text key={`it${i}`} x={x.x} y={x.y} dy="0.35em" textAnchor="middle" fontSize={L.indexFs} fontWeight={700} fill="var(--muted)" className="tabular-nums">
              {x.text}
            </text>
          ))}
          {L.indexBottom.map((x, i) => (
            <text key={`ib${i}`} x={x.x} y={x.y} dy="0.35em" textAnchor="middle" fontSize={L.indexFs} fontWeight={700} fill="var(--muted)" className="tabular-nums">
              {x.text}
            </text>
          ))}

          {/* ячейки */}
          {L.cells.map((c) => cell(c, "c"))}

          {/* граница «не включая» */}
          {L.stop && (
            <m.g {...appear}>
              <line x1={L.stop.x} x2={L.stop.x} y1={L.stop.y1} y2={L.stop.y2} stroke="var(--muted)" strokeWidth={2} strokeDasharray="4 3" strokeLinecap="round" />
              <text x={L.stop.label.cx} y={L.stop.label.y} dy="0.35em" textAnchor="middle" fontSize={11} fontWeight={800} fill="var(--muted)">
                {L.stop.label.text}
              </text>
            </m.g>
          )}

          {/* дуги: прыжки среза и обмены */}
          {L.arcs.map((a) => {
            const color = a.kind === "jump" ? "var(--primary)" : "var(--warning-strong)";
            return (
              <m.g key={a.key} {...appear} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d={arcPath(a)} />
                <path d={head(a.xb, a.y)} />
                {a.kind === "swap" && <path d={head(a.xa, a.y)} />}
              </m.g>
            );
          })}

          {/* группы: скобки с подписью */}
          {L.groups.map((g) => (
            <m.g key={g.key} {...appear}>
              <path d={`M ${g.x1} ${g.y + 5} V ${g.y} H ${g.x2} V ${g.y + 5}`} fill="none" stroke="var(--muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <text x={g.label.cx} y={g.label.y} dy="0.35em" textAnchor="middle" fontSize={11} fontWeight={800} fill="var(--text)">
                {g.label.text}
              </text>
            </m.g>
          ))}

          {/* указатели под лентой */}
          {L.pointers.map((p) => (
            // группа переезжает (transform) между шагами разбора: ключ — подпись указателя, а не порядковый номер
            <m.g
              key={p.key}
              initial={reduce ? false : { opacity: 0, x: p.x, y: p.yTop }}
              animate={{ opacity: 1, x: p.x, y: p.yTop }}
              transition={reduce ? { duration: 0 } : springSoft}
            >
              {p.line && <line x1={0} x2={0} y1={6} y2={p.yEnd - p.yTop} stroke={TONE_VAR[p.tone]} strokeWidth={1.25} opacity={0.6} />}
              {p.triangle && <path d="M -4.5 6 L 0 0 L 4.5 6 Z" fill={TONE_VAR[p.tone]} />}
              <text x={p.label.cx - p.x} y={p.label.y - p.yTop} dy="0.35em" textAnchor="middle" fontSize={12} fontWeight={800} fill={TONE_VAR[p.tone]} className="font-mono">
                {p.label.text}
              </text>
            </m.g>
          ))}

          {/* пустой срез */}
          {L.empty && (
            <text x={L.empty.x} y={L.empty.y} dy="0.35em" textAnchor="middle" fontSize={13} fontWeight={800} fill="var(--muted)" fontStyle="italic">
              {L.empty.text}
            </text>
          )}

          {/* кадр «после» */}
          {L.after && (
            <m.g {...appear}>
              <g stroke="var(--muted)" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d={`M ${L.after.arrow.x} ${L.after.arrow.y1} V ${L.after.arrow.y2}`} />
                <path d={`M ${L.after.arrow.x - 5} ${L.after.arrow.y2 - 6} L ${L.after.arrow.x} ${L.after.arrow.y2} L ${L.after.arrow.x + 5} ${L.after.arrow.y2 - 6}`} />
              </g>
              {L.after.cells.map((c) => cell(c, "a"))}
              {L.after.empty && (
                <text x={L.after.empty.x} y={L.after.empty.y} dy="0.35em" textAnchor="middle" fontSize={13} fontWeight={800} fill="var(--muted)" fontStyle="italic">
                  {L.after.empty.text}
                </text>
              )}
            </m.g>
          )}
        </g>
      </svg>
    </div>
  );
}

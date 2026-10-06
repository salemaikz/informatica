"use client";

import { m } from "motion/react";
import { springSoft } from "@/components/motion/presets";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { useT } from "@/i18n/useT";
import type { Scene, SceneTone } from "@/lib/types";
import { TAPE_CELL_GAP, TAPE_LABEL_FS, arcSegments, tapeAria, tapeLayout, type TapeCell } from "./tape";

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

/**
 * Цвет текста подписи указателя на карточке (не на -soft-заливке): в светлой теме темнее базового, в тёмной — базовый (токены ink-*).
 * Золото своего ink-токена не имеет — для текста смешиваем его с цветом текста, иначе жёлтые буквы на светлой карточке не читаются.
 */
const TONE_INK: Record<SceneTone, string> = {
  primary: "var(--ink-primary)",
  success: "var(--ink-success)",
  danger: "var(--ink-danger)",
  warning: "var(--ink-warning)",
  ai: "var(--ink-ai)",
  gold: "color-mix(in srgb, var(--gold) 55%, var(--text))",
  muted: "var(--muted)",
};

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
          x={c.x + TAPE_CELL_GAP / 2}
          y={c.y + TAPE_CELL_GAP / 2}
          width={L.cellW - TAPE_CELL_GAP}
          height={L.cellH - TAPE_CELL_GAP}
          rx={Math.min(6, L.cellW / 4)}
          fill={fill}
          stroke={stroke}
          strokeWidth={c.state === "slice" || c.state === "highlight" || c.state === "sliceHl" ? 2 : 1.5}
          style={{ transition: fade }}
        />
        {/* текст на -soft-заливке — «чернила» ink-* (в тёмной теме -strong на -soft нечитаем) */}
        {c.lines.map((line, k) => (
          <text
            key={k}
            x={c.x + L.cellW / 2}
            y={c.y + L.cellH / 2 + (k - (c.lines.length - 1) / 2) * L.lineH}
            dy="0.35em"
            textAnchor="middle"
            fontSize={L.cellFs}
            fontWeight={L.mono ? 700 : 800}
            fill={c.state === "slice" || c.state === "sliceHl" ? "var(--ink-primary)" : c.state === "highlight" ? "var(--ink-warning)" : "var(--text)"}
            className={monoCls}
          >
            {line}
          </text>
        ))}
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
              <text x={L.stop.label.cx} y={L.stop.label.y} dy="0.35em" textAnchor="middle" fontSize={TAPE_LABEL_FS} fontWeight={800} fill="var(--muted)">
                {L.stop.label.text}
              </text>
            </m.g>
          )}

          {/* дуги: прыжки среза и обмены; там, где поверх проходит дуга выше, — разрыв (мост), а не сплетение */}
          {L.arcs.map((a) => {
            const color = a.kind === "jump" ? "var(--primary)" : "var(--ink-warning)";
            return (
              <m.g key={a.key} {...appear} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round">
                {arcSegments(a).map((d, i) => (
                  <path key={i} d={d} />
                ))}
                <path d={head(a.xb, a.y)} strokeLinecap="round" />
                {a.kind === "swap" && <path d={head(a.xa, a.y)} strokeLinecap="round" />}
              </m.g>
            );
          })}

          {/* группы: скобки с подписью */}
          {L.groups.map((g) => (
            <m.g key={g.key} {...appear}>
              <path d={`M ${g.x1} ${g.y + 5} V ${g.y} H ${g.x2} V ${g.y + 5}`} fill="none" stroke="var(--muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <text x={g.label.cx} y={g.label.y} dy="0.35em" textAnchor="middle" fontSize={TAPE_LABEL_FS} fontWeight={800} fill="var(--text)">
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
              {/* стрелка у всех одна: остриё у ячейки и стебель до подписи (выше нулевого уровня — длиннее) */}
              {p.arrow && (
                <>
                  <line x1={0} x2={0} y1={4} y2={p.yEnd - p.yTop} stroke={TONE_VAR[p.tone]} strokeWidth={1.5} strokeLinecap="round" />
                  <path d="M -4.5 6 L 0 0 L 4.5 6 Z" fill={TONE_VAR[p.tone]} />
                </>
              )}
              <text x={p.label.cx - p.x} y={p.label.y - p.yTop} dy="0.35em" textAnchor="middle" fontSize={12} fontWeight={800} fill={TONE_INK[p.tone]} className="font-mono">
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

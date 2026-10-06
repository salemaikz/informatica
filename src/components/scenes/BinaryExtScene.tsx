"use client";

import { Fragment } from "react";
import { m } from "motion/react";
import { springSoft } from "@/components/motion/presets";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import type { Scene } from "@/lib/types";
import { subscript } from "@/lib/calc";
import { SumLine } from "./primitives";
import { sumTerms } from "./logic";
import {
  NUM_W,
  andLines,
  binaryUnits,
  expFont,
  layoutRows,
  shiftBits,
  shiftResultChunks,
  weightLabel,
  weightMode,
  type PlacedCell,
  type RowsLayout,
} from "./numbers";

type BinaryData = Extract<Scene, { kind: "binary" }>;

type Tone = "default" | "one" | "zero" | "highlight" | "dropped" | "added";

const RECT: Record<Tone, string> = {
  default: "fill-surface stroke-border",
  one: "fill-gold-soft stroke-gold",
  zero: "fill-surface stroke-border",
  highlight: "fill-primary-soft stroke-primary",
  dropped: "fill-danger-soft stroke-danger",
  added: "fill-success-soft stroke-success",
};
const TEXT: Record<Tone, string> = {
  default: "fill-text",
  one: "fill-ink-warning",
  zero: "fill-muted",
  highlight: "fill-ink-primary",
  dropped: "fill-ink-danger",
  added: "fill-ink-success",
};

interface LineProps {
  lay: RowsLayout;
  tone: (c: PlacedCell) => Tone;
  /** Смещение блока по вертикали. */
  dy?: number;
  weights?: { cross: boolean; mode: "value" | "pow"; font: number; digits: (c: PlacedCell) => boolean };
  brackets?: boolean;
  /** Цифра плитки (режим and: геометрия общая, цифры у каждой строки свои). */
  chars?: (c: PlacedCell) => string;
  reduce: boolean;
  /** Префикс ключей: строки режима and различаются. */
  id: string;
}

/** Один блок рядов: плитки, веса и скобки. Плитки с одинаковым ключом между шагами остаются на месте и плавно переезжают. */
function Rows({ lay, tone, dy = 0, weights, brackets, chars, reduce, id }: LineProps) {
  const { t } = useT();
  const sp = reduce ? { duration: 0 } : springSoft;
  return (
    <g>
      {lay.rows.map((row, r) => (
        <g key={`${id}r${r}`}>
          {row.cells.map((c, i) => {
            const tn = tone(c);
            const y = row.top + dy;
            return (
              <m.g
                key={`${id}${c.key}`}
                initial={reduce ? false : { opacity: 0, x: c.x, y }}
                animate={{ opacity: c.pad ? 0.4 : 1, x: c.x, y }}
                transition={{ ...sp, delay: reduce ? 0 : Math.min(i * 0.02, 0.3) }}
              >
                {c.kind === "gap" ? (
                  <text x={lay.tileW / 2} y={lay.tileH / 2} textAnchor="middle" dominantBaseline="central" fontSize={lay.font} fontWeight={800} className="fill-muted font-mono">
                    …
                  </text>
                ) : (
                  <>
                    <rect
                      width={lay.tileW}
                      height={lay.tileH}
                      rx={Math.min(8, lay.tileW / 3)}
                      strokeWidth={2}
                      strokeDasharray={c.pad || c.kind === "extra" ? "3 2" : undefined}
                      className={RECT[tn]}
                    />
                    <text x={lay.tileW / 2} y={lay.tileH / 2 + 1} textAnchor="middle" dominantBaseline="central" fontSize={lay.font} fontWeight={800} className={`font-mono ${TEXT[tn]}`}>
                      {chars ? chars(c) : c.ch}
                    </text>
                    {c.mark === "dropped" && <line x1={2} y1={lay.tileH - 2} x2={lay.tileW - 2} y2={2} strokeWidth={2.5} strokeLinecap="round" className="stroke-danger" />}
                  </>
                )}
                {weights && c.exp !== undefined && !c.pad && c.kind === "digit" && (
                  <WeightText lay={lay} exp={c.exp} cfg={weights} crossed={weights.cross && !weights.digits(c)} />
                )}
              </m.g>
            );
          })}
          {brackets &&
            row.units.map((u) =>
              u.bracket ? (
                <g key={`${id}${u.key}`} transform={`translate(0 ${row.top + dy + lay.bracketDy})`}>
                  <path d={`M${u.x1 + 1} 0 V5 H${u.x2 - 1} V0`} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="stroke-primary" />
                  {u.bracket.byte !== undefined ? (
                    <>
                      <text x={(u.x1 + u.x2) / 2} y={20} textAnchor="middle" fontSize={12} fontWeight={800} className="fill-ink-primary">
                        {t("scene.binary.byte", { n: u.bracket.byte })}
                      </text>
                      <text x={(u.x1 + u.x2) / 2} y={36} textAnchor="middle" fontSize={14} fontWeight={800} className="fill-muted font-mono">
                        {u.bracket.text}
                      </text>
                    </>
                  ) : (
                    <text x={(u.x1 + u.x2) / 2} y={21} textAnchor="middle" fontSize={16} fontWeight={800} className="fill-ink-primary font-mono">
                      {u.bracket.text}
                    </text>
                  )}
                </g>
              ) : null,
            )}
        </g>
      ))}
    </g>
  );
}

function WeightText({ lay, exp, cfg, crossed }: { lay: RowsLayout; exp: number; cfg: NonNullable<LineProps["weights"]>; crossed: boolean }) {
  const y = lay.weightsDy + 8;
  return (
    <g>
      <text x={lay.tileW / 2} y={y} textAnchor="middle" dominantBaseline="central" fontSize={cfg.font} fontWeight={700} className={crossed ? "fill-muted font-mono" : "fill-ink-primary font-mono"} opacity={crossed ? 0.7 : 1}>
        {cfg.mode === "pow" ? (
          <>
            2
            {/* показатель — настоящий верхний индекс (tspan): юникод-надстрочные цифры на телефоне мельче 6 px */}
            <tspan fontSize={expFont(cfg.font)} dy={-Math.round(cfg.font * 0.35)}>
              {exp}
            </tspan>
          </>
        ) : (
          weightLabel(exp, cfg.mode)
        )}
      </text>
      {crossed && <line x1={1} x2={lay.tileW - 1} y1={y} y2={y} strokeWidth={2} strokeLinecap="round" className="stroke-muted" />}
    </g>
  );
}

/**
 * Результат сдвига: «получится:» и число. Длинное число не рвётся посреди записи — делится на группы (как плитки, по 8 разрядов),
 * строки переносятся по границам групп и выравниваются по центру (text-balance), подпись стоит над числом по центру.
 */
function ShiftResult({ bits, dir, groups }: { bits: string; dir: "left" | "right"; groups?: 3 | 4 | 8 }) {
  const { t } = useT();
  const chunks = shiftResultChunks(bits, dir, groups);
  const last = chunks.length - 1;
  return (
    <div className={cn("flex items-baseline justify-center gap-x-2 gap-y-0.5 text-sm font-extrabold text-muted", last > 0 ? "flex-col items-center" : "flex-wrap")}>
      <span>{t("scene.binary.shiftResult")}</span>
      <span className="max-w-full text-balance text-center font-mono text-lg leading-snug text-ink-success" data-shift-result="">
        {chunks.map((c, i) => (
          <Fragment key={i}>
            {i > 0 && " "}
            <span className="whitespace-nowrap">
              {c}
              {i === last && subscript(2)}
            </span>
          </Fragment>
        ))}
      </span>
    </div>
  );
}

/**
 * Расширенная двоичная запись (группы, сдвиг, пропуск середины, режим «адрес / маска / И»).
 * Рисуется одним SVG шириной 328 (масштабируется по ширине экрана); числа и скобки считает код.
 */
export function BinaryExtScene({ scene }: { scene: BinaryData }) {
  const { t, l } = useT();
  const reduce = useReduceMotion();
  const bits = scene.bits;
  const isAnd = scene.and !== undefined;
  const showWeights = !isAnd && (!!scene.weights || !!scene.gap);
  const cross = !!scene.cross;
  const hi = new Set(scene.highlight ?? []);
  const units = binaryUnits(bits, { groups: scene.groups, gap: scene.gap, shift: scene.shift });
  const lay = layoutRows(units, {
    weights: showWeights,
    brackets: !!scene.groups && !isAnd,
    maxTiles: scene.shift && !scene.groups ? 17 : undefined,
  });
  const exps = units.flatMap((u) => u.cells.flatMap((c) => (c.kind === "digit" && !c.pad && c.exp !== undefined ? [c.exp] : [])));
  const wm = weightMode(exps, lay.tileW);

  const tone = (c: PlacedCell): Tone => {
    if (c.mark === "dropped") return "dropped";
    if (c.mark === "added") return "added";
    if (c.index >= 0 && hi.has(c.index)) return "highlight";
    if (cross && c.kind === "digit") return c.ch === "1" ? "one" : "zero";
    return "default";
  };

  // ---- режим and ----
  if (isAnd) {
    const lines = andLines(bits, scene.and as string);
    const labels = scene.andLabels ? scene.andLabels.map((x) => l(x)) : [t("scene.binary.andIp"), t("scene.binary.andMask"), t("scene.binary.andNet")];
    const LABEL_H = 18;
    const block = LABEL_H + lay.height;
    const total = 3 * block + 2 * 12;
    const x0 = lay.rows[0]?.cells[0]?.x ?? 0;
    const aria = `${labels[0]} ${bits}, ${labels[1]} ${scene.and}, ${labels[2]} ${lines[2].bits}`;
    return (
      <div className="mx-auto w-full max-w-xl">
        <svg viewBox={`0 0 ${NUM_W} ${total}`} role="img" aria-label={aria} className="block h-auto w-full">
          {lines.map((ln, li) => {
            const dy = li * (block + 12) + LABEL_H;
            // Подсветка — разряды под единицами маски (сетевая часть).
            const chOf = (c: PlacedCell) => (c.index >= 0 ? ln.bits[c.index] : "0");
            const lt = (c: PlacedCell): Tone => (c.index >= 0 && ln.mask[c.index] ? "highlight" : chOf(c) === "0" ? "zero" : "default");
            return (
              <g key={ln.key}>
                <text x={x0} y={dy - 6} fontSize={13} fontWeight={800} className="fill-muted">
                  {labels[li]}
                </text>
                <Rows lay={lay} tone={lt} chars={chOf} dy={dy} reduce={reduce} id={`and${li}`} />
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  // ---- shift: стрелка и результат ----
  const shiftH = scene.shift ? 22 : 0;
  const total = lay.height + shiftH;
  const left = Math.min(...lay.rows.flatMap((r) => r.cells.map((c) => c.x)));
  const right = Math.max(...lay.rows.flatMap((r) => r.cells.map((c) => c.x + lay.tileW)));
  const aria = [
    `${bits}${subscript(2)}`,
    scene.groups ? t("scene.binary.ariaGroups", { g: scene.groups }) : "",
    scene.gap ? t("scene.binary.ariaGap") : "",
    scene.shift ? `${t(scene.shift === "left" ? "scene.binary.shiftLeft" : "scene.binary.shiftRight")}: ${shiftBits(bits, scene.shift)}${subscript(2)}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const ay = lay.height + 12;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-2">
      <svg viewBox={`0 0 ${NUM_W} ${total}`} role="img" aria-label={aria} className="block h-auto w-full">
        <Rows
          lay={lay}
          tone={tone}
          reduce={reduce}
          id="b"
          brackets={!!scene.groups}
          weights={showWeights ? { cross, mode: wm.mode, font: wm.font, digits: (c) => c.ch === "1" } : undefined}
        />
        {scene.shift && (
          <g>
            <line x1={left + 6} x2={right - 6} y1={ay} y2={ay} strokeWidth={3} strokeLinecap="round" className="stroke-primary" />
            <path
              d={scene.shift === "left" ? `M${left + 14} ${ay - 7} L${left + 5} ${ay} L${left + 14} ${ay + 7}` : `M${right - 14} ${ay - 7} L${right - 5} ${ay} L${right - 14} ${ay + 7}`}
              fill="none"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-primary"
            />
          </g>
        )}
      </svg>
      {/* подпись — обычным текстом, а не в SVG: длинная фраза (особенно на kk) переносится, а не вылезает за рамку */}
      {scene.shift && <p className="text-balance text-center text-sm font-extrabold text-muted">{t(scene.shift === "left" ? "scene.binary.shiftLeft" : "scene.binary.shiftRight")}</p>}
      {scene.shift && <ShiftResult bits={bits} dir={scene.shift} groups={scene.groups} />}
      {scene.sum && !scene.shift && (
        <SumLine
          terms={sumTerms(bits).map((w) => ({ id: String(w), value: w }))}
          total={sumTerms(bits).reduce((a, b) => a + b, 0)}
          delay={0.1}
        />
      )}
    </div>
  );
}

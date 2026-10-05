"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { X } from "lucide-react";
import { m } from "motion/react";
import { springSoft } from "@/components/motion/presets";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import type { Scene, SceneTone, Text } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import {
  JOIN_WIDE_FROM,
  TONE_BG,
  TONE_FILL,
  TONE_STROKE,
  arrowGeometry,
  binaryColumns,
  cellKey,
  changeMap,
  colLetter,
  joinLinkPath,
  joinTones,
  needsOverlay,
  rangeRect,
  rowStateMap,
  sheetRowNumber,
  tableData,
  toneMap,
  type Rect,
  type RowState,
} from "./table";

type TableScene = Extract<Scene, { kind: "table" }>;

// ---------- Измерение: прямоугольники ячеек (для рамки, стрелок и линий JOIN) ----------

interface Geo {
  rects: Map<string, Rect>;
  w: number;
  h: number;
}

const sameGeo = (a: Geo, b: Geo) =>
  a.w === b.w &&
  a.h === b.h &&
  a.rects.size === b.rects.size &&
  [...b.rects].every(([k, r]) => {
    const p = a.rects.get(k);
    return !!p && p.x === r.x && p.y === r.y && p.w === r.w && p.h === r.h;
  });

/**
 * Измеряет элементы с атрибутом `attr` внутри корня (координаты — от левого верхнего угла корня). Пересчёт — на любое изменение
 * размера корня или самих ячеек (ResizeObserver), поэтому слой не отстаёт от таблицы при смене шага и поворота экрана.
 */
function useMeasured(active: boolean, attr: string, dep: unknown): [RefObject<HTMLDivElement | null>, Geo | null] {
  const ref = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    const measure = () => {
      const rb = root.getBoundingClientRect();
      const rects = new Map<string, Rect>();
      root.querySelectorAll<HTMLElement>(`[${attr}]`).forEach((el) => {
        const b = el.getBoundingClientRect();
        rects.set(el.getAttribute(attr)!, { x: b.left - rb.left, y: b.top - rb.top, w: b.width, h: b.height });
      });
      const next: Geo = { rects, w: Math.max(rb.width, root.scrollWidth), h: Math.max(rb.height, root.scrollHeight) };
      setGeo((prev) => (prev && sameGeo(prev, next) ? prev : next));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    root.querySelectorAll(`[${attr}]`).forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [active, attr, dep]);
  return [ref, geo];
}

// ---------- Одна таблица ----------

interface GridSpec {
  head: Text[] | null;
  rows: Text[][];
  sheet: boolean;
  mono: boolean;
  hiRows: Set<number>;
  hiCols: Set<number>;
  hiCells: Set<string>;
  states: Map<number, RowState>;
  changes: Map<string, Text>;
  tones: Map<string, SceneTone>;
  /** Тон всей строки (JOIN: совпавшие строки двух таблиц). */
  rowTones: Map<number, SceneTone>;
  rowNumber: (r: number) => number;
  /** Подписать ячейки атрибутом для измерения (рамка, стрелки). */
  measureCells: boolean;
  /** Подписать строки атрибутом для измерения (линии JOIN): «L» или «R». */
  joinSide?: "L" | "R";
}

const STATE_KEY: Record<RowState, DictKey> = {
  struck: "scene.table.struck",
  dim: "scene.table.dim",
  rejected: "scene.table.rejected",
  new: "scene.table.new",
};

/** Красная рамка отклонённой строки: сверху и снизу у каждой ячейки, слева — у первой, справа — у последней (класс — целиком, для Tailwind). */
const REJECT_MID = "shadow-[inset_0_2px_0_0_var(--danger),inset_0_-2px_0_0_var(--danger)]";
const REJECT_FIRST = "shadow-[inset_0_2px_0_0_var(--danger),inset_0_-2px_0_0_var(--danger),inset_2px_0_0_0_var(--danger)]";
const REJECT_LAST = "shadow-[inset_0_2px_0_0_var(--danger),inset_0_-2px_0_0_var(--danger),inset_-2px_0_0_0_var(--danger)]";
const REJECT_ONLY = "shadow-[inset_0_2px_0_0_var(--danger),inset_0_-2px_0_0_var(--danger),inset_2px_0_0_0_var(--danger),inset_-2px_0_0_0_var(--danger)]";

/** Дополнительные классы ячейки от расширений (пусто — разметка как раньше). */
function extraClass(state: RowState | undefined, tone: SceneTone | undefined, c: number, width: number): string | undefined {
  const parts: string[] = [];
  if (state === "struck") parts.push("bg-danger-soft text-danger-strong line-through decoration-2");
  else if (state === "dim") parts.push("text-muted opacity-50");
  else if (state === "new") parts.push("bg-success-soft");
  else if (state === "rejected") {
    parts.push("bg-danger-soft/40", width === 1 ? REJECT_ONLY : c === 0 ? REJECT_FIRST : c === width - 1 ? REJECT_LAST : REJECT_MID);
  }
  if (tone) parts.push(TONE_BG[tone]);
  return parts.length ? parts.join(" ") : undefined;
}

function TableGrid({ spec, wrapRef, overlay }: { spec: GridSpec; wrapRef?: RefObject<HTMLDivElement | null>; overlay?: ReactNode }) {
  const { t, l } = useT();
  const { head, rows, sheet, mono } = spec;
  const grid = rows.map((r) => r.map((c) => l(c)));
  const width = rows[0]?.length ?? 0;
  const bin = mono ? binaryColumns(grid) : [];
  const { hiRows, hiCols, hiCells } = spec;
  const hiCell = (r: number, c: number) => hiCells.has(cellKey(r, c));
  const hiBg = (r: number, c: number) => hiRows.has(r) || hiCols.has(c) || hiCell(r, c);
  const anyRejected = [...spec.states.values()].includes("rejected");

  const cell = "px-3 py-2 text-sm leading-snug transition-colors duration-200";
  // Линии сетки: сверху — если над строкой есть шапка; слева — если слева есть столбец (в sheet — номера строк).
  const hasTop = (r: number) => r > 0 || !!head || sheet;
  const hasLeft = (c: number) => c > 0 || sheet;

  const table = (
    <table className={cn("w-full border-separate border-spacing-0", mono && "font-mono")}>
      {head && (
        <thead>
          <tr>
            {head.map((h, c) => (
              <th
                key={c}
                scope="col"
                className={cn(
                  cell,
                  "bg-surface-2 font-extrabold",
                  c > 0 && "border-l border-border",
                  mono ? "text-center" : "text-left",
                  hiCols.has(c) && "bg-primary-soft text-primary-strong",
                )}
              >
                {l(h)}
              </th>
            ))}
          </tr>
        </thead>
      )}
      {sheet && (
        <thead>
          <tr>
            <th aria-hidden className="sticky left-0 z-20 w-10 min-w-10 bg-surface-2" />
            {Array.from({ length: width }, (_, c) => (
              <th
                key={c}
                scope="col"
                className={cn(
                  "border-l border-border bg-surface-2 px-3 py-1 text-center font-sans text-[13px] font-semibold text-muted transition-colors duration-200",
                  hiCols.has(c) && "bg-primary-soft text-primary-strong",
                )}
              >
                {colLetter(c)}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {grid.map((row, r) => {
          const state = spec.states.get(r);
          const rowTone = spec.rowTones.get(r);
          return (
            <tr key={r} {...(spec.joinSide ? { "data-join-row": `${spec.joinSide}:${r}` } : {})}>
              {sheet && (
                <th
                  scope="row"
                  className={cn(
                    "sticky left-0 z-20 border-t border-border bg-surface-2 px-2 py-1 text-center font-sans text-[13px] font-semibold text-muted transition-colors duration-200",
                    hiRows.has(r) && "bg-primary-soft text-primary-strong",
                  )}
                >
                  {spec.rowNumber(r)}
                </th>
              )}
              {row.map((value, c) => {
                const was = spec.changes.get(cellKey(r, c));
                const tone = spec.tones.get(cellKey(r, c)) ?? rowTone;
                const last = c === width - 1;
                return (
                  <td
                    key={c}
                    {...(spec.measureCells ? { "data-cell": cellKey(r, c) } : {})}
                    className={cn(
                      cell,
                      hasLeft(c) && "border-l border-border",
                      hasTop(r) && "border-t border-border",
                      mono && !sheet ? "text-center" : "text-left",
                      hiBg(r, c) && "bg-primary-soft",
                      hiCell(r, c) && "relative z-10 ring-2 ring-inset ring-primary",
                      bin[c] && (value === "1" ? "font-bold text-success" : "text-muted"),
                      extraClass(state, tone, c, width),
                      anyRejected && last && "relative pr-9",
                    )}
                  >
                    {state && c === 0 && <span className="sr-only">{t(STATE_KEY[state])}: </span>}
                    {was !== undefined ? (
                      <>
                        <span className="font-extrabold">{value}</span>
                        <span className="ml-1.5 text-xs font-semibold text-muted line-through">
                          <span className="sr-only">{t("scene.table.was")} </span>
                          {l(was)}
                        </span>
                      </>
                    ) : (
                      value
                    )}
                    {state === "rejected" && last && <X aria-hidden size={16} strokeWidth={3.2} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-danger" />}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className="mx-auto w-full max-w-xl overflow-x-auto rounded-2xl border border-border bg-surface">
      {wrapRef ? (
        <div ref={wrapRef} className="relative">
          {table}
          {overlay}
        </div>
      ) : (
        table
      )}
    </div>
  );
}

/** Слой поверх таблицы: рамка диапазона и стрелки между ячейками (по измеренным прямоугольникам). */
function Overlay({ scene, geo, reduce }: { scene: TableScene; geo: Geo | null; reduce: boolean }) {
  if (!geo) return null;
  const frame = scene.range ? rangeRect(geo.rects, scene.range) : null;
  const spring = reduce ? { duration: 0 } : springSoft;
  return (
    <svg width={geo.w} height={geo.h} className="pointer-events-none absolute left-0 top-0 z-30 overflow-visible" aria-hidden="true">
      {frame && (
        <m.rect
          rx={4}
          fill="none"
          strokeWidth={2.5}
          className="fill-primary/10 stroke-primary"
          initial={false}
          animate={{ x: frame.x + 1, y: frame.y + 1, width: Math.max(0, frame.w - 2), height: Math.max(0, frame.h - 2) }}
          transition={spring}
        />
      )}
      {(scene.arrows ?? []).map((a, i) => {
        const from = geo.rects.get(cellKey(a.from[0], a.from[1]));
        const to = geo.rects.get(cellKey(a.to[0], a.to[1]));
        const g = from && to ? arrowGeometry(from, to, { w: geo.w, h: geo.h }) : null;
        if (!g) return null;
        const tone = a.tone ?? "primary";
        return (
          <m.g key={`${i}|${g.d}`} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduce ? 0 : 0.25, delay: reduce ? 0 : 0.1 }}>
            <path d={g.d} fill="none" strokeWidth={2.2} strokeLinecap="round" className={TONE_STROKE[tone]} />
            <circle cx={g.start[0]} cy={g.start[1]} r={3} className={TONE_FILL[tone]} />
            <polygon points={g.head.map((p) => p.join(",")).join(" ")} strokeWidth={1} strokeLinejoin="round" className={cn(TONE_FILL[tone], TONE_STROKE[tone])} />
          </m.g>
        );
      })}
    </svg>
  );
}

/** Строка формул над таблицей (как в Excel): поле имени ячейки, «fx» и текст формулы. */
function FormulaBar({ cell, text }: { cell: string; text: string }) {
  const { t } = useT();
  return (
    <div role="group" aria-label={t("scene.table.formulaBar")} className="mx-auto mb-2 flex w-full max-w-xl items-stretch overflow-hidden rounded-xl border border-border bg-surface text-sm">
      <span className="flex min-w-14 items-center justify-center border-r border-border bg-surface-2 px-3 py-1.5 font-sans text-[13px] font-extrabold text-text">{cell}</span>
      <span aria-hidden className="flex items-center border-r border-border px-2.5 font-mono text-xs font-bold italic text-muted">
        fx
      </span>
      <span className="min-w-0 flex-1 px-3 py-1.5 font-mono font-bold text-text [overflow-wrap:anywhere]">{text}</span>
    </div>
  );
}

/**
 * Таблица: истинности, БД, трассировка или электронная таблица (sheet: буквы A, B, C… и номера строк).
 * Подсветка строк/столбцов/ячеек меняется плавно; широкая таблица прокручивается внутри сцены.
 * Расширения (волна 3): состояния строк (удалена, приглушена, отклонена, новая), «было → стало», тона ячеек, рамка диапазона,
 * стрелки между ячейками, строка формул, свои номера строк и вторая таблица JOIN. Без них разметка — прежняя.
 */
export function TableScene({ scene }: { scene: TableScene }) {
  const { head, rows } = tableData(scene);
  const reduce = useReduceMotion();
  const overlayOn = needsOverlay(scene);
  const [mainRef, mainGeo] = useMeasured(overlayOn, "data-cell", scene);

  const join = scene.join;
  const jt = join ? joinTones(join.links) : null;
  const [joinRef, joinGeo] = useMeasured(!!join, "data-join-row", scene);
  const wide = !!join && !!joinGeo && joinGeo.w >= JOIN_WIDE_FROM;

  const mainSpec: GridSpec = {
    head,
    rows,
    sheet: !!scene.sheet,
    mono: !!scene.mono,
    hiRows: new Set(scene.highlightRows ?? []),
    hiCols: new Set(scene.highlightCols ?? []),
    hiCells: new Set((scene.highlightCells ?? []).map(([r, c]) => cellKey(r, c))),
    states: rowStateMap(scene),
    changes: changeMap(scene),
    tones: toneMap(scene),
    rowTones: jt?.left ?? new Map(),
    rowNumber: (r) => sheetRowNumber(scene, r),
    measureCells: overlayOn,
    joinSide: join ? "L" : undefined,
  };
  const grid = (
    <TableGrid spec={mainSpec} wrapRef={overlayOn ? mainRef : undefined} overlay={overlayOn ? <Overlay scene={scene} geo={mainGeo} reduce={reduce} /> : undefined} />
  );
  const bar = scene.formula ? <FormulaBar cell={scene.formula.cell} text={scene.formula.text} /> : null;

  if (!join) {
    return bar ? (
      <div>
        {bar}
        {grid}
      </div>
    ) : (
      grid
    );
  }

  const rightSpec: GridSpec = {
    head: join.columns ?? null,
    rows: join.rows,
    sheet: false,
    mono: !!scene.mono,
    hiRows: new Set(),
    hiCols: new Set(),
    hiCells: new Set(),
    states: new Map(),
    changes: new Map(),
    tones: new Map(),
    rowTones: jt?.right ?? new Map(),
    rowNumber: (r) => r + 1,
    measureCells: false,
    joinSide: "R",
  };
  const links = wide && joinGeo ? join.links : [];

  return (
    <div>
      {bar}
      <div ref={joinRef} className="relative mx-auto w-full max-w-xl">
        <div className={cn("flex", wide ? "flex-row items-start gap-10" : "flex-col gap-3")}>
          <div className="min-w-0" style={wide ? { flex: `${Math.max(1, mainSpec.rows[0]?.length ?? 1)} 1 0%` } : undefined}>
            {grid}
          </div>
          <div className="min-w-0" style={wide ? { flex: `${Math.max(1, rightSpec.rows[0]?.length ?? 1)} 1 0%` } : undefined}>
            <TableGrid spec={rightSpec} />
          </div>
        </div>
        {joinGeo && links.length > 0 && (
          <svg width={joinGeo.w} height={joinGeo.h} className="pointer-events-none absolute left-0 top-0 z-30 overflow-visible" aria-hidden="true">
            {links.map(([a, b], i) => {
              const ra = joinGeo!.rects.get(`L:${a}`);
              const rb = joinGeo!.rects.get(`R:${b}`);
              if (!ra || !rb) return null;
              const tone = jt!.left.get(a) ?? "primary";
              const p = joinLinkPath(ra, rb);
              return (
                <m.g key={`${i}|${p.d}`} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduce ? 0 : 0.25, delay: reduce ? 0 : 0.1 }}>
                  <path d={p.d} fill="none" strokeWidth={2.2} strokeLinecap="round" className={TONE_STROKE[tone]} />
                  <circle cx={p.from[0]} cy={p.from[1]} r={3} className={TONE_FILL[tone]} />
                  <circle cx={p.to[0]} cy={p.to[1]} r={3} className={TONE_FILL[tone]} />
                </m.g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}

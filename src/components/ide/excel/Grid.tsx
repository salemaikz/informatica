"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";
import { addrOf, colToLetters, formatValue, isError, isFormula, lettersToCol, type SheetCells, type Value } from "@/lib/sheet";
import { useT } from "@/i18n/useT";

export interface GridProps {
  cols: number;
  rows: number;
  /** Введённое в ячейки (формулы и значения). */
  cells: SheetCells;
  /** Вычисленные значения. */
  values: Record<string, Value>;
  selected: string;
  /** Показывать формулы вместо значений. */
  showFormulas: boolean;
  /** Ячейки, на которые ссылается выбранная формула, — подсвечиваются. */
  related: ReadonlySet<string>;
  /** Только что заполненные ячейки (после «Протянуть»). */
  filled: ReadonlySet<string>;
  /** Нажатие на ячейку. */
  onSelect: (addr: string) => void;
  /** Перед выбором ячейки: можно отменить перенос фокуса (режим вставки адреса в формулу). */
  onCellMouseDown: (e: React.MouseEvent) => void;
  /** Печать символа на выбранной ячейке — начать ввод. */
  onTypeStart: (ch: string) => void;
  /** Enter или F2 — редактировать содержимое. */
  onEdit: () => void;
  onClear: () => void;
}

const ARROWS: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

/**
 * Сетка таблицы: заголовки A–H и 1–15 «прилипают» при прокрутке (прокрутка — внутри сетки, не страницы).
 * Клавиатура: стрелки, Enter/F2 — правка, Delete — очистить, любой символ — начать ввод.
 */
export function Grid({ cols, rows, cells, values, selected, showFormulas, related, filled, onSelect, onCellMouseDown, onTypeStart, onEdit, onClear }: GridProps) {
  const { t } = useT();
  const root = useRef<HTMLDivElement>(null);
  const sel = /^([A-Z]+)(\d+)$/.exec(selected);
  const selCol = sel ? sel[1] : "";
  const selRow = sel ? Number(sel[2]) : 0;

  const move = (dRow: number, dCol: number) => {
    const col = Math.min(cols, Math.max(1, lettersToCol(selCol) + dCol));
    const row = Math.min(rows, Math.max(1, selRow + dRow));
    const next = addrOf(col, row);
    onSelect(next);
    root.current?.querySelector<HTMLElement>(`[data-addr="${next}"]`)?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const arrow = ARROWS[e.key];
    if (arrow) {
      e.preventDefault();
      move(arrow[0], arrow[1]);
    } else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      onEdit();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onClear();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      onTypeStart(e.key);
    }
  };

  const colNums = Array.from({ length: cols }, (_, i) => i + 1);
  const rowNums = Array.from({ length: rows }, (_, i) => i + 1);

  return (
    <div ref={root} className="max-h-[min(22rem,58vh)] overflow-auto overscroll-contain rounded-2xl border-2 border-border bg-surface">
      <table role="grid" aria-label={t("idexl.grid.aria")} className="w-full min-w-max border-separate border-spacing-0 text-sm" onKeyDown={onKeyDown}>
        <thead>
          <tr role="row">
            <th scope="col" className="sticky left-0 top-0 z-20 h-8 w-10 border-b border-r border-border bg-surface-2" />
            {colNums.map((c) => {
              const L = colToLetters(c);
              return (
                <th
                  key={c}
                  scope="col"
                  role="columnheader"
                  className={cn(
                    "sticky top-0 z-10 h-8 border-b border-r border-border text-xs font-extrabold",
                    L === selCol ? "bg-primary-soft text-primary" : "bg-surface-2 text-muted",
                  )}
                >
                  {L}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rowNums.map((r) => (
            <tr key={r} role="row">
              <th
                scope="row"
                role="rowheader"
                className={cn(
                  "sticky left-0 z-10 w-10 border-b border-r border-border text-xs font-extrabold",
                  r === selRow ? "bg-primary-soft text-primary" : "bg-surface-2 text-muted",
                )}
              >
                {r}
              </th>
              {colNums.map((c) => {
                const addr = addrOf(c, r);
                const raw = cells[addr];
                const v = values[addr] ?? null;
                const isSel = addr === selected;
                const shownFormula = showFormulas && isFormula(raw);
                const text = shownFormula ? (raw as string).trim() : formatValue(v);
                const err = !shownFormula && isError(v);
                const kind = shownFormula ? "formula" : err || typeof v === "boolean" ? "center" : typeof v === "number" ? "number" : "text";
                return (
                  <td
                    key={c}
                    role="gridcell"
                    aria-selected={isSel}
                    className={cn("border-b border-r border-border p-0", related.has(addr) && !isSel && "bg-primary-soft", filled.has(addr) && !isSel && "bg-success-soft")}
                  >
                    <button
                      type="button"
                      data-addr={addr}
                      tabIndex={isSel ? 0 : -1}
                      aria-label={t("idexl.cell.aria", { addr, value: text || t("idexl.cell.empty") })}
                      onMouseDown={onCellMouseDown}
                      onClick={() => onSelect(addr)}
                      className={cn(
                        "block h-9 w-full min-w-[4.75rem] max-w-[9rem] truncate px-2 outline-none",
                        kind === "number" && "text-right tabular-nums",
                        kind === "center" && "text-center",
                        kind === "text" && "text-left",
                        kind === "formula" && "text-left font-mono text-xs",
                        err && "font-extrabold text-danger",
                        isSel && "relative z-[1] ring-2 ring-inset ring-primary",
                        !isSel && "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60",
                      )}
                    >
                      {text}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

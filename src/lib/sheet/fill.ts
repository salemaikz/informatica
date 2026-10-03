// «Протянуть» ячейку: копирование введённого в соседние ячейки (формулы — со сдвигом ссылок).

import { shiftFormula } from "./parse";
import { isFormula, type SheetCells } from "./format";
import { addrOf, inBounds, parseAddr } from "./refs";

export type FillDirection = "down" | "right";

/** Что окажется в ячейке, скопированной на dRow строк вниз и dCol столбцов вправо. */
export function copyInput(raw: string, dRow: number, dCol: number): string {
  const s = raw.trim();
  return isFormula(s) ? shiftFormula(s, dRow, dCol) : raw;
}

/**
 * Протягивание ячейки `from` на `count` ячеек вниз или вправо. Возвращает новый набор ячеек и адреса заполненных.
 * Выход за край таблицы обрезается. Пустая исходная ячейка очищает целевые (как в Excel).
 */
export function fillCells(cells: SheetCells, from: string, direction: FillDirection, count: number): { cells: SheetCells; filled: string[] } {
  const src = parseAddr(from);
  if (!src) return { cells, filled: [] };
  const raw = cells[addrOf(src.col, src.row)] ?? "";
  const next: SheetCells = { ...cells };
  const filled: string[] = [];
  for (let i = 1; i <= Math.max(0, Math.floor(count)); i++) {
    const col = direction === "right" ? src.col + i : src.col;
    const row = direction === "down" ? src.row + i : src.row;
    if (!inBounds(col, row)) break;
    const addr = addrOf(col, row);
    const v = copyInput(raw, row - src.row, col - src.col);
    if (v.trim() === "") delete next[addr];
    else next[addr] = v;
    filled.push(addr);
  }
  return { cells: next, filled };
}

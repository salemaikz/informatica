"use client";

import type { Scene } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { binaryColumns, colLetter, tableData } from "./table";

type TableScene = Extract<Scene, { kind: "table" }>;

/**
 * Таблица: истинности, БД, трассировка или электронная таблица (sheet: буквы A, B, C… и номера строк).
 * Подсветка строк/столбцов/ячеек меняется плавно; широкая таблица прокручивается внутри сцены.
 */
export function TableScene({ scene }: { scene: TableScene }) {
  const { l } = useT();
  const { head, rows } = tableData(scene);
  const sheet = !!scene.sheet;
  const mono = !!scene.mono;
  const grid = rows.map((r) => r.map((c) => l(c)));
  const width = rows[0]?.length ?? 0;
  const bin = mono ? binaryColumns(grid) : [];

  const hiRows = new Set(scene.highlightRows ?? []);
  const hiCols = new Set(scene.highlightCols ?? []);
  const hiCells = new Set((scene.highlightCells ?? []).map(([r, c]) => `${r}:${c}`));
  const hiCell = (r: number, c: number) => hiCells.has(`${r}:${c}`);
  const hiBg = (r: number, c: number) => hiRows.has(r) || hiCols.has(c) || hiCell(r, c);

  const cell = "px-3 py-2 text-sm leading-snug transition-colors duration-200";
  // Линии сетки: сверху — если над строкой есть шапка; слева — если слева есть столбец (в sheet — номера строк).
  const hasTop = (r: number) => r > 0 || !!head || sheet;
  const hasLeft = (c: number) => c > 0 || sheet;

  return (
    <div className="mx-auto w-full max-w-xl overflow-x-auto rounded-2xl border border-border bg-surface">
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
          {grid.map((row, r) => (
            <tr key={r}>
              {sheet && (
                <th
                  scope="row"
                  className={cn(
                    "sticky left-0 z-20 border-t border-border bg-surface-2 px-2 py-1 text-center font-sans text-[13px] font-semibold text-muted transition-colors duration-200",
                    hiRows.has(r) && "bg-primary-soft text-primary-strong",
                  )}
                >
                  {r + 1}
                </th>
              )}
              {row.map((value, c) => (
                <td
                  key={c}
                  className={cn(
                    cell,
                    hasLeft(c) && "border-l border-border",
                    hasTop(r) && "border-t border-border",
                    mono && !sheet ? "text-center" : "text-left",
                    hiBg(r, c) && "bg-primary-soft",
                    hiCell(r, c) && "relative z-10 ring-2 ring-inset ring-primary",
                    bin[c] && (value === "1" ? "font-bold text-success" : "text-muted"),
                  )}
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

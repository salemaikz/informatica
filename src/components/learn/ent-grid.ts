// Раскладка плиток «Карты ЕНТ» (без React): размер плитки по весу темы и проверка,
// что сетка заполнена без дыр. Покрыто тестами в tests/learn-map.test.ts.

export interface TileSpan {
  cols: 1 | 2;
  rows: 1 | 2;
}

/** Столько заданий (с долей контекстных) и больше — плитка на всю ширину двух колонок. */
export const WIDE_FROM = 5;
/** Столько заданий и больше — плитка двойной высоты. */
export const TALL_FROM = 4;

/** Размер плитки по числу заданий темы на ЕНТ (`topicTaskShare`). */
export function tileSpan(taskShare: number): TileSpan {
  if (taskShare >= WIDE_FROM) return { cols: 2, rows: 1 };
  if (taskShare >= TALL_FROM) return { cols: 1, rows: 2 };
  return { cols: 1, rows: 1 };
}

export interface GridFill {
  /** Сколько рядов заняла сетка. */
  rows: number;
  /** Пустых клеток внутри этих рядов (в середине и в конце). */
  holes: number;
}

/**
 * Раскладка как у CSS `grid-auto-flow: row dense`: каждая плитка встаёт на первое свободное место
 * (слева направо, сверху вниз), куда помещается. Нужна, чтобы проверить сетку тестом, а не глазами.
 */
export function fillGrid(spans: readonly TileSpan[], columns: number): GridFill {
  const busy: boolean[][] = [];
  const free = (row: number, col: number) => !busy[row]?.[col];
  for (const { cols, rows } of spans) {
    if (cols > columns) throw new Error(`плитка шире сетки: ${cols} > ${columns}`);
    let placed = false;
    for (let row = 0; !placed; row++) {
      for (let col = 0; col + cols <= columns && !placed; col++) {
        let fits = true;
        for (let dr = 0; dr < rows && fits; dr++) for (let dc = 0; dc < cols && fits; dc++) fits = free(row + dr, col + dc);
        if (!fits) continue;
        for (let dr = 0; dr < rows; dr++) for (let dc = 0; dc < cols; dc++) (busy[row + dr] ??= [])[col + dc] = true;
        placed = true;
      }
    }
  }
  let holes = 0;
  for (let row = 0; row < busy.length; row++) for (let col = 0; col < columns; col++) if (!busy[row]?.[col]) holes++;
  return { rows: busy.length, holes };
}

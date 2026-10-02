// Таблица: буквы столбцов электронной таблицы и признак «столбец из нулей и единиц» (чистая логика).

import type { Scene, Text } from "@/lib/types";

export type TableScene = Extract<Scene, { kind: "table" }>;

/** Имя столбца электронной таблицы: 0 → A, 1 → B, … 25 → Z, 26 → AA. */
export function colLetter(index: number): string {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/**
 * Данные таблицы: в режиме sheet столбцы-заголовки не используются — если они заданы,
 * это первая строка данных; в обычном режиме шапка отдельно от строк.
 */
export function tableData(scene: TableScene): { head: Text[] | null; rows: Text[][] } {
  if (scene.sheet) return { head: null, rows: scene.columns ? [scene.columns, ...scene.rows] : scene.rows };
  return { head: scene.columns ?? null, rows: scene.rows };
}

/** Для каждого столбца: все ли ячейки — «0» или «1» (только тогда цифры подкрашиваются). */
export function binaryColumns(rows: string[][]): boolean[] {
  const width = rows[0]?.length ?? 0;
  return Array.from({ length: width }, (_, c) => rows.length > 0 && rows.every((r) => r[c] === "0" || r[c] === "1"));
}

import type { Lang } from "@/lib/types";

// Чистая логика сцены sizes: подпись размера (Б/КБ/МБ/ГБ/ТБ по 1024) и ширина полос в логарифмическом масштабе.

/** Единицы: в русском и казахском сокращения совпадают (Б, КБ, МБ, ГБ, ТБ). */
const UNITS: Record<Lang, readonly string[]> = {
  ru: ["Б", "КБ", "МБ", "ГБ", "ТБ"],
  kk: ["Б", "КБ", "МБ", "ГБ", "ТБ"],
};

/** Число с запятой и не более чем одним знаком после неё: 1,5 · 3 · 0,3. */
function trim1(value: number): string {
  const r = Math.round(value * 10) / 10;
  return String(r).replace(".", ",");
}

/** Размер в удобных единицах: 3 145 728 → «3 МБ», 1 610 612 736 → «1,5 ГБ». Больше терабайта остаётся в ТБ. */
export function formatBytes(bytes: number, lang: Lang): string {
  const units = UNITS[lang];
  let b = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  let k = 0;
  while (k < units.length - 1 && b >= 1024) {
    b /= 1024;
    k++;
  }
  // 1023,96 КБ округляется до «1024 КБ» — переходим на следующую единицу.
  if (k < units.length - 1 && Math.round(b * 10) / 10 >= 1024) {
    b /= 1024;
    k++;
  }
  return `${trim1(b)} ${units[k]}`;
}

/**
 * Ширина полос в процентах (логарифмическая шкала): самая маленькая — `minPct`, самая большая — 100.
 * Если все размеры равны — все полосы полные. Нулевые и отрицательные размеры считаются за 1 байт.
 */
export function barWidths(bytes: number[], minPct = 10): number[] {
  if (bytes.length === 0) return [];
  const logs = bytes.map((b) => Math.log(Number.isFinite(b) && b > 1 ? b : 1));
  const lo = Math.min(...logs);
  const hi = Math.max(...logs);
  if (hi - lo < 1e-9) return bytes.map(() => 100);
  return logs.map((v) => Math.round((minPct + ((100 - minPct) * (v - lo)) / (hi - lo)) * 10) / 10);
}

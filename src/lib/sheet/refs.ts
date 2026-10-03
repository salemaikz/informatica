// Адреса ячеек и диапазонов: A1, $A$1, A$1, $A1, A1:B5. Столбцы и строки считаем с 1.

/** Пределы как в Excel: столбцы до XFD, строки до 1 048 576. */
export const MAX_COL = 16384;
export const MAX_ROW = 1048576;

export interface CellAddr {
  col: number;
  row: number;
}

/** Ссылка с признаками абсолютности ($). */
export interface CellRef extends CellAddr {
  absCol: boolean;
  absRow: boolean;
}

/** Прямоугольный диапазон (c1 ≤ c2, r1 ≤ r2). */
export interface RangeAddr {
  c1: number;
  r1: number;
  c2: number;
  r2: number;
}

export function colToLetters(col: number): string {
  let n = col;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** «AB» → 28; неверные буквы → 0. */
export function lettersToCol(letters: string): number {
  if (!/^[A-Za-z]{1,3}$/.test(letters)) return 0;
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export const inBounds = (col: number, row: number) => col >= 1 && col <= MAX_COL && row >= 1 && row <= MAX_ROW;

/** Адрес без долларов: (2, 3) → «B3». */
export const addrOf = (col: number, row: number) => colToLetters(col) + row;

const REF_RE = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/;

/** «$B$3», «b3» → ссылка; вне таблицы или не адрес → null. */
export function parseRef(text: string): CellRef | null {
  const m = REF_RE.exec(text);
  if (!m) return null;
  const col = lettersToCol(m[2]);
  const row = Number(m[4]);
  if (!inBounds(col, row)) return null;
  return { col, row, absCol: m[1] === "$", absRow: m[3] === "$" };
}

/** «B3» (доллары допускаются, регистр не важен) → координаты. */
export function parseAddr(text: string): CellAddr | null {
  const r = parseRef(text.trim());
  return r ? { col: r.col, row: r.row } : null;
}

/** «b3» → «B3»; не адрес → null. */
export function normalizeAddr(text: string): string | null {
  const a = parseAddr(text);
  return a ? addrOf(a.col, a.row) : null;
}

export function refText(r: CellRef): string {
  return (r.absCol ? "$" : "") + colToLetters(r.col) + (r.absRow ? "$" : "") + r.row;
}

/** Сдвиг ссылки при копировании: абсолютные части не двигаются. Вышла за край таблицы → null (#ССЫЛКА!). */
export function shiftRef(r: CellRef, dRow: number, dCol: number): CellRef | null {
  const col = r.absCol ? r.col : r.col + dCol;
  const row = r.absRow ? r.row : r.row + dRow;
  if (!inBounds(col, row)) return null;
  return { col, row, absCol: r.absCol, absRow: r.absRow };
}

export function normalizeRange(a: CellAddr, b: CellAddr): RangeAddr {
  return { c1: Math.min(a.col, b.col), r1: Math.min(a.row, b.row), c2: Math.max(a.col, b.col), r2: Math.max(a.row, b.row) };
}

export const inRange = (col: number, row: number, r: RangeAddr) => col >= r.c1 && col <= r.c2 && row >= r.r1 && row <= r.r2;

export const rangeArea = (r: RangeAddr) => (r.c2 - r.c1 + 1) * (r.r2 - r.r1 + 1);

/** Все адреса диапазона по строкам (для небольших диапазонов; для больших не вызывать). */
export function rangeAddrs(r: RangeAddr): string[] {
  const out: string[] = [];
  for (let row = r.r1; row <= r.r2; row++) for (let col = r.c1; col <= r.c2; col++) out.push(addrOf(col, row));
  return out;
}

/** «A1:B5» (без учёта $) → диапазон или null. */
export function parseRangeText(text: string): RangeAddr | null {
  const [a, b, ...rest] = text.split(":");
  if (b === undefined || rest.length) return null;
  const x = parseAddr(a);
  const y = parseAddr(b);
  return x && y ? normalizeRange(x, y) : null;
}

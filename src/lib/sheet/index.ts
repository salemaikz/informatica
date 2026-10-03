// Движок электронных таблиц Практикума (чистый TypeScript): разбор и вычисление формул, ссылки, копирование.

export * from "./value";
export * from "./refs";
export * from "./parse";
export * from "./eval";
export * from "./format";
export * from "./fill";

/** Размер сетки в интерфейсе: A–H × 1–15. Сам движок работает на всей таблице Excel. */
export const GRID_COLS = 8;
export const GRID_ROWS = 15;

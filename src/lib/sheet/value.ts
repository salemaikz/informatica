// Значения ячеек электронной таблицы (движок формул Практикума, решение #35).
// Чистый TypeScript, без React и DOM.

/** Коды ошибок — как в русском Excel (плюс «#ЦИКЛ!» для циклической ссылки). */
export type ErrorCode = "#ДЕЛ/0!" | "#ЗНАЧ!" | "#ССЫЛКА!" | "#ИМЯ?" | "#ЧИСЛО!" | "#ЦИКЛ!";

export interface SheetError {
  readonly error: ErrorCode;
}

/** Обычное значение: число, текст, логическое, пустая ячейка (null). */
export type Scalar = number | string | boolean | null;
export type Value = Scalar | SheetError;

export const ERR = {
  div0: { error: "#ДЕЛ/0!" },
  value: { error: "#ЗНАЧ!" },
  ref: { error: "#ССЫЛКА!" },
  name: { error: "#ИМЯ?" },
  num: { error: "#ЧИСЛО!" },
  cycle: { error: "#ЦИКЛ!" },
} as const satisfies Record<string, SheetError>;

export function isError(v: unknown): v is SheetError {
  return typeof v === "object" && v !== null && "error" in v;
}

/** Все коды ошибок (для UI и тестов). */
export const ERROR_CODES: ErrorCode[] = ["#ДЕЛ/0!", "#ЗНАЧ!", "#ССЫЛКА!", "#ИМЯ?", "#ЧИСЛО!", "#ЦИКЛ!"];

/** Литералы ошибок, которые понимает разбор формулы (русские и английские), — после «копирования за край таблицы» формула остаётся читаемой. */
export const ERROR_LITERALS: Record<string, ErrorCode> = {
  "#ССЫЛКА!": "#ССЫЛКА!",
  "#REF!": "#ССЫЛКА!",
  "#ДЕЛ/0!": "#ДЕЛ/0!",
  "#DIV/0!": "#ДЕЛ/0!",
  "#ЗНАЧ!": "#ЗНАЧ!",
  "#VALUE!": "#ЗНАЧ!",
  "#ИМЯ?": "#ИМЯ?",
  "#NAME?": "#ИМЯ?",
  "#ЧИСЛО!": "#ЧИСЛО!",
  "#NUM!": "#ЧИСЛО!",
};

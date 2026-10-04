// Конец потокового ответа ИИ: сервер дописывает маркер последним куском, клиент его отрезает и не показывает ученику.
// Без React и без server-only: общий модуль для маршрута /api/ai/tutor и клиента (lib/ai.ts). Тест — tests/ai-stream.test.ts.
//
// Обычный ответ маркера не содержит. Сбой во время потока — STREAM_ERROR_MARK, обрезка по длине
// (finish_reason === "length") — STREAM_CUT_MARK. Символ \u0000 не встречается в тексте модели
// (сервер вырезает его из кусков), поэтому первый \u0000 в тексте — всегда начало маркера.

export const STREAM_MARK = "\u0000";
export const STREAM_ERROR_MARK = `${STREAM_MARK}ERR`;
export const STREAM_CUT_MARK = `${STREAM_MARK}CUT`;

export type StreamEnd = "ok" | "error" | "cut";

/** Убирает служебный символ из текста модели: маркер конца потока нельзя подделать содержимым ответа. */
export function stripStreamMark(text: string): string {
  return text.includes(STREAM_MARK) ? text.split(STREAM_MARK).join("") : text;
}

/**
 * Делит накопленный текст потока на ответ и признак конца.
 * Нет маркера — «ok» (поток ещё идёт или закончился нормально). Недописанный маркер («\u0000E») —
 * тоже конец с ошибкой: поток оборвался на маркере.
 */
export function splitStreamTail(raw: string): { text: string; end: StreamEnd } {
  const i = raw.indexOf(STREAM_MARK);
  if (i < 0) return { text: raw, end: "ok" };
  return { text: raw.slice(0, i), end: raw.startsWith(STREAM_CUT_MARK, i) ? "cut" : "error" };
}

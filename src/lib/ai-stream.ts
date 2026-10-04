// Конец потокового ответа ИИ: сервер дописывает маркер последним куском, клиент его отрезает и не показывает ученику.
// Без React и без server-only: общий модуль для маршрута /api/ai/tutor и клиента (lib/ai.ts). Тест — tests/ai-stream.test.ts.
//
// Каждый текстовый ответ маршрута tutor (поток, кэш, кризисный текст, заглушка подсказки) заканчивается маркером:
// STREAM_OK_MARK — ответ дошёл целиком; сбой во время потока — STREAM_ERROR_MARK; обрезка по длине
// (finish_reason === "length") — STREAM_CUT_MARK. Ответ БЕЗ маркера «ok» клиент считает оборванным (платформа
// закрыла соединение по таймауту, сеть упала, сервер перезапустился): положительный маркер надёжнее, чем отсутствие
// маркера ошибки. Символ \u0000 не встречается в тексте модели (сервер вырезает его из кусков), поэтому первый
// \u0000 в тексте — всегда начало маркера.

export const STREAM_MARK = "\u0000";
export const STREAM_OK_MARK = `${STREAM_MARK}OK`;
export const STREAM_ERROR_MARK = `${STREAM_MARK}ERR`;
export const STREAM_CUT_MARK = `${STREAM_MARK}CUT`;

/** «open» — маркера ещё нет (поток идёт) или поток закончился без него (оборван). */
export type StreamEnd = "ok" | "error" | "cut" | "open";

/** Убирает служебный символ из текста модели: маркер конца потока нельзя подделать содержимым ответа. */
export function stripStreamMark(text: string): string {
  return text.includes(STREAM_MARK) ? text.split(STREAM_MARK).join("") : text;
}

/** Дописывает «ok» к готовому ответу, если маркера конца в нём ещё нет (кэш, кризисный текст, заглушка). */
export function withStreamEnd(text: string): string {
  return text.includes(STREAM_MARK) ? text : text + STREAM_OK_MARK;
}

/**
 * Делит накопленный текст потока на ответ и признак конца. Показывать ученику — только `text`.
 * Нет маркера — «open»: пока идёт поток это норма, но после закрытия соединения означает обрыв.
 * Недописанный маркер («\u0000O», «\u0000E») — тоже конец с ошибкой: поток оборвался на маркере.
 */
export function splitStreamTail(raw: string): { text: string; end: StreamEnd } {
  const i = raw.indexOf(STREAM_MARK);
  if (i < 0) return { text: raw, end: "open" };
  const end: StreamEnd = raw.startsWith(STREAM_OK_MARK, i) ? "ok" : raw.startsWith(STREAM_CUT_MARK, i) ? "cut" : "error";
  return { text: raw.slice(0, i), end };
}

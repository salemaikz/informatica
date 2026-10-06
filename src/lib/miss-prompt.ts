import type { L, Text } from "./types";

/**
 * Что показать в «Повторяющихся ошибках» (этап 16Г, полировка): текст задания на языке интерфейса.
 * Порядок: текст, найденный в контенте по id задания (resolved) → оба языка из журнала (promptL) → старая строка prompt
 * (на языке, в котором ошиблись; у записей до этой правки других нет).
 */
export function missPromptText(entry: { prompt: string; promptL?: L }, resolved?: L): Text {
  return resolved ?? entry.promptL ?? entry.prompt;
}

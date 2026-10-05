import "server-only";
import type { TaskContext, TutorMode } from "@/lib/ai-types";
import { aiLimitsDict } from "@/i18n/parts/ai-limits";
import { answerLeaks, type Secret } from "@/lib/answer-leak";

// Страж «ответ к нерешённому заданию не называем» (#100): код проверяет текст модели (#53), модели на слово не верим.

/** Безопасный текст вместо ответа модели, назвавшей ответ (ru/kk). */
export const LEAK_FALLBACK = aiLimitsDict["ailimit.leakFallback"];

/**
 * Ответы, которых в тексте быть не должно: подсказка и «вопрос / объясни проще» к ещё не решённому заданию.
 * Пусто — проверять нечего (теория, практикум кода, решённое задание, разбор ошибки, чат без задания).
 * Ответы берём из контекста задания от клиента (`secrets`; нет — хотя бы `correct`): это недоверенные данные,
 * они служат только стоп-словами и в инструкцию модели не попадают.
 */
export function unsolvedSecrets(mode: TutorMode, task: TaskContext | undefined): Secret[] {
  if (!task || task.ide || task.theory || !task.prompt) return [];
  if (mode !== "hint" && !(mode === "ask" && !task.answered)) return [];
  if (task.secrets?.length) return task.secrets;
  return task.correct ? [[task.correct]] : [];
}

/** Назвал ли текст ответ к нерешённому заданию; условие задания ученик видит сам — его слова утечкой не считаются. */
export function leaksUnsolved(text: string, task: TaskContext, secrets: Secret[]): boolean {
  return secrets.length > 0 && answerLeaks(text, secrets, { known: task.prompt });
}

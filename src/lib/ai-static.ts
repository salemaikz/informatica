import type { TaskContext, TutorMode } from "./ai-types";

/**
 * Бесплатный текст для шторки ИИ (одни и те же слова всем ученикам, без запроса к модели):
 * подсказка автора либо разбор неверного варианта + объяснение задания. Режим «вопрос» бесплатного текста не имеет.
 */
export function staticAiText(mode: Exclude<TutorMode, "chat">, task: Pick<TaskContext, "hint" | "whyWrong" | "explanation">): string | undefined {
  if (mode === "hint") return task.hint?.trim() || undefined;
  if (mode === "explain") return [task.whyWrong, task.explanation].map((x) => x?.trim()).filter(Boolean).join("\n\n") || undefined;
  return undefined;
}

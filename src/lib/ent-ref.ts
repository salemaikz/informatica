// Ссылки на задания ЕНТ в id шагов («ent:<id>[:n]»). Лёгкий модуль без банка ЕНТ (этап 16):
// плеер урока проверяет ссылки, не загружая все задания. Разбор ссылок — lib/ent-steps.ts.

export const ENT_REF_PREFIX = "ent:";

/** Ссылка на задание ЕНТ (n — пункт соответствия или номер вопроса контекста, с нуля). */
export const entRef = (id: string, n?: number): string => `${ENT_REF_PREFIX}${id}${n === undefined ? "" : `:${n}`}`;

export const isEntRef = (stepId: string): boolean => stepId.startsWith(ENT_REF_PREFIX);

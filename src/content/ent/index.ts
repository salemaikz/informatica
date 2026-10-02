import type { EntItem, EntTopicId } from "@/lib/types";
import { GENERATED_ENT } from "./generated";

// Банк заданий в формате ЕНТ: все файлы src/content/ent/<урок>.ts (export const ITEMS).
// Подключаются скриптом scripts/register-content.mjs (src/content/ent/generated.ts). Задания собирает пробный ЕНТ (lib/exam.ts).

export const ENT_POOL: EntItem[] = [...GENERATED_ENT];

export function entItemsByTopic(topic: EntTopicId): EntItem[] {
  return ENT_POOL.filter((i) => i.topic === topic);
}

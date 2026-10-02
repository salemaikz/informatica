import type { EntItem, EntTopicId } from "@/lib/types";

// Банк заданий в формате ЕНТ: все файлы src/content/ent/<урок>.ts (export const ITEMS).
// Новый урок = импорт здесь. Задания собирает пробный ЕНТ (lib/exam.ts).

export const ENT_POOL: EntItem[] = [];

export function entItemsByTopic(topic: EntTopicId): EntItem[] {
  return ENT_POOL.filter((i) => i.topic === topic);
}

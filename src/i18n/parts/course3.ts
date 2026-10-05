import type { L } from "@/lib/types";

// Курс 3.0 (этап 14, #46): узлы «Практика» и «Повторение» на карте, мини-тест группы, микроуроки (ru + kk).
// Ключи — `course3.*`. Пакет P2 дописывает свои ключи сюда; заголовки сессий ниже использует DrillScreen (каркас).
export const course3Dict = {
  "course3.practice.title": { ru: "Практика: {group}", kk: "Практика: {group}" },
  "course3.recap.title": { ru: "Повторение: {unit}", kk: "Қайталау: {unit}" },
  "course3.minitest.title": { ru: "Мини-тест: {group}", kk: "Шағын тест: {group}" },
  "course3.empty": {
    ru: "Здесь пока нечего тренировать — сначала пройди хотя бы один урок группы.",
    kk: "Мұнда әзірге жаттығатын ештеңе жоқ — алдымен топтың кемінде бір сабағын өт.",
  },
} satisfies Record<string, L>;

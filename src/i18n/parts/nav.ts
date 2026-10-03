import type { L } from "@/lib/types";

// Навигация v0.8: группы разделов (Учиться, Практика, ИИ-чат, Материалы, Прогресс) и подразделы. Префикс nav2.*
export const navDict = {
  "nav2.materials": { ru: "Материалы", kk: "Материалдар" },
} satisfies Record<string, L>;

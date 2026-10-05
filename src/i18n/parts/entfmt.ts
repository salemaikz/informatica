import type { L } from "@/lib/types";

// Задания в настоящем формате ЕНТ внутри уроков (этап 14): «соответствие» 2×4 (ru + kk). Ключи — `entfmt.*`.
// Пакет P3 дописывает свои ключи сюда.
export const entfmtDict = {
  "entfmt.match.hint": { ru: "Для каждого пункта выбери одно описание", kk: "Әр тармаққа бір сипаттаманы таңда" },
} satisfies Record<string, L>;

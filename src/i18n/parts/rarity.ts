import type { L } from "@/lib/types";

// Этап 16В: названия редкости (украшения профиля, достижения). Вычитано моделью, носителем — нет.
export const rarityDict = {
  "rarity.common": { ru: "Обычная", kk: "Қарапайым" },
  "rarity.rare": { ru: "Редкая", kk: "Сирек" },
  "rarity.epic": { ru: "Эпическая", kk: "Эпикалық" },
  "rarity.legendary": { ru: "Легендарная", kk: "Аңыздық" },
} satisfies Record<string, L>;

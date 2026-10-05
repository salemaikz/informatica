// Редкость (этап 16В): общая шкала для украшений профиля, достижений и ступеней уровня. Чистая логика без React.
// Цвета — токены `rarity-*` в globals.css (классы — components/ui/rarity.ts), названия — `rarity.*` в i18n.

export const RARITIES = ["common", "rare", "epic", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];

/** Порядок редкости: common 0 … legendary 3 (для сортировки и сравнения). */
export const rarityRank = (r: Rarity): number => RARITIES.indexOf(r);

export const isRarity = (x: unknown): x is Rarity => typeof x === "string" && (RARITIES as readonly string[]).includes(x);

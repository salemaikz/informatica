import type { L } from "./types";

export type CosmeticStyle = "orbit" | "circuit" | "prism" | "crown";
export interface Cosmetic {
  id: string;
  name: L;
  style: CosmeticStyle;
  color: "primary" | "success" | "ai" | "gold" | "streak";
  rarity: "common" | "rare";
}

export const COSMETICS: Cosmetic[] = [
  { id: "blue-orbit", name: { ru: "Голубая орбита", kk: "Көгілдір орбита" }, style: "orbit", color: "primary", rarity: "common" },
  { id: "green-circuit", name: { ru: "Зелёная схема", kk: "Жасыл сұлба" }, style: "circuit", color: "success", rarity: "common" },
  { id: "violet-prism", name: { ru: "Фиолетовая призма", kk: "Күлгін призма" }, style: "prism", color: "ai", rarity: "common" },
  { id: "orange-orbit", name: { ru: "Огненная орбита", kk: "Жалынды орбита" }, style: "orbit", color: "streak", rarity: "common" },
  { id: "blue-circuit", name: { ru: "Печатная плата", kk: "Баспа тақшасы" }, style: "circuit", color: "primary", rarity: "common" },
  { id: "green-prism", name: { ru: "Изумрудные грани", kk: "Зүбәржат қырлар" }, style: "prism", color: "success", rarity: "common" },
  { id: "gold-crown", name: { ru: "Золотая корона", kk: "Алтын тәж" }, style: "crown", color: "gold", rarity: "rare" },
  { id: "violet-orbit", name: { ru: "Космическая орбита", kk: "Ғарыштық орбита" }, style: "orbit", color: "ai", rarity: "rare" },
  { id: "gold-prism", name: { ru: "Солнечная призма", kk: "Күн призмасы" }, style: "prism", color: "gold", rarity: "rare" },
];

/** Пока коллекция не собрана, кейс всегда даёт новое оформление. */
export function pickCosmetic(owned: string[], random = Math.random): Cosmetic {
  const available = COSMETICS.filter((item) => !owned.includes(item.id));
  const pool = available.length ? available : COSMETICS;
  const weights = pool.map((item) => item.rarity === "rare" ? 1 : 3);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let position = Math.max(0, Math.min(0.999999, random())) * total;
  for (let i = 0; i < pool.length; i++) {
    position -= weights[i];
    if (position < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

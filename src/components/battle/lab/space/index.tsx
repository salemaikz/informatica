"use client";

import type { BattleVariant } from "../types";

// Заготовка: вариант «space» рисует исполнитель (docs/specs/battle-lab.md).
export const variant: BattleVariant = {
  id: "space",
  title: "space",
  pitch: "Скоро",
  skins: [{ id: "base", name: "Базовый", rarity: "common" }],
  Screen: () => <div className="p-6 text-center text-muted">Скоро</div>,
  SkinPreview: ({ size }) => <div style={{ width: size, height: size }} className="rounded-xl bg-border" />,
};

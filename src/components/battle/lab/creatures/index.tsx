"use client";

import type { BattleVariant } from "../types";
import { Creature } from "./art";
import CreaturesScreen from "./Screen";
import { SKINS } from "./skins";

// Вариант «Существа»: милые зверьки на лугу, раскладка как в классических битвах карманных монстров.
export const variant: BattleVariant = {
  id: "creatures",
  title: "Существа",
  pitch:
    "Милые существа на лугу: у каждого скина свой силуэт и характер. Вы слева внизу, крупнее; соперник справа вверху. Ответы — «приёмы» со стихиями: Логика, Код, Сеть, Данные.",
  skins: SKINS,
  Screen: CreaturesScreen,
  SkinPreview: ({ skin, size }) => <Creature skin={skin} size={size} shadow />,
};

import type { L } from "@/lib/types";

export const S = {
  score: { ru: "Очки", kk: "Ұпай" },
  secShort: { ru: "с", kk: "с" },
  believe: { ru: "Верю", kk: "Сенемін" },
  disbelieve: { ru: "Не верю", kk: "Сенбеймін" },
  correct: { ru: "Верно!", kk: "Дұрыс!" },
  wrong: { ru: "Неверно", kk: "Қате" },
  timeUp: { ru: "Время!", kk: "Уақыт бітті!" },
  timeoutHead: { ru: "Время вышло", kk: "Уақыт бітті" },
  done: { ru: "Готово!", kk: "Дайын!" },
  claimTrue: { ru: "Утверждение верное", kk: "Тұжырым дұрыс" },
  claimFalse: { ru: "Утверждение неверное", kk: "Тұжырым қате" },
  swipeHint: {
    ru: "Смахни карточку вправо — верю, влево — не верю",
    kk: "Карточканы оңға сырғыт — сенемін, солға — сенбеймін",
  },
  calmHint: {
    ru: "Не торопись. Смахни карточку или нажми кнопку",
    kk: "Асықпа. Карточканы сырғыт немесе түймені бас",
  },
  announceRight: { ru: "Верно", kk: "Дұрыс" },
  announceWrong: { ru: "Неверно. {why}", kk: "Қате. {why}" },
  announceTimeout: { ru: "Время вышло. {why}", kk: "Уақыт бітті. {why}" },
  streakDouble: { ru: "Серия: очки ×2", kk: "Серия: ұпай ×2" },
} satisfies Record<string, L>;

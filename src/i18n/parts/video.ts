import type { L } from "@/lib/types";

// Строки раздела (ru + kk). Префикс ключей — см. docs/specs/stage3.md. Казахский — литературный, термины по глоссарию НЦТ.
export const videoDict = {
  "video.back5": { ru: "−5 с", kk: "−5 сек" },
  "video.fwd5": { ru: "+5 с", kk: "+5 сек" },
  "video.back5.aria": { ru: "Назад на 5 секунд", kk: "5 секунд артқа" },
  "video.fwd5.aria": { ru: "Вперёд на 5 секунд", kk: "5 секунд алға" },
  "video.speed.aria": { ru: "Скорость воспроизведения: {rate}", kk: "Ойнату жылдамдығы: {rate}" },
  "video.speed.pick": { ru: "Выбрать скорость", kk: "Жылдамдықты таңдау" },
} satisfies Record<string, L>;

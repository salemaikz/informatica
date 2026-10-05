import type { L } from "@/lib/types";

// Этап 16Б, волна 3 (сцена wave и расширения binary, decimal; ТЗ — docs/specs/stage16b-wave3*.md). Ключи — `scene.wave.*, scene.binary.*, scene.decimal.*`.
// Казахский — литературный, термины по глоссарию НЦТ, без глаголов с родом в русском. Вычитано моделью, носителем — нет.
export const sceneSignalDict = {
  // wave: подписи под рисунком и описание для скринридера
  "scene.wave.samples": { ru: "отсчётов: {n}", kk: "өлшемдер: {n}" },
  "scene.wave.bits": { ru: "бит: {n}", kk: "бит: {n}" },
  "scene.wave.levels": { ru: "уровней: {f}", kk: "деңгейлер: {f}" },
  "scene.wave.aria": { ru: "Звуковая волна", kk: "Дыбыс толқыны" },
  "scene.wave.ariaCompare": { ru: "Для сравнения", kk: "Салыстыру үшін" },
  "scene.wave.ariaDigital": { ru: "ступенчатая цифровая кривая", kk: "сатылы цифрлық қисық" },

  // binary: группы, сдвиг, пропуск середины, режим «адрес / маска / И»
  "scene.binary.byte": { ru: "байт {n}", kk: "байт {n}" },
  "scene.binary.andIp": { ru: "IP", kk: "IP" },
  "scene.binary.andMask": { ru: "Маска", kk: "Маска" },
  "scene.binary.andNet": { ru: "Сеть", kk: "Желі" },
  "scene.binary.shiftLeft": { ru: "влево — умножаем на 2, справа приписан 0", kk: "солға — 2-ге көбейтеміз, оң жағына 0 жазылады" },
  "scene.binary.shiftRight": { ru: "вправо — делим на 2, правый разряд отброшен", kk: "оңға — 2-ге бөлеміз, оң жақ разряд тасталады" },
  "scene.binary.shiftResult": { ru: "получится:", kk: "нәтиже:" },
  "scene.binary.ariaGroups": { ru: "разрядов в группе: {g}", kk: "топтағы разряд: {g}" },
  "scene.binary.ariaGap": { ru: "середина пропущена", kk: "ортасы көрсетілмеген" },

  // decimal: основание и «отрываем цифру»
  "scene.decimal.peelStep": { ru: "шаг {n}", kk: "{n}-қадам" },
  "scene.decimal.peelDigits": { ru: "цифры справа налево:", kk: "цифрлар оңнан солға:" },
  "scene.decimal.ariaBase": { ru: "Число {number}, основание системы счисления: {base}", kk: "{number} саны, санау жүйесінің негізі: {base}" },
  "scene.decimal.ariaPeel": { ru: "Отделение цифр числа {number}, основание: {base}", kk: "{number} санының цифрларын бөліп алу, негіз: {base}" },
} satisfies Record<string, L>;

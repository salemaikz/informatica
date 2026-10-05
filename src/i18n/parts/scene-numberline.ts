import type { L } from "@/lib/types";

// Этап 16Б, волна 3 (сцена numberline; ТЗ — docs/specs/stage16b-wave3*.md). Ключи — `scene.numberline.*`.
// Казахский — литературный, термины по глоссарию НЦТ, без глаголов с родом в русском. Вычитано моделью, носителем — нет.
export const sceneNumberlineDict = {
  "scene.numberline.aria": { ru: "Числовая ось: наименьшее значение {min}, наибольшее {max}.", kk: "Сан осі: ең кіші мән {min}, ең үлкен мән {max}." },
  "scene.numberline.row": { ru: "Строка {n}", kk: "{n}-жол" },
  "scene.numberline.rowLine": { ru: "{name}: {parts}.", kk: "{name}: {parts}." },
  "scene.numberline.range": { ru: "промежуток от {from} до {to}", kk: "{from} мен {to} аралығы" },
  "scene.numberline.in": { ru: "входит", kk: "кіреді" },
  "scene.numberline.out": { ru: "не входит", kk: "кірмейді" },
  "scene.numberline.end": { ru: "{value} ({state})", kk: "{value} ({state})" },
  "scene.numberline.infNeg": { ru: "минус бесконечность", kk: "минус шексіздік" },
  "scene.numberline.infPos": { ru: "плюс бесконечность", kk: "плюс шексіздік" },
  "scene.numberline.point": { ru: "точка {at} ({state})", kk: "{at} нүктесі ({state})" },
  "scene.numberline.pointLabel": { ru: "{point}, подпись «{label}»", kk: "{point}, жазуы «{label}»" },
  "scene.numberline.jumps": {
    ru: "шаг {step}, начало {start}, конец {stop} не включается; берутся числа: {list}",
    kk: "қадам {step}, басы {start}, соңы {stop} кірмейді; алынатын сандар: {list}",
  },
  "scene.numberline.none": { ru: "ни одного числа", kk: "бірде-бір сан жоқ" },
} satisfies Record<string, L>;

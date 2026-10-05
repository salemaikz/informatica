import type { Scene } from "@/lib/types";

/** Образцы сцены numberline (галерея /dev/scenes, проверка tests/scene-samples.test.ts). */
export const SAMPLES: Extract<Scene, { kind: "numberline" }>[] = [
  // два условия и их пересечение третьей строкой; лучи, входит / не входит
  {
    kind: "numberline",
    min: 0,
    max: 10,
    ticks: "all",
    rows: [
      { label: "x > 3", ranges: [{ from: 3, to: null }] },
      { label: "x ≤ 7", ranges: [{ from: null, to: 7, toIn: true }] },
      { label: { ru: "оба", kk: "екеуі" }, tone: "success", ranges: [{ from: 3, to: 7, toIn: true }] },
    ],
    caption: { ru: "Оба условия верны на промежутке (3; 7].", kk: "Екі шарт та (3; 7] аралығында орындалады." },
  },
  // range(2, 9, 3): дуги шагов, stop — выколотый
  { kind: "numberline", min: 0, max: 10, ticks: "all", rows: [{ label: "range(2, 9, 3)", jumps: { start: 2, stop: 9, step: 3 } }] },
  // отрицательный шаг — дуги идут влево
  {
    kind: "numberline",
    min: 0,
    max: 10,
    ticks: "all",
    rows: [{ label: "range(9, 2, -3)", tone: "ai", jumps: { start: 9, stop: 2, step: -3 } }],
  },
  // отрицательные числа, точки с подписями, закрашенная и выколотая, свои деления
  {
    kind: "numberline",
    min: -5,
    max: 5,
    ticks: [-5, -3, 0, 3, 5],
    rows: [
      {
        label: "A",
        tone: "primary",
        points: [
          { at: -3, label: { ru: "входит", kk: "кіреді" } },
          { at: 3, open: true, label: { ru: "не входит", kk: "кірмейді" } },
        ],
      },
      { label: "B", tone: "ai", points: [{ at: 0, label: "x = 0" }], ranges: [{ from: -5, to: -2, fromIn: true, toIn: true }] },
    ],
  },
  // максимум: 21 деление, 20 прыжков подряд, подпись длиннее — над строкой
  {
    kind: "numberline",
    min: 0,
    max: 20,
    ticks: "all",
    rows: [{ label: { ru: "range(0, 20): каждое число подряд", kk: "range(0, 20): әр сан қатарынан" }, jumps: { start: 0, stop: 20, step: 1 } }],
  },
  // максимум шкалы (40 делений), длинные kk-подписи, три строки
  {
    kind: "numberline",
    min: -20,
    max: 20,
    rows: [
      { label: { ru: "x < −10 или x > 10", kk: "x < −10 немесе x > 10" }, tone: "ai", ranges: [{ from: null, to: -10 }, { from: 10, to: null }] },
      { label: { ru: "−15 ≤ x ≤ 5", kk: "−15 ≤ x ≤ 5 болғанда" }, tone: "primary", ranges: [{ from: -15, to: 5, fromIn: true, toIn: true }] },
      { label: { ru: "пересечение", kk: "қиылысуы (ортақ бөлігі)" }, tone: "success", ranges: [{ from: -15, to: -10, fromIn: true }] },
    ],
  },
  // подписи точек рядом друг с другом: уходят на второй уровень
  {
    kind: "numberline",
    min: 0,
    max: 12,
    rows: [
      {
        label: "x",
        tone: "ai",
        points: [
          { at: 5, label: { ru: "минимум", kk: "ең кіші мән" } },
          { at: 6, open: true, label: { ru: "середина", kk: "ортасы" } },
          { at: 7, label: { ru: "максимум", kk: "ең үлкен мән" } },
          { at: 12, label: { ru: "конец шкалы", kk: "шкала соңы" } },
        ],
      },
    ],
  },
  // вся ось: луч в обе стороны и точка внутри
  { kind: "numberline", min: -3, max: 3, ticks: "all", rows: [{ label: "x ≠ 0", tone: "muted", ranges: [{ from: null, to: 0 }, { from: 0, to: null }], points: [{ at: 0, open: true }] }] },
];

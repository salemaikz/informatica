import type { Scene } from "@/lib/types";

/** Образцы сцены wave: только волна, отсчёты, сетка уровней, цифровая кривая, сравнение качества. */
export const SAMPLES: Extract<Scene, { kind: "wave" }>[] = [
  { kind: "wave", samples: 0 },
  { kind: "wave", samples: 12, bits: 3, digital: true },
  { kind: "wave", samples: 8, bits: 2, label: { ru: "Грубо: мало отсчётов и уровней", kk: "Дөрекі: өлшемдер мен деңгейлер аз" } },
  {
    kind: "wave",
    samples: 16,
    bits: 4,
    digital: true,
    label: { ru: "Лучше: 16 отсчётов, 4 бита", kk: "Жақсы: 16 өлшем, 4 бит" },
    compare: { samples: 6, bits: 2, label: { ru: "Хуже: 6 отсчётов, 2 бита", kk: "Нашар: 6 өлшем, 2 бит" } },
  },
  { kind: "wave", samples: 40, bits: 8, digital: true },
  { kind: "wave", samples: 10, digital: true, caption: { ru: "Только дискретизация: значения не округляются", kk: "Тек дискреттеу: мәндер дөңгелектелмейді" } },
  { kind: "wave", samples: 20, bits: 1, digital: true, compare: { samples: 20, bits: 3 } },
];

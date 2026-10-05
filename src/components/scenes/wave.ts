// Чистая раскладка сцены wave (звук): волна, отсчёты, сетка уровней, ступенчатая «цифровая» кривая.
// Координаты — в viewBox панели; компонент только рисует. Всё считает код: контент задаёт лишь число отсчётов и бит.

import { superscript } from "@/lib/calc";
import type { Scene, Text } from "@/lib/types";

type WaveData = Extract<Scene, { kind: "wave" }>;

/** Размеры панели (viewBox) и поля вокруг графика. */
export const WAVE_GEO = { w: 320, h: 124, padX: 8, padY: 10 } as const;
/** Сетку уровней рисуем только до этой глубины (2⁴ = 16 линий — предел читаемости). */
export const MAX_GRID_BITS = 4;
/** Число точек ломаной, которой рисуется «аналоговая» волна. */
export const WAVE_POINTS = 160;

/** Значение «звука» в точке x ∈ [0, 1]: сумма двух синусов (2 и 5 периодов), всегда в [-1, 1]. */
export function waveValue(x: number): number {
  return 0.7 * Math.sin(2 * Math.PI * 2 * x) + 0.3 * Math.sin(2 * Math.PI * 5 * x + 0.8);
}

/** Число уровней при глубине bits: 2^bits. */
export function levelCount(bits: number): number {
  return 2 ** bits;
}

/** Подпись «2³ = 8». */
export function levelsFormula(bits: number): string {
  return `2${superscript(bits)} = ${levelCount(bits)}`;
}

/** Рисуется ли сетка уровней. */
export function hasGrid(bits: number | undefined): bits is number {
  return bits !== undefined && bits >= 1 && bits <= MAX_GRID_BITS;
}

/** Ближайший уровень (индекс 0..2^bits − 1) для значения v ∈ [-1, 1]: сетка включает крайние значения -1 и 1. */
export function quantizeIndex(v: number, bits: number): number {
  const top = levelCount(bits) - 1;
  const idx = Math.round(((Math.max(-1, Math.min(1, v)) + 1) / 2) * top);
  return Math.max(0, Math.min(top, idx));
}

/** Значение уровня по индексу: -1 … 1. */
export function levelValue(index: number, bits: number): number {
  const top = levelCount(bits) - 1;
  return top === 0 ? 0 : -1 + (2 * index) / top;
}

/** Значение после округления к уровню (bits не задан — без округления: «только дискретизация»). */
export function quantizeValue(v: number, bits: number | undefined): number {
  return bits === undefined ? v : levelValue(quantizeIndex(v, bits), bits);
}

/** x отсчёта i из n: середины n равных долей отрезка — первый и последний не прилипают к краю. */
export function sampleX(i: number, n: number): number {
  return (i + 0.5) / n;
}

export interface WaveSample {
  i: number;
  x: number;
  /** Точка на волне. */
  y: number;
  /** Точка на уровне (после округления); без bits совпадает с y. */
  yq: number;
  /** Индекс уровня (только при заданных bits). */
  level?: number;
}

export interface WaveLayout {
  w: number;
  h: number;
  /** Ломаная «аналоговой» волны. */
  wavePath: string;
  /** Линия нуля (середина). */
  axisY: number;
  /** Горизонтальные линии сетки, сверху вниз (пусто, если сетка не рисуется). */
  grid: number[];
  samples: WaveSample[];
  /** Ступенчатая кривая (пусто, если digital выключен или отсчётов < 2). */
  stepPath: string;
  levels?: number;
}

const f = (n: number) => Math.round(n * 100) / 100;

/** Раскладка одной панели. */
export function waveLayout(o: { samples: number; bits?: number; digital?: boolean }): WaveLayout {
  const { w, h, padX, padY } = WAVE_GEO;
  const plotW = w - 2 * padX;
  const plotH = h - 2 * padY;
  const px = (x: number) => padX + x * plotW;
  const py = (v: number) => padY + ((1 - v) / 2) * plotH;

  const pts: string[] = [];
  for (let k = 0; k <= WAVE_POINTS; k++) {
    const x = k / WAVE_POINTS;
    pts.push(`${k === 0 ? "M" : "L"}${f(px(x))} ${f(py(waveValue(x)))}`);
  }

  const n = Math.max(0, Math.floor(o.samples));
  const samples: WaveSample[] = Array.from({ length: n }, (_, i) => {
    const x = sampleX(i, n);
    const v = waveValue(x);
    return {
      i,
      x: f(px(x)),
      y: f(py(v)),
      yq: f(py(quantizeValue(v, o.bits))),
      level: o.bits === undefined ? undefined : quantizeIndex(v, o.bits),
    };
  });

  const grid = hasGrid(o.bits) ? Array.from({ length: levelCount(o.bits) }, (_, k) => f(py(1 - (2 * k) / (levelCount(o.bits as number) - 1)))) : [];

  // Ступеньки: каждый отсчёт «держится» на своей доле отрезка (границы — середины между соседними отсчётами).
  let stepPath = "";
  if (o.digital && n >= 2) {
    const seg: string[] = [];
    samples.forEach((s, i) => {
      const left = px(i === 0 ? 0 : (sampleX(i - 1, n) + sampleX(i, n)) / 2);
      const right = px(i === n - 1 ? 1 : (sampleX(i, n) + sampleX(i + 1, n)) / 2);
      seg.push(i === 0 ? `M${f(left)} ${s.yq}` : `V${s.yq}`);
      seg.push(`H${f(right)}`);
    });
    stepPath = seg.join(" ");
  }

  return { w, h, wavePath: pts.join(" "), axisY: f(py(0)), grid, samples, stepPath, levels: o.bits === undefined ? undefined : levelCount(o.bits) };
}

export interface WavePanel {
  samples: number;
  bits?: number;
  digital: boolean;
  label?: Text;
}

/** Панели сцены: основная и (если есть compare) вторая под ней; digital у второй наследуется от основной. */
export function wavePanels(scene: WaveData): WavePanel[] {
  const main: WavePanel = { samples: scene.samples, bits: scene.bits, digital: !!scene.digital, label: scene.label };
  if (!scene.compare) return [main];
  return [main, { samples: scene.compare.samples, bits: scene.compare.bits ?? scene.bits, digital: !!scene.digital, label: scene.compare.label }];
}

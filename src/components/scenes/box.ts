// Чистая логика сцены box (блочная модель CSS): условные толщины слоёв, размеры, линейка итоговой ширины.
// Без React; покрыта тестами (tests/scene-box.test.ts). Пропорции условные: порядок величин виден, но 200 px не в 20 раз толще 10 px.

import type { BoxSides, Scene } from "@/lib/types";
import { estimateTextWidth } from "./text-width";

export type BoxData = Extract<Scene, { kind: "box" }>;
export type BoxLayer = "margin" | "border" | "padding" | "content";
/** Слои снаружи внутрь. */
export const BOX_LAYERS: readonly BoxLayer[] = ["margin", "border", "padding", "content"];

/** [верх, право, низ, лево]. */
export type Sides4 = [number, number, number, number];

/** Стороны как в CSS: одно число — на все четыре, иначе [верх, право, низ, лево]. Пусто — нули. */
export function sides4(x?: BoxSides): Sides4 {
  if (x === undefined) return [0, 0, 0, 0];
  return typeof x === "number" ? [x, x, x, x] : [x[0], x[1], x[2], x[3]];
}

/** Стороны текстом для описания: «20» или «10 20 10 20». */
export function formatSides(x?: BoxSides): string {
  const s = sides4(x);
  return s[0] === s[1] && s[1] === s[2] && s[2] === s[3] ? String(s[0]) : s.join(" ");
}

/** Ширина content в px: при border-box — width за вычетом padding и border (не меньше 0). */
export function contentWidth(scene: BoxData): number {
  if (!scene.borderBox) return scene.width;
  const p = sides4(scene.padding);
  const b = sides4(scene.border);
  return Math.max(0, scene.width - p[1] - p[3] - b[1] - b[3]);
}

// ---------- Раскладка ----------

/** Размер шрифта числа на стороне слоя. */
export function bandFont(layer: BoxLayer): number {
  return layer === "border" ? 10 : 11;
}

/**
 * Условная толщина полосы слоя на экране (px). Ноль — полосы нет (и подписи нет). Растёт по логарифму от значения,
 * но не меньше, чем нужно для подписи: у боковых сторон — по ширине числа, у верхней/нижней — по высоте строки.
 */
export function bandThickness(layer: BoxLayer, value: number, horizontalLabel: boolean): number {
  if (value <= 0) return 0;
  const font = bandFont(layer);
  const base = layer === "border" ? 12 + 5 * Math.log10(1 + value) : 16 + 7 * Math.log10(1 + value);
  const need = horizontalLabel ? estimateTextWidth(String(value), font) + 6 : font + 8;
  return Math.ceil(Math.max(base, need));
}

/** Толщины сторон слоя [верх, право, низ, лево]. */
export function layerBands(layer: Exclude<BoxLayer, "content">, s: Sides4): Sides4 {
  return [bandThickness(layer, s[0], false), bandThickness(layer, s[1], true), bandThickness(layer, s[2], false), bandThickness(layer, s[3], true)];
}

/** Ширина content на экране. Подобрана так, чтобы худший случай (все стороны 200) с рамками слоёв был не шире 304 px. */
export const CONTENT_W = 104;
/** Толщина рамки слоя (px): рамка занимает место (border-box), поэтому входит в размеры блока. */
export const LAYER_STROKE = { margin: 1.5, border: 2, padding: 1.5 } as const;
/** Предельная ширина блока без масштабирования (px): сцена в уроке на 360 px — 304. */
export const BOX_MAX_W = 304;
export const CONTENT_H = 44;
export const CONTENT_H_FIXED = 56;
/** Высота второго блока в режиме collapse. */
export const BLOCK2_H = 34;
/** Минимальная высота зазора между блоками: в неё помещается подпись «max(…)». */
export const GAP_MIN = 24;

export interface BoxCollapse {
  /** Нижний margin первого блока и верхний второго (px, как в сцене). */
  a: number;
  b: number;
  /** Итоговый зазор в px — больший из двух. */
  max: number;
  /** Подпись «max(10, 20) = 20 px». */
  label: string;
  /** Условные толщины: нижний margin первого, верхний второго, зазор между рамками блоков. */
  dA: number;
  dB: number;
  gapH: number;
  /** Рамка margin-слоя первого блока снизу и по бокам (0, если слой не виден). */
  mStroke: number;
  /** Отступ сверху второго блока (может быть отрицательным: его margin-полоса заходит на margin первого) и сверху подписи. */
  block2Top: number;
  labelTop: number;
}

export interface BoxGeometry {
  margin: Sides4;
  border: Sides4;
  padding: Sides4;
  contentW: number;
  contentH: number;
  /** Подпись внутри content: «200 × auto». */
  contentLabel: string;
  contentFont: number;
  /** Размеры внешнего прямоугольника (с margin). */
  outerW: number;
  outerH: number;
  /** Полная высота сцены, включая второй блок при collapse. */
  totalH: number;
  /** Слой виден (есть хотя бы одна ненулевая сторона); content — всегда. */
  visible: Record<BoxLayer, boolean>;
  /** Сторона слоя с подписью числа: у нижнего margin в режиме collapse подписи нет (числа — в формуле max). */
  labelled: Record<Exclude<BoxLayer, "content">, [boolean, boolean, boolean, boolean]>;
  collapse?: BoxCollapse;
}

const sum = (s: Sides4) => s[0] + s[1] + s[2] + s[3];

export function boxGeometry(scene: BoxData): BoxGeometry {
  const rawM = sides4(scene.margin);
  const rawB = sides4(scene.border);
  const rawP = sides4(scene.padding);
  const margin = layerBands("margin", rawM);
  const border = layerBands("border", rawB);
  const padding = layerBands("padding", rawP);
  const contentH = scene.height !== undefined ? CONTENT_H_FIXED : CONTENT_H;
  const label = `${contentWidth(scene)} × ${scene.height ?? "auto"}`;
  // Длинная подпись («2000 × 123456789») сжимается, чтобы остаться внутри content.
  const w = estimateTextWidth(label, 12);
  const contentFont = w <= CONTENT_W - 8 ? 12 : Math.max(8, Math.floor((12 * (CONTENT_W - 8)) / w));
  const visible = { margin: sum(margin) > 0, border: sum(border) > 0, padding: sum(padding) > 0, content: true };
  // рамки видимых слоёв (с двух сторон) занимают место; рамка content уже входит в CONTENT_W / contentH
  const strokes = 2 * ((visible.margin ? LAYER_STROKE.margin : 0) + (visible.border ? LAYER_STROKE.border : 0) + (visible.padding ? LAYER_STROKE.padding : 0));
  const outerW = CONTENT_W + margin[1] + margin[3] + border[1] + border[3] + padding[1] + padding[3] + strokes;
  const outerH = contentH + margin[0] + margin[2] + border[0] + border[2] + padding[0] + padding[2] + strokes;
  const labelled = {
    margin: rawM.map((v) => v > 0) as [boolean, boolean, boolean, boolean],
    border: rawB.map((v) => v > 0) as [boolean, boolean, boolean, boolean],
    padding: rawP.map((v) => v > 0) as [boolean, boolean, boolean, boolean],
  };

  let collapse: BoxCollapse | undefined;
  if (scene.collapse) {
    const a = rawM[2];
    const b = scene.collapse.top;
    const max = Math.max(a, b);
    const dA = margin[2];
    const dB = bandThickness("margin", b, false);
    const gapH = Math.max(GAP_MIN, bandThickness("margin", max, false));
    labelled.margin[2] = false;
    const mStroke = visible.margin ? LAYER_STROKE.margin : 0;
    collapse = {
      a,
      b,
      max,
      label: `max(${a}, ${b}) = ${max} px`,
      dA,
      dB,
      gapH,
      mStroke,
      // верх второго блока = нижняя граница рамки border-слоя первого + gapH
      block2Top: gapH - dA - dB - mStroke,
      labelTop: outerH - dA - mStroke + gapH / 2,
    };
  }
  const totalH = collapse ? outerH + collapse.block2Top + collapse.dB + BLOCK2_H : outerH;
  return { margin, border, padding, contentW: CONTENT_W, contentH, contentLabel: label, contentFont, outerW, outerH, totalH, visible, labelled, collapse };
}

/** Слой приглушён: задан highlight, и это другой слой. */
export function layerDim(layer: BoxLayer, highlight: BoxData["highlight"]): boolean {
  return highlight !== undefined && highlight !== layer;
}

// ---------- Линейка итоговой ширины ----------

export interface RulerTerm {
  text: string;
  /** Слой, чьим цветом рисуется число; "total" — нейтральная пилюля (итоговая ширина, не слой). */
  layer: BoxLayer | "total";
}
/** Строка линейки: [head] терм + терм + … [= total]. */
export interface RulerLine {
  head?: string;
  terms: RulerTerm[];
  total?: string;
}

/**
 * Линейка. Без borderBox: «10 + 5 + 20 + 200 + 20 + 5 + 10 = 270 px» (нулевые стороны не пишем).
 * С borderBox: «width 200 = 5 + 20 + 150 + 20 + 5», затем (если есть margin по бокам) «10 + 200 + 10 = 220 px».
 */
export function boxRuler(scene: BoxData): RulerLine[] {
  const m = sides4(scene.margin);
  const b = sides4(scene.border);
  const p = sides4(scene.padding);
  const t = (v: number, layer: BoxLayer): RulerTerm[] => (v > 0 ? [{ text: String(v), layer }] : []);
  const content: RulerTerm = { text: String(contentWidth(scene)), layer: "content" };
  if (!scene.borderBox) {
    const terms = [...t(m[3], "margin"), ...t(b[3], "border"), ...t(p[3], "padding"), content, ...t(p[1], "padding"), ...t(b[1], "border"), ...t(m[1], "margin")];
    return [{ terms, total: `${m[3] + b[3] + p[3] + scene.width + p[1] + b[1] + m[1]} px` }];
  }
  const inner = [...t(b[3], "border"), ...t(p[3], "padding"), content, ...t(p[1], "padding"), ...t(b[1], "border")];
  const lines: RulerLine[] = [{ head: `width ${scene.width} =`, terms: inner }];
  if (m[1] + m[3] > 0) {
    lines.push({ terms: [...t(m[3], "margin"), { text: String(scene.width), layer: "total" }, ...t(m[1], "margin")], total: `${m[3] + scene.width + m[1]} px` });
  }
  return lines;
}

/** Линейка одной строкой — для тестов. */
export function rulerText(lines: RulerLine[]): string {
  return lines
    .map((ln) => [ln.head, ln.terms.map((x) => x.text).join(" + "), ln.total ? `= ${ln.total}` : undefined].filter(Boolean).join(" "))
    .join("; ");
}

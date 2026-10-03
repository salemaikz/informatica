// Чистая логика сцены venn (круги Эйлера): области, геометрия, места для чисел, цвета, описание для экранного диктора.
// Без React, покрыта тестами (tests/scenes-venn.test.ts).

import type { DictKey } from "@/i18n/dict";
import type { VennRegion } from "@/lib/types";

export type VennCount = 2 | 3;

/** Области для двух множеств в порядке показа. */
export const VENN_REGIONS_2: readonly VennRegion[] = ["a", "b", "ab", "out"];
/** Области для трёх множеств в порядке показа. */
export const VENN_REGIONS_3: readonly VennRegion[] = ["a", "b", "c", "ab", "ac", "bc", "abc", "out"];

/** Допустимые области для n множеств. */
export function vennRegions(n: number): readonly VennRegion[] {
  return n >= 3 ? VENN_REGIONS_3 : VENN_REGIONS_2;
}

/** Ключ области допустим для n множеств (для двух — без c, ac, bc, abc). */
export function isVennRegion(region: string, n: number): region is VennRegion {
  return (vennRegions(n) as readonly string[]).includes(region);
}

/** Число множеств сцены, приведённое к 2 или 3 (всё, что больше двух, рисуем тремя кругами). */
export function vennCount(setsLength: number): VennCount {
  return setsLength >= 3 ? 3 : 2;
}

/** Круги, внутри которых лежит область (inside), и круги, которых она избегает (outside). Индексы: 0 = A, 1 = B, 2 = C. */
export function regionMembership(region: VennRegion, n: VennCount): { inside: number[]; outside: number[] } {
  const inside: number[] = [];
  if (region !== "out") for (const ch of region) inside.push(ch.charCodeAt(0) - 97);
  const outside: number[] = [];
  for (let i = 0; i < n; i++) if (!inside.includes(i)) outside.push(i);
  return { inside, outside };
}

// ---------- Геометрия ----------

/** Ширина рисунка (единицы viewBox). */
export const VENN_W = 360;

export interface VennCircle {
  cx: number;
  cy: number;
  r: number;
}

/** Место для числа в области: центр и «запас» — радиус наибольшего круга, помещающегося в область. */
export interface VennAnchor {
  x: number;
  y: number;
  room: number;
}

export interface VennLabel {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
}

export interface VennLayout {
  w: number;
  h: number;
  circles: VennCircle[];
  /** Рамка универсума; null — рамки нет. */
  frame: { x: number; y: number; w: number; h: number } | null;
  /** Подписи множеств (над кругами; у C — под кругом). */
  labels: VennLabel[];
  /** Подпись универсума (левый верхний угол рамки). */
  universe: { x: number; y: number };
  /** Где писать число в каждой области. */
  anchors: Record<VennRegion, VennAnchor>;
}

const FRAME_INSET = 4;
const LABEL_BAND = 26;
const UNIVERSE_BAND = 22;

/** Расстояние от точки до области: > 0 внутри области, < 0 снаружи (минимум по кругам). */
export function regionClearance(x: number, y: number, circles: VennCircle[], region: VennRegion): number {
  const { inside, outside } = regionMembership(region, circles.length as VennCount);
  let m = Infinity;
  for (const i of inside) m = Math.min(m, circles[i].r - Math.hypot(x - circles[i].cx, y - circles[i].cy));
  for (const i of outside) m = Math.min(m, Math.hypot(x - circles[i].cx, y - circles[i].cy) - circles[i].r);
  return m;
}

/** Точка с наибольшим «запасом» внутри области (перебор по сетке) — туда ставится число. */
export function bestSpot(circles: VennCircle[], region: VennRegion, step = 1): VennAnchor {
  let best: VennAnchor = { x: circles[0].cx, y: circles[0].cy, room: -Infinity };
  const xs = circles.map((c) => [c.cx - c.r, c.cx + c.r]).flat();
  const ys = circles.map((c) => [c.cy - c.r, c.cy + c.r]).flat();
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  for (let y = y0; y <= y1; y += step) {
    for (let x = x0; x <= x1; x += step) {
      const room = regionClearance(x, y, circles, region);
      if (room > best.room + 1e-9) best = { x, y, room };
    }
  }
  return best;
}

const cache = new Map<string, VennLayout>();

/**
 * Раскладка кругов. Для двух множеств круги по горизонтали, для трёх — треугольником (A слева-сверху, B справа-сверху, C снизу).
 * framed — рисовать рамку универсума: сверху остаётся полоса под подпись «U», число «вне кругов» — в правом нижнем углу.
 */
export function vennLayout(n: VennCount, framed: boolean): VennLayout {
  const key = `${n}:${framed ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const r = n === 2 ? 80 : 74;
  const d = n === 2 ? 96 : 82;
  const top = framed ? UNIVERSE_BAND : 0;
  const cy = top + LABEL_BAND + r;
  const cx = VENN_W / 2;
  const circles: VennCircle[] =
    n === 2
      ? [
          { cx: cx - d / 2, cy, r },
          { cx: cx + d / 2, cy, r },
        ]
      : [
          { cx: cx - d / 2, cy, r },
          { cx: cx + d / 2, cy, r },
          { cx, cy: cy + (d * Math.sqrt(3)) / 2, r },
        ];
  const bottom = Math.max(...circles.map((c) => c.cy + c.r));
  const h = Math.round(bottom + (n === 3 ? 26 : 8) + (framed ? 10 : 0));
  const labelY = cy - r - 10;
  const labels: VennLabel[] = [
    { x: circles[0].cx - r, y: labelY, anchor: "start" },
    { x: circles[1].cx + r, y: labelY, anchor: "end" },
  ];
  if (n === 3) labels.push({ x: circles[2].cx, y: Math.round(circles[2].cy + r + 20), anchor: "middle" });

  const anchors = {} as Record<VennRegion, VennAnchor>;
  for (const region of vennRegions(n)) {
    if (region === "out") continue;
    anchors[region] = bestSpot(circles, region);
  }
  // Вне кругов — правый нижний угол рамки.
  const ox = VENN_W - FRAME_INSET - 22;
  const oy = h - FRAME_INSET - 18;
  anchors.out = { x: ox, y: oy, room: Math.min(regionClearance(ox, oy, circles, "out"), 22) };
  // Для двух множеств c, ac, bc, abc не нужны, но объект полный — чтобы индексация не давала undefined.
  for (const region of VENN_REGIONS_3) anchors[region] ??= { x: cx, y: cy, room: 0 };

  const layout: VennLayout = {
    w: VENN_W,
    h,
    circles,
    frame: framed ? { x: FRAME_INSET, y: FRAME_INSET, w: VENN_W - 2 * FRAME_INSET, h: h - 2 * FRAME_INSET } : null,
    labels,
    universe: { x: FRAME_INSET + 10, y: FRAME_INSET + 15 },
    anchors,
  };
  cache.set(key, layout);
  return layout;
}

/** Путь «всё, кроме круга» для clipPath с clip-rule="evenodd": рамка рисунка плюс круг. */
export function outsideClipPath(c: VennCircle, w: number, h: number): string {
  return `M0 0H${w}V${h}H0Z M${c.cx - c.r} ${c.cy}a${c.r} ${c.r} 0 1 0 ${2 * c.r} 0a${c.r} ${c.r} 0 1 0 ${-2 * c.r} 0Z`;
}

// ---------- Шрифты ----------

/** Размер числа в области: крупно, но чтобы строка влезла в запас (диаметр 2·room); не меньше 11. */
export function valueFontSize(len: number, room: number): number {
  const fit = Math.floor((2 * room * 0.92) / (Math.max(len, 1) * 0.62));
  return Math.max(11, Math.min(20, fit));
}

/** Размер подписи множества: чем длиннее название, тем мельче (чтобы подписи A и B не наезжали); не меньше 12. */
export function labelFontSize(len: number): number {
  return len <= 7 ? 16 : len <= 10 ? 14 : 12;
}

/** Самое длинное название множества, которое помещается у круга (проверяет tests/validate.ts). */
export const VENN_NAME_MAX = 13;

// ---------- Цвета ----------

/** Цвет круга/подписи: A — primary, B — warning, C — ai (токены, обе темы). */
export const VENN_SET_COLORS = ["var(--primary)", "var(--warning)", "var(--ai)"] as const;

/** Цвет заливки области (токены; смеси — color-mix). Пересечение A и B — зелёное success, как в уроке. */
export function regionColor(region: VennRegion): string {
  switch (region) {
    case "a":
      return VENN_SET_COLORS[0];
    case "b":
      return VENN_SET_COLORS[1];
    case "c":
      return VENN_SET_COLORS[2];
    case "ab":
      return "var(--success)";
    case "ac":
      return "color-mix(in srgb, var(--primary) 50%, var(--ai))";
    case "bc":
      return "color-mix(in srgb, var(--warning) 50%, var(--ai))";
    case "abc":
      return "color-mix(in srgb, var(--success) 50%, var(--ai))";
    case "out":
      return "var(--muted)";
  }
}

/** Прозрачность заливки: выделенная область — сильнее; когда что-то выделено, остальные бледнее; «вне кругов» без выделения не заливается. */
export function regionOpacity(region: VennRegion, highlighted: boolean, anyHighlight: boolean): number {
  if (highlighted) return 0.45;
  if (region === "out") return 0;
  return anyHighlight ? 0.12 : 0.2;
}

// ---------- Описание для экранного диктора ----------

type Tr = (key: DictKey, params?: Record<string, string | number>) => string;

/** Название области словами: «только A», «A и B (пересечение)», «A и C, без B»… names — названия множеств (уже на нужном языке). */
export function regionName(region: VennRegion, names: string[], t: Tr): string {
  const n = vennCount(names.length);
  const [a, b, c] = [names[0] ?? "A", names[1] ?? "B", names[2] ?? "C"];
  switch (region) {
    case "a":
      return t("scene.venn.only", { x: a });
    case "b":
      return t("scene.venn.only", { x: b });
    case "c":
      return t("scene.venn.only", { x: c });
    case "ab":
      return n === 2 ? t("scene.venn.and2", { a, b }) : t("scene.venn.and3", { a, b, c });
    case "ac":
      return t("scene.venn.and3", { a, b: c, c: b });
    case "bc":
      return t("scene.venn.and3", { a: b, b: c, c: a });
    case "abc":
      return t("scene.venn.all3", { a, b, c });
    case "out":
      return n === 2 ? t("scene.venn.out2", { a, b }) : t("scene.venn.out3", { a, b, c });
  }
}

/**
 * Текст для aria-label: названия множеств, универсум, значения в областях и выделенные области.
 * Области берутся в порядке показа, лишние/недопустимые ключи пропускаются.
 */
export function vennAria(
  args: { names: string[]; values?: Partial<Record<VennRegion, string>>; highlight?: VennRegion[]; universe?: string },
  t: Tr,
): string {
  const n = vennCount(args.names.length);
  const order = vennRegions(n);
  const parts = [t("scene.venn.aria", { sets: args.names.join(", ") })];
  if (args.universe) parts.push(t("scene.venn.universe", { name: args.universe }));
  const vals = order.filter((r) => args.values?.[r] !== undefined && args.values[r] !== "");
  if (vals.length) parts.push(t("scene.venn.values", { list: vals.map((r) => `${regionName(r, args.names, t)}: ${args.values?.[r]}`).join("; ") }));
  const hl = order.filter((r) => args.highlight?.includes(r));
  if (hl.length) parts.push(t("scene.venn.highlight", { list: hl.map((r) => regionName(r, args.names, t)).join("; ") }));
  return parts.join(" ");
}

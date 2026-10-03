import type { L, PcPart } from "@/lib/types";
import { HARDWARE_NAMES } from "./hardware/names";

// Сцена «системный блок изнутри»: чистая логика без React — названия, точки выносок, раскладка подписей.

/** Все детали схемы в порядке рисования (снизу вверх по слоям). */
export const PC_PARTS = ["ports", "motherboard", "cpu", "cooler", "ram", "gpu", "psu", "ssd", "hdd", "fans"] as const satisfies readonly PcPart[];

/**
 * Названия деталей, которых нет среди рисунков сцены hardware (ru + kk).
 * Исключение из правила «строки — в src/i18n/dict.ts», как и hardware/names.ts: тексты сцены живут рядом с ней,
 * чтобы сцена разрабатывалась независимо. TODO: прогнать через npm run review:kk (нет ключа в среде исполнителя).
 */
export const PC_EXTRA_NAMES: Record<"fans" | "ports", L> = {
  fans: { ru: "Вентиляторы", kk: "Желдеткіштер" },
  ports: { ru: "Порты", kk: "Порттар" },
};

/** Подписи для чтеца экрана. */
export const PC_INSIDE_TEXT = {
  title: { ru: "Системный блок изнутри", kk: "Жүйелік блоктың іші" },
  highlighted: { ru: "Выделено", kk: "Белгіленген бөліктер" },
} satisfies Record<string, L>;

export function pcPartName(part: PcPart): L {
  return part === "fans" || part === "ports" ? PC_EXTRA_NAMES[part] : HARDWARE_NAMES[part];
}

/** Геометрия сцены: корпус рисуется в своих координатах (CASE_W × CASE_H) и масштабируется в середину. */
export const PC_GEO = {
  /** Ширина и высота всей сцены с подписями. */
  vw: 324,
  vh: 216,
  /** Корпус: размер в своих координатах, позиция и масштаб в сцене. */
  caseW: 150,
  caseH: 236,
  caseX: 98,
  caseY: 7,
  scale: 128 / 150,
  /** Край колонки подписей слева (текст прижат вправо) и справа (текст прижат влево). */
  leftEdge: 92,
  rightEdge: 232,
  /** Текст подписей. */
  fontSize: 11.5,
  lineH: 13,
  /** Минимальный зазор между блоками подписей. */
  gap: 6,
  /** Ширина колонки подписей. */
  colW: 92,
  /** Сколько символов в строке: самое длинное слово «Салқындатқыш» (12) в Nunito 800 занимает ≈ 91 из 92. */
  maxChars: 12,
  /** Границы колонки подписей по вертикали. */
  top: 2,
  bottom: 214,
} as const;

export type Side = "left" | "right";

/** Радиатор кулера (координаты корпуса). Он короче процессора: нижний край процессора с контактами виден под ним. */
export const PC_COOLER_BOX = { x: 40, y: 19, w: 42, h: 29 } as const;

/** Процессор (координаты корпуса). */
export const PC_CPU_BOX = { x: 44, y: 24, w: 34, h: 34 } as const;

/** Точка выноски на детали (в координатах корпуса) и сторона подписи. */
export const PC_ANCHORS: Record<PcPart, { x: number; y: number; side: Side }> = {
  cooler: { x: 44, y: 24, side: "left" },
  cpu: { x: 52, y: 52, side: "left" },
  ports: { x: 16, y: 66, side: "left" },
  gpu: { x: 30, y: 108, side: "left" },
  motherboard: { x: 60, y: 146, side: "left" },
  psu: { x: 18, y: 204, side: "left" },
  fans: { x: 131, y: 30, side: "right" },
  ram: { x: 101, y: 74, side: "right" },
  ssd: { x: 132, y: 104, side: "right" },
  hdd: { x: 127, y: 190, side: "right" },
};

/** Точка корпуса → координаты сцены. */
export function toScene(x: number, y: number): { x: number; y: number } {
  const g = PC_GEO;
  return { x: +(g.caseX + x * g.scale).toFixed(2), y: +(g.caseY + y * g.scale).toFixed(2) };
}

/** Перенос подписи по словам (и после дефиса) в строки не длиннее maxChars; слишком длинное слово не режется. */
export function wrapLabel(text: string, maxChars: number = PC_GEO.maxChars): string[] {
  const words = text
    .trim()
    .split(/\s+/)
    .flatMap((w) => (w.length > maxChars && w.includes("-") ? w.split(/(?<=-)/) : [w]));
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    const glue = last !== undefined && !last.endsWith("-") ? " " : "";
    if (last !== undefined && (last + glue + w).length <= maxChars) lines[lines.length - 1] = last + glue + w;
    else lines.push(w);
  }
  return lines;
}

export interface Callout {
  part: PcPart;
  side: Side;
  lines: string[];
  /** Точка на детали (координаты сцены). */
  anchor: { x: number; y: number };
  /** Верх блока подписи и его высота. */
  top: number;
  height: number;
}

/**
 * Раскладка подписей по колонкам слева и справа: каждая подпись — напротив своей детали,
 * при наложении соседние раздвигаются вниз, а если не помещаются — сдвигаются вверх.
 */
export function layoutCallouts(names: Record<PcPart, string>, parts: readonly PcPart[] = PC_PARTS): Callout[] {
  const g = PC_GEO;
  const out: Callout[] = [];
  for (const side of ["left", "right"] as const) {
    const items = parts
      .filter((p) => PC_ANCHORS[p].side === side)
      .map((part) => {
        const a = PC_ANCHORS[part];
        const lines = wrapLabel(names[part]);
        const height = lines.length * g.lineH;
        const anchor = toScene(a.x, a.y);
        return { part, side, lines, anchor, height, top: anchor.y - height / 2 };
      })
      .sort((a, b) => a.anchor.y - b.anchor.y);
    // Сверху вниз: не выше границы и не налезая на предыдущую.
    let floor = g.top;
    for (const it of items) {
      it.top = Math.max(it.top, floor);
      floor = it.top + it.height + g.gap;
    }
    // Снизу вверх: не ниже границы и не налезая на следующую.
    let ceil = g.bottom;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.top = Math.min(it.top, ceil - it.height);
      ceil = it.top - g.gap;
    }
    for (const it of items) out.push({ ...it, top: +it.top.toFixed(2) });
  }
  return out;
}

/** Текст для aria-label: что на рисунке и что выделено. */
export function pcInsideAria(name: (part: PcPart) => string, title: string, highlightedWord: string, highlight: readonly PcPart[]): string {
  const all = `${title}: ${PC_PARTS.map(name).join(", ")}.`;
  return highlight.length ? `${all} ${highlightedWord}: ${highlight.map(name).join(", ")}.` : all;
}

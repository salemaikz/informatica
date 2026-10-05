// Геометрия для рисунков украшений профиля (SVG): чистые функции без React, детерминированные
// (никакого Math.random: сервер и клиент рисуют одно и то же). Тесты — tests/cosmetics.test.ts.

/** Округление до сотых: короткие строки путей, одинаковые на сервере и в браузере. */
export const round = (n: number): number => Math.round(n * 100) / 100;

/** Точка на окружности: 0° — вверху, дальше по часовой стрелке. */
export function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: round(cx + r * Math.cos(a)), y: round(cy + r * Math.sin(a)) };
}

/** Дуга по часовой стрелке от угла `from` до угла `to` (градусы, 0° — вверху); to − from ≤ 360. */
export function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const sweep = Math.min(359.99, Math.max(0, to - from));
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, from + sweep);
  return `M${a.x} ${a.y}A${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${b.x} ${b.y}`;
}

/** Волнистое кольцо: радиус r + amp·sin(waves·θ + phase), замкнутый путь по `steps` точкам. */
export function wavyRingPath(cx: number, cy: number, r: number, amp: number, waves: number, phase = 0, steps = 144): string {
  const pts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const th = (i / steps) * Math.PI * 2;
    const rr = r + amp * Math.sin(waves * th + phase);
    pts.push(`${round(cx + rr * Math.sin(th))} ${round(cy - rr * Math.cos(th))}`);
  }
  return `M${pts.join("L")}Z`;
}

export interface PixelCell {
  x: number;
  y: number;
  /** Шахматный оттенок: вторая «краска» клетки. */
  alt: boolean;
}

/** Клетки сетки (шаг `cell`) на поле size×size, центр которых лежит в кольце [rIn, rOut] вокруг середины поля. */
export function pixelRing(cell: number, size: number, rIn: number, rOut: number): PixelCell[] {
  const mid = size / 2;
  const n = Math.ceil(size / cell);
  const out: PixelCell[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const dx = i * cell + cell / 2 - mid;
      const dy = j * cell + cell / 2 - mid;
      const d = Math.hypot(dx, dy);
      if (d >= rIn && d <= rOut) out.push({ x: i * cell, y: j * cell, alt: (i + j) % 2 === 1 });
    }
  }
  return out;
}

/** Четырёхконечная звёздочка радиуса r с центром (x, y). */
export function starPath(x: number, y: number, r: number): string {
  const k = r * 0.3;
  const p = (dx: number, dy: number) => `${round(x + dx)} ${round(y + dy)}`;
  return `M${p(0, -r)}L${p(k, -k)}L${p(r, 0)}L${p(k, k)}L${p(0, r)}L${p(-k, k)}L${p(-r, 0)}L${p(-k, -k)}Z`;
}

/** Линии тетрадной клетки на поле w×h с шагом step (внутренние линии, без границ). */
export function gridPath(w: number, h: number, step: number): string {
  const d: string[] = [];
  for (let x = step; x < w; x += step) d.push(`M${x} 0V${h}`);
  for (let y = step; y < h; y += step) d.push(`M0 ${y}H${w}`);
  return d.join("");
}

/**
 * Закрашиваемая «волна» от верхней кромки y(x) = y0 + amp·sin(2πx/length + phase) до низа поля h.
 * Рисуется с запасом `bleed` по бокам, чтобы при сдвиге вбок (анимация) не открывался край.
 */
export function wavePath(w: number, h: number, y0: number, amp: number, length: number, phase = 0, step = 8, bleed = 24): string {
  const pts: string[] = [];
  for (let x = -bleed; x <= w + bleed; x += step) pts.push(`${x} ${round(y0 + amp * Math.sin((x / length) * Math.PI * 2 + phase))}`);
  return `M${pts.join("L")}L${w + bleed} ${h}L${-bleed} ${h}Z`;
}

/** Клин «луча»: из точки (cx, cy) на длину r между углами from и to (0° — вверх). */
export function rayPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  return `M${cx} ${cy}L${a.x} ${a.y}L${b.x} ${b.y}Z`;
}

/** Детерминированный ГПСЧ (mulberry32): тот же, что в lib/text.ts, но без зависимости от неё. */
export function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Строка из n нулей и единиц (детерминированно по seed). */
export function bitString(n: number, seed: number): string {
  const r = rng(seed);
  let s = "";
  for (let i = 0; i < n; i++) s += r() < 0.5 ? "0" : "1";
  return s;
}

export interface Star {
  x: number;
  y: number;
  r: number;
  /** Прозрачность 0.3..1. */
  o: number;
  /** Задержка мерцания, с (0..3). */
  delay: number;
}

/** Звёзды: на кольце [rIn, rOut] вокруг (cx, cy) при ring = true, иначе по прямоугольнику w×h. */
export function scatterStars(count: number, seed: number, area: { w: number; h: number } | { cx: number; cy: number; rIn: number; rOut: number }, size: [number, number] = [0.7, 1.6]): Star[] {
  const r = rng(seed);
  const out: Star[] = [];
  for (let i = 0; i < count; i++) {
    let x: number;
    let y: number;
    if ("w" in area) {
      x = r() * area.w;
      y = r() * area.h;
    } else {
      const deg = r() * 360;
      const rad = area.rIn + r() * (area.rOut - area.rIn);
      ({ x, y } = polar(area.cx, area.cy, rad, deg));
    }
    out.push({ x: round(x), y: round(y), r: round(size[0] + r() * (size[1] - size[0])), o: round(0.3 + r() * 0.7), delay: round(r() * 3) });
  }
  return out;
}

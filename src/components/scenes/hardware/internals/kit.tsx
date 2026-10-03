import type { ReactNode } from "react";

// Общие детали рисунков деталей ПК и носителей: холст 120×90, палитра из токенов темы.
// Стиль совпадает с рисунками устройств (hardware/devices/kit.tsx): плоско, 2–3 оттенка, мягкая тень.
// Тёмный пластик и плата смешиваются с постоянным тёмным цветом, чтобы оставаться тёмными в обеих темах.

export const mix = (a: string, pct: number, b: string) => `color-mix(in srgb, ${a} ${pct}%, ${b})`;

export const C = {
  /** Светлый пластик / корпус. */
  shell1: mix("var(--muted)", 16, "var(--surface)"),
  shell2: mix("var(--muted)", 34, "var(--surface)"),
  shell3: mix("var(--muted)", 58, "var(--surface)"),
  /** Тёмный пластик и его тень. */
  dark: mix("var(--muted)", 34, "#121722"),
  dark2: mix("var(--muted)", 14, "#0b0f17"),
  /** Металл (алюминий, сталь): светлый, полутень, тень. */
  metal1: mix("var(--muted)", 10, "#f4f6fa"),
  metal2: mix("var(--muted)", 32, "#e4e8f0"),
  metal3: mix("var(--muted)", 62, "#c9cfdb"),
  /** Печатная плата (зелёный текстолит) и дорожки. */
  pcb: mix("var(--success-strong)", 62, "#0f2b20"),
  pcb2: mix("var(--success-strong)", 82, "#1d4a36"),
  pcbLine: mix("var(--success)", 55, "#bfe9d3"),
  /** Микросхема. */
  chip: mix("var(--muted)", 18, "#10141c"),
  chipTop: mix("var(--muted)", 30, "#1a202b"),
  /** Позолоченные контакты, медь. */
  gold: mix("var(--gold)", 78, "#b07a10"),
  copper: mix("var(--streak)", 55, "#a5582a"),
  /** Наклейка/бумага. */
  paper: mix("var(--muted)", 6, "#ffffff"),
  primary: "var(--primary)",
  primaryStrong: "var(--primary-strong)",
  primarySoft: "var(--primary-soft)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  ai: "var(--ai)",
} as const;

/** Блик — нейтральный полупрозрачный (работает на любом фоне). */
export const GLOSS = { fill: "#ffffff", fillOpacity: 0.22 } as const;

/** Холст рисунка. Подпись даёт сама сцена (role="img" + aria-label), поэтому рисунок скрыт от чтеца. */
export function Art({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 120 90" className="block h-auto w-full" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** Мягкая тень под предметом. */
export function Shadow({ cx = 60, cy = 82, rx = 44, ry = 4 }: { cx?: number; cy?: number; rx?: number; ry?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#000000" fillOpacity={0.13} />;
}

const r2 = (n: number) => +n.toFixed(2);

/** Кольцо (диск с отверстием) как path с fillRule="evenodd": отверстие прозрачное на любом фоне. */
export function ring(cx: number, cy: number, outer: number, inner: number): string {
  const circle = (r: number) => `M${r2(cx - r)} ${cy} a${r} ${r} 0 1 0 ${r2(2 * r)} 0 a${r} ${r} 0 1 0 ${r2(-2 * r)} 0 Z`;
  return circle(outer) + " " + circle(inner);
}

/** Вентилятор анфас: рамка, круг, лопасти, ступица. */
export function Fan({ cx, cy, size, frame = C.dark, hole = C.dark2, blade = C.shell3, hub = C.shell2, blades = 7 }: {
  cx: number;
  cy: number;
  size: number;
  frame?: string;
  hole?: string;
  blade?: string;
  hub?: string;
  blades?: number;
}) {
  const h = size / 2;
  const r = h * 0.9;
  const paths: ReactNode[] = [];
  for (let i = 0; i < blades; i++) {
    const a = (i * 2 * Math.PI) / blades;
    const p = (ang: number, rad: number) => `${r2(cx + rad * Math.cos(ang))} ${r2(cy + rad * Math.sin(ang))}`;
    // Лопасть: от ступицы к краю, изогнутая.
    const d = `M${p(a, r * 0.3)} Q${p(a + 0.5, r * 0.75)} ${p(a + 0.3, r * 0.94)} L${p(a - 0.18, r * 0.94)} Q${p(a - 0.05, r * 0.6)} ${p(a - 0.35, r * 0.3)} Z`;
    paths.push(<path key={i} d={d} fill={blade} />);
  }
  return (
    <g>
      <rect x={r2(cx - h)} y={r2(cy - h)} width={size} height={size} rx={r2(size * 0.12)} fill={frame} />
      <circle cx={cx} cy={cy} r={r2(r)} fill={hole} />
      {paths}
      <circle cx={cx} cy={cy} r={r2(r * 0.3)} fill={hub} />
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sy], i) => (
        <circle key={i} cx={r2(cx + sx * h * 0.8)} cy={r2(cy + sy * h * 0.8)} r={r2(size * 0.04)} fill={hole} />
      ))}
    </g>
  );
}

/** Ряд одинаковых полосок (рёбра радиатора, контакты, щели). */
export function Stripes({ x, y, n, w, h, step, fill, vertical = true }: {
  x: number;
  y: number;
  n: number;
  w: number;
  h: number;
  step: number;
  fill: string;
  vertical?: boolean;
}) {
  return (
    <g fill={fill}>
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x={vertical ? r2(x + i * step) : x} y={vertical ? y : r2(y + i * step)} width={w} height={h} />
      ))}
    </g>
  );
}

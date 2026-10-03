import type { ReactNode } from "react";

// Общие детали рисунков устройств: холст 120×90, палитра из токенов темы.
// Плоский «учебниковый» стиль: 2–3 оттенка на предмет, мягкая тень снизу, без градиентов (id не конфликтуют).

const mix = (a: string, pct: number, b: string) => `color-mix(in srgb, ${a} ${pct}%, ${b})`;

/** Палитра. Светлый/серый пластик строится от --muted и --surface, поэтому сам подстраивается под тему. */
export const C = {
  /** Светлый пластик / корпус. */
  shell1: mix("var(--muted)", 16, "var(--surface)"),
  /** Пластик в полутени. */
  shell2: mix("var(--muted)", 34, "var(--surface)"),
  /** Пластик в тени, рёбра. */
  shell3: mix("var(--muted)", 58, "var(--surface)"),
  /** Тёмный пластик (рамки экранов, кнопки) — тёмный в обеих темах. */
  dark: mix("var(--muted)", 34, "#121722"),
  /** Ещё темнее: глубина, отверстия, щели. */
  dark2: mix("var(--muted)", 14, "#0b0f17"),
  /** Выключенное стекло экрана. */
  glass: mix("var(--primary-strong)", 26, "#0a111d"),
  /** Включённый экран: фон и детали интерфейса. */
  lit: mix("var(--primary)", 22, "var(--surface)"),
  litDeep: mix("var(--primary)", 55, "var(--surface)"),
  /** Бумага. */
  paper: mix("var(--muted)", 4, "#ffffff"),
  paperLine: mix("var(--muted)", 45, "#ffffff"),
  /** Кожа (палец). */
  skin: mix("var(--warning)", 22, "#efc9ae"),
  skinShade: mix("var(--warning-strong)", 30, "#d9a685"),
  primary: "var(--primary)",
  primaryStrong: "var(--primary-strong)",
  primarySoft: "var(--primary-soft)",
  success: "var(--success)",
  danger: "var(--danger)",
  warning: "var(--warning)",
  gold: "var(--gold)",
  ai: "var(--ai)",
  streak: "var(--streak)",
} as const;

/** Блик и тень — нейтральные полупрозрачные (работают на любом фоне). */
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

/** Дуги «волн» (звук, Wi‑Fi): центр, направление в градусах, радиусы. */
export function Waves({ cx, cy, dir, radii, spread = 40, color = C.primary, width = 2.2 }: {
  cx: number;
  cy: number;
  dir: number;
  radii: number[];
  spread?: number;
  color?: string;
  width?: number;
}) {
  const rad = (d: number) => (d * Math.PI) / 180;
  return (
    <g fill="none" stroke={color} strokeWidth={width} strokeLinecap="round">
      {radii.map((r, i) => {
        const a1 = rad(dir - spread);
        const a2 = rad(dir + spread);
        const x1 = +(cx + r * Math.cos(a1)).toFixed(2);
        const y1 = +(cy + r * Math.sin(a1)).toFixed(2);
        const x2 = +(cx + r * Math.cos(a2)).toFixed(2);
        const y2 = +(cy + r * Math.sin(a2)).toFixed(2);
        return <path key={i} d={`M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`} opacity={1 - i * 0.22} />;
      })}
    </g>
  );
}

/** Сетка одинаковых прямоугольников (клавиши, кнопки, иконки). */
export function Grid({ x, y, cols, rows, w, h, gx, gy, rx = 1, fill, colors }: {
  x: number;
  y: number;
  cols: number;
  rows: number;
  w: number;
  h: number;
  gx: number;
  gy: number;
  rx?: number;
  fill?: string;
  colors?: string[];
}) {
  const cells: ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      cells.push(
        <rect
          key={i}
          x={+(x + c * (w + gx)).toFixed(2)}
          y={+(y + r * (h + gy)).toFixed(2)}
          width={w}
          height={h}
          rx={rx}
          fill={colors ? colors[i % colors.length] : fill}
        />,
      );
    }
  }
  return <g>{cells}</g>;
}

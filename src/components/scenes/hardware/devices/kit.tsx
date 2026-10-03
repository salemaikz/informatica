import type { ReactNode } from "react";

// Общие детали рисунков устройств: холст 120×90, палитра из токенов темы.
// Плоский «учебниковый» стиль: 2–3 оттенка на предмет, мягкая тень снизу, без градиентов (id не конфликтуют).

const mix = (a: string, pct: number, b: string) => `color-mix(in srgb, ${a} ${pct}%, ${b})`;

/**
 * Тон, зависящий от темы: `light-dark()` берёт значение по `color-scheme`, который задаёт globals.css
 * в каждом блоке темы. Если в globals.css появится токен `--<name>`, он важнее (fallback не нужен).
 */
const tone = (name: string, light: string, dark: string) => `var(--${name}, light-dark(${light}, ${dark}))`;

/**
 * Палитра — только из токенов темы, без своих hex.
 * Порядок оттенков пластика одинаков в обеих темах: shell1 светлее shell2 светлее shell3
 * (shell3 — тень/нижние грани), dark/dark2 темнее любого shell; в тёмной теме dark чуть светлее карточки,
 * чтобы рамки не терялись на фоне.
 */
export const C = {
  /** Светлый пластик / корпус. */
  shell1: tone("device-shell-1", mix("var(--muted)", 16, "var(--surface)"), mix("var(--muted)", 52, "var(--surface)")),
  /** Пластик в полутени. */
  shell2: tone("device-shell-2", mix("var(--muted)", 34, "var(--surface)"), mix("var(--muted)", 40, "var(--surface)")),
  /** Пластик в тени, рёбра, нижние грани. */
  shell3: tone("device-shell-3", mix("var(--muted)", 58, "var(--surface)"), mix("var(--muted)", 28, "var(--surface)")),
  /** Тёмный пластик (рамки экранов, кнопки) — тёмный в обеих темах. */
  dark: tone("device-dark", mix("var(--muted)", 30, "var(--text)"), mix("var(--muted)", 12, "var(--surface)")),
  /** Ещё темнее: глубина, отверстия, щели. */
  dark2: tone("device-dark-2", mix("var(--muted)", 10, "var(--text)"), mix("var(--muted)", 3, "var(--bg)")),
  /** Выключенное стекло экрана. */
  glass: tone("device-glass", mix("var(--primary-strong)", 26, "var(--text)"), mix("var(--primary-strong)", 26, "var(--bg)")),
  /** Включённый экран: фон и детали интерфейса. */
  lit: mix("var(--primary)", 22, "var(--surface)"),
  litDeep: mix("var(--primary)", 55, "var(--surface)"),
  /** Бумага (в тёмной теме — чуть приглушённая) и линии/контур на ней. */
  paper: tone("paper", "var(--surface)", mix("var(--text)", 88, "var(--surface)")),
  paperLine: tone("paper-line", mix("var(--muted)", 45, "var(--surface)"), "var(--muted)"),
  /** Кожа (палец): тёплый оттенок из warning/danger на светлой основе. */
  skin: tone(
    "skin",
    mix("var(--warning)", 28, mix("var(--danger)", 12, "var(--surface)")),
    mix("var(--warning)", 28, mix("var(--danger)", 12, "var(--text)")),
  ),
  skinShade: tone(
    "skin-shade",
    mix("var(--warning-strong)", 40, mix("var(--danger)", 15, "var(--surface)")),
    mix("var(--warning-strong)", 40, mix("var(--danger)", 15, "var(--text)")),
  ),
  /** Блик (почти белый) и тень (почти чёрная) — всегда с прозрачностью. */
  gloss: tone("art-gloss", "var(--surface)", "var(--text)"),
  shade: tone("art-shadow", "var(--text)", "var(--bg)"),
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

/** Блик — полупрозрачный светлый (работает на любом фоне). */
export const GLOSS = { fill: C.gloss, fillOpacity: 0.22 } as const;

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
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={C.shade} fillOpacity={0.13} />;
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

/** Рабочий стол на экране (обои, окна, панель задач) — вписывается в прямоугольник x,y,w,h. */
export function DesktopUI({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${+(w / 100).toFixed(4)} ${+(h / 60).toFixed(4)})`}>
      <rect width="100" height="60" fill={C.lit} />
      <circle cx="84" cy="12" r="5" fill={C.gold} />
      <path d="M0 46 Q25 33 50 43 T100 38 V60 H0 Z" fill={C.success} fillOpacity={0.45} />
      <rect x="8" y="7" width="48" height="32" rx="2.5" fill="var(--surface)" />
      <path d="M8 13 V9.5 A2.5 2.5 0 0 1 10.5 7 H53.5 A2.5 2.5 0 0 1 56 9.5 V13 Z" fill={C.primary} />
      <rect x="12" y="17" width="30" height="2.6" rx="1.3" fill={C.shell2} />
      <rect x="12" y="22" width="38" height="2.6" rx="1.3" fill={C.shell2} />
      <rect x="12" y="27" width="22" height="2.6" rx="1.3" fill={C.shell2} />
      <rect x="38" y="27" width="14" height="9" rx="1.5" fill={C.primarySoft} />
      <rect x="52" y="20" width="38" height="28" rx="2.5" fill="var(--surface)" />
      <path d="M52 26 V22.5 A2.5 2.5 0 0 1 54.5 20 H87.5 A2.5 2.5 0 0 1 90 22.5 V26 Z" fill={C.ai} />
      <rect x="58" y="36" width="5" height="8" rx="1" fill={C.success} />
      <rect x="66" y="31" width="5" height="13" rx="1" fill={C.primary} />
      <rect x="74" y="34" width="5" height="10" rx="1" fill={C.warning} />
      <rect x="0" y="53" width="100" height="7" fill={C.dark} fillOpacity={0.9} />
      <rect x="3" y="54.5" width="4" height="4" rx="1" fill={C.primary} />
      <rect x="10" y="55" width="8" height="3" rx="1" fill={C.shell3} />
      <rect x="21" y="55" width="8" height="3" rx="1" fill={C.shell3} />
    </g>
  );
}

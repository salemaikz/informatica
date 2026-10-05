// Мелкие чистые помощники экранов прогресса: время, дата, цвет по доле, мини-график. Без React.
// Тесты — tests/progress-ui.test.ts.

import type { DictKey } from "@/i18n/dict";

export type Translate = (key: DictKey, params?: Record<string, string | number>) => string;
export type Tone = "success" | "warning" | "danger";

/** Доля 0..1 → целые проценты 0..100 (мусор — 0). */
export const percent = (x: number): number => (Number.isFinite(x) ? Math.round(Math.max(0, Math.min(1, x)) * 100) : 0);

/** Цвет по доле (как точность в итогах): зелёный ≥ 80%, янтарный 50–79%, красный < 50%. */
export function toneOfRatio(x: number): Tone {
  if (!(x >= 0.5)) return "danger";
  return x >= 0.8 ? "success" : "warning";
}

/** Цвет полосы освоения по уровню — как на «Карте ЕНТ» и в итогах урока (новый — нейтральный). */
export const LEVEL_COLOR = { new: "var(--border)", none: "var(--border)", weak: "var(--danger)", progress: "var(--warning)", mastered: "var(--success)" } as const;

export const TONE_TEXT: Record<Tone, string> = {
  success: "text-success-strong",
  warning: "text-warning-strong",
  danger: "text-danger",
};

/** Время: «0 мин», «<1 мин», «25 мин», «2 ч 5 мин». */
export function formatDuration(sec: number, t: Translate): string {
  const s = Math.max(0, Math.round(Number.isFinite(sec) ? sec : 0));
  const min = t("progress.time.min");
  if (s === 0) return `0 ${min}`;
  if (s < 60) return `<1 ${min}`;
  const total = Math.round(s / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h} ${t("progress.time.hour")} ${m} ${min}` : `${total} ${min}`;
}

/** «ГГГГ-ММ-ДД» → «ДД.ММ.ГГГГ» (без падежных окончаний: работает и по-русски, и по-казахски). */
export function formatDate(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

export interface SparkGeometry {
  /** Ломаная через все точки с данными (дни без заданий пропускаются). Пусто, если точек меньше двух. */
  d: string;
  /** Одиночная точка (когда данных ровно на один день). */
  dots: { x: number; y: number }[];
  /** Сколько дней с данными. */
  count: number;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Геометрия мини-графика точности в координатах viewBox: x — день, y — точность (сверху — 100%). */
export function sparkGeometry(points: readonly { acc: number | null }[], w: number, h: number, pad = 2): SparkGeometry {
  const n = points.length;
  const step = n > 1 ? (w - 2 * pad) / (n - 1) : 0;
  const xy: { x: number; y: number }[] = [];
  points.forEach((p, i) => {
    if (p.acc === null || !Number.isFinite(p.acc)) return;
    xy.push({ x: r1(pad + i * step), y: r1(pad + (1 - Math.max(0, Math.min(1, p.acc))) * (h - 2 * pad)) });
  });
  if (xy.length === 1) return { d: "", dots: xy, count: 1 };
  return { d: xy.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(""), dots: [], count: xy.length };
}

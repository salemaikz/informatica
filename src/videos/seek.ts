// Чистая логика перемотки и скорости видео (без React) — покрыта tests/video-seek.test.ts.

/** Шаг перемотки кнопками, стрелками и двойным касанием, секунд. */
export const SEEK_STEP_SEC = 5;

/** Доступные скорости воспроизведения (по возрастанию). */
export const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export const DEFAULT_RATE = 1;
export const RATE_STORAGE_KEY = "informatica:video-rate";

/** Кадр в границах 0…duration−1 (целый). Нечисловое значение → 0. */
export function clampFrame(frame: number, durationInFrames: number): number {
  const last = Math.max(0, Math.floor(durationInFrames) - 1);
  if (!Number.isFinite(frame)) return 0;
  return Math.min(last, Math.max(0, Math.round(frame)));
}

/** Кадр после перемотки на deltaSec секунд (минус — назад). */
export function seekFrame(current: number, deltaSec: number, fps: number, durationInFrames: number): number {
  return clampFrame(current + deltaSec * fps, durationInFrames);
}

/** Приводит значение (например, из хранилища) к допустимой скорости; мусор → 1×. */
export function sanitizeRate(value: unknown): number {
  // Number, а не parseFloat: «1.5abc» из хранилища — мусор, а не 1.5
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return (RATES as readonly number[]).includes(n) ? n : DEFAULT_RATE;
}

/** Соседняя скорость: dir = 1 — быстрее, −1 — медленнее; на краю остаётся на месте. */
export function stepRate(current: number, dir: 1 | -1): number {
  const idx = (RATES as readonly number[]).indexOf(sanitizeRate(current));
  const next = Math.min(RATES.length - 1, Math.max(0, idx + dir));
  return RATES[next];
}

/** Подпись скорости: 1 → «1×», 0.75 → «0.75×». */
export function formatRate(rate: number): string {
  return `${rate}×`;
}

/** Время «м:сс» по номеру кадра (для подписи ползунка). */
export function formatClock(frame: number, fps: number): string {
  const f = Number.isFinite(frame) && frame > 0 ? frame : 0;
  const total = Math.floor(f / Math.max(1, fps));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Самый большой прямоугольник с отношением сторон aspect (ширина/высота), помещающийся в areaW×areaH. */
export function fitBox(areaW: number, areaH: number, aspect: number): { w: number; h: number } {
  if (!(areaW > 0) || !(areaH > 0) || !(aspect > 0)) return { w: 0, h: 0 };
  const w = Math.min(areaW, areaH * aspect);
  return { w: Math.floor(w), h: Math.floor(w / aspect) };
}

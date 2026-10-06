import type { ChatMeta } from "./chats";

// Плавающая кнопка Бита (BitDock, этап 16В, пакет P2b): где показывать, жесты, какой чат открыть. Чистая логика без React.

/**
 * Главные страницы оболочки, на которых живёт кнопка Бита (точное совпадение пути).
 * Внутренние экраны (заметка, теория, задача кода, результат теста…) и чат `/tutor*` — без неё.
 * Урок, тренировка, игры, пробный ЕНТ и онбординг вне оболочки (AppShell) — там её нет в принципе.
 */
export const DOCK_PAGES: readonly string[] = [
  "/learn",
  "/plan",
  "/practice",
  "/duel",
  "/exam",
  "/code",
  "/history",
  "/materials",
  "/notes",
  "/theory",
  "/search",
  "/stats",
  "/shop",
  "/profile",
];

/** Путь без query/hash и без хвостового «/». */
function cleanPath(pathname: string): string {
  const p = pathname.split(/[?#]/)[0] || "/";
  return p.length > 1 ? p.replace(/\/+$/, "") || "/" : p;
}

/** Показывать ли кнопку Бита на этой странице. */
export function dockVisible(pathname: string): boolean {
  return DOCK_PAGES.includes(cleanPath(pathname));
}

/** Последний открытый чат: с самым свежим `updatedAt` (закрепление не в счёт). Чатов нет — undefined. */
export function pickDockChat(chats: readonly ChatMeta[]): ChatMeta | undefined {
  let best: ChatMeta | undefined;
  for (const c of chats) if (!best || c.updatedAt > best.updatedAt) best = c;
  return best;
}

// ---------- жесты ----------

/** Свайп вправо по кнопке прячет её: сдвиг от 40 px или быстрый взмах (px/мс). */
export const HIDE_SWIPE_PX = 40;
export const FLICK_V = 0.5;
export function swipeHidesDock(dx: number, vx: number): boolean {
  return dx >= HIDE_SWIPE_PX || (dx >= 12 && vx >= FLICK_V);
}

/** Свайп влево по язычку возвращает кнопку: сдвиг от 24 px или взмах. (Касание без сдвига — тоже возврат, решает обработчик.) */
export const REVEAL_SWIPE_PX = 24;
export function swipeRevealsDock(dx: number, vx: number): boolean {
  return dx <= -REVEAL_SWIPE_PX || (dx <= -10 && vx <= -FLICK_V);
}

/** Свайп вниз по ручке закрывает шторку: сдвиг от 100 px или быстрый взмах. */
export const CLOSE_SWIPE_PX = 100;
export function swipeClosesSheet(dy: number, vy: number): boolean {
  return dy >= CLOSE_SWIPE_PX || (dy >= 30 && vy >= 0.6);
}

/** Точка траектории указателя: время (мс) и координата (px). */
export interface Sample {
  t: number;
  v: number;
}

/** Скорость при отпускании (px/мс): по точкам за последние `windowMs` мс. Мало данных — 0. */
export function releaseVelocity(samples: readonly Sample[], windowMs = 100): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  let first = last;
  for (let i = samples.length - 2; i >= 0; i--) {
    if (last.t - samples[i].t > windowMs) break;
    first = samples[i];
  }
  const dt = last.t - first.t;
  return dt > 0 ? (last.v - first.v) / dt : 0;
}

// ---------- прокрутка страницы ----------

/** Прокрутка вниз на столько px подряд — кнопка бледнеет и уменьшается, чтобы не закрывать правый край контента. */
export const SCROLL_AWAY_PX = 24;
/** Прокрутка остановилась на столько мс — кнопка возвращается (прокрутка вверх возвращает сразу). */
export const SCROLL_BACK_MS = 700;

/**
 * Шаг по событию прокрутки: `acc` — сколько px страница ушла вниз подряд, `delta` — сдвиг по вертикали (вниз > 0).
 * Прокрутка вверх (и пустой сдвиг — горизонтальная лента) сбрасывает счёт; кнопка «ушла», когда счёт дошёл до порога.
 */
export function scrollAwayStep(acc: number, delta: number): { acc: number; away: boolean } {
  if (delta < 0) return { acc: 0, away: false };
  const next = acc + delta;
  return { acc: next, away: next >= SCROLL_AWAY_PX };
}

/** Через сколько мс Бит снова слегка подпрыгнет: 32–48 с (r — случайное число 0…1). */
export function nextHopDelayMs(r: number): number {
  return Math.round(32_000 + Math.min(1, Math.max(0, r)) * 16_000);
}

import "server-only";

// Часы сервера для дуэлей и соцчасти (docs/specs/duels.md §5): все маршруты берут время только отсюда,
// чистые функции получают `now` параметром. Клиент держит сдвиг `serverNow − (send+recv)/2`.
//
// Тестовый сдвиг (e2e: «перемотать матч к итогам») работает только при DUEL_TEST_HOOKS=1 и никогда на Vercel
// (VERCEL=1): e2e идёт на production-сборке (`next start`), поэтому NODE_ENV для защиты не годится.
// Маршрут POST /api/duel/test/clock — в следующем пакете; здесь только функции.
// Сдвиг хранится в globalThis: точки входа маршрутов Next могут грузить модуль отдельно, а часы должны быть одни.

const CLOCK_KEY = Symbol.for("informatica.clock");
type ClockGlobal = { [CLOCK_KEY]?: { offsetMs: number } };

/** Потолок тестового сдвига: сутки в любую сторону (опечатка в тесте не должна уводить часы на годы). */
export const MAX_CLOCK_OFFSET_MS = 86_400_000;

const state = () => ((globalThis as ClockGlobal)[CLOCK_KEY] ??= { offsetMs: 0 });

/** Тестовые крючки часов разрешены: DUEL_TEST_HOOKS=1 и не Vercel. */
export function clockHooksEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.DUEL_TEST_HOOKS === "1" && env.VERCEL !== "1";
}

/** Время сервера, мс. Сдвиг учитывается, только пока крючки разрешены (выключили env — часы сразу настоящие). */
export function serverNow(): number {
  return Date.now() + (clockHooksEnabled() ? state().offsetMs : 0);
}

/** Текущий тестовый сдвиг (0, если крючки выключены). */
export function clockOffset(): number {
  return clockHooksEnabled() ? state().offsetMs : 0;
}

/** Поставить сдвиг; false — крючки выключены или значение не число (сдвиг не меняется). */
export function setClockOffset(ms: number): boolean {
  if (!clockHooksEnabled() || !Number.isFinite(ms)) return false;
  state().offsetMs = Math.max(-MAX_CLOCK_OFFSET_MS, Math.min(MAX_CLOCK_OFFSET_MS, Math.round(ms)));
  return true;
}

/** Перемотать вперёд (или назад) на ms; null — крючки выключены. Возвращает новый сдвиг. */
export function advanceClock(ms: number): number | null {
  if (!clockHooksEnabled() || !Number.isFinite(ms)) return null;
  setClockOffset(state().offsetMs + ms);
  return state().offsetMs;
}

/** Сбросить сдвиг (тесты). Работает всегда: обнулить часы безопасно. */
export function resetClock(): void {
  state().offsetMs = 0;
}

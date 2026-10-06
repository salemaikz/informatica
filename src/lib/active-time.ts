// Активное время учёбы (решение #68, аудит T7). Чистые функции без React; часы — lib/active-clock.ts.
//
// Время идёт, только пока вкладка видна, ученик действовал не позже idleMs назад и открыт учебный экран.
// Один интервал — не больше TICK_CAP_MS (спящий ноутбук и притормаживание фоновых вкладок не дают скачка).

export const IDLE_MS = 60_000;
/** На пробном ЕНТ и в практикуме долго читают и пишут без касаний — порог больше. */
export const IDLE_MS_LONG = 180_000;
export const TICK_CAP_MS = 5_000;
/** Как часто сбрасывать накопленное в стор. */
export const FLUSH_MS = 15_000;

/** Учебный экран: что считается занятием. null — не считаем (карта, магазин, профиль…). */
export type StudyKind = "lesson" | "drill" | "game" | "exam" | "code" | "theory" | "tutor" | "diagnostic";

/** Вид занятия по адресу страницы. */
export function studyKindOf(pathname: string | null | undefined): StudyKind | null {
  const p = pathname ?? "";
  if (p.startsWith("/lesson/")) return "lesson";
  if (p === "/drill" || p.startsWith("/drill/")) return "drill";
  // Матч дуэли — как игра (этап 16Д).
  if (p.startsWith("/game/") || p === "/duel/play" || p === "/duel/live" || p.startsWith("/duel/r/")) return "game";
  if (p.startsWith("/exam/run")) return "exam";
  if (p === "/code" || p.startsWith("/code/")) return "code";
  if (p === "/theory" || p.startsWith("/theory/")) return "theory";
  if (p === "/tutor" || p.startsWith("/tutor/")) return "tutor";
  if (p.startsWith("/diagnostic")) return "diagnostic";
  return null;
}

export const idleFor = (kind: StudyKind | null): number => (kind === "exam" || kind === "code" ? IDLE_MS_LONG : IDLE_MS);

export interface ClockState {
  /** Последний тик, мс. */
  lastTick: number;
  /** Последнее действие ученика (касание, клавиша, прокрутка), мс. */
  lastInput: number;
  /** Накоплено, но ещё не сброшено в стор, мс. */
  pendingMs: number;
  /** Всего активного времени на вкладке, мс (для итогов урока и времени ответа). */
  totalMs: number;
}

export const startClock = (now: number): ClockState => ({ lastTick: now, lastInput: now, pendingMs: 0, totalMs: 0 });

/** Тик: прибавить интервал, если вкладка видна, экран учебный и ученик не простаивает. */
export function tick(c: ClockState, now: number, visible: boolean, kind: StudyKind | null): ClockState {
  const dt = Math.max(0, Math.min(TICK_CAP_MS, now - c.lastTick));
  const active = visible && kind !== null && now - c.lastInput <= idleFor(kind);
  if (!active || dt === 0) return { ...c, lastTick: now };
  return { lastTick: now, lastInput: c.lastInput, pendingMs: c.pendingMs + dt, totalMs: c.totalMs + dt };
}

export const input = (c: ClockState, now: number): ClockState => ({ ...c, lastInput: Math.max(c.lastInput, now) });

/** Забрать целые секунды для стора; остаток миллисекунд остаётся. */
export function takeSeconds(c: ClockState): { clock: ClockState; sec: number } {
  const sec = Math.floor(c.pendingMs / 1000);
  return { clock: { ...c, pendingMs: c.pendingMs - sec * 1000 }, sec };
}

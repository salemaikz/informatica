// Просьба включить уведомления (этап 15, отзыв владельца 2026-10-05): мягкое окно с первого входа; не включили —
// напоминаем: первую неделю раз в 3 дня, потом раз в неделю. Чистая логика без React (тесты — tests/push-ask.test.ts).
// Каркас — главная модель; правило показа (`shouldAskPush`) реализует пакет F3.

/** Когда последний раз показывали окно и сколько раз всего. */
export interface PushAskState {
  lastAt: number;
  count: number;
}

export const EMPTY_PUSH_ASK: PushAskState = { lastAt: 0, count: 0 };

/** Состояние из localStorage — недоверенные данные. */
export function sanitizePushAsk(raw: unknown): PushAskState {
  const r = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Partial<PushAskState>;
  const ok = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  return { lastAt: ok(r.lastAt) ? Math.floor(r.lastAt!) : 0, count: ok(r.count) ? Math.floor(r.count!) : 0 };
}

// ---------------------------------------------------------------------------------------------------------------------
// Правило показа окна «Включить напоминания» (пакет F3). Решает только «показывать ли и что именно»; само окно —
// components/reminders/PushAskAgent.tsx, состояние разрешения — components/goals/push.ts (pushPermission).

/**
 * Состояние разрешения на уведомления:
 * - default / granted / denied — как у Notification.permission;
 * - unsupported — браузер не умеет уведомления вовсе (просить бесполезно);
 * - needs-install — iPhone/iPad: уведомления есть только у приложения на экране «Домой», в обычной вкладке их нет.
 */
export type PushPermission = "default" | "granted" | "denied" | "unsupported" | "needs-install";

/** Что показать: ask — окно с кнопкой запроса; blocked-help — «разреши в настройках браузера»; install-help — «добавь на экран Домой». */
export type PushAskAction = "ask" | "blocked-help" | "install-help";

const DAY = 86_400_000;
/** Первая неделя с регистрации — напоминаем чаще. */
export const PUSH_ASK_EARLY_WEEK_DAYS = 7;
/** Ритм в первую неделю (дней между показами). */
export const PUSH_ASK_EARLY_EVERY_DAYS = 3;
/** Ритм после первой недели и ритм подсказки про экран «Домой». */
export const PUSH_ASK_LATE_EVERY_DAYS = 7;

/**
 * Пора ли показывать окно. `pushOn` — уведомления уже включены в профиле (и работают).
 * Первый показ — сразу; дальше раз в 3 дня, пока с регистрации (`createdAt`) не прошла неделя, потом раз в 7 дней.
 * Включено/разрешено или браузер не умеет — null. Запрещено в браузере (denied) — то же окно, но с инструкцией.
 * iPhone без установки на экран «Домой» — подсказка про установку, раз в 7 дней.
 */
export function shouldAskPush(permission: PushPermission, state: PushAskState, createdAt: number, now: number, pushOn: boolean): PushAskAction | null {
  if (pushOn || permission === "granted" || permission === "unsupported") return null;
  const action: PushAskAction = permission === "denied" ? "blocked-help" : permission === "needs-install" ? "install-help" : "ask";
  // Ни разу не показывали. Время «из будущего» (часы переводили назад) не должно блокировать показ навсегда.
  if (state.count <= 0 || state.lastAt <= 0 || state.lastAt > now) return action;
  const late = permission === "needs-install" || now - createdAt >= PUSH_ASK_EARLY_WEEK_DAYS * DAY;
  const everyDays = late ? PUSH_ASK_LATE_EVERY_DAYS : PUSH_ASK_EARLY_EVERY_DAYS;
  return now - state.lastAt >= everyDays * DAY ? action : null;
}

/** Главные экраны, где окно уместно (не урок, тест, игра, чат и профиль — там свой переключатель). */
const ASK_SCREENS = new Set(["/learn", "/practice", "/plan", "/stats", "/materials"]);

export function isPushAskScreen(pathname: string): boolean {
  return ASK_SCREENS.has(pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname);
}

/** iPhone/iPad в обычной вкладке браузера (не установленное приложение): уведомлений там нет, пока сайт не добавлен на экран «Домой». */
export function iosNeedsInstall(env: { ua: string; platform?: string; maxTouchPoints?: number; standalone: boolean }): boolean {
  if (env.standalone) return false;
  const iphoneOrIpad = /iPhone|iPad|iPod/.test(env.ua);
  // iPadOS в режиме «как на компьютере» называет себя Mac, но у него есть сенсорный экран.
  const ipadAsMac = env.platform === "MacIntel" && (env.maxTouchPoints ?? 0) > 1;
  return iphoneOrIpad || ipadAsMac;
}

// Отправка статистики с телефона (решение #69): буфер в памяти, пачки, sendBeacon / fetch с keepalive.
// Чистая логика (буфер, пачки, удержание, «Что помешало?») — покрыта tests/analytics-client.test.ts.
// Подключение к window и стору — components/app/AnalyticsAgent.tsx. Ни id устройства, ни имени, ни времени события не отправляем.

import { setAnalyticsSink, track, type AnalyticsEvent } from "@/lib/analytics";
import { EVENTS_BODY_MAX, MAX_BATCH, parseEvent } from "@/lib/analytics-schema";
import { dayDiff, todayKey } from "@/lib/text";

/** Адрес приёма. */
export const ANALYTICS_URL = "/api/events";
/** Пачка уходит не чаще раза в это время (мс): первое событие запускает таймер, остальные копятся. */
export const FLUSH_MS = 20_000;
/** Не больше стольких событий за окно WINDOW_MS: защита от зациклившегося кода; остальное — повторы и шум. */
export const MAX_PER_HOUR = 300;
/** Окно потолка событий, мс: час. Открытая вкладка или PWA живёт днями — потолок «за загрузку» навсегда глушил бы тех, кто занимается много. */
export const WINDOW_MS = 60 * 60_000;

// text/plain — «простой» тип: sendBeacon не требует предварительного запроса, сервер читает тело как текст.
const BEACON_TYPE = "text/plain;charset=UTF-8";
// Запас под обёртку `{"events":[]}` и запятые: тело — не больше EVENTS_BODY_MAX байт (все поля ASCII).
const BODY_BUDGET = EVENTS_BODY_MAX - 100;

// ---------- Пачки ----------

/** Разбивает события на пачки: не больше MAX_BATCH штук и не больше budget знаков JSON в каждой (все поля — ASCII). */
export function splitBatches(events: readonly AnalyticsEvent[], budget: number = BODY_BUDGET): AnalyticsEvent[][] {
  const batches: AnalyticsEvent[][] = [];
  let cur: AnalyticsEvent[] = [];
  let size = 0;
  for (const ev of events) {
    const len = JSON.stringify(ev).length + 1;
    if (cur.length > 0 && (cur.length >= MAX_BATCH || size + len > budget)) {
      batches.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(ev);
    size += len;
  }
  if (cur.length > 0) batches.push(cur);
  return batches;
}

/** Тело запроса /api/events. */
export const batchBody = (events: readonly AnalyticsEvent[]): string => JSON.stringify({ events });

export interface SendDeps {
  sendBeacon?: (url: string, data: Blob) => boolean;
  fetch?: typeof fetch;
}

/** Шлёт одну пачку: sendBeacon (переживает закрытие страницы), иначе fetch с keepalive. Не бросает. */
export function sendBatch(events: readonly AnalyticsEvent[], deps: SendDeps): void {
  if (events.length === 0) return;
  const json = batchBody(events);
  try {
    if (deps.sendBeacon?.(ANALYTICS_URL, new Blob([json], { type: BEACON_TYPE }))) return;
  } catch {
    // дальше — fetch
  }
  try {
    void deps.fetch?.(ANALYTICS_URL, { method: "POST", headers: { "Content-Type": BEACON_TYPE }, body: json, keepalive: true }).catch(() => {});
  } catch {
    // статистика не обязательна
  }
}

// ---------- Клиент: буфер и таймер ----------

export interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export interface AnalyticsClient {
  /** Принять событие (после проверки по белому списку). false — отброшено (мусор или потолок за час). */
  add(ev: AnalyticsEvent): boolean;
  /** Отправить всё накопленное сейчас (уход со страницы). */
  flush(): void;
  /** Остановить: таймер снят, накопленное НЕ отправляется (ученик выключил статистику). */
  stop(): void;
  /** Сколько событий принято в текущем окне (час) и сколько ждёт отправки. */
  readonly accepted: number;
  readonly pending: number;
}

/**
 * Клиент статистики. События копятся в памяти; первое событие запускает таймер на FLUSH_MS, по его концу уходят все
 * накопленные (пачками). max — потолок событий за скользящее окно windowMs (по умолчанию 300 в час); часы now подменяются в тестах.
 * Суточные потолки на IP и на сайт остаются на сервере — это жёсткая страховка.
 */
export function createAnalyticsClient(deps: SendDeps & { timers: Timers; max?: number; flushMs?: number; windowMs?: number; now?: () => number }): AnalyticsClient {
  const max = deps.max ?? MAX_PER_HOUR;
  const flushMs = deps.flushMs ?? FLUSH_MS;
  const windowMs = deps.windowMs ?? WINDOW_MS;
  const now = deps.now ?? Date.now;
  let buffer: AnalyticsEvent[] = [];
  let accepted = 0;
  let windowStart = now();
  let timer: unknown = null;
  let stopped = false;

  const clearTimer = () => {
    if (timer !== null) deps.timers.clear(timer);
    timer = null;
  };
  const flush = () => {
    clearTimer();
    const events = buffer;
    buffer = [];
    for (const batch of splitBatches(events)) sendBatch(batch, deps);
  };
  return {
    add(ev) {
      if (stopped) return false;
      // Окно кончилось — счёт начинается заново: долгая вкладка не глохнет навсегда.
      const t = now();
      if (t - windowStart >= windowMs) {
        windowStart = t;
        accepted = 0;
      }
      if (accepted >= max) return false;
      // Проверка по тому же белому списку, что и на сервере: мусор не копим и не отправляем.
      const clean = parseEvent(ev);
      if (!clean) return false;
      accepted++;
      buffer.push(clean);
      if (timer === null) timer = deps.timers.set(flush, flushMs);
      return true;
    },
    flush,
    stop() {
      stopped = true;
      clearTimer();
      buffer = [];
    },
    get accepted() {
      // Окно могло закончиться, пока событий не было: тогда в новом окне принято 0.
      return now() - windowStart >= windowMs ? 0 : accepted;
    },
    get pending() {
      return buffer.length;
    },
  };
}

// ---------- Удержание: событие active ----------

/** Ключ в localStorage: местный день, за который событие active уже отправлено. */
export const ACTIVE_MARK_KEY = "informatica-analytics-active";
/** Дни с первого запуска, за которые считаем удержание. */
export const RETENTION_DAYS = [0, 1, 7, 30] as const;

type MarkStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * Событие active раз в календарный день: d — сколько календарных дней (по местному времени) прошло с первого запуска,
 * только 0, 1, 7 или 30. Нет первого запуска (createdAt ≤ 0), другой день или за сегодня уже отправляли — null.
 * Отметку «сегодня отправляли» кладём в storage (может быть недоступно — тогда повторов за загрузку не будет, а за день возможны).
 */
export function activeEventFor(createdAt: number, now: number, storage: MarkStorage | null): AnalyticsEvent | null {
  if (!(createdAt > 0) || !Number.isFinite(now)) return null;
  const today = todayKey(new Date(now));
  const d = dayDiff(todayKey(new Date(createdAt)), today);
  if (!(RETENTION_DAYS as readonly number[]).includes(d)) return null;
  try {
    if (storage?.getItem(ACTIVE_MARK_KEY) === today) return null;
  } catch {
    // хранилище недоступно — отправим
  }
  try {
    storage?.setItem(ACTIVE_MARK_KEY, today);
  } catch {
    // не страшно
  }
  return { e: "active", d: d as 0 | 1 | 7 | 30 };
}

// ---------- «Что помешало?» ----------

/** Перерыв, после которого спрашиваем «Что помешало?»: дней без занятий. */
export const BREAK_DAYS = 3;
/** Ключ в localStorage: последний день занятий, перед перерывом после которого уже спросили. */
export const BREAK_ASKED_KEY = "informatica-break-asked";

/** Последний день занятий: серия или последний день в `days`, что позже. null — занятий не было. */
export function lastStudyDay(streakLastDay: string | null | undefined, dayKeys: readonly string[]): string | null {
  const ok = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
  let last: string | null = ok(streakLastDay) ? streakLastDay : null;
  for (const d of dayKeys) if (ok(d) && (last === null || d > last)) last = d;
  return last;
}

/**
 * Спросить «Что помешало?»: с последнего дня занятий прошло не меньше BREAK_DAYS дней и за этот перерыв ещё не спрашивали
 * (askedFor — последний день занятий, при котором спросили). Занятий не было вовсе — не спрашиваем.
 */
export function shouldAskBreak(lastDay: string | null, today: string, askedFor: string | null): boolean {
  if (!lastDay || lastDay === askedFor) return false;
  return dayDiff(lastDay, today) >= BREAK_DAYS;
}

// ---------- Подключение к браузеру ----------

/** true — сбор разрешён на сервере (NEXT_PUBLIC_ANALYTICS=1). Читается при вызове: в тестах подменяется переменной окружения. */
export const analyticsEnabledOnServer = (): boolean => process.env.NEXT_PUBLIC_ANALYTICS === "1";

let devNotice = false;
const devWarned = new Set<string>();

/**
 * Включает сбор в браузере: ставит приёмник для track(), следит за уходом со страницы. Возвращает отписку (выключение в профиле).
 * В разработке ничего не отправляется: один раз сообщение в консоль и предупреждения о событиях не по белому списку
 * (в production такие события молча отбрасываются — здесь их видно).
 */
export function startAnalytics(isProduction: boolean = process.env.NODE_ENV === "production"): () => void {
  if (typeof window === "undefined") return () => {};
  if (!isProduction) {
    if (!devNotice) {
      devNotice = true;
      console.info("[analytics] статистика выключена в разработке: события не отправляются");
    }
    setAnalyticsSink((ev) => {
      if (parseEvent(ev) || devWarned.has(ev.e)) return;
      devWarned.add(ev.e);
      console.warn(`[analytics] событие «${ev.e}» не по белому списку (lib/analytics-schema.ts) и в production будет отброшено`, ev);
    });
    return () => setAnalyticsSink(null);
  }
  const client = createAnalyticsClient({
    sendBeacon: typeof navigator.sendBeacon === "function" ? (u, d) => navigator.sendBeacon(u, d) : undefined,
    fetch: typeof fetch === "function" ? (u, i) => fetch(u, i) : undefined,
    timers: { set: (fn, ms) => window.setTimeout(fn, ms), clear: (h) => window.clearTimeout(h as number) },
  });
  setAnalyticsSink((ev) => void client.add(ev));
  // Ушли со страницы или свернули вкладку — отправляем всё, что накопилось.
  const onHidden = () => {
    if (document.visibilityState === "hidden") client.flush();
  };
  const onPageHide = () => client.flush();
  document.addEventListener("visibilitychange", onHidden);
  window.addEventListener("pagehide", onPageHide);
  return () => {
    document.removeEventListener("visibilitychange", onHidden);
    window.removeEventListener("pagehide", onPageHide);
    setAnalyticsSink(null);
    client.stop();
  };
}

/** Отправить событие active за сегодня (если пора). Из эффекта агента; localStorage обёрнут в try. */
export function trackActiveToday(createdAt: number): void {
  let storage: MarkStorage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    // хранилище заблокировано
  }
  const ev = activeEventFor(createdAt, Date.now(), storage);
  if (ev) track(ev);
}

// Сбор ошибок с телефонов: window.onerror и unhandledrejection уходят в /api/issue (type "client_error").
// Здесь чистая логика (фильтр чужих ошибок, дедупликация, лимит за сессию, сборка и отправка) —
// покрыта tests/client-errors.test.ts. Подключение к window — в components/app/ClientErrorReporter.tsx.

import { clip, ISSUE_LIMITS, type ClientErrorBody } from "@/lib/issue";
import type { Lang } from "@/lib/types";

/** Не больше стольких отчётов за сессию (вкладку): остальное — шум и повторы. */
export const CLIENT_ERROR_MAX_PER_SESSION = 5;

export interface RawClientError {
  message: string;
  stack?: string;
  /** Адрес скрипта, где случилась ошибка (ErrorEvent.filename), если браузер его отдал. */
  source?: string;
}

// ---------- Фильтр чужих ошибок ----------

/** Адреса из стека вызовов: расширения браузера и любые внешние скрипты. */
const FRAME_URL = /\b(?:https?|chrome-extension|moz-extension|safari-extension|safari-web-extension|webkit-masked-url):\/\/[^\s)]+/gi;
const EXTENSION = /^(?:chrome|moz|safari|safari-web)-extension:\/\/|^webkit-masked-url:/i;
/** Безвредные сообщения браузера: не ошибка нашего кода. */
const NOISE = /^ResizeObserver loop (?:completed with undelivered notifications|limit exceeded)/i;

/** true — ошибка не из нашего кода (расширение, чужой скрипт, «Script error.»): её не отправляем. */
export function isForeignError(raw: RawClientError, origin: string): boolean {
  const message = raw.message.trim();
  if (!message || /^script error\.?$/i.test(message) || NOISE.test(message)) return true;

  if (raw.source) {
    if (EXTENSION.test(raw.source)) return true;
    try {
      if (new URL(raw.source, origin).origin !== origin) return true;
    } catch {
      // «<anonymous>» и подобное — по адресу не решить, смотрим стек.
    }
  }

  const frames = raw.stack?.match(FRAME_URL) ?? [];
  if (frames.some((f) => EXTENSION.test(f))) return true;
  // В стеке есть адреса, и ни один не с нашего сайта — ошибка чужого скрипта.
  // Сравниваем с «origin/», а не по префиксу: https://informatica.kz.evil.example — чужой хост.
  if (frames.length > 0 && !frames.some((f) => f === origin || f.startsWith(origin + "/"))) return true;
  return false;
}

// ---------- Дедупликация и лимит ----------

/** Сообщение для сравнения: пробелы схлопнуты, длина ограничена. */
function dedupKey(message: string): string {
  return message.replace(/\s+/g, " ").trim().slice(0, 200);
}

export interface ErrorGate {
  /** true — отчёт нужно отправить (и он засчитан). */
  accept(raw: RawClientError, origin: string): boolean;
  /** Сколько отчётов уже принято. */
  readonly count: number;
}

/** Один на сессию: чужие ошибки отбрасываются, одинаковые сообщения — один раз, всего не больше max. */
export function createErrorGate(max: number = CLIENT_ERROR_MAX_PER_SESSION): ErrorGate {
  const seen = new Set<string>();
  return {
    accept(raw, origin) {
      if (seen.size >= max) return false;
      if (isForeignError(raw, origin)) return false;
      const key = dedupKey(raw.message);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    },
    get count() {
      return seen.size;
    },
  };
}

// ---------- Сборка и отправка ----------

/** Из того, что пришло в onerror / unhandledrejection / error.tsx, достаёт сообщение и стек. */
export function normalizeError(input: unknown, source?: string): RawClientError {
  if (input && typeof input === "object") {
    const o = input as { message?: unknown; stack?: unknown; digest?: unknown };
    const message = typeof o.message === "string" ? o.message : "";
    const digest = typeof o.digest === "string" && o.digest ? ` [digest ${o.digest}]` : "";
    return { message: message + digest, stack: typeof o.stack === "string" ? o.stack : undefined, source };
  }
  return { message: typeof input === "string" ? input : "", source };
}

/** Тело запроса /api/issue для ошибки клиента. path — без параметров (их ещё раз отрежет сервер). */
export function buildClientErrorBody(raw: RawClientError, ctx: { path: string; lang: Lang }): ClientErrorBody {
  const body: ClientErrorBody = {
    type: "client_error",
    message: clip(raw.message, ISSUE_LIMITS.message),
    path: clip(ctx.path, ISSUE_LIMITS.path),
    lang: ctx.lang,
  };
  const stack = clip(raw.stack, ISSUE_LIMITS.stack);
  if (stack) body.stack = stack;
  return body;
}

export interface SendDeps {
  sendBeacon?: (url: string, data: Blob) => boolean;
  fetch?: typeof fetch;
}

const REPORT_URL = "/api/issue";
// text/plain — «простой» тип: sendBeacon не требует предварительного запроса, сервер читает тело как текст.
const REPORT_TYPE = "text/plain;charset=UTF-8";

/** Шлёт отчёт: sendBeacon (переживает закрытие страницы), иначе fetch с keepalive. Не бросает. */
export function sendClientError(body: ClientErrorBody, deps: SendDeps): void {
  const json = JSON.stringify(body);
  try {
    if (deps.sendBeacon?.(REPORT_URL, new Blob([json], { type: REPORT_TYPE }))) return;
  } catch {
    // дальше — fetch
  }
  try {
    void deps.fetch?.(REPORT_URL, { method: "POST", headers: { "Content-Type": REPORT_TYPE }, body: json, keepalive: true }).catch(() => {});
  } catch {
    // отчёт не обязателен
  }
}

// ---------- Язык для страниц ошибок ----------

/** Язык по сохранённому профилю, иначе по языку браузера: kk* — kk, всё остальное — ru. */
export function pickLang(stored: unknown, navigatorLang: string | undefined): Lang {
  if (stored === "ru" || stored === "kk") return stored;
  return /^kk\b/i.test(navigatorLang ?? "") ? "kk" : "ru";
}

export interface StoredProfile {
  lang: Lang | null;
  theme: "light" | "dark" | null;
}

/** Профиль из localStorage (ключ стора) без самого стора: страница глобальной ошибки не зависит от него. */
export function readStoredProfile(storage: Pick<Storage, "getItem"> | null | undefined): StoredProfile {
  const empty: StoredProfile = { lang: null, theme: null };
  try {
    const raw = storage?.getItem("informatica-v1");
    if (!raw) return empty;
    const profile = (JSON.parse(raw) as { state?: { profile?: { lang?: unknown; theme?: unknown } } })?.state?.profile;
    const lang = profile?.lang;
    const theme = profile?.theme;
    return {
      lang: lang === "ru" || lang === "kk" ? lang : null,
      theme: theme === "light" || theme === "dark" ? theme : null,
    };
  } catch {
    return empty;
  }
}

/** Язык и тема в браузере; на сервере и при недоступном хранилище — ru и системная тема. */
export function detectProfile(): { lang: Lang; theme: "light" | "dark" | null } {
  if (typeof window === "undefined") return { lang: "ru", theme: null };
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    // хранилище заблокировано
  }
  const p = readStoredProfile(storage);
  return { lang: pickLang(p.lang, window.navigator?.language), theme: p.theme };
}

// ---------- Подключение к браузеру ----------

let sessionGate: ErrorGate | null = null;

/** Отправляет одну ошибку с учётом общего (на вкладку) фильтра и лимита. Только в production. */
export function reportClientError(raw: RawClientError, lang: Lang): void {
  if (typeof window === "undefined" || process.env.NODE_ENV !== "production") return;
  sessionGate ??= createErrorGate();
  const { origin, pathname } = window.location;
  if (!sessionGate.accept(raw, origin)) return;
  sendClientError(buildClientErrorBody(raw, { path: pathname, lang }), {
    sendBeacon: typeof navigator.sendBeacon === "function" ? (u, d) => navigator.sendBeacon(u, d) : undefined,
    fetch: typeof fetch === "function" ? (u, i) => fetch(u, i) : undefined,
  });
}

/** Подписка на window.onerror и unhandledrejection. Возвращает отписку. В dev и на сервере ничего не делает. */
export function installClientErrorReporter(getLang: () => Lang): () => void {
  if (typeof window === "undefined" || process.env.NODE_ENV !== "production") return () => {};
  const onError = (e: ErrorEvent) => {
    reportClientError(normalizeError(e.error ?? e.message, e.filename), getLang());
  };
  const onRejection = (e: PromiseRejectionEvent) => {
    const raw = normalizeError(e.reason);
    if (!raw.message) raw.message = "Unhandled promise rejection";
    reportClientError(raw, getLang());
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}

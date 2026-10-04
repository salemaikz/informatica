import { describe, expect, it, vi } from "vitest";
import {
  buildClientErrorBody,
  CLIENT_ERROR_MAX_PER_SESSION,
  createErrorGate,
  isForeignError,
  normalizeError,
  pickLang,
  readStoredProfile,
  sendClientError,
} from "@/lib/client-errors";
import { ISSUE_LIMITS, parseIssue } from "@/lib/issue";

const ORIGIN = "https://informatica.kz";
const own = (message: string, extra: { stack?: string; source?: string } = {}) => ({ message, ...extra });

describe("фильтр чужих ошибок", () => {
  it("«Script error.» (чужой скрипт без доступа к тексту) и пустое сообщение — не наши", () => {
    expect(isForeignError(own("Script error."), ORIGIN)).toBe(true);
    expect(isForeignError(own("Script error"), ORIGIN)).toBe(true);
    expect(isForeignError(own("   "), ORIGIN)).toBe(true);
    expect(isForeignError(own(""), ORIGIN)).toBe(true);
  });

  it("безвредные сообщения браузера (ResizeObserver) — не ошибка", () => {
    expect(isForeignError(own("ResizeObserver loop completed with undelivered notifications."), ORIGIN)).toBe(true);
    expect(isForeignError(own("ResizeObserver loop limit exceeded"), ORIGIN)).toBe(true);
  });

  it("источник — расширение браузера или чужой сайт: не наша ошибка", () => {
    expect(isForeignError(own("x is not a function", { source: "chrome-extension://abcdef/content.js" }), ORIGIN)).toBe(true);
    expect(isForeignError(own("x is not a function", { source: "moz-extension://abcdef/content.js" }), ORIGIN)).toBe(true);
    expect(isForeignError(own("x is not a function", { source: "https://cdn.ads.example/tag.js" }), ORIGIN)).toBe(true);
  });

  it("стек из расширения или целиком с чужих адресов — не наши", () => {
    const ext = `TypeError: boom\n    at f (chrome-extension://abc/inject.js:1:2)\n    at g (${ORIGIN}/_next/static/chunks/a.js:3:4)`;
    expect(isForeignError(own("boom", { stack: ext }), ORIGIN)).toBe(true);
    const foreign = "TypeError: boom\n    at f (https://widget.example/w.js:1:2)\n    at g (https://widget.example/w.js:3:4)";
    expect(isForeignError(own("boom", { stack: foreign }), ORIGIN)).toBe(true);
  });

  it("наши ошибки проходят: источник и стек с нашего адреса, стек без адресов, адрес не указан", () => {
    expect(isForeignError(own("Cannot read properties of undefined", { source: `${ORIGIN}/_next/static/chunks/app.js` }), ORIGIN)).toBe(false);
    expect(isForeignError(own("boom", { source: "/_next/static/chunks/app.js" }), ORIGIN)).toBe(false);
    expect(isForeignError(own("boom", { stack: `TypeError: boom\n    at a (${ORIGIN}/_next/static/chunks/a.js:1:1)` }), ORIGIN)).toBe(false);
    // Смесь: есть и наши кадры, и чужие — ошибка наша (чужой скрипт её только вызвал).
    expect(isForeignError(own("boom", { stack: `at x (https://other.example/a.js:1:1)\n at y (${ORIGIN}/_next/a.js:1:1)` }), ORIGIN)).toBe(false);
    expect(isForeignError(own("boom", { stack: "TypeError: boom\n    at <anonymous>" }), ORIGIN)).toBe(false);
    expect(isForeignError(own("boom"), ORIGIN)).toBe(false);
    expect(isForeignError(own("boom", { source: "<anonymous>" }), ORIGIN)).toBe(false);
  });
});

describe("дедупликация и лимит за сессию", () => {
  it("лимит — 5 отчётов за сессию", () => {
    expect(CLIENT_ERROR_MAX_PER_SESSION).toBe(5);
    const gate = createErrorGate();
    const results = Array.from({ length: 8 }, (_, i) => gate.accept(own(`ошибка ${i}`), ORIGIN));
    expect(results).toEqual([true, true, true, true, true, false, false, false]);
    expect(gate.count).toBe(5);
  });

  it("одинаковое сообщение — один раз (пробелы и хвост не в счёт)", () => {
    const gate = createErrorGate();
    expect(gate.accept(own("TypeError: x is undefined"), ORIGIN)).toBe(true);
    expect(gate.accept(own("TypeError: x is undefined"), ORIGIN)).toBe(false);
    expect(gate.accept(own("  TypeError:   x is undefined "), ORIGIN)).toBe(false);
    expect(gate.accept(own("TypeError: y is undefined"), ORIGIN)).toBe(true);
    expect(gate.count).toBe(2);
  });

  it("чужие и повторные ошибки лимит не расходуют", () => {
    const gate = createErrorGate();
    for (let i = 0; i < 20; i++) expect(gate.accept(own("Script error."), ORIGIN)).toBe(false);
    for (let i = 0; i < 20; i++) gate.accept(own("повтор"), ORIGIN);
    expect(gate.count).toBe(1);
    for (let i = 0; i < 4; i++) expect(gate.accept(own(`новая ${i}`), ORIGIN)).toBe(true);
    expect(gate.accept(own("шестая"), ORIGIN)).toBe(false);
  });

  it("свой лимит можно задать", () => {
    const gate = createErrorGate(2);
    expect([gate.accept(own("a"), ORIGIN), gate.accept(own("b"), ORIGIN), gate.accept(own("c"), ORIGIN)]).toEqual([true, true, false]);
  });
});

describe("сборка отчёта", () => {
  it("normalizeError: Error, строка, мусор, digest серверной ошибки", () => {
    const e = new Error("boom");
    expect(normalizeError(e, "https://x/a.js")).toMatchObject({ message: "boom", source: "https://x/a.js" });
    expect(normalizeError(e).stack).toContain("boom");
    expect(normalizeError("просто строка")).toEqual({ message: "просто строка", source: undefined });
    expect(normalizeError(undefined).message).toBe("");
    expect(normalizeError(42).message).toBe("");
    expect(normalizeError(Object.assign(new Error("An error occurred in the Server Components render."), { digest: "123" })).message).toBe(
      "An error occurred in the Server Components render. [digest 123]",
    );
  });

  it("buildClientErrorBody обрезает поля, и тело проходит серверную проверку", () => {
    const body = buildClientErrorBody({ message: "m".repeat(900), stack: "s".repeat(4000) }, { path: "/lesson/a", lang: "kk" });
    expect(body.type).toBe("client_error");
    expect(body.message).toHaveLength(ISSUE_LIMITS.message);
    expect(body.stack).toHaveLength(ISSUE_LIMITS.stack);
    expect(body.path).toBe("/lesson/a");
    expect(body.lang).toBe("kk");
    expect(parseIssue(body, { now: 0, version: "dev" }).ok).toBe(true);
  });
});

describe("отправка", () => {
  const body = buildClientErrorBody(own("boom", { stack: "at a" }), { path: "/learn", lang: "ru" });

  it("sendBeacon: тело — text/plain с JSON, fetch не нужен", async () => {
    const beacon = vi.fn((url: string, data: Blob) => {
      void url;
      void data;
      return true;
    });
    const fetchMock = vi.fn();
    sendClientError(body, { sendBeacon: beacon, fetch: fetchMock as unknown as typeof fetch });
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    const [url, blob] = beacon.mock.calls[0];
    expect(url).toBe("/api/issue");
    expect(blob.type).toMatch(/^text\/plain/);
    expect(JSON.parse(await blob.text())).toEqual(body);
  });

  it("sendBeacon отказал (очередь полна) или не бросил — fetch с keepalive", () => {
    const fetchMock = vi.fn(async () => new Response("{}"));
    sendClientError(body, { sendBeacon: () => false, fetch: fetchMock as unknown as typeof fetch });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/issue");
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(String(init.body))).toEqual(body);
  });

  it("sendBeacon бросил исключение — тоже fetch; ничего не доступно — не падает", () => {
    const fetchMock = vi.fn(async () => new Response("{}"));
    sendClientError(
      body,
      {
        sendBeacon: () => {
          throw new Error("no");
        },
        fetch: fetchMock as unknown as typeof fetch,
      },
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(() => sendClientError(body, {})).not.toThrow();
  });

  it("fetch отклонён или бросил сразу — ошибка не всплывает наружу", async () => {
    expect(() => sendClientError(body, { fetch: (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch })).not.toThrow();
    expect(() =>
      sendClientError(body, {
        fetch: (() => {
          throw new Error("sync");
        }) as unknown as typeof fetch,
      }),
    ).not.toThrow();
    await Promise.resolve();
  });
});

describe("язык для страниц ошибок", () => {
  it("профиль важнее браузера; без профиля kk* — kk, остальное — ru", () => {
    expect(pickLang("kk", "ru-RU")).toBe("kk");
    expect(pickLang("ru", "kk-KZ")).toBe("ru");
    expect(pickLang(null, "kk-KZ")).toBe("kk");
    expect(pickLang(null, "kk")).toBe("kk");
    expect(pickLang(null, "KK-kz")).toBe("kk");
    expect(pickLang(null, "ru-RU")).toBe("ru");
    expect(pickLang(null, "en-US")).toBe("ru");
    expect(pickLang(undefined, undefined)).toBe("ru");
    expect(pickLang("de", "kkx")).toBe("ru");
  });

  it("readStoredProfile читает язык и тему из сохранённого стора и не падает на мусоре", () => {
    const store = (v: string | null) => ({ getItem: () => v });
    expect(readStoredProfile(store(JSON.stringify({ state: { profile: { lang: "kk", theme: "dark" } }, version: 3 })))).toEqual({ lang: "kk", theme: "dark" });
    expect(readStoredProfile(store(JSON.stringify({ state: { profile: { lang: "en", theme: "system" } } })))).toEqual({ lang: null, theme: null });
    expect(readStoredProfile(store("{не json"))).toEqual({ lang: null, theme: null });
    expect(readStoredProfile(store(null))).toEqual({ lang: null, theme: null });
    expect(readStoredProfile(store("null"))).toEqual({ lang: null, theme: null });
    expect(readStoredProfile(null)).toEqual({ lang: null, theme: null });
    expect(
      readStoredProfile({
        getItem: () => {
          throw new Error("заблокировано");
        },
      }),
    ).toEqual({ lang: null, theme: null });
  });
});

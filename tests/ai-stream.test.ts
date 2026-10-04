import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STREAM_CUT_MARK, STREAM_ERROR_MARK, STREAM_OK_MARK, splitStreamTail, stripStreamMark, withStreamEnd } from "@/lib/ai-stream";
import { aiCodeKey, canRetryAiError } from "@/lib/ai-errors";
import { AiError, aiErrorKey, streamTutor } from "@/lib/ai";
import type { TutorRequest } from "@/lib/ai-types";
import { dict } from "@/i18n/dict";

describe("маркеры конца потока", () => {
  it("целый ответ заканчивается маркером OK: текст до него и признак ok", () => {
    expect(splitStreamTail(`Привет, Бит${STREAM_OK_MARK}`)).toEqual({ text: "Привет, Бит", end: "ok" });
    expect(splitStreamTail(STREAM_OK_MARK)).toEqual({ text: "", end: "ok" });
  });

  it("нет маркера — «open»: поток ещё идёт или закрыт без конца (обрыв), но не «ok»", () => {
    expect(splitStreamTail("Привет, Бит")).toEqual({ text: "Привет, Бит", end: "open" });
    expect(splitStreamTail("")).toEqual({ text: "", end: "open" });
  });

  it("недописанный OK («\u0000», «\u0000O») — не ok", () => {
    expect(splitStreamTail("abc\u0000O")).toEqual({ text: "abc", end: "error" });
    expect(splitStreamTail("abc\u0000K")).toEqual({ text: "abc", end: "error" });
  });

  it("withStreamEnd: дописывает OK, а готовый маркер (CUT, ERR, OK) не трогает", () => {
    expect(withStreamEnd("Ответ")).toBe(`Ответ${STREAM_OK_MARK}`);
    expect(withStreamEnd(`Ответ${STREAM_CUT_MARK}`)).toBe(`Ответ${STREAM_CUT_MARK}`);
    expect(withStreamEnd(`Ответ${STREAM_ERROR_MARK}`)).toBe(`Ответ${STREAM_ERROR_MARK}`);
    expect(withStreamEnd(`Ответ${STREAM_OK_MARK}`)).toBe(`Ответ${STREAM_OK_MARK}`);
    expect(splitStreamTail(withStreamEnd("Текст")).end).toBe("ok");
  });

  it("сбой потока: текст до маркера и признак error", () => {
    expect(splitStreamTail(`Начало отве${STREAM_ERROR_MARK}`)).toEqual({ text: "Начало отве", end: "error" });
  });

  it("обрезка по длине: признак cut", () => {
    expect(splitStreamTail(`Текст${STREAM_CUT_MARK}`)).toEqual({ text: "Текст", end: "cut" });
  });

  it("недописанный маркер — тоже конец с ошибкой, служебный символ не просачивается в текст", () => {
    expect(splitStreamTail("abc\u0000")).toEqual({ text: "abc", end: "error" });
    expect(splitStreamTail("abc\u0000C")).toEqual({ text: "abc", end: "error" });
    expect(splitStreamTail("abc\u0000CU")).toEqual({ text: "abc", end: "error" });
    expect(splitStreamTail("\u0000CUT")).toEqual({ text: "", end: "cut" });
  });

  it("всё после первого служебного символа отбрасывается", () => {
    expect(splitStreamTail("a\u0000ERRb\u0000CUT")).toEqual({ text: "a", end: "error" });
    expect(splitStreamTail("a\u0000CUTb\u0000OK")).toEqual({ text: "a", end: "cut" });
  });

  it("stripStreamMark вырезает служебный символ из текста модели: маркер нельзя подделать", () => {
    expect(stripStreamMark("a\u0000CUTb")).toBe("aCUTb");
    // подделанный «OK» посреди ответа не делает оборванный ответ целым: без настоящего маркера конца — «open»
    expect(splitStreamTail(stripStreamMark("ответ\u0000OK")).end).toBe("open");
    expect(splitStreamTail(stripStreamMark("ответ\u0000ERR")).end).toBe("open");
    expect(stripStreamMark("чисто")).toBe("чисто");
  });
});

describe("код ошибки → текст", () => {
  it("rate_limited → «слишком много подряд», daily_limit → лимит на сегодня, ai_busy → общий запас, stream_cut → оборвался", () => {
    expect(aiCodeKey("rate_limited")).toBe("ai.err.burst");
    expect(aiCodeKey("http_429")).toBe("ai.err.burst");
    expect(aiCodeKey("daily_limit")).toBe("tutor.limit");
    expect(aiCodeKey("ai_busy")).toBe("ai.err.busy");
    expect(aiCodeKey("stream_cut")).toBe("ai.err.cut");
  });

  it("остальное — общая ошибка", () => {
    for (const c of ["ai_failed", "ai_not_configured", "forbidden_origin", "http_502", "empty_answer", "no_body", "", undefined]) {
      expect(aiCodeKey(c)).toBe("tutor.error");
    }
  });

  it("aiErrorKey: AiError по коду, любое другое исключение — общая ошибка", () => {
    expect(aiErrorKey(new AiError("ai_busy"))).toBe("ai.err.busy");
    expect(aiErrorKey(new AiError("stream_cut"))).toBe("ai.err.cut");
    expect(aiErrorKey(new TypeError("network"))).toBe("tutor.error");
    expect(aiErrorKey(null)).toBe("tutor.error");
    expect(aiErrorKey("rate_limited")).toBe("tutor.error");
  });

  it("все тексты ошибок есть в словаре на двух языках, без эмодзи и без «ЕНТ» (в kk — ҰБТ)", () => {
    for (const key of ["ai.err.burst", "ai.err.busy", "ai.err.cut", "tutor.limit", "tutor.error"] as const) {
      expect(dict[key].ru.length).toBeGreaterThan(10);
      expect(dict[key].kk.length).toBeGreaterThan(10);
      expect(dict[key].ru).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(dict[key].kk).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(dict[key].ru).not.toMatch(/ЕНТ/);
      expect(dict[key].kk).not.toMatch(/ЕНТ/);
    }
  });

  it("«Повторить» — после сбоя, обрыва и всплеска; не после лимита дня, общего запаса и нехватки чипов", () => {
    expect(canRetryAiError("tutor.error")).toBe(true);
    expect(canRetryAiError("ai.err.cut")).toBe(true);
    expect(canRetryAiError("ai.err.burst")).toBe(true);
    expect(canRetryAiError("tutor.limit")).toBe(false);
    expect(canRetryAiError("ai.err.busy")).toBe(false);
    expect(canRetryAiError("economy.noChips")).toBe(false);
    expect(canRetryAiError(null)).toBe(false);
  });
});

// ---------- streamTutor: клиент потока ----------

const enc = new TextEncoder();

/** Тело ответа из кусков; failAfter — после стольких кусков поток обрывается ошибкой сети. */
function streamOf(chunks: string[], failAfter?: number): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(c) {
      chunks.forEach((s, i) => {
        if (failAfter === undefined || i < failAfter) c.enqueue(enc.encode(s));
      });
      if (failAfter !== undefined) c.error(new TypeError("network error"));
      else c.close();
    },
  });
}

const req: TutorRequest = { mode: "chat", messages: [{ role: "user", content: "Привет" }], context: {} as never };
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const reply = (chunks: string[], init: { failAfter?: number; headers?: Record<string, string> } = {}) =>
  new Response(streamOf(chunks, init.failAfter), { status: 200, headers: init.headers });

describe("streamTutor: конец ответа", () => {
  it("целый ответ: onText получает накопленный текст, результат — полный текст, маркер OK не виден", async () => {
    fetchMock.mockResolvedValue(reply(["При", "вет, ", "Бит", STREAM_OK_MARK]));
    const seen: string[] = [];
    const text = await streamTutor(req, (t) => seen.push(t));
    expect(text).toBe("Привет, Бит");
    expect(seen[0]).toBe("При");
    expect(seen[seen.length - 1]).toBe("Привет, Бит");
    for (const s of seen) expect(s).not.toContain("\u0000");
  });

  it("маркер OK, разорванный границей кусков, всё равно не виден и ответ целый", async () => {
    fetchMock.mockResolvedValue(reply(["Текст\u0000", "O", "K"]));
    const seen: string[] = [];
    expect(await streamTutor(req, (t) => seen.push(t))).toBe("Текст");
    for (const s of seen) expect(s).toBe("Текст");
  });

  it("ответ без маркера OK — оборван (соединение закрыли раньше времени): stream_cut, показанный текст не сохраняется как готовый", async () => {
    fetchMock.mockResolvedValue(reply(["Ответ почти ", "готов"]));
    const err = await streamTutor(req, () => {}).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe("stream_cut");
    expect(aiErrorKey(err)).toBe("ai.err.cut");
  });

  it("поток закончился на недописанном OK — stream_cut", async () => {
    fetchMock.mockResolvedValue(reply(["Текст\u0000O"]));
    await expect(streamTutor(req, () => {})).rejects.toMatchObject({ code: "stream_cut" });
  });

  it("маркер обрезки по длине: AiError stream_cut, маркер ученику не показывается", async () => {
    fetchMock.mockResolvedValue(reply(["Ответ почти ", "готов", STREAM_CUT_MARK]));
    const seen: string[] = [];
    const err = await streamTutor(req, (t) => seen.push(t)).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe("stream_cut");
    expect(seen.length).toBeGreaterThan(0);
    for (const s of seen) expect(s).not.toContain("\u0000");
    expect(seen[seen.length - 1]).toBe("Ответ почти готов");
  });

  it("маркер сбоя на сервере: stream_cut", async () => {
    fetchMock.mockResolvedValue(reply(["Начало", STREAM_ERROR_MARK]));
    await expect(streamTutor(req, () => {})).rejects.toMatchObject({ code: "stream_cut" });
  });

  it("маркер, разорванный границей кусков, всё равно не виден и даёт stream_cut", async () => {
    fetchMock.mockResolvedValue(reply(["Текст\u0000", "C", "UT"]));
    const seen: string[] = [];
    await expect(streamTutor(req, (t) => seen.push(t))).rejects.toMatchObject({ code: "stream_cut" });
    for (const s of seen) expect(s).toBe("Текст");
  });

  it("поток закончился на недописанном маркере — stream_cut", async () => {
    fetchMock.mockResolvedValue(reply(["Текст\u0000E"]));
    await expect(streamTutor(req, () => {})).rejects.toMatchObject({ code: "stream_cut" });
  });

  it("только маркер без текста — stream_cut, а не «пустой ответ»", async () => {
    fetchMock.mockResolvedValue(reply([STREAM_ERROR_MARK]));
    await expect(streamTutor(req, () => {})).rejects.toMatchObject({ code: "stream_cut" });
  });

  it("сеть оборвалась посреди чтения — stream_cut", async () => {
    fetchMock.mockResolvedValue(reply(["Начало ", "ответа"], { failAfter: 1 }));
    await expect(streamTutor(req, () => {})).rejects.toMatchObject({ code: "stream_cut" });
  });

  it("отмена учеником пробрасывается как есть (не stream_cut)", async () => {
    const ctrl = new AbortController();
    const abortErr = new DOMException("aborted", "AbortError");
    fetchMock.mockResolvedValue(
      new Response(
        new ReadableStream<Uint8Array>({
          pull(c) {
            ctrl.abort();
            c.error(abortErr);
          },
        }),
      ),
    );
    await expect(streamTutor(req, () => {}, ctrl.signal)).rejects.toBe(abortErr);
  });

  it("пустой ответ с маркером OK — empty_answer (общая ошибка)", async () => {
    fetchMock.mockResolvedValue(reply(["   ", STREAM_OK_MARK]));
    const err = await streamTutor(req, () => {}).catch((e) => e);
    expect(err.code).toBe("empty_answer");
    expect(aiErrorKey(err)).toBe("tutor.error");
  });

  it("кризисный и кэшированный ответы: заголовок X-AI-Cache доходит до колбэка", async () => {
    fetchMock.mockResolvedValue(reply(["Ответ", STREAM_OK_MARK], { headers: { "X-AI-Cache": "hit" } }));
    const statuses: (string | null)[] = [];
    await streamTutor(req, () => {}, undefined, (s) => statuses.push(s));
    expect(statuses).toEqual(["hit"]);
  });

  it("ответ сервера с кодом ошибки → AiError(code) → нужный текст", async () => {
    const cases: [number, string, string][] = [
      [429, "rate_limited", "ai.err.burst"],
      [429, "daily_limit", "tutor.limit"],
      [503, "ai_busy", "ai.err.busy"],
      [502, "ai_failed", "tutor.error"],
      [403, "forbidden_origin", "tutor.error"],
    ];
    for (const [status, code, key] of cases) {
      fetchMock.mockResolvedValue(Response.json({ error: code }, { status }));
      const err = await streamTutor(req, () => {}).catch((e) => e);
      expect(err).toBeInstanceOf(AiError);
      expect(err.code).toBe(code);
      expect(aiErrorKey(err)).toBe(key);
    }
    // платформа вернула 429 без нашего тела
    fetchMock.mockResolvedValue(new Response("slow down", { status: 429 }));
    expect(aiErrorKey(await streamTutor(req, () => {}).catch((e) => e))).toBe("ai.err.burst");
  });
});

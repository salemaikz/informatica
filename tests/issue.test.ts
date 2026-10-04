import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildIssueBody,
  clip,
  clipId,
  ISSUE_ANY_LIMIT,
  ISSUE_CHANNELS,
  ISSUE_DAY_MAX,
  ISSUE_LIMITS,
  ISSUE_REASONS,
  issueChannel,
  issueKey,
  parseIssue,
  submitIssue,
  type IssueTarget,
} from "@/lib/issue";
import { dict } from "@/i18n/dict";
import { createMemoryKv } from "@/server/kv";

vi.mock("server-only", () => ({}));

const meta = { now: Date.UTC(2026, 9, 4, 12, 0, 0), version: "abc1234", userAgent: "Mozilla/5.0 (Linux; Android 14)" };

const valid = {
  type: "task",
  where: "lesson",
  reason: "wrong_answer",
  comment: "  В ответе опечатка  ",
  itemId: "ns-1-binary:q-3",
  lessonId: "ns-1-binary",
  snippet: "Переведи 1011₂ в десятичную систему",
  lang: "kk",
};

describe("clip", () => {
  it("не строка — пустая; края обрезаются, управляющие символы убираются", () => {
    expect(clip(42, 10)).toBe("");
    expect(clip(null, 10)).toBe("");
    expect(clip("  привет\u0000\u0007 мир  ", 50)).toBe("привет мир");
  });

  it("C1, невидимые знаки нулевой ширины и bidi-метки вырезаются; обычный текст на ru и kk не страдает", () => {
    // NEL (U+0085), U+009F, ZWSP/LRM/RLM, RLO/PDF (202A–202E), изоляты (2066–2069), BOM, разделители строк.
    expect(clip("a\u0085b\u009Fc\u200Bd\u200Ee\u200Ff\u202Eg\u202Ah\u2066i\u2069j\uFEFFk\u2028l\u2029m", 50)).toBe("abcdefghijklm");
    // Разворот строки (RLO) не должен остаться в записи: иначе «gnp.exe» в списке жалоб выглядит как «exe.png».
    expect(clip("\u202Egnp.exe", 50)).toBe("gnp.exe");
    expect(clip("Екілік жүйе: 1011₂ = 11₁₀ — қазақша мәтін и русский", 80)).toBe("Екілік жүйе: 1011₂ = 11₁₀ — қазақша мәтін и русский");
    // Перевод строки и табуляция — по-прежнему допустимы.
    expect(clip("раз\nдва\tтри", 50)).toBe("раз\nдва\tтри");
  });

  it("не длиннее max и не рвёт пару-суррогат", () => {
    expect(clip("a".repeat(100), 10)).toHaveLength(10);
    // 😀 — две единицы UTF-16: на границе вторая половина не должна остаться «висеть» одна.
    const s = clip("ab😀😀", 3);
    expect(s).toBe("ab");
    expect(clip("ab😀😀", 4)).toBe("ab😀");
  });

  it("id — только безопасные символы и не длиннее 80", () => {
    expect(clipId("ns-1:q#3 <script>")).toBe("ns-1:q#3script");
    expect(clipId("x".repeat(500))).toHaveLength(ISSUE_LIMITS.id);
    expect(clipId(undefined)).toBe("");
  });
});

describe("parseIssue — жалоба на задание и на ответ ИИ", () => {
  it("верное тело: запись без лишних полей, с версией и временем", () => {
    const r = parseIssue(valid, meta);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.channel).toBe("issue");
    expect(r.record).toEqual({
      type: "task",
      where: "lesson",
      reason: "wrong_answer",
      comment: "В ответе опечатка",
      itemId: "ns-1-binary:q-3",
      lessonId: "ns-1-binary",
      snippet: "Переведи 1011₂ в десятичную систему",
      lang: "kk",
      version: "abc1234",
      at: "2026-10-04T12:00:00.000Z",
    });
  });

  it("в запись не попадает ничего чужого: ни IP, ни id устройства, ни произвольные поля", () => {
    const r = parseIssue({ ...valid, ip: "1.2.3.4", deviceId: "dev-1", name: "Айгерим", userAgent: "x" }, meta);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const keys = Object.keys(r.record).sort();
    expect(keys).toEqual(["at", "comment", "itemId", "lang", "lessonId", "reason", "snippet", "type", "version", "where"]);
    expect(JSON.stringify(r.record)).not.toMatch(/1\.2\.3\.4|dev-1|Айгерим/);
  });

  it("пустые необязательные поля не сохраняются", () => {
    const r = parseIssue({ type: "ai", where: "chat", reason: "wrong", comment: "   ", itemId: "", snippet: 5 }, meta);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.record).toEqual({ type: "ai", where: "chat", reason: "wrong", lang: null, version: "abc1234", at: "2026-10-04T12:00:00.000Z" });
  });

  it("поля обрезаются по лимитам: комментарий 500, текст 600, id 80", () => {
    const r = parseIssue({ ...valid, comment: "к".repeat(900), snippet: "с".repeat(2000), itemId: "i".repeat(300), lessonId: "l".repeat(300) }, meta);
    expect(r.ok).toBe(true);
    if (!r.ok || r.record.type === "client_error") return;
    expect(r.record.comment).toHaveLength(ISSUE_LIMITS.comment);
    expect(r.record.snippet).toHaveLength(ISSUE_LIMITS.snippet);
    expect(r.record.itemId).toHaveLength(ISSUE_LIMITS.id);
    expect(r.record.lessonId).toHaveLength(ISSUE_LIMITS.id);
  });

  it("язык не из списка — null", () => {
    const r = parseIssue({ ...valid, lang: "en" }, meta);
    expect(r.ok && r.record.lang).toBeNull();
  });

  it("список причин: у задания и у ответа ИИ свои", () => {
    expect(ISSUE_REASONS.task).toEqual(["wrong_answer", "unclear", "typo", "other"]);
    expect(ISSUE_REASONS.ai).toEqual(["wrong", "unclear", "gave_solution", "other"]);
    for (const reason of ISSUE_REASONS.task) expect(parseIssue({ ...valid, reason }, meta).ok).toBe(true);
    for (const reason of ISSUE_REASONS.ai) expect(parseIssue({ type: "ai", where: "panel", reason }, meta).ok).toBe(true);
  });

  it("причина из чужого списка — отказ", () => {
    expect(parseIssue({ ...valid, reason: "gave_solution" }, meta)).toEqual({ ok: false, code: "bad_reason" });
    expect(parseIssue({ type: "ai", where: "chat", reason: "wrong_answer" }, meta)).toEqual({ ok: false, code: "bad_reason" });
    expect(parseIssue({ ...valid, reason: "" }, meta)).toEqual({ ok: false, code: "bad_reason" });
    expect(parseIssue({ ...valid, reason: undefined }, meta)).toEqual({ ok: false, code: "bad_reason" });
    expect(parseIssue({ ...valid, reason: ["other"] }, meta)).toEqual({ ok: false, code: "bad_reason" });
  });

  it("место не из списка или без места — отказ", () => {
    expect(parseIssue({ ...valid, where: "sidebar" }, meta)).toEqual({ ok: false, code: "bad_where" });
    expect(parseIssue({ ...valid, where: undefined }, meta)).toEqual({ ok: false, code: "bad_where" });
    for (const where of ["lesson", "drill", "exam", "chat", "panel"]) expect(parseIssue({ ...valid, where }, meta).ok).toBe(true);
  });

  it("мусор вместо тела — отказ без падения", () => {
    for (const junk of [null, undefined, 0, 42, "строка", true, [], [valid], () => 1]) {
      expect(parseIssue(junk, meta)).toEqual({ ok: false, code: "bad_body" });
    }
    expect(parseIssue({}, meta)).toEqual({ ok: false, code: "bad_type" });
    expect(parseIssue({ type: "spam", reason: "other", where: "lesson" }, meta)).toEqual({ ok: false, code: "bad_type" });
    expect(parseIssue({ type: { toString: () => "task" } }, meta)).toEqual({ ok: false, code: "bad_type" });
  });

  it("переводы строк в комментарии остаются, но запись — одна строка лога", () => {
    const r = parseIssue({ ...valid, comment: "раз\nдва\r\n[issue] {\"type\":\"fake\"}" }, meta);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(JSON.stringify(r.record)).not.toContain("\n");
  });
});

describe("parseIssue — ошибка с телефона", () => {
  const err = { type: "client_error", message: "Cannot read properties of undefined", stack: "TypeError\n at a (https://x.kz/_next/a.js:1:2)", path: "/lesson/ns-1-binary?seed=5#top", lang: "ru" };

  it("верное тело: путь без параметров, userAgent из заголовка", () => {
    const r = parseIssue(err, meta);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.channel).toBe("client_error");
    expect(r.record).toEqual({
      type: "client_error",
      message: "Cannot read properties of undefined",
      stack: "TypeError\n at a (https://x.kz/_next/a.js:1:2)",
      path: "/lesson/ns-1-binary",
      userAgent: "Mozilla/5.0 (Linux; Android 14)",
      lang: "ru",
      version: "abc1234",
      at: "2026-10-04T12:00:00.000Z",
    });
  });

  it("лимиты: сообщение 500, стек 1500, путь 200, userAgent 160", () => {
    const r = parseIssue({ ...err, message: "m".repeat(900), stack: "s".repeat(5000), path: "/" + "p".repeat(900) }, { ...meta, userAgent: "u".repeat(400) });
    expect(r.ok).toBe(true);
    if (!r.ok || r.record.type !== "client_error") return;
    expect(r.record.message).toHaveLength(ISSUE_LIMITS.message);
    expect(r.record.stack).toHaveLength(ISSUE_LIMITS.stack);
    expect(r.record.path).toHaveLength(ISSUE_LIMITS.path);
    expect(r.record.userAgent).toHaveLength(ISSUE_LIMITS.userAgent);
  });

  it("без сообщения — отказ; без стека, пути и userAgent — можно", () => {
    expect(parseIssue({ ...err, message: "" }, meta)).toEqual({ ok: false, code: "bad_message" });
    expect(parseIssue({ type: "client_error" }, meta)).toEqual({ ok: false, code: "bad_message" });
    expect(parseIssue({ type: "client_error", message: 7 }, meta)).toEqual({ ok: false, code: "bad_message" });
    const r = parseIssue({ type: "client_error", message: "boom" }, { now: meta.now, version: "dev" });
    expect(r.ok && r.record).toEqual({ type: "client_error", message: "boom", lang: null, version: "dev", at: "2026-10-04T12:00:00.000Z" });
  });
});

describe("issueChannel и лимиты потоков", () => {
  it("определяет поток по type", () => {
    expect(issueChannel({ type: "task" })).toBe("issue");
    expect(issueChannel({ type: "ai" })).toBe("issue");
    expect(issueChannel({ type: "client_error" })).toBe("client_error");
    expect(issueChannel({ type: "other" })).toBeNull();
    expect(issueChannel(null)).toBeNull();
    expect(issueChannel([])).toBeNull();
    expect(issueChannel("task")).toBeNull();
  });

  it("жалобы — 20 за 10 минут, ошибки клиента — 30; списки 5000 и 2000", () => {
    expect(ISSUE_CHANNELS.issue).toEqual({ limit: 20, windowMs: 600_000, list: "issues", max: 5000 });
    expect(ISSUE_CHANNELS.client_error).toEqual({ limit: 30, windowMs: 600_000, list: "client-errors", max: 2000 });
  });

  it("общий лимит по IP — 60 за 10 минут, суточный потолок на сайт — 3000", () => {
    expect(ISSUE_ANY_LIMIT).toEqual({ limit: 60, windowMs: 600_000 });
    expect(ISSUE_DAY_MAX).toBe(3000);
  });
});

describe("клиент: тело, ключ «уже отправлено», отправка", () => {
  const target: IssueTarget = { kind: "task", where: "drill", itemId: "bank:ns:12", snippet: "2 + 2 = ?" };

  it("buildIssueBody обрезает так же, как сервер, и не кладёт пустое", () => {
    const body = buildIssueBody({ ...target, lessonId: undefined, snippet: "с".repeat(2000) }, "typo", "   ", "ru");
    expect(body).toEqual({ type: "task", where: "drill", reason: "typo", lang: "ru", itemId: "bank:ns:12", snippet: "с".repeat(ISSUE_LIMITS.snippet) });
    // Тело от клиента проходит серверную проверку.
    expect(parseIssue(body, meta).ok).toBe(true);
  });

  it("issueKey: то же самое — тот же ключ, другое задание или другой ответ ИИ — другой", () => {
    expect(issueKey(target)).toBe(issueKey({ ...target, where: "lesson" }));
    expect(issueKey(target)).not.toBe(issueKey({ ...target, itemId: "bank:ns:13" }));
    expect(issueKey(target)).not.toBe(issueKey({ ...target, kind: "ai" }));
    const a = issueKey({ kind: "ai", where: "chat", itemId: "q1", snippet: "Ответ один" });
    const b = issueKey({ kind: "ai", where: "chat", itemId: "q1", snippet: "Ответ два" });
    expect(a).not.toBe(b);
  });

  it("submitIssue: true только если сервер ответил ok; сеть упала — false", async () => {
    const body = buildIssueBody(target, "other", "", "ru");
    const calls: { url: string; init: RequestInit }[] = [];
    const ok = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await submitIssue(body, ok)).toBe(true);
    expect(calls[0].url).toBe("/api/issue");
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init.body))).toEqual(body);
    expect(await submitIssue(body, (async () => new Response("{}", { status: 429 })) as unknown as typeof fetch)).toBe(false);
    expect(await submitIssue(body, (async () => Promise.reject(new Error("offline"))) as unknown as typeof fetch)).toBe(false);
  });
});

describe("словарь: тексты кнопки и страниц ошибок", () => {
  it("у каждого ключа issue.* и errors.* есть ru и kk", () => {
    const keys = Object.keys(dict).filter((k) => k.startsWith("issue.") || k.startsWith("errors."));
    expect(keys.length).toBeGreaterThan(15);
    for (const k of keys) {
      const v = dict[k as keyof typeof dict];
      expect(v.ru.trim(), k).not.toBe("");
      expect(v.kk.trim(), k).not.toBe("");
    }
  });

  it("в казахском — ҰБТ, не ЕНТ; нет эмодзи", () => {
    for (const k of Object.keys(dict).filter((k) => k.startsWith("issue.") || k.startsWith("errors."))) {
      const v = dict[k as keyof typeof dict];
      expect(v.kk, k).not.toMatch(/ЕНТ/);
      expect(`${v.ru}${v.kk}`, k).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

describe("POST /api/issue", () => {
  // Общее хранилище — настоящая память (счётчики лимитов работают), а запись в список — шпион.
  const mem = createMemoryKv();
  const pushCapped = vi.fn(async () => {});
  let day = "2026-10-04";
  vi.doMock("@/server/kv", () => ({ getKv: () => ({ ...mem, pushCapped }), kzDay: () => day }));

  let n = 0;
  const req = (body: unknown, headers: Record<string, string> = {}) =>
    new Request("http://localhost/api/issue", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { host: "localhost", "x-forwarded-for": `10.1.0.${++n}`, ...headers },
    });

  let POST: (r: Request) => Promise<Response>;
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  beforeEach(async () => {
    pushCapped.mockClear();
    log.mockClear();
    POST = (await import("@/app/api/issue/route")).POST;
  });

  it("жалоба: ok, строка в лог и запись в список «issues»", async () => {
    const res = await POST(req(valid));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(pushCapped).toHaveBeenCalledTimes(1);
    const [list, json, max] = pushCapped.mock.calls[0] as unknown as [string, string, number];
    expect(list).toBe("issues");
    expect(max).toBe(5000);
    expect(JSON.parse(json)).toMatchObject({ type: "task", reason: "wrong_answer", where: "lesson" });
    expect(log).toHaveBeenCalledWith(`[issue] ${json}`);
    expect(json).not.toContain("10.1.0.");
  });

  it("ошибка клиента (text/plain, как шлёт sendBeacon): список «client-errors»", async () => {
    const res = await POST(req(JSON.stringify({ type: "client_error", message: "boom", path: "/learn?x=1" }), { "content-type": "text/plain;charset=UTF-8", "user-agent": "TestPhone/1" }));
    expect(res.status).toBe(200);
    const [list, json, max] = pushCapped.mock.calls[0] as unknown as [string, string, number];
    expect(list).toBe("client-errors");
    expect(max).toBe(2000);
    expect(JSON.parse(json)).toMatchObject({ message: "boom", path: "/learn", userAgent: "TestPhone/1" });
  });

  it("чужой Origin — 403, ничего не пишется", async () => {
    const res = await POST(req(valid, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(pushCapped).not.toHaveBeenCalled();
  });

  it("не JSON, мусор и слишком большое тело — 400 / 413", async () => {
    expect((await POST(req("не json"))).status).toBe(400);
    expect((await POST(req("[1,2]"))).status).toBe(400);
    expect((await POST(req({ type: "task", where: "lesson", reason: "nope" }))).status).toBe(400);
    expect((await POST(req({ ...valid, comment: "x".repeat(ISSUE_LIMITS.body + 1) }))).status).toBe(413);
    expect(pushCapped).not.toHaveBeenCalled();
  });

  it("лимит по IP: жалоб 20, ошибок клиента 30 за окно", async () => {
    const ip = { "x-forwarded-for": "10.9.9.9" };
    for (let i = 0; i < 20; i++) expect((await POST(req(valid, ip))).status).toBe(200);
    expect((await POST(req(valid, ip))).status).toBe(429);
    // Поток ошибок клиента считается отдельно.
    const e = { type: "client_error", message: "boom" };
    for (let i = 0; i < 30; i++) expect((await POST(req(e, ip))).status).toBe(200);
    expect((await POST(req(e, ip))).status).toBe(429);
  });

  it("общий лимит по IP срабатывает до чтения тела: мусор тоже считается, тело не читается", async () => {
    const ip = { "x-forwarded-for": "10.8.8.8" };
    for (let i = 0; i < ISSUE_ANY_LIMIT.limit; i++) expect((await POST(req("не json", ip))).status).toBe(400);
    // Тело — поток: если лимит проверен до чтения, поток останется нетронутым.
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(JSON.stringify(valid)));
        c.close();
      },
    });
    const r = new Request("http://localhost/api/issue", { method: "POST", body, headers: { host: "localhost", ...ip }, duplex: "half" } as RequestInit);
    expect((await POST(r)).status).toBe(429);
    expect(r.bodyUsed).toBe(false);
    expect(pushCapped).not.toHaveBeenCalled();
  });

  it("IPv6: лимит общий на всю сеть /64 — смена адреса внутри неё не даёт новых запросов; другая /64 не задета", async () => {
    const from = (i: number) => ({ "x-forwarded-for": `2001:db8:77:1:${i.toString(16)}::${i.toString(16)}` });
    for (let i = 1; i <= ISSUE_ANY_LIMIT.limit; i++) expect((await POST(req("не json", from(i)))).status).toBe(400);
    expect((await POST(req("не json", from(999)))).status).toBe(429);
    // другая сеть /64
    expect((await POST(req("не json", { "x-forwarded-for": "2001:db8:77:2::1" }))).status).toBe(400);
    // IPv4-mapped тот же адрес, что и IPv4
    const v4 = { "x-forwarded-for": "198.51.100.5" };
    for (let i = 0; i < ISSUE_ANY_LIMIT.limit; i++) expect((await POST(req("не json", i % 2 ? { "x-forwarded-for": "::ffff:198.51.100.5" } : v4))).status).toBe(400);
    expect((await POST(req("не json", v4))).status).toBe(429);
  });

  it("тело без Content-Length читается потоком и обрывается после 8000 байт", async () => {
    let pulled = 0;
    let cancelled = false;
    const chunk = new TextEncoder().encode("x".repeat(3000));
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        // Бесконечный источник: если сервер не оборвёт чтение, тест зависнет.
        pulled++;
        c.enqueue(chunk);
      },
      cancel() {
        cancelled = true;
      },
    });
    const r = new Request("http://localhost/api/issue", { method: "POST", body, headers: { host: "localhost", "x-forwarded-for": "10.7.7.7" }, duplex: "half" } as RequestInit);
    expect(r.headers.get("content-length")).toBeNull();
    expect((await POST(r)).status).toBe(413);
    expect(cancelled).toBe(true);
    expect(pulled).toBeLessThan(10);
    expect(pushCapped).not.toHaveBeenCalled();
  });

  it("объявленный Content-Length больше 8000 — 413 без чтения; пустое тело — 400, не 0 «принято»", async () => {
    const res = await POST(req(valid, { "content-length": String(ISSUE_LIMITS.body + 1) }));
    expect(res.status).toBe(413);
    expect((await POST(req(""))).status).toBe(400);
    expect(pushCapped).not.toHaveBeenCalled();
  });

  it("предел тела — в байтах, а не в символах: кириллица занимает 2 байта", async () => {
    // 2 байта на символ: 4100 «я» — 8200 байт, больше предела, хотя «символов» меньше 8000.
    const big = JSON.stringify({ type: "client_error", message: "m", stack: "я".repeat(4100) });
    expect(new TextEncoder().encode(big).length).toBeGreaterThan(ISSUE_LIMITS.body);
    expect(big.length).toBeLessThan(ISSUE_LIMITS.body);
    expect((await POST(req(big))).status).toBe(413);
    // Обычная жалоба на кириллице — далеко от предела.
    expect((await POST(req({ ...valid, comment: "я".repeat(500), snippet: "ю".repeat(600) }))).status).toBe(200);
  });

  it("суточный потолок на весь сайт: жалобы и ошибки клиента — раздельно, сверх 3000 — 429 без записи", async () => {
    day = "2026-12-01";
    try {
      // Копим до потолка напрямую в хранилище (3000 запросов по сети здесь не нужны).
      await mem.incrBy(`issue-day:${day}:issue`, ISSUE_DAY_MAX, 86_400);
      const blocked = await POST(req(valid));
      expect(blocked.status).toBe(429);
      expect(await blocked.json()).toEqual({ error: "daily_limit" });
      expect(pushCapped).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
      // Ошибки клиента считаются отдельно — они ещё проходят.
      expect((await POST(req({ type: "client_error", message: "boom" }))).status).toBe(200);
      expect(pushCapped).toHaveBeenCalledTimes(1);
      // Завтра счётчик новый.
      day = "2026-12-02";
      expect((await POST(req(valid))).status).toBe(200);
    } finally {
      day = "2026-10-04";
    }
  });

  it("хранилище упало — ученику всё равно ok (строка в логе есть)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    pushCapped.mockRejectedValueOnce(new Error("kv down"));
    const res = await POST(req(valid));
    expect(res.status).toBe(200);
    expect(log).toHaveBeenCalled();
    err.mockRestore();
  });
});

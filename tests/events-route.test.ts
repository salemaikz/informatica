import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EVENTS_BODY_MAX, EVENTS_FIELDS_DAY_MAX, EVENTS_IP_DAY_MAX, EVENTS_IP_LIMIT, EVENTS_SITE_DAY_MAX, MAX_BATCH } from "@/lib/analytics-schema";
import { EVENTS_TTL_SEC } from "@/lib/analytics-fields";
import { LESSONS } from "@/content/course";
import { createMemoryKv } from "@/server/kv";

vi.mock("server-only", () => ({}));

// Настоящие идентификаторы из контента: сервер сверяет id с реестрами и неизвестное сводит к `other`.
const LESSON = Object.values(LESSONS)[0];
const LESSON_ID = LESSON.id;
const STEP_KEY = `${LESSON_ID}:${LESSON.steps[0].id}`;

describe("POST /api/events", () => {
  // Общее хранилище — настоящая память (счётчики лимитов работают), запись в хеш — шпион поверх неё.
  const mem = createMemoryKv();
  const hincrMany = vi.fn(mem.hincrMany);
  const incrBy = vi.fn(mem.incrBy);
  let day = "2026-10-05";
  vi.doMock("@/server/kv", () => ({ getKv: () => ({ ...mem, incrBy, hincrMany }), kzDay: () => day }));

  let n = 0;
  const req = (body: unknown, headers: Record<string, string> = {}) =>
    new Request("http://localhost/api/events", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { host: "localhost", "x-forwarded-for": `10.2.0.${++n}`, ...headers },
    });

  const lessonStart = { e: "lesson_start", lesson: LESSON_ID, via: "learn", resume: 0 };
  const task = (ok: 0 | 1) => ({ e: "task", step: STEP_KEY, ok, skip: 0, hint: 0 });

  let POST: (r: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS", "1");
    hincrMany.mockClear();
    incrBy.mockClear();
    POST = (await import("@/app/api/events/route")).POST;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("сбор выключен (нет NEXT_PUBLIC_ANALYTICS=1): 204, ничего не читается и не пишется", async () => {
    for (const value of ["", "0", "true", "yes"]) {
      vi.stubEnv("NEXT_PUBLIC_ANALYTICS", value);
      const res = await POST(req({ events: [lessonStart] }));
      expect(res.status, value).toBe(204);
    }
    expect(hincrMany).not.toHaveBeenCalled();
    expect(incrBy).not.toHaveBeenCalled();
    // Выключено — даже чужой Origin не получает отказа: маршрут ничего не делает.
    expect((await POST(req({ events: [lessonStart] }, { origin: "https://evil.example" }))).status).toBe(204);
    expect(hincrMany).not.toHaveBeenCalled();
  });

  it("верная пачка: 204 без тела, счётчики в хеше суток, срок 400 дней", async () => {
    const res = await POST(req({ events: [lessonStart, task(0), task(1)] }));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(hincrMany).toHaveBeenCalledTimes(1);
    const [key, fields, ttl] = hincrMany.mock.calls[0] as unknown as [string, Record<string, number>, number];
    expect(key).toBe("ev:2026-10-05");
    expect(ttl).toBe(EVENTS_TTL_SEC);
    expect(fields).toEqual({ lesson_start: 1, [`ls:${LESSON_ID}:learn`]: 1, task: 2, [`tk:${STEP_KEY}:n`]: 2, [`tk:${STEP_KEY}:w`]: 1 });
  });

  it("text/plain (как шлёт sendBeacon) и голый массив тоже принимаются", async () => {
    expect((await POST(req(JSON.stringify([lessonStart]), { "content-type": "text/plain;charset=UTF-8" }))).status).toBe(204);
    expect(hincrMany).toHaveBeenCalledTimes(1);
  });

  it("мусор отбрасывается, верное остаётся; ни имён, ни id устройства, ни времени в записи нет", async () => {
    const dirty = { ...lessonStart, deviceId: "dev-1", name: "Айгерим", at: 1_700_000_000_000 };
    const res = await POST(req({ events: [dirty, { e: "evil" }, "строка", null, { e: "task", step: "<b>", ok: 1, skip: 0, hint: 0 }, { e: "active", d: 99 }] }));
    expect(res.status).toBe(204);
    const [, fields] = hincrMany.mock.calls[0] as unknown as [string, Record<string, number>];
    expect(fields).toEqual({ lesson_start: 1, [`ls:${LESSON_ID}:learn`]: 1 });
    expect(JSON.stringify(hincrMany.mock.calls)).not.toMatch(/dev-1|Айгерим|1700000000000/);
  });

  it("нет ни одного верного события — 204 без записи и без счёта суточного потолка", async () => {
    expect((await POST(req({ events: [{ e: "nope" }, 5] }))).status).toBe(204);
    expect((await POST(req({ events: [] }))).status).toBe(204);
    expect((await POST(req({}))).status).toBe(204);
    expect(hincrMany).not.toHaveBeenCalled();
    // В ключах суточных потолков не бывает записи: считать нечего.
    expect(incrBy.mock.calls.filter(([k]) => String(k).startsWith("ev-"))).toEqual([]);
  });

  it("в ключах хранилища нет сырого IP — только хеш", async () => {
    const ip = "203.0.113.77";
    expect((await POST(req({ events: [lessonStart] }, { "x-forwarded-for": ip }))).status).toBe(204);
    const keys = incrBy.mock.calls.map(([k]) => String(k));
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) expect(k, k).not.toContain(ip);
    expect(keys.some((k) => /^rl:events:[0-9a-f]{20}:/.test(k))).toBe(true);
    expect(keys.some((k) => /^ev-ip:2026-10-05:[0-9a-f]{20}$/.test(k))).toBe(true);
  });

  it("чужой Origin — 403, ничего не пишется", async () => {
    const res = await POST(req({ events: [lessonStart] }, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(hincrMany).not.toHaveBeenCalled();
  });

  it("не JSON — 400; слишком большое тело — 413; пустое тело — 400", async () => {
    expect((await POST(req("не json"))).status).toBe(400);
    expect((await POST(req(""))).status).toBe(400);
    expect((await POST(req({ events: [lessonStart], pad: "x".repeat(EVENTS_BODY_MAX) }))).status).toBe(413);
    expect((await POST(req({ events: [lessonStart] }, { "content-length": String(EVENTS_BODY_MAX + 1) }))).status).toBe(413);
    expect(hincrMany).not.toHaveBeenCalled();
  });

  it("тело без Content-Length читается потоком и обрывается после 4000 байт", async () => {
    let pulled = 0;
    let cancelled = false;
    const chunk = new TextEncoder().encode("x".repeat(1500));
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
    const r = new Request("http://localhost/api/events", { method: "POST", body, headers: { host: "localhost", "x-forwarded-for": "10.7.7.7" }, duplex: "half" } as RequestInit);
    expect(r.headers.get("content-length")).toBeNull();
    expect((await POST(r)).status).toBe(413);
    expect(cancelled).toBe(true);
    expect(pulled).toBeLessThan(10);
    expect(hincrMany).not.toHaveBeenCalled();
  });

  it("в пачке не больше 30 событий: остальное не записывается", async () => {
    const many = Array.from({ length: 40 }, () => ({ e: "active", d: 1 }));
    // 40 событий «active» не влезают в 4000 байт? Влезают (по ~20 байт), значит обрезка — работа parseEvents.
    expect(JSON.stringify({ events: many }).length).toBeLessThan(EVENTS_BODY_MAX);
    expect((await POST(req({ events: many }))).status).toBe(204);
    const [, fields] = hincrMany.mock.calls[0] as unknown as [string, Record<string, number>];
    expect(fields.active).toBe(MAX_BATCH);
    expect(fields["act:1"]).toBe(MAX_BATCH);
  });

  it("лимит по IP считается до чтения тела: сверх лимита — 429, поток нетронут", async () => {
    const ip = { "x-forwarded-for": "10.9.9.9" };
    for (let i = 0; i < EVENTS_IP_LIMIT.limit; i++) expect((await POST(req("не json", ip))).status).toBe(400);
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(JSON.stringify({ events: [lessonStart] })));
        c.close();
      },
    });
    const r = new Request("http://localhost/api/events", { method: "POST", body, headers: { host: "localhost", ...ip }, duplex: "half" } as RequestInit);
    expect((await POST(r)).status).toBe(429);
    expect(r.bodyUsed).toBe(false);
    expect(hincrMany).not.toHaveBeenCalled();
    // Другой IP не задет.
    expect((await POST(req({ events: [lessonStart] }, { "x-forwarded-for": "10.9.9.10" }))).status).toBe(204);
  });

  it("IPv6: лимит общий на всю сеть /64", async () => {
    const from = (i: number) => ({ "x-forwarded-for": `2001:db8:55:1:${i.toString(16)}::${i.toString(16)}` });
    for (let i = 1; i <= EVENTS_IP_LIMIT.limit; i++) expect((await POST(req("не json", from(i)))).status).toBe(400);
    expect((await POST(req("не json", from(4095)))).status).toBe(429);
    expect((await POST(req("не json", { "x-forwarded-for": "2001:db8:55:2::1" }))).status).toBe(400);
  });

  it("суточный потолок с одного IP: сверх 10 000 событий — 429 без записи", async () => {
    const ip = { "x-forwarded-for": "10.5.5.5" };
    const batch = { events: Array.from({ length: MAX_BATCH }, () => ({ e: "active", d: 1 })) };
    const full = Math.floor(EVENTS_IP_DAY_MAX / MAX_BATCH);
    for (let i = 0; i < full; i++) expect((await POST(req(batch, ip))).status).toBe(204);
    hincrMany.mockClear();
    // Остаток до потолка — 10 событий: следующая пачка из 30 его превышает.
    expect((await POST(req(batch, ip))).status).toBe(429);
    expect(hincrMany).not.toHaveBeenCalled();
    // Другой IP в тот же день пишет.
    expect((await POST(req({ events: [lessonStart] }, { "x-forwarded-for": "10.5.5.6" }))).status).toBe(204);
  });

  it("суточный потолок на сайт: сверх 50 000 — 429 без записи; завтра счётчик новый", async () => {
    day = "2026-12-01";
    try {
      await mem.incrBy(`ev-site:${day}`, EVENTS_SITE_DAY_MAX, 86_400);
      const blocked = await POST(req({ events: [lessonStart] }));
      expect(blocked.status).toBe(429);
      expect(await blocked.json()).toEqual({ error: "daily_limit" });
      expect(hincrMany).not.toHaveBeenCalled();
      day = "2026-12-02";
      expect((await POST(req({ events: [lessonStart] }))).status).toBe(204);
      expect(hincrMany).toHaveBeenCalledTimes(1);
      expect(hincrMany.mock.calls[0][0]).toBe("ev:2026-12-02");
    } finally {
      day = "2026-10-05";
    }
  });

  it("бюджет новых полей считается: растёт на число созданных полей, повтор тех же полей его не тратит", async () => {
    day = "2027-01-11";
    try {
      expect((await POST(req({ events: [lessonStart, task(0)] }))).status).toBe(204);
      // lesson_start, ls:…, task, tk:…:n, tk:…:w
      expect(await mem.get(`ev-fields:${day}`)).toBe(5);
      expect((await POST(req({ events: [lessonStart, task(0)] }))).status).toBe(204);
      expect(await mem.get(`ev-fields:${day}`)).toBe(5);
    } finally {
      day = "2026-10-05";
    }
  });

  it("бюджет новых полей за сутки исчерпан (выдуманные id): пишутся только счётчики событий, без измерений", async () => {
    day = "2027-01-10";
    try {
      await mem.incrBy(`ev-fields:${day}`, EVENTS_FIELDS_DAY_MAX, 86_400);
      expect((await POST(req({ events: [lessonStart, task(0), { ...lessonStart, lesson: "fake-lesson-123" }] }))).status).toBe(204);
      const [, fields] = hincrMany.mock.calls[0] as unknown as [string, Record<string, number>];
      expect(fields).toEqual({ lesson_start: 2, task: 1 });
      // Завтра бюджет новый.
      day = "2027-01-11";
      hincrMany.mockClear();
      expect((await POST(req({ events: [lessonStart] }))).status).toBe(204);
      expect(Object.keys((hincrMany.mock.calls[0] as unknown as [string, Record<string, number>])[1])).toContain(`ls:${LESSON_ID}:learn`);
    } finally {
      day = "2026-10-05";
    }
  });

  it("C2: неизвестные урок, шаг, игра, режим, товар и шаг онбординга сводятся к `other` — число полей ограничено контентом", async () => {
    day = "2027-02-10";
    try {
      const fake = Array.from({ length: 25 }, (_, i) => [
        { e: "lesson_start", lesson: `fake-lesson-${i}`, via: "learn", resume: 0 },
        { e: "task", step: `fake-lesson-${i}:q-${i}`, ok: 0, skip: 0, hint: 0 },
        { e: "game_start", game: `game-${i}`, lesson: 0 },
      ]).flat();
      // 75 событий не влезают в пачку (30) и в тело (4000 байт): шлём несколькими запросами, как клиент
      for (let i = 0; i < fake.length; i += 25) expect((await POST(req({ events: fake.slice(i, i + 25) }))).status).toBe(204);
      const written = new Set(hincrMany.mock.calls.flatMap((c) => Object.keys((c as unknown as [string, Record<string, number>])[1])));
      expect([...written].sort()).toEqual(["game_start", "gs:other", "lesson_start", "ls:other:learn", "task", "tk:other:n", "tk:other:w"]);
      expect(JSON.stringify([...written])).not.toContain("fake-lesson");
    } finally {
      day = "2026-10-05";
    }
  });

  it("C1: id с именем из Object.prototype (constructor, __proto__…) — событие отбрасывается, ничего не пишется", async () => {
    const poisoned = ["constructor", "__proto__", "toString", "hasOwnProperty", "prototype", "constructor:x"].flatMap((bad) => [
      { e: "lesson_start", lesson: bad, via: "learn", resume: 0 },
      { e: "task", step: bad, ok: 0, skip: 0, hint: 0 },
      { e: "drill_start", mode: bad },
    ]);
    expect((await POST(req({ events: poisoned.slice(0, 30) }))).status).toBe(204);
    expect(hincrMany).not.toHaveBeenCalled();
  });

  it("C4: IP над суточным потолком не наращивает счётчик сайта — другие ученики не теряют статистику", async () => {
    day = "2027-02-11";
    try {
      const ip = { "x-forwarded-for": "10.8.8.8" };
      const batch = { events: Array.from({ length: MAX_BATCH }, () => ({ e: "active", d: 1 })) };
      const accepted = Math.floor(EVENTS_IP_DAY_MAX / MAX_BATCH);
      for (let i = 0; i < accepted; i++) expect((await POST(req(batch, ip))).status).toBe(204);
      for (let i = 0; i < 20; i++) expect((await POST(req(batch, ip))).status).toBe(429);
      // Сайт посчитал только принятое: отказанные запросы счёт не двигают.
      expect(await mem.get(`ev-site:${day}`)).toBe(accepted * MAX_BATCH);
      // Остальные по-прежнему пишут.
      expect((await POST(req({ events: [lessonStart] }, { "x-forwarded-for": "10.8.8.9" }))).status).toBe(204);
    } finally {
      day = "2026-10-05";
    }
  });

  it("бюджет новых полей: резерв до сравнения — параллельные запросы не проскакивают потолок", async () => {
    day = "2027-02-12";
    try {
      await mem.incrBy(`ev-fields:${day}`, EVENTS_FIELDS_DAY_MAX - 1, 86_400);
      const results = await Promise.all(Array.from({ length: 10 }, () => POST(req({ events: [lessonStart, task(0)] }))));
      expect(results.every((r) => r.status === 204)).toBe(true);
      // До потолка оставалось одно поле, а пачка резервирует три измерения: ни одна не прошла с измерениями.
      for (const c of hincrMany.mock.calls) expect(Object.keys((c as unknown as [string, Record<string, number>])[1]).every((k) => !k.includes(":"))).toBe(true);
      // Резерв возвращён: счётчик не «убежал» за потолок на число отклонённых запросов.
      expect(await mem.get(`ev-fields:${day}`)).toBeLessThanOrEqual(EVENTS_FIELDS_DAY_MAX + 2);
    } finally {
      day = "2026-10-05";
    }
  });

  it("хранилище упало при записи — клиенту всё равно 204, в лог ошибка без данных", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    hincrMany.mockRejectedValueOnce(new Error("kv down"));
    expect((await POST(req({ events: [lessonStart] }))).status).toBe(204);
    expect(err).toHaveBeenCalledTimes(1);
    expect(String(err.mock.calls[0])).not.toContain(LESSON_ID);
  });
});

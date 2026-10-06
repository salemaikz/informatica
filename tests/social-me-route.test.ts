import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

vi.mock("server-only", () => ({}));

// Маршруты профиля игрока /api/social/me и /api/social/home: вызываем обработчики с Request, хранилище — память
// (или подменный Upstash), как в ai-routes-guard.test.ts.
const holder = vi.hoisted(() => ({ kv: null as null | import("@/server/kv").Kv }));
vi.mock("@/server/kv", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/kv")>();
  return { ...real, getKv: () => holder.kv!, getStrictKv: () => holder.kv! };
});

const { createMemoryKv, createUpstashKv } = await import("@/server/kv");
const me = await import("@/app/api/social/me/route");
const home = await import("@/app/api/social/home/route");
const { kzIsoWeek, PLAYER_COOKIE } = await import("@/server/social/player");

let ipN = 0;
const freshIp = () => `10.9.${Math.floor(++ipN / 250)}.${ipN % 250}`;

const req = (method: string, path: string, opts: { body?: unknown; cookie?: string | null; ip?: string; headers?: Record<string, string> } = {}) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      host: "localhost",
      "x-forwarded-for": opts.ip ?? freshIp(),
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
      ...opts.headers,
    },
    ...(opts.body !== undefined ? { body: typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body) } : {}),
  });

/** cookie игрока из ответа («inf_pl=…» для заголовка Cookie). */
const cookieOf = (res: Response): string | null => {
  const sc = res.headers.get("set-cookie");
  const m = sc ? new RegExp(`${PLAYER_COOKIE}=([^;]*)`).exec(sc) : null;
  return m ? `${PLAYER_COOKIE}=${m[1]}` : null;
};
const pidOf = (cookie: string) => cookie.slice(PLAYER_COOKIE.length + 1, PLAYER_COOKIE.length + 23);

const profile = (over: Record<string, unknown> = {}) => ({ name: "Әсем", lang: "kk", lv: 7, cosmetics: { frame: "frame-neon", title: "title-bit-lord" }, ft: true, ...over });

/** Создать игрока: cookie и ответ. */
async function create(over: Record<string, unknown> = {}) {
  const res = await me.POST(req("POST", "/api/social/me", { body: profile(over) }));
  const json = await res.json();
  return { res, json, cookie: cookieOf(res)! };
}

const kv = () => holder.kv!;
let info: MockInstance<typeof console.info>;

beforeEach(() => {
  holder.kv = createMemoryKv();
  vi.stubEnv("SOCIAL_SECRET", "test-social-secret");
  vi.stubEnv("SOCIAL_MEMORY_OK", "1");
  vi.stubEnv("SOCIAL_NAMES", "");
  info = vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("выключатели соцчасти", () => {
  it("нет SOCIAL_SECRET — 503 social_disabled на всех маршрутах", async () => {
    vi.stubEnv("SOCIAL_SECRET", "");
    for (const res of [
      await me.GET(req("GET", "/api/social/me")),
      await me.POST(req("POST", "/api/social/me", { body: profile() })),
      await me.DELETE(req("DELETE", "/api/social/me")),
      await home.GET(req("GET", "/api/social/home")),
    ]) {
      expect(res.status).toBe(503);
      expect((await res.json()).error).toBe("social_disabled");
    }
  });

  it("память без SOCIAL_MEMORY_OK=1 — выключено (production без Upstash)", async () => {
    vi.stubEnv("SOCIAL_MEMORY_OK", "");
    const res = await me.POST(req("POST", "/api/social/me", { body: profile() }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("social_disabled");
  });

  it("Upstash не ответил — 503 social_unavailable, без тихого отката в память", async () => {
    const fetchMock = (async () => new Response("down", { status: 500 })) as unknown as typeof fetch;
    holder.kv = createUpstashKv("https://x.upstash.io", "tok", null, fetchMock);
    vi.stubEnv("SOCIAL_MEMORY_OK", "");
    const post = await me.POST(req("POST", "/api/social/me", { body: profile() }));
    expect(post.status).toBe(503);
    expect((await post.json()).error).toBe("social_unavailable");
    expect(post.headers.get("set-cookie")).toBeNull();
  });

  it("чужой сайт — 403 (изменения и чтение)", async () => {
    const post = await me.POST(req("POST", "/api/social/me", { body: profile(), headers: { origin: "https://evil.example" } }));
    expect(post.status).toBe(403);
    const get = await me.GET(req("GET", "/api/social/me", { headers: { "sec-fetch-site": "cross-site" } }));
    expect(get.status).toBe(403);
    const ok = await me.GET(req("GET", "/api/social/me", { headers: { "sec-fetch-site": "same-origin" } }));
    expect(ok.status).toBe(200);
  });
});

describe("POST /api/social/me — создание и обновление", () => {
  it("новый игрок: cookie inf_pl (HttpOnly, SameSite=Lax, Path=/api, 400 дней), код друга, имя после проверки", async () => {
    const { res, json, cookie } = await create();
    expect(res.status).toBe(200);
    const sc = res.headers.get("set-cookie")!;
    expect(sc).toMatch(/^inf_pl=[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{22}; HttpOnly; SameSite=Lax; Path=\/api; Max-Age=34560000$/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(json.player).toEqual({
      code: expect.stringMatching(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/),
      name: "Әсем",
      lv: 7,
      frame: "frame-neon",
      title: "title-bit-lord",
      nameState: "ok",
      lang: "kk",
      ft: true,
    });
    expect(json.nameState).toBe("ok");
    const pid = pidOf(cookie);
    expect(await kv().getStr(`pl:code:${json.player.code}`)).toBe(pid);
    expect(JSON.parse((await kv().getStr(`pl:c:${pid}`))!)).toEqual({ c: json.player.code, n: "Әсем", lv: 7, fr: "frame-neon", ti: "title-bit-lord" });
    const h = await kv().hgetAllStr(`pl:${pid}`);
    expect(h).toMatchObject({ code: json.player.code, name: "Әсем", nameState: "ok", lv: "7", lang: "kk", ft: "1" });
    // Ничего лишнего о ребёнке на сервере нет.
    expect(Object.keys(h).sort()).toEqual(["code", "created", "frame", "ft", "lang", "lv", "name", "nameState", "seen", "title"]);
  });

  it("повторный POST с cookie обновляет тот же профиль и не ставит cookie заново", async () => {
    const { json, cookie } = await create();
    const res = await me.POST(req("POST", "/api/social/me", { cookie, body: profile({ lv: 12, ft: false, cosmetics: {} }) }));
    const upd = await res.json();
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(upd.player).toMatchObject({ code: json.player.code, lv: 12, ft: false, frame: null, title: null, name: "Әсем" });
    const get = await (await me.GET(req("GET", "/api/social/me", { cookie }))).json();
    expect(get.player).toEqual(upd.player);
  });

  it("украшения: чужой слот и неизвестный id — null; уровень обрезается 1..999", async () => {
    const { json } = await create({ lv: 5000, cosmetics: { frame: "title-legend", title: "<script>" } });
    expect(json.player).toMatchObject({ lv: 999, frame: null, title: null });
  });

  it("имя не прошло фильтр — rejected, имя не хранится, отдаётся код отказа (без слова)", async () => {
    const { json, cookie } = await create({ name: "Сука" });
    expect(json.player.name).toBeNull();
    expect(json.nameState).toBe("rejected");
    expect(json.hint).toBe("blocked");
    const pid = pidOf(cookie);
    const h = await kv().hgetAllStr(`pl:${pid}`);
    expect(h.name).toBeUndefined();
    expect(JSON.stringify(h)).not.toMatch(/сука/i);
    expect(JSON.parse((await kv().getStr(`pl:c:${pid}`))!).n).toBeNull();
    // Причина-слово не уходит в лог.
    expect(JSON.stringify(info.mock.calls)).not.toMatch(/сука/i);
  });

  it("смен имени — не больше 5 в сутки (первое имя тоже считается); тот же ввод не тратит смену", async () => {
    const { cookie } = await create({ name: "Аня" });
    const names = ["Даня", "Ваня", "Таня", "Саня"];
    for (const name of names) {
      const r = await (await me.POST(req("POST", "/api/social/me", { cookie, body: profile({ name }) }))).json();
      expect(r.player.name, name).toBe(name);
    }
    // Шестая смена за сутки — отказ, имя прежнее.
    const over = await (await me.POST(req("POST", "/api/social/me", { cookie, body: profile({ name: "Ксюша" }) }))).json();
    expect(over.hint).toBe("limit");
    expect(over.player.name).toBe("Саня");
    // Тот же ввод — без проверки и без лимита.
    const same = await (await me.POST(req("POST", "/api/social/me", { cookie, body: profile({ name: "  Саня " }) }))).json();
    expect(same.hint).toBeUndefined();
    expect(same.player.name).toBe("Саня");
  });

  it("отклонённое имя, присланное повторно, не тратит смены и снова отвечает тем же кодом", async () => {
    const { cookie } = await create({ name: "Бот" });
    for (let i = 0; i < 8; i++) {
      const r = await (await me.POST(req("POST", "/api/social/me", { cookie, body: profile({ name: "Бот" }) }))).json();
      expect(r).toMatchObject({ nameState: "rejected", hint: "reserved" });
    }
    const ok = await (await me.POST(req("POST", "/api/social/me", { cookie, body: profile({ name: "Нұрай" }) }))).json();
    expect(ok.player.name).toBe("Нұрай");
  });

  it("имя пустое — стирается (none)", async () => {
    const { cookie } = await create();
    const r = await (await me.POST(req("POST", "/api/social/me", { cookie, body: profile({ name: "" }) }))).json();
    expect(r.player).toMatchObject({ name: null, nameState: "none" });
    expect((await kv().hgetAllStr(`pl:${pidOf(cookie)}`)).name).toBeUndefined();
  });

  it("SOCIAL_NAMES=0 — имя, сохранённое раньше, стирается из хранилища при первом чтении (GET /me и /home)", async () => {
    const a = await create({ name: "Әсем" });
    const b = await create({ name: "Сука" }); // отклонённое: в профиле только отпечаток nameTry
    const pa = pidOf(a.cookie);
    const pb = pidOf(b.cookie);
    expect((await kv().hgetAllStr(`pl:${pa}`)).name).toBe("Әсем");
    expect((await kv().hgetAllStr(`pl:${pb}`)).nameTry).toBeTruthy();
    vi.stubEnv("SOCIAL_NAMES", "0");
    await me.GET(req("GET", "/api/social/me", { cookie: a.cookie }));
    await home.GET(req("GET", "/api/social/home", { cookie: b.cookie }));
    for (const pid of [pa, pb]) {
      const h = await kv().hgetAllStr(`pl:${pid}`);
      expect(h.name).toBeUndefined();
      expect(h.nameTry).toBeUndefined();
      expect(h.nameState).toBe("off");
      expect(JSON.parse((await kv().getStr(`pl:c:${pid}`))!).n).toBeNull();
    }
    // Повторное чтение — уже без лишних команд (лог: GET /me = 1 команда).
    info.mockClear();
    await me.GET(req("GET", "/api/social/me", { cookie: a.cookie }));
    expect(String(info.mock.calls.at(-1)?.[0])).toMatch(/cmds=1\b/);
  });

  it("отпечаток отклонённого имени солится секретом и pid (не sha256 самого ввода)", async () => {
    const { createHash } = await import("node:crypto");
    const a = await create({ name: "Бот" });
    const b = await create({ name: "Бот" });
    const ta = (await kv().hgetAllStr(`pl:${pidOf(a.cookie)}`)).nameTry.split(":")[0];
    const tb = (await kv().hgetAllStr(`pl:${pidOf(b.cookie)}`)).nameTry.split(":")[0];
    expect(ta).not.toBe(tb);
    const plain = createHash("sha256").update("name-try:бот").digest("base64url").slice(0, 12);
    expect([ta, tb]).not.toContain(plain);
  });

  it("SOCIAL_NAMES=0 — имя не хранится и не отдаётся, в том числе сохранённое раньше", async () => {
    const { cookie } = await create({ name: "Әсем" });
    vi.stubEnv("SOCIAL_NAMES", "0");
    const get = await (await me.GET(req("GET", "/api/social/me", { cookie }))).json();
    expect(get.player).toMatchObject({ name: null, nameState: "off" });
    const post = await (await me.POST(req("POST", "/api/social/me", { cookie, body: profile({ name: "Мадина" }) }))).json();
    expect(post.player).toMatchObject({ name: null, nameState: "off" });
    const pid = pidOf(cookie);
    expect((await kv().hgetAllStr(`pl:${pid}`)).name).toBeUndefined();
    expect(JSON.parse((await kv().getStr(`pl:c:${pid}`))!).n).toBeNull();
    const fresh = await create({ name: "Дана" });
    expect(fresh.json.player.name).toBeNull();
    expect(await kv().getStr(`pl:c:${pidOf(fresh.cookie)}`)).not.toMatch(/Дана/);
  });

  it("новых игроков с одного IP — не больше лимита в сутки (SOCIAL_NEW_PLAYERS_PER_IP)", async () => {
    vi.stubEnv("SOCIAL_NEW_PLAYERS_PER_IP", "2");
    const ip = "10.200.0.1";
    expect((await me.POST(req("POST", "/api/social/me", { ip, body: profile() }))).status).toBe(200);
    expect((await me.POST(req("POST", "/api/social/me", { ip, body: profile() }))).status).toBe(200);
    const third = await me.POST(req("POST", "/api/social/me", { ip, body: profile() }));
    expect(third.status).toBe(429);
    expect((await third.json()).error).toBe("daily_limit");
    expect(third.headers.get("set-cookie")).toBeNull();
  });

  it("поддельная cookie (чужая подпись) — новый игрок, а не чужой профиль", async () => {
    const { cookie, json } = await create();
    const forged = `${cookie.slice(0, -3)}abc`;
    const r = await me.POST(req("POST", "/api/social/me", { cookie: forged, body: profile() }));
    expect(cookieOf(r)).not.toBeNull();
    expect((await r.json()).player.code).not.toBe(json.player.code);
    expect((await (await me.GET(req("GET", "/api/social/me", { cookie: forged }))).json()).player).toBeNull();
  });

  it("плохое тело — 400, слишком большое — 413, не объект — 400", async () => {
    expect((await me.POST(req("POST", "/api/social/me", { body: "{нет" }))).status).toBe(400);
    expect((await me.POST(req("POST", "/api/social/me", { body: JSON.stringify({ name: "x".repeat(5000) }) }))).status).toBe(413);
    const arr = await me.POST(req("POST", "/api/social/me", { body: [1, 2] }));
    expect(arr.status).toBe(400);
    expect((await arr.json()).error).toBe("bad_request");
  });

  it("лог: route, 6 знаков pid и число команд; без имени и IP", async () => {
    const { cookie } = await create({ name: "Мирас" });
    const line = info.mock.calls.map((c) => String(c[0])).find((l) => l.startsWith("[social] route=me.post"));
    expect(line).toMatch(new RegExp(`^\\[social\\] route=me\\.post pid=${pidOf(cookie).slice(0, 6)} cmds=\\d+$`));
    expect(JSON.stringify(info.mock.calls)).not.toMatch(/Мирас|10\.9\./);
  });
});

describe("GET /api/social/me и /home", () => {
  it("без cookie — player: null", async () => {
    expect(await (await me.GET(req("GET", "/api/social/me"))).json()).toEqual({ player: null });
    expect(await (await home.GET(req("GET", "/api/social/home"))).json()).toEqual({ player: null, inbox: [], requests: 0 });
  });

  it("home: профиль, входящие (разобранный JSON, мусор пропущен) и число заявок — 3 команды", async () => {
    const { cookie, json } = await create();
    const pid = pidOf(cookie);
    await kv().pipeline([
      { op: "lpush", key: `pl:inbox:${pid}`, value: JSON.stringify({ t: "room", code: "ABC123" }) },
      { op: "lpush", key: `pl:inbox:${pid}`, value: "не json" },
      { op: "sadd", key: `pl:frq:${pid}`, members: ["x", "y"] },
    ]);
    info.mockClear();
    const res = await (await home.GET(req("GET", "/api/social/home", { cookie }))).json();
    expect(res).toEqual({ player: json.player, inbox: [{ t: "room", code: "ABC123" }], requests: 2 });
    expect(String(info.mock.calls.at(-1)?.[0])).toMatch(/route=home pid=\S{6} cmds=3$/);
  });
});

describe("DELETE /api/social/me — удалить профиль соревнований", () => {
  it("удаляет профиль, карточку, код, друзей с обеих сторон, топ недели и снимает cookie", async () => {
    const a = await create({ name: "Әсем" });
    const b = await create({ name: "Дана" });
    const pa = pidOf(a.cookie);
    const pb = pidOf(b.cookie);
    const week = kzIsoWeek(Date.now());
    await kv().pipeline([
      { op: "sadd", key: `pl:fr:${pa}`, members: [pb] },
      { op: "sadd", key: `pl:fr:${pb}`, members: [pa] },
      { op: "sadd", key: `pl:frq:${pa}`, members: [pb] },
      { op: "sadd", key: `pl:blk:${pa}`, members: ["zz"] },
      { op: "lpush", key: `pl:inbox:${pa}`, value: "{}" },
      { op: "zincrBy", key: `top:w:${week}`, n: 3, member: pa },
      { op: "zincrBy", key: `top:w:${week}`, n: 1, member: pb },
    ]);
    const res = await me.DELETE(req("DELETE", "/api/social/me", { cookie: a.cookie }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("set-cookie")).toMatch(/^inf_pl=; HttpOnly; SameSite=Lax; Path=\/api; Max-Age=0/);
    expect(await kv().hgetAllStr(`pl:${pa}`)).toEqual({});
    expect(await kv().getStr(`pl:c:${pa}`)).toBeNull();
    expect(await kv().getStr(`pl:code:${a.json.player.code}`)).toBeNull();
    expect(await kv().smembers(`pl:fr:${pa}`)).toEqual([]);
    expect(await kv().smembers(`pl:fr:${pb}`)).toEqual([]);
    expect(await kv().scard(`pl:frq:${pa}`)).toBe(0);
    expect(await kv().scard(`pl:blk:${pa}`)).toBe(0);
    expect(await kv().lrange(`pl:inbox:${pa}`, 0, -1)).toEqual([]);
    expect(await kv().zmscore(`top:w:${week}`, [pa, pb])).toEqual([null, 1]);
    // Второй игрок цел.
    expect((await (await me.GET(req("GET", "/api/social/me", { cookie: b.cookie }))).json()).player.name).toBe("Дана");
    expect((await (await me.GET(req("GET", "/api/social/me", { cookie: a.cookie }))).json()).player).toBeNull();
  });

  it("без cookie — ok и снятие cookie (повторное удаление безопасно)", async () => {
    const res = await me.DELETE(req("DELETE", "/api/social/me"));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/);
  });

  it("после удаления тот же браузер создаёт профиль заново (новый код)", async () => {
    const a = await create();
    await me.DELETE(req("DELETE", "/api/social/me", { cookie: a.cookie }));
    const again = await me.POST(req("POST", "/api/social/me", { cookie: a.cookie, body: profile() }));
    expect(again.status).toBe(200);
    expect((await again.json()).player.code).not.toBe(a.json.player.code);
  });
});

describe("неделя по Астане", () => {
  it("понедельник 00:00 по Астане — новая неделя; 53-я неделя 2026 года", () => {
    expect(kzIsoWeek(Date.UTC(2026, 9, 4, 18, 59))).toBe("2026-W40"); // вс 23:59 Астана
    expect(kzIsoWeek(Date.UTC(2026, 9, 4, 19, 0))).toBe("2026-W41"); // пн 00:00 Астана
    expect(kzIsoWeek(Date.UTC(2026, 11, 31, 12))).toBe("2026-W53");
    expect(kzIsoWeek(Date.UTC(2027, 0, 4, 12))).toBe("2027-W01");
  });
});

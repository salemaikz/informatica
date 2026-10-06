import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

vi.mock("server-only", () => ({}));

// Ф3 дуэлей: друзья, приглашения по ссылке, блокировка, топ друзей, жалобы и решения владельца. Обработчики маршрутов
// вызываются с Request, хранилище — память (как в social-me-route.test.ts).
const holder = vi.hoisted(() => ({ kv: null as null | import("@/server/kv").Kv }));
vi.mock("@/server/kv", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/kv")>();
  return { ...real, getKv: () => holder.kv!, getStrictKv: () => holder.kv! };
});

const { createMemoryKv } = await import("@/server/kv");
const me = await import("@/app/api/social/me/route");
const home = await import("@/app/api/social/home/route");
const friends = await import("@/app/api/social/friends/route");
const request = await import("@/app/api/social/friends/request/route");
const respond = await import("@/app/api/social/friends/respond/route");
const unfriend = await import("@/app/api/social/friends/[code]/route");
const block = await import("@/app/api/social/block/route");
const inviteCreate = await import("@/app/api/social/invite-link/route");
const inviteView = await import("@/app/api/social/invite-link/[token]/route");
const inviteAccept = await import("@/app/api/social/invite-link/[token]/accept/route");
const top = await import("@/app/api/social/top/friends/route");
const report = await import("@/app/api/social/report/route");
const owner = await import("@/app/api/owner/social/route");
const { PLAYER_COOKIE } = await import("@/server/social/player");
const { countingKv } = await import("@/server/social/kv");
const { awardWeek } = await import("@/server/social/tops");
const { OWNER_COOKIE, signOwnerCookie } = await import("@/server/owner-auth");
const { formatFriendCode } = await import("@/lib/friend-code");

let ipN = 0;
const freshIp = () => `10.7.${Math.floor(++ipN / 250)}.${ipN % 250}`;

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
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });

const cookieOf = (res: Response): string => {
  const m = new RegExp(`${PLAYER_COOKIE}=([^;]*)`).exec(res.headers.get("set-cookie") ?? "");
  return `${PLAYER_COOKIE}=${m![1]}`;
};
const pidOf = (cookie: string) => cookie.slice(PLAYER_COOKIE.length + 1, PLAYER_COOKIE.length + 23);
const ctxOf = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) });

interface Player {
  cookie: string;
  code: string;
  pid: string;
}

async function create(name: string, over: Record<string, unknown> = {}): Promise<Player> {
  const res = await me.POST(req("POST", "/api/social/me", { body: { name, lang: "ru", lv: 4, cosmetics: { frame: null, title: null }, ft: true, ...over } }));
  const json = await res.json();
  const cookie = cookieOf(res);
  return { cookie, code: json.player.code, pid: pidOf(cookie) };
}

const post = async <T = Record<string, unknown>>(mod: { POST: (r: Request) => Promise<Response> }, path: string, p: Player | null, body?: unknown) => {
  const res = await mod.POST(req("POST", path, { body, cookie: p?.cookie }));
  return { status: res.status, json: (await res.json()) as T };
};
const get = async <T = Record<string, unknown>>(mod: { GET: (r: Request) => Promise<Response> }, path: string, p: Player | null) => {
  const res = await mod.GET(req("GET", path, { cookie: p?.cookie }));
  return { status: res.status, json: (await res.json()) as T };
};
const lists = (p: Player) => get<{ friends: { code: string }[]; requests: { code: string }[]; blocked: { code: string }[] }>(friends, "/api/social/friends", p);
const codes = (cards: { code: string }[]) => cards.map((c) => c.code).sort();

let clock = Date.UTC(2026, 9, 6, 8, 0, 0);
let info: MockInstance<typeof console.info>;
/** Число команд Redis из лога `[social] route=<name> … cmds=N` (последний вызов маршрута). */
const cmdsOf = (route: string): number => {
  const lines = info.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith(`[social] route=${route} `));
  return Number(/cmds=(\d+)/.exec(lines[lines.length - 1] ?? "")?.[1] ?? NaN);
};

beforeEach(() => {
  holder.kv = createMemoryKv(() => clock);
  clock = Date.UTC(2026, 9, 6, 8, 0, 0);
  vi.spyOn(Date, "now").mockImplementation(() => clock);
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

describe("обвязка маршрутов Ф3", () => {
  it("нет SOCIAL_SECRET — 503 social_disabled; нет игрока — 401 no_player; чужой сайт — 403", async () => {
    const a = await create("Айжан");
    vi.stubEnv("SOCIAL_SECRET", "");
    expect((await post(request, "/api/social/friends/request", a, { code: "K7QF29XM" })).json.error).toBe("social_disabled");
    expect((await get(top, "/api/social/top/friends", a)).status).toBe(503);
    vi.stubEnv("SOCIAL_SECRET", "test-social-secret");
    for (const r of [
      await post(request, "/api/social/friends/request", null, { code: a.code }),
      await post(respond, "/api/social/friends/respond", null, { code: a.code, accept: true }),
      await post(block, "/api/social/block", null, { code: a.code }),
      await post(inviteCreate, "/api/social/invite-link", null),
      await post(report, "/api/social/report", null, { code: a.code, reason: "name", where: "friend" }),
      await get(top, "/api/social/top/friends", null),
      await get(friends, "/api/social/friends", null),
    ]) {
      expect(r.status).toBe(401);
      expect(r.json.error).toBe("no_player");
    }
    const evil = await request.POST(req("POST", "/api/social/friends/request", { body: { code: a.code }, cookie: a.cookie, headers: { origin: "https://evil.example" } }));
    expect(evil.status).toBe(403);
  });

  it("неверное тело — 400; слишком большое — 413", async () => {
    const a = await create("Айжан");
    expect((await post(request, "/api/social/friends/request", a, { code: 5 })).status).toBe(400);
    expect((await post(respond, "/api/social/friends/respond", a, { code: "X", accept: "yes" })).status).toBe(400);
    expect((await post(report, "/api/social/report", a, { code: a.code, reason: "ugly", where: "friend" })).status).toBe(400);
    expect((await post(request, "/api/social/friends/request", a, { code: "x".repeat(2000) })).status).toBe(413);
  });
});

describe("заявки в друзья по коду", () => {
  it("заявка → у владельца кода в заявках → принять → друзья с обеих сторон", async () => {
    const a = await create("Айжан");
    const b = await create("Болат");
    // Ввод ученика: нижний регистр и дефис.
    const sent = await post(request, "/api/social/friends/request", b, { code: formatFriendCode(a.code).toLowerCase() });
    expect(sent.json).toEqual({ status: "sent" });
    expect(cmdsOf("friends.request")).toBeLessThanOrEqual(16);
    expect(codes((await lists(a)).json.requests)).toEqual([b.code]);
    expect((await lists(b)).json.friends).toEqual([]);

    const ok = await post(respond, "/api/social/friends/respond", a, { code: b.code, accept: true });
    expect(ok.json).toEqual({ status: "accepted" });
    const la = (await lists(a)).json;
    expect(codes(la.friends)).toEqual([b.code]);
    expect(la.requests).toEqual([]);
    expect(cmdsOf("friends.list")).toBe(4);
    expect(codes((await lists(b)).json.friends)).toEqual([a.code]);
    // Карточка друга — только публичные поля.
    expect(Object.keys((await lists(b)).json.friends[0]).sort()).toEqual(["code", "frame", "lv", "name", "title"]);

    expect((await post(request, "/api/social/friends/request", b, { code: a.code })).json.status).toBe("already");
    expect((await post(request, "/api/social/friends/request", a, { code: a.code })).json.status).toBe("self");
    expect((await post(request, "/api/social/friends/request", a, { code: "ZZZZ-ZZZZ" })).json.status).toBe("not_found");
  });

  it("встречная заявка — сразу дружба; отказ молчаливый; удалить — с обеих сторон", async () => {
    const a = await create("Айжан");
    const c = await create("Сауле");
    await post(request, "/api/social/friends/request", c, { code: a.code });
    expect((await post(request, "/api/social/friends/request", a, { code: c.code })).json.status).toBe("accepted");
    expect(codes((await lists(c)).json.friends)).toEqual([a.code]);

    const unf = await unfriend.DELETE(req("DELETE", `/api/social/friends/${c.code}`, { cookie: a.cookie }), ctxOf({ code: c.code }));
    expect(unf.status).toBe(200);
    expect((await lists(a)).json.friends).toEqual([]);
    expect((await lists(c)).json.friends).toEqual([]);

    const d = await create("Данияр");
    await post(request, "/api/social/friends/request", d, { code: a.code });
    expect((await post(respond, "/api/social/friends/respond", a, { code: d.code, accept: false })).json.status).toBe("declined");
    expect((await lists(a)).json.requests).toEqual([]);
    expect((await lists(d)).json.friends).toEqual([]);
    expect((await post(respond, "/api/social/friends/respond", a, { code: d.code, accept: true })).json.status).toBe("not_found");
  });

  it("блокировка: дружба снимается, заявка заблокированного — «sent», но не доходит; разблокировать", async () => {
    const a = await create("Айжан");
    const b = await create("Болат");
    await post(request, "/api/social/friends/request", b, { code: a.code });
    await post(respond, "/api/social/friends/respond", a, { code: b.code, accept: true });
    expect((await post(block, "/api/social/block", a, { code: b.code })).json).toEqual({ ok: true });
    expect((await lists(a)).json.friends).toEqual([]);
    expect((await lists(b)).json.friends).toEqual([]);
    expect(codes((await lists(a)).json.blocked)).toEqual([b.code]);
    // Блокировку не раскрываем.
    expect((await post(request, "/api/social/friends/request", b, { code: a.code })).json.status).toBe("sent");
    expect((await lists(a)).json.requests).toEqual([]);
    await post(block, "/api/social/block", a, { code: b.code, off: true });
    expect((await lists(a)).json.blocked).toEqual([]);
  });

  it("лимит заявок: 20 в час на игрока — 429", async () => {
    const a = await create("Айжан");
    const b = await create("Болат");
    for (let k = 0; k < 20; k++) expect((await post(request, "/api/social/friends/request", b, { code: a.code })).status).toBe(200);
    expect((await post(request, "/api/social/friends/request", b, { code: a.code })).status).toBe(429);
  });
});

describe("ссылка-приглашение /f/<token>", () => {
  it("создать (живая переиспользуется) → посмотреть (GET ничего не меняет) → добавиться POST", async () => {
    const a = await create("Айжан");
    const first = await post<{ url: string }>(inviteCreate, "/api/social/invite-link", a);
    expect(first.json.url).toMatch(/^\/f\/[A-Za-z0-9_-]{22}$/);
    expect((await post<{ url: string }>(inviteCreate, "/api/social/invite-link", a)).json.url).toBe(first.json.url);
    const token = first.json.url.slice(3);

    // Ещё нет профиля — посмотреть можно, добавиться нельзя.
    const view = await inviteView.GET(req("GET", `/api/social/invite-link/${token}`), ctxOf({ token }));
    expect(view.status).toBe(200);
    expect((await view.json()).from).toMatchObject({ code: a.code, name: "Айжан" });
    expect((await lists(a)).json.friends).toEqual([]);
    const anon = await inviteAccept.POST(req("POST", `/api/social/invite-link/${token}/accept`), ctxOf({ token }));
    expect(anon.status).toBe(401);

    const b = await create("Болат");
    const join = await inviteAccept.POST(req("POST", `/api/social/invite-link/${token}/accept`, { cookie: b.cookie }), ctxOf({ token }));
    expect(await join.json()).toMatchObject({ status: "accepted", friend: { code: a.code } });
    expect(codes((await lists(a)).json.friends)).toEqual([b.code]);
    const again = await inviteAccept.POST(req("POST", `/api/social/invite-link/${token}/accept`, { cookie: b.cookie }), ctxOf({ token }));
    expect((await again.json()).status).toBe("already");
    const self = await inviteAccept.POST(req("POST", `/api/social/invite-link/${token}/accept`, { cookie: a.cookie }), ctxOf({ token }));
    expect((await self.json()).status).toBe("self");
  });

  it("исчерпанная или истёкшая ссылка — expired; приглашающий заблокировал — тоже expired", async () => {
    const a = await create("Айжан");
    const token = (await post<{ url: string }>(inviteCreate, "/api/social/invite-link", a)).json.url.slice(3);
    const b = await create("Болат");
    await post(block, "/api/social/block", a, { code: b.code });
    const blocked = await inviteAccept.POST(req("POST", `/api/social/invite-link/${token}/accept`, { cookie: b.cookie }), ctxOf({ token }));
    expect((await blocked.json()).status).toBe("expired");

    await holder.kv!.set(`pl:inv:${token}:n`, "30");
    const c = await create("Сауле");
    const used = await inviteAccept.POST(req("POST", `/api/social/invite-link/${token}/accept`, { cookie: c.cookie }), ctxOf({ token }));
    expect((await used.json()).status).toBe("expired");
    // Исчерпанная — выдаётся новая.
    expect((await post<{ url: string }>(inviteCreate, "/api/social/invite-link", a)).json.url).not.toBe(`/f/${token}`);

    const d = await create("Данияр");
    const fresh = (await post<{ url: string }>(inviteCreate, "/api/social/invite-link", d)).json.url.slice(3);
    clock += 8 * 86_400_000;
    const late = await inviteView.GET(req("GET", `/api/social/invite-link/${fresh}`), ctxOf({ token: fresh }));
    expect(late.status).toBe(404);
  });
});

describe("топ друзей за неделю", () => {
  it("я и друзья с очками недели (3 команды), скрытые очки — null, чужие — не видны", async () => {
    const a = await create("Айжан");
    const b = await create("Болат");
    const c = await create("Сауле");
    const stranger = await create("Ерлан");
    await post(request, "/api/social/friends/request", b, { code: a.code });
    await post(respond, "/api/social/friends/respond", a, { code: b.code, accept: true });
    await post(request, "/api/social/friends/request", c, { code: a.code });
    await post(respond, "/api/social/friends/respond", a, { code: c.code, accept: true });
    const kv = countingKv(holder.kv!);
    const side = (pid: string, pts: number) => ({ pid, opponent: "ghost" as const, flags: 0, answered: 10, points: (ok: boolean) => (ok ? pts : 0) });
    await awardWeek(kv, [side(b.pid, 2)], [b.pid, a.pid], clock);
    await awardWeek(kv, [side(c.pid, 1)], [c.pid, a.pid], clock);
    await awardWeek(kv, [side(stranger.pid, 5)], [stranger.pid, c.pid], clock);

    const t = await get<{ rows: { card: { code: string }; score: number | null; me?: true }[]; week: string }>(top, "/api/social/top/friends", a);
    expect(t.status).toBe(200);
    expect(cmdsOf("top.friends")).toBe(3);
    expect(t.json.week).toBe("2026-W41");
    expect(t.json.rows.map((r) => [r.card.code, r.score, !!r.me])).toEqual([
      [b.code, 2, false],
      [c.code, 1, false],
      [a.code, 0, true],
    ]);

    // Болат скрыл очки — у друзей без числа, у себя видны.
    await me.POST(req("POST", "/api/social/me", { cookie: b.cookie, body: { name: "Болат", lang: "ru", lv: 4, cosmetics: {}, ft: false } }));
    const t2 = await get<{ rows: { card: { code: string }; score: number | null }[] }>(top, "/api/social/top/friends", a);
    expect(t2.json.rows.find((r) => r.card.code === b.code)?.score).toBeNull();
    const own = await get<{ rows: { card: { code: string }; score: number | null }[] }>(top, "/api/social/top/friends", b);
    expect(own.json.rows.find((r) => r.card.code === b.code)?.score).toBe(2);
  });

  it("потолки: пара — 2 засчитанных в сутки, бот — никогда; новая неделя — с нуля", async () => {
    const a = await create("Айжан");
    const b = await create("Болат");
    const kv = countingKv(holder.kv!);
    const side = { pid: b.pid, opponent: "ghost" as const, flags: 0, answered: 10, points: (ok: boolean) => (ok ? 1 : 0) };
    const r = [];
    for (let k = 0; k < 3; k++) r.push((await awardWeek(kv, [side], [b.pid, a.pid], clock))[0]);
    expect(r.map((x) => x.counted)).toEqual([true, true, false]);
    expect(r[2].why).toBe("pair_limit");
    expect((await awardWeek(kv, [{ ...side, opponent: "bot" }], null, clock))[0]).toMatchObject({ counted: false, why: "bot", weekPts: 0 });
    expect((await awardWeek(kv, [{ ...side, flags: 3 }], [b.pid, "x"], clock))[0].why).toBe("fast");
    expect(await holder.kv!.zscore("top:w:2026-W41", b.pid)).toBe(2);
  });
});

describe("жалобы и модерация", () => {
  it("3 разных жалобы на имя за 30 дней → имя скрыто у всех; повтор не считается", async () => {
    const target = await create("Ерлан");
    const reporters = [await create("Айжан"), await create("Болат"), await create("Сауле")];
    const rep = (p: Player) => post(report, "/api/social/report", p, { code: target.code, reason: "name", where: "friend" });
    expect((await rep(reporters[0])).json).toEqual({ ok: true });
    await rep(reporters[0]);
    await rep(reporters[1]);
    expect(JSON.parse((await holder.kv!.getStr(`pl:c:${target.pid}`))!).n).toBe("Ерлан");
    await rep(reporters[2]);
    expect(JSON.parse((await holder.kv!.getStr(`pl:c:${target.pid}`))!).n).toBeNull();
    const mine = await get<{ player: { nameState: string; name: string | null } }>(me, "/api/social/me", target);
    expect(mine.json.player).toMatchObject({ nameState: "hidden", name: null });
    // Жалоба на себя и на неизвестный код — тот же ответ, ничего не пишется.
    expect((await post(report, "/api/social/report", target, { code: target.code, reason: "name", where: "friend" })).json).toEqual({ ok: true });
    expect(await holder.kv!.scard(`mod:rep:${target.pid}:name`)).toBe(3);
  });

  it("10 жалоб в сутки на игрока — дальше 429", async () => {
    const r = await create("Айжан");
    const t = await create("Ерлан");
    for (let k = 0; k < 10; k++) expect((await post(report, "/api/social/report", r, { code: t.code, reason: "other", where: "top" })).status).toBe(200);
    expect((await post(report, "/api/social/report", r, { code: t.code, reason: "other", where: "top" })).status).toBe(429);
  });

  it("владелец: без входа 401; список жалоб; «Разрешить» возвращает имя, «Скрыть» прячет", async () => {
    vi.stubEnv("OWNER_SECRET", "owner-secret-123456");
    const target = await create("Ерлан");
    for (const n of ["Айжан", "Болат", "Сауле"]) await post(report, "/api/social/report", await create(n), { code: target.code, reason: "name", where: "challenge" });
    expect((await owner.GET(req("GET", "/api/owner/social"))).status).toBe(401);
    const cookie = `${OWNER_COOKIE}=${signOwnerCookie("owner-secret-123456", Date.now())}`;
    const list = await owner.GET(req("GET", "/api/owner/social", { cookie }));
    const cases = (await list.json()).cases as { code: string; name: string; nameState: string; reasons: { name: number } }[];
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({ code: target.code, name: "Ерлан", nameState: "hidden", reasons: { name: 3 } });

    clock += 1000;
    const allow = await owner.POST(req("POST", "/api/owner/social", { cookie, body: { code: target.code, action: "allow" } }));
    expect(allow.status).toBe(200);
    expect(JSON.parse((await holder.kv!.getStr(`pl:c:${target.pid}`))!).n).toBe("Ерлан");
    expect((await (await owner.GET(req("GET", "/api/owner/social", { cookie }))).json()).cases).toEqual([]);
    // Разрешённое имя новые жалобы автоматически не скрывают.
    for (const n of ["Данияр", "Ерке", "Жанар"]) await post(report, "/api/social/report", await create(n), { code: target.code, reason: "name", where: "top" });
    expect(JSON.parse((await holder.kv!.getStr(`pl:c:${target.pid}`))!).n).toBe("Ерлан");

    clock += 1000;
    await owner.POST(req("POST", "/api/owner/social", { cookie, body: { code: target.code, action: "hide" } }));
    expect(JSON.parse((await holder.kv!.getStr(`pl:c:${target.pid}`))!).n).toBeNull();
    const evil = await owner.POST(req("POST", "/api/owner/social", { cookie, body: { code: target.code, action: "allow" }, headers: { origin: "https://evil.example" } }));
    expect(evil.status).toBe(403);
  });
});

describe("главная: входящие с карточкой автора", () => {
  it("pid автора не уходит наружу, имя — свежее из карточки", async () => {
    const a = await create("Айжан");
    const b = await create("Болат");
    await holder.kv!.pipeline([{ op: "lpush", key: `pl:inbox:${a.pid}`, value: JSON.stringify({ k: "chr", id: "abcdefghij", m: "blitz", p: b.pid, s: {}, r: {}, w: "win", at: clock }), max: 20 }]);
    const h = await get<{ inbox: Record<string, unknown>[] }>(home, "/api/social/home", a);
    expect(h.json.inbox).toHaveLength(1);
    expect(h.json.inbox[0].p).toBeUndefined();
    expect(h.json.inbox[0].from).toMatchObject({ code: b.code, name: "Болат" });
    expect(JSON.stringify(h.json)).not.toContain(b.pid);
    expect(cmdsOf("home")).toBe(4);
  });
});

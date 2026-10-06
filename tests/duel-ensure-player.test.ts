import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ensurePlayer (lib/duel/live.ts) против настоящего маршрута /api/social/me (хранилище — память): живой вход не создаёт
// профиль сам и не публикует имя из профиля приложения поверх выбора ученика («Без имени», скрытое, отклонённое).
const holder = vi.hoisted(() => ({ kv: null as null | import("@/server/kv").Kv }));
vi.mock("@/server/kv", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/kv")>();
  return { ...real, getKv: () => holder.kv!, getStrictKv: () => holder.kv! };
});

const { createMemoryKv } = await import("@/server/kv");
const me = await import("@/app/api/social/me/route");
const { PLAYER_COOKIE } = await import("@/server/social/player");
const { ensurePlayer } = await import("@/lib/duel/live");
const { PLAYER_MARK, deleteMe } = await import("@/lib/social/client");

/** Браузер одной вкладки: cookie игрока и sessionStorage. */
let jar: string | null = null;
let store: Map<string, string>;
const posts: unknown[] = [];

async function browserFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const method = init.method ?? "GET";
  const req = new Request(`http://localhost${url}`, {
    method,
    headers: { ...(init.headers as Record<string, string>), host: "localhost", origin: "http://localhost", "x-forwarded-for": "10.1.1.1", ...(jar ? { cookie: jar } : {}) },
    ...(init.body ? { body: init.body } : {}),
  });
  if (method === "POST") posts.push(JSON.parse(String(init.body)));
  const handler = method === "POST" ? me.POST : method === "DELETE" ? me.DELETE : me.GET;
  const res = await handler(req);
  const sc = res.headers.get("set-cookie");
  const m = sc ? new RegExp(`${PLAYER_COOKIE}=([^;]*)`).exec(sc) : null;
  if (m) jar = m[1] ? `${PLAYER_COOKIE}=${m[1]}` : null;
  return res;
}

const getMe = async () => ((await (await browserFetch("/api/social/me")).json()) as { player: { nameState: string; name: string | null; lv: number } | null }).player;
const saveName = (name: string | null, lv = 3) => browserFetch("/api/social/me", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, lang: "ru", lv, cosmetics: {}, ft: true }) });
const input = (lv: number) => ({ lang: "ru" as const, lv, frame: null, title: null });

beforeEach(() => {
  holder.kv = createMemoryKv();
  jar = null;
  posts.length = 0;
  store = new Map();
  vi.stubEnv("SOCIAL_SECRET", "test-social-secret");
  vi.stubEnv("SOCIAL_MEMORY_OK", "1");
  vi.stubEnv("SOCIAL_NAMES", "");
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) => browserFetch(url, init));
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ensurePlayer: имя выбирает только ученик", () => {
  it("нет профиля — no_player, ничего не создаётся (сначала экран имени)", async () => {
    expect(await ensurePlayer(input(3))).toBe("no_player");
    expect(posts).toEqual([]);
    expect(jar).toBeNull();
    expect(store.has(PLAYER_MARK)).toBe(false);
  });

  it("«Без имени» (профиль «Аня» в приложении): новый уровень обновляется, имя не появляется", async () => {
    await saveName(null, 3);
    expect((await getMe())?.nameState).toBe("none");
    posts.length = 0;
    expect(await ensurePlayer(input(4))).toBe("ok");
    expect(posts).toEqual([expect.objectContaining({ name: null, lv: 4 })]);
    const p = await getMe();
    expect(p).toMatchObject({ nameState: "none", name: null, lv: 4 });
  });

  it("принятое имя остаётся тем же (смена имени не тратится), свежий профиль — без POST", async () => {
    await saveName("Аня", 3);
    posts.length = 0;
    expect(await ensurePlayer(input(5))).toBe("ok");
    expect(posts).toEqual([expect.objectContaining({ name: "Аня", lv: 5 })]);
    expect(await getMe()).toMatchObject({ nameState: "ok", name: "Аня", lv: 5 });
    posts.length = 0;
    expect(await ensurePlayer(input(5), true)).toBe("ok");
    expect(posts).toEqual([]);
  });

  it("«Удалить мой профиль» снимает отметку вкладки: следующий живой вход снова спрашивает имя", async () => {
    await saveName(null, 3);
    expect(await ensurePlayer(input(3))).toBe("ok");
    expect(store.has(PLAYER_MARK)).toBe(true);
    await deleteMe();
    expect(store.has(PLAYER_MARK)).toBe(false);
    expect(await ensurePlayer(input(3))).toBe("no_player");
  });

  it("сервер недоступен — down", async () => {
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 503 }));
    expect(await ensurePlayer(input(3))).toBe("down");
  });
});

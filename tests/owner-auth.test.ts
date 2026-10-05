import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryKv } from "@/server/kv";

vi.mock("server-only", () => ({}));

const {
  OWNER_COOKIE,
  OWNER_LOGIN_LIMIT,
  OWNER_SECRET_MIN,
  OWNER_TTL_MS,
  ownerCookieHeader,
  ownerLogoutHeader,
  ownerSecret,
  passwordMatches,
  signOwnerCookie,
  verifyOwnerCookie,
} = await import("@/server/owner-auth");

const SECRET = "очень-длинный-секрет-владельца-123";
const NOW = Date.UTC(2026, 9, 5, 10, 0, 0);

describe("секрет владельца", () => {
  it("нет, пусто, одни пробелы или короче 12 знаков — null (страница = 404)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(ownerSecret({})).toBeNull();
    expect(ownerSecret({ OWNER_SECRET: "" })).toBeNull();
    expect(ownerSecret({ OWNER_SECRET: "    " })).toBeNull();
    expect(ownerSecret({ OWNER_SECRET: "a".repeat(OWNER_SECRET_MIN - 1) })).toBeNull();
    expect(ownerSecret({ OWNER_SECRET: "a".repeat(OWNER_SECRET_MIN) })).toBe("a".repeat(OWNER_SECRET_MIN));
    expect(ownerSecret({ OWNER_SECRET: `  ${SECRET}  ` })).toBe(SECRET);
    // Про короткий секрет в лог — один раз за жизнь копии, сам секрет в лог не попадает.
    expect(warn.mock.calls.length).toBeLessThanOrEqual(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("aaaa");
    warn.mockRestore();
  });
});

describe("cookie владельца: подпись и срок", () => {
  it("свежая cookie верна; формат — `<срок, мс>.<подпись>`", () => {
    const c = signOwnerCookie(SECRET, NOW);
    expect(c).toMatch(/^\d{13}\.[A-Za-z0-9_-]{43}$/);
    expect(c.startsWith(String(NOW + OWNER_TTL_MS))).toBe(true);
    expect(verifyOwnerCookie(c, SECRET, NOW)).toBe(true);
    expect(verifyOwnerCookie(c, SECRET, NOW + OWNER_TTL_MS - 1)).toBe(true);
  });

  it("срок 12 часов: ровно в конце и позже — отказ", () => {
    expect(OWNER_TTL_MS).toBe(12 * 3_600_000);
    const c = signOwnerCookie(SECRET, NOW);
    expect(verifyOwnerCookie(c, SECRET, NOW + OWNER_TTL_MS)).toBe(false);
    expect(verifyOwnerCookie(c, SECRET, NOW + OWNER_TTL_MS + 1)).toBe(false);
    expect(verifyOwnerCookie(c, SECRET, NOW + 7 * 86_400_000)).toBe(false);
  });

  it("другой секрет — отказ (смена OWNER_SECRET выкидывает всех)", () => {
    const c = signOwnerCookie(SECRET, NOW);
    expect(verifyOwnerCookie(c, `${SECRET}x`, NOW)).toBe(false);
  });

  it("подделка срока: подпись от другого срока не подходит, продлить cookie нельзя", () => {
    const c = signOwnerCookie(SECRET, NOW);
    const [exp, sig] = c.split(".");
    expect(verifyOwnerCookie(`${Number(exp) + 1}.${sig}`, SECRET, NOW)).toBe(false);
    expect(verifyOwnerCookie(`${Number(exp) + 86_400_000}.${sig}`, SECRET, NOW)).toBe(false);
    // Даже верно подписанный срок дальше 12 часов (с запасом минута) — отказ.
    const far = NOW + 2 * OWNER_TTL_MS;
    expect(verifyOwnerCookie(`${far}.${signOwnerCookie(SECRET, far - OWNER_TTL_MS).split(".")[1]}`, SECRET, NOW)).toBe(false);
  });

  it("мусор вместо cookie — отказ без падения", () => {
    for (const junk of [undefined, null, "", "x", ".", "123.", `.${"a".repeat(43)}`, "abc.def", `1${"0".repeat(20)}.${"a".repeat(43)}`, `${NOW + 1000}.${"a".repeat(42)}`, `${NOW + 1000}.${"a".repeat(44)}`, `${NOW + 1000}.${"!".repeat(43)}`]) {
      expect(verifyOwnerCookie(junk as string | undefined, SECRET, NOW), String(junk)).toBe(false);
    }
  });

  it("заголовок входа: HttpOnly, SameSite=Strict, Path=/, 12 часов; Secure только в production", () => {
    const dev = ownerCookieHeader("v", { NODE_ENV: "development" });
    expect(dev).toBe(`${OWNER_COOKIE}=v; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`);
    const prod = ownerCookieHeader("v", { NODE_ENV: "production" });
    expect(prod).toContain("; Secure");
    expect(prod).toContain("HttpOnly");
    expect(prod).toContain("SameSite=Strict");
    expect(prod).toContain("Path=/;");
  });

  it("заголовок выхода: cookie сразу истекает", () => {
    expect(ownerLogoutHeader({ NODE_ENV: "development" })).toBe(`${OWNER_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
    expect(ownerLogoutHeader({ NODE_ENV: "production" })).toContain("Secure");
  });
});

describe("пароль владельца", () => {
  it("верный проходит, любой другой — нет", () => {
    expect(passwordMatches(SECRET, SECRET)).toBe(true);
    expect(passwordMatches(`${SECRET} `, SECRET)).toBe(false);
    expect(passwordMatches(SECRET.slice(0, -1), SECRET)).toBe(false);
    expect(passwordMatches(SECRET.toUpperCase(), SECRET)).toBe(false);
    expect(passwordMatches("", SECRET)).toBe(false);
  });

  it("не строка и слишком длинное — отказ без падения", () => {
    for (const junk of [undefined, null, 5, {}, [SECRET], true]) expect(passwordMatches(junk, SECRET)).toBe(false);
    expect(passwordMatches("a".repeat(5000), SECRET)).toBe(false);
  });
});

describe("POST /api/owner/login и /api/owner/logout", () => {
  const mem = createMemoryKv();
  vi.doMock("@/server/kv", () => ({ getKv: () => mem, kzDay: () => "2026-10-05" }));

  let n = 0;
  const form = (password: string, headers: Record<string, string> = {}) =>
    new Request("http://localhost/api/owner/login", {
      method: "POST",
      body: new URLSearchParams({ password }).toString(),
      headers: { host: "localhost", "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": `10.3.0.${++n}`, ...headers },
    });

  let login: (r: Request) => Promise<Response>;
  let logout: (r: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.stubEnv("OWNER_SECRET", SECRET);
    login = (await import("@/app/api/owner/login/route")).POST;
    logout = (await import("@/app/api/owner/logout/route")).POST;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("нет секрета — 404, как будто маршрута нет", async () => {
    vi.stubEnv("OWNER_SECRET", "");
    expect((await login(form(SECRET))).status).toBe(404);
    expect((await logout(new Request("http://localhost/api/owner/logout", { method: "POST", headers: { host: "localhost" } }))).status).toBe(404);
  });

  it("верный пароль: 303 на /owner и cookie, которую принимает проверка", async () => {
    const res = await login(form(SECRET));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/owner");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=43200");
    const value = /^inf_owner=([^;]+)/.exec(cookie)?.[1];
    expect(value).toBeTruthy();
    expect(verifyOwnerCookie(value, SECRET, Date.now())).toBe(true);
  });

  it("пароль в JSON тоже принимается", async () => {
    const req = new Request("http://localhost/api/owner/login", {
      method: "POST",
      body: JSON.stringify({ password: SECRET }),
      headers: { host: "localhost", "content-type": "application/json", "x-forwarded-for": "10.3.1.1" },
    });
    expect((await login(req)).headers.get("set-cookie")).toContain("inf_owner=");
  });

  it("неверный пароль: редирект с ?e=1, cookie нет", async () => {
    const res = await login(form("неверный-пароль"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/owner?e=1");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("чужой Origin — 403 без проверки пароля", async () => {
    const res = await login(form(SECRET, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("слишком большое тело — ?e=3; пустое — неверный пароль", async () => {
    const big = new Request("http://localhost/api/owner/login", {
      method: "POST",
      body: `password=${"x".repeat(1200)}`,
      headers: { host: "localhost", "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": "10.3.2.1" },
    });
    expect((await login(big)).headers.get("location")).toBe("/owner?e=3");
    expect((await login(form(""))).headers.get("location")).toBe("/owner?e=1");
  });

  it("лимит попыток: 10 за 10 минут с одного IP, дальше даже верный пароль не принимается; другой IP не задет", async () => {
    const ip = { "x-forwarded-for": "10.3.9.9" };
    for (let i = 0; i < OWNER_LOGIN_LIMIT.limit; i++) expect((await login(form("не тот", ip))).headers.get("location")).toBe("/owner?e=1");
    const blocked = await login(form(SECRET, ip));
    expect(blocked.headers.get("location")).toBe("/owner?e=2");
    expect(blocked.headers.get("set-cookie")).toBeNull();
    expect((await login(form(SECRET, { "x-forwarded-for": "10.3.9.10" }))).headers.get("set-cookie")).toContain("inf_owner=");
  });

  it("в ключе лимита нет сырого IP", async () => {
    const spy = vi.spyOn(mem, "incrBy");
    await login(form("не тот", { "x-forwarded-for": "198.51.100.44" }));
    const keys = spy.mock.calls.map(([k]) => String(k));
    expect(keys.some((k) => k.startsWith("rl:owner-login:"))).toBe(true);
    for (const k of keys) expect(k).not.toContain("198.51.100.44");
    spy.mockRestore();
  });

  it("выход: cookie истекает, редирект на /owner; чужой Origin — 403", async () => {
    const res = await logout(new Request("http://localhost/api/owner/logout", { method: "POST", headers: { host: "localhost" } }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/owner");
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
    const bad = await logout(new Request("http://localhost/api/owner/logout", { method: "POST", headers: { host: "localhost", origin: "https://evil.example" } }));
    expect(bad.status).toBe(403);
  });
});

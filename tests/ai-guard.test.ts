import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Хранилище — память, но своё на каждый тест (счётчики не перетекают между тестами).
const holder = vi.hoisted(() => ({ kv: null as null | import("@/server/kv").Kv }));
vi.mock("@/server/kv", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/kv")>();
  return { ...real, getKv: () => holder.kv! };
});

const { createMemoryKv, kzDay } = await import("@/server/kv");
const guard = await import("@/server/ai-guard");
const { guardAi, withGuardHeaders, readLimits, envPositiveInt, verifyDeviceCookie, AI_LIMIT_DEFAULTS, BURST_WINDOW_MS } = guard;
const { sanitizeHistory, sameOrigin, HISTORY_MAX_CHARS } = await import("@/server/context");
const { kvRateLimit } = await import("@/server/rate-limit");

let ipN = 0;
const freshIp = () => `10.1.${Math.floor(++ipN / 250)}.${ipN % 250}`;

interface ReqOpts {
  ip?: string;
  cookie?: string | null;
  headers?: Record<string, string>;
}
const req = ({ ip = freshIp(), cookie = null, headers = {} }: ReqOpts = {}) =>
  new Request("http://localhost/api/ai/tutor", {
    method: "POST",
    headers: { host: "localhost", "x-forwarded-for": ip, ...(cookie ? { cookie } : {}), ...headers },
  });

/** «inf_ai=<значение>» из Set-Cookie ответа. */
const cookieOf = (setCookie: string | null) => setCookie?.split(";")[0] ?? "";
const bodyCode = async (r: Response) => (await r.json()).error as string;

/** Первый запрос устройства: возвращает cookie, которую браузер отправит дальше. */
async function newDevice(ip: string, units = 1) {
  const g = await guardAi(req({ ip }), { route: "tutor", units });
  if (!g.ok) throw new Error("новое устройство отклонено");
  return { cookie: cookieOf(g.setCookie), g };
}

beforeEach(() => {
  holder.kv = createMemoryKv();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("числа лимитов из env", () => {
  it("по умолчанию: устройство 100, IP 1000, сайт 3000, новых устройств 30, бесплатных 30", () => {
    expect(readLimits({})).toEqual({ deviceDaily: 100, ipDaily: 1000, siteDaily: 3000, newDevicesPerIp: 30, freeDeviceDaily: 30 });
    expect(AI_LIMIT_DEFAULTS.deviceDaily).toBe(100);
  });

  it("строго целое число > 0, иначе значение по умолчанию", () => {
    expect(envPositiveInt("250", 7)).toBe(250);
    expect(envPositiveInt(" 12 ", 7)).toBe(12);
    for (const bad of ["abc", "0", "-5", "12x", "1e3", "1.5", "", "  ", "NaN", "Infinity", "9999999999999", undefined]) {
      expect(envPositiveInt(bad, 7)).toBe(7);
    }
  });

  it("читаются из своих переменных", () => {
    const l = readLimits({
      AI_DEVICE_DAILY_UNITS: "10",
      AI_IP_DAILY_UNITS: "20",
      AI_SITE_DAILY_UNITS: "30",
      AI_NEW_DEVICES_PER_IP: "4",
      AI_FREE_DEVICE_DAILY: "5",
    });
    expect(l).toEqual({ deviceDaily: 10, ipDaily: 20, siteDaily: 30, newDevicesPerIp: 4, freeDeviceDaily: 5 });
    expect(readLimits({ AI_SITE_DAILY_UNITS: "-1", AI_IP_DAILY_UNITS: "x" })).toMatchObject({ siteDaily: 3000, ipDaily: 1000 });
  });
});

describe("устройство: подписанная cookie inf_ai", () => {
  it("без cookie выдаётся новое устройство: HttpOnly, SameSite=Lax, Path=/api, 400 дней, без Secure вне production", async () => {
    const g = await guardAi(req(), { route: "tutor", units: 1 });
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    expect(g.setCookie).toMatch(/^inf_ai=[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{22}; HttpOnly; SameSite=Lax; Path=\/api; Max-Age=34560000$/);
  });

  it("в production cookie с Secure", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const g = await guardAi(req({ headers: { origin: "http://localhost" } }), { route: "tutor", units: 1 });
    expect(g.ok && g.setCookie).toMatch(/; Secure$/);
  });

  it("с верной cookie устройство то же и новая cookie не выдаётся", async () => {
    const ip = freshIp();
    const first = await newDevice(ip);
    const again = await guardAi(req({ ip, cookie: first.cookie }), { route: "tutor", units: 1 });
    expect(again.ok).toBe(true);
    if (!again.ok || !first.g.ok) return;
    expect(again.setCookie).toBeNull();
    expect(again.device).toBe(first.g.device);
    expect(first.cookie.startsWith(`inf_ai=${again.device}`)).toBe(true);
  });

  it("поддельная подпись, чужой id, обрезанная и мусорная cookie — это новое устройство", async () => {
    const ip = freshIp();
    const { cookie } = await newDevice(ip);
    const value = cookie.slice("inf_ai=".length);
    const [id, sig] = value.split(".");
    const forged = [
      `inf_ai=${id}.${"A".repeat(22)}`,
      `inf_ai=${id}.${sig.slice(0, 21)}`,
      `inf_ai=${"B".repeat(22)}.${sig}`,
      `inf_ai=${id}`,
      `inf_ai=${value}x`,
      "inf_ai=",
      "inf_ai=....",
      `other=${value}`,
    ];
    for (const c of forged) {
      const g = await guardAi(req({ ip: freshIp(), cookie: c }), { route: "tutor", units: 1 });
      expect(g.ok && g.setCookie).toBeTruthy();
    }
  });

  it("среди нескольких cookie берётся верная", async () => {
    const ip = freshIp();
    const { cookie } = await newDevice(ip);
    const g = await guardAi(req({ ip, cookie: `a=1; inf_ai=${"Z".repeat(22)}.${"Z".repeat(22)}; ${cookie}; b=2` }), { route: "tutor", units: 1 });
    expect(g.ok && g.setCookie).toBeNull();
  });

  it("verifyDeviceCookie проверяет подпись конкретным секретом", async () => {
    const ip = freshIp();
    const { cookie } = await newDevice(ip);
    const value = cookie.slice("inf_ai=".length);
    expect(verifyDeviceCookie(value, "informatica-dev-device-secret")).toBe(value.slice(0, 22));
    expect(verifyDeviceCookie(value, "другой секрет")).toBeNull();
  });

  it("смена AI_DEVICE_SECRET делает старые cookie недействительными", async () => {
    const ip = freshIp();
    const { cookie } = await newDevice(ip);
    vi.stubEnv("AI_DEVICE_SECRET", "новый-секрет-1234");
    const g = await guardAi(req({ ip, cookie }), { route: "tutor", units: 1 });
    expect(g.ok && g.setCookie).toBeTruthy();
  });

  it("секрет из OPENAI_API_KEY: cookie живёт между запросами, сам ключ нигде не виден", async () => {
    const key = "sk-test-SECRET-KEY-0123456789";
    vi.stubEnv("OPENAI_API_KEY", key);
    const ip = freshIp();
    const first = await newDevice(ip);
    const again = await guardAi(req({ ip, cookie: first.cookie }), { route: "tutor", units: 1 });
    expect(again.ok && again.setCookie).toBeNull();
    expect(first.cookie).not.toContain(key);
    const logged = JSON.stringify(vi.mocked(console.info).mock.calls) + JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).not.toContain(key);
  });

  it("withGuardHeaders добавляет Set-Cookie нового устройства, известному — нет", async () => {
    const ip = freshIp();
    const first = await newDevice(ip);
    if (!first.g.ok) return;
    const res = withGuardHeaders(Response.json({ ok: 1 }), first.g);
    expect(res.headers.get("set-cookie")).toBe(first.g.setCookie);
    const known = await guardAi(req({ ip, cookie: first.cookie }), { route: "tutor", units: 1 });
    if (!known.ok) return;
    expect(withGuardHeaders(Response.json({}), known).headers.get("set-cookie")).toBeNull();
  });

  it("withGuardHeaders не падает на ответе с неизменяемыми заголовками", async () => {
    const g = await newDevice(freshIp());
    if (!g.g.ok) return;
    const frozen = Response.redirect("http://localhost/x", 302);
    const res = withGuardHeaders(frozen, g.g);
    expect(res.headers.get("set-cookie")).toBe(g.g.setCookie);
    expect(res.status).toBe(302);
  });
});

describe("новые устройства с одного IP", () => {
  it("не больше AI_NEW_DEVICES_PER_IP в сутки: сверх — 429 daily_limit без новой cookie; известное устройство работает", async () => {
    vi.stubEnv("AI_NEW_DEVICES_PER_IP", "3");
    const ip = freshIp();
    const devices: string[] = [];
    for (let i = 0; i < 3; i++) devices.push((await newDevice(ip)).cookie);
    const over = await guardAi(req({ ip }), { route: "tutor", units: 1 });
    expect(over.ok).toBe(false);
    if (over.ok) return;
    expect(over.response.status).toBe(429);
    expect(over.response.headers.get("set-cookie")).toBeNull();
    expect(await bodyCode(over.response)).toBe("daily_limit");
    // известное устройство с того же IP — проходит
    const known = await guardAi(req({ ip, cookie: devices[0] }), { route: "tutor", units: 1 });
    expect(known.ok).toBe(true);
    // другой IP — свой счёт
    expect((await guardAi(req({ ip: freshIp() }), { route: "tutor", units: 1 })).ok).toBe(true);
  });

  it("на следующие сутки счёт новых устройств начинается заново", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T10:00:00Z"));
    vi.stubEnv("AI_NEW_DEVICES_PER_IP", "1");
    const ip = freshIp();
    expect((await guardAi(req({ ip }), { route: "tutor", units: 1 })).ok).toBe(true);
    expect((await guardAi(req({ ip }), { route: "tutor", units: 1 })).ok).toBe(false);
    vi.setSystemTime(new Date("2026-10-06T10:00:00Z"));
    expect((await guardAi(req({ ip }), { route: "tutor", units: 1 })).ok).toBe(true);
  });
});

describe("потолки в обращениях", () => {
  it("устройство: AI_DEVICE_DAILY_UNITS в сутки (по умолчанию 100); следующее — 429 daily_limit с той же cookie; другое устройство не задето", async () => {
    // Всплеск (40 запросов tutor за 10 минут) — отдельная защита; здесь проверяем дневной потолок на малом числе.
    vi.stubEnv("AI_DEVICE_DAILY_UNITS", "30");
    const ip = freshIp();
    const { cookie } = await newDevice(ip); // 1-е
    for (let i = 1; i < 30; i++) {
      const g = await guardAi(req({ ip, cookie }), { route: "tutor", units: 1 });
      expect(g.ok).toBe(true);
    }
    const over = await guardAi(req({ ip, cookie }), { route: "tutor", units: 1 });
    expect(over.ok).toBe(false);
    if (over.ok) return;
    expect(over.response.status).toBe(429);
    expect(await bodyCode(over.response)).toBe("daily_limit");
    // отказ ничего не оставил в счётчиках: другое устройство с того же IP проходит
    expect((await guardAi(req({ ip: freshIp() }), { route: "tutor", units: 1 })).ok).toBe(true);
  });

  it("вес запроса: фото — 2, голос — 4; на 99 из 100 фото не помещается, подсказка помещается", async () => {
    vi.stubEnv("AI_DEVICE_DAILY_UNITS", "10");
    const ip = freshIp();
    const { cookie } = await newDevice(ip, 4); // голос: 4
    expect((await guardAi(req({ ip, cookie }), { route: "tutor", units: 2 })).ok).toBe(true); // 6
    expect((await guardAi(req({ ip, cookie }), { route: "tutor", units: 2 })).ok).toBe(true); // 8
    expect((await guardAi(req({ ip, cookie }), { route: "tutor", units: 2 })).ok).toBe(true); // 10
    const over = await guardAi(req({ ip, cookie }), { route: "tutor", units: 1 });
    expect(over.ok).toBe(false);
  });

  it("отклонённый запрос откатывает списанное: потом помещается ровно остаток", async () => {
    vi.stubEnv("AI_DEVICE_DAILY_UNITS", "5");
    const ip = freshIp();
    const { cookie } = await newDevice(ip, 4); // 4 из 5
    expect((await guardAi(req({ ip, cookie }), { route: "tutor", units: 2 })).ok).toBe(false); // 6 > 5, откат
    expect((await guardAi(req({ ip, cookie }), { route: "tutor", units: 2 })).ok).toBe(false);
    expect((await guardAi(req({ ip, cookie }), { route: "tutor", units: 1 })).ok).toBe(true); // 5
    expect((await guardAi(req({ ip, cookie }), { route: "tutor", units: 1 })).ok).toBe(false);
  });

  it("IP: общий потолок за адресом, даже если у каждого устройства своя cookie", async () => {
    vi.stubEnv("AI_IP_DAILY_UNITS", "5");
    const ip = freshIp();
    const a = await newDevice(ip, 2);
    const b = await newDevice(ip, 2);
    expect((await guardAi(req({ ip, cookie: a.cookie }), { route: "tutor", units: 1 })).ok).toBe(true); // 5
    const over = await guardAi(req({ ip, cookie: b.cookie }), { route: "tutor", units: 1 });
    expect(over.ok).toBe(false);
    if (over.ok) return;
    expect(over.response.status).toBe(429);
    expect(await bodyCode(over.response)).toBe("daily_limit");
    // другой адрес — не задет
    expect((await guardAi(req({ ip: freshIp() }), { route: "tutor", units: 1 })).ok).toBe(true);
  });

  it("весь сайт: сверх AI_SITE_DAILY_UNITS — 503 ai_busy для всех, отказ ничего не списывает", async () => {
    vi.stubEnv("AI_SITE_DAILY_UNITS", "3");
    const held = [];
    for (let i = 0; i < 3; i++) {
      const g = await guardAi(req(), { route: "tutor", units: 1 });
      expect(g.ok).toBe(true);
      held.push(g);
    }
    const over = await guardAi(req(), { route: "tutor", units: 1 });
    expect(over.ok).toBe(false);
    if (over.ok) return;
    expect(over.response.status).toBe(503);
    expect(await bodyCode(over.response)).toBe("ai_busy");
    expect(await holder.kv!.get(`ai:site:${kzDay()}`)).toBe(3);
    // отказ 503 тоже выдаёт cookie новому устройству (чтобы оно не считалось «новым» снова и снова)
    expect(over.response.headers.get("set-cookie")).toMatch(/^inf_ai=/);
    // освободили одно — снова можно
    const first = held[0];
    if (first.ok) await first.release();
    expect((await guardAi(req(), { route: "tutor", units: 1 })).ok).toBe(true);
  });

  it("счётчики сутками по Астане: после полуночи (UTC+5) начинаются заново", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T18:50:00Z")); // 23:50 в Астане
    vi.stubEnv("AI_DEVICE_DAILY_UNITS", "1");
    const ip = freshIp();
    const { cookie } = await newDevice(ip);
    expect((await guardAi(req({ ip, cookie }), { route: "tutor", units: 1 })).ok).toBe(false);
    vi.setSystemTime(new Date("2026-10-05T19:10:00Z")); // 00:10 следующего дня
    expect((await guardAi(req({ ip, cookie }), { route: "tutor", units: 1 })).ok).toBe(true);
  });

  it("units: отрицательные, нецелые и огромные не ломают счёт (потолок 20 за вызов)", async () => {
    const day = kzDay();
    const huge = await guardAi(req(), { route: "tutor", units: 1e9 });
    expect(huge.ok && huge.units).toBe(20);
    expect(await holder.kv!.get(`ai:site:${day}`)).toBe(20);
    const nan = await guardAi(req(), { route: "tutor", units: Number.NaN });
    expect(nan.ok && nan.units).toBe(1);
    const frac = await guardAi(req(), { route: "tutor", units: 2.9 });
    expect(frac.ok && frac.units).toBe(2);
    const neg = await guardAi(req(), { route: "feedback", units: -5 });
    expect(neg.ok && neg.units).toBe(0);
  });
});

describe("release: возврат обращений", () => {
  it("возвращает списанное со всех счётчиков; повторный release ничего не меняет", async () => {
    const day = kzDay();
    const ip = freshIp();
    const g = await guardAi(req({ ip }), { route: "tutor", units: 2 });
    if (!g.ok) throw new Error("ожидали ok");
    expect(await holder.kv!.get(`ai:site:${day}`)).toBe(2);
    await g.release();
    expect(await holder.kv!.get(`ai:site:${day}`)).toBe(0);
    await g.release();
    await g.release();
    expect(await holder.kv!.get(`ai:site:${day}`)).toBe(0);
  });

  it("после release на потолке снова помещается запрос (ответ из кэша не списывает)", async () => {
    vi.stubEnv("AI_DEVICE_DAILY_UNITS", "2");
    const ip = freshIp();
    const first = await newDevice(ip); // 1
    const cookie = first.cookie;
    const second = await guardAi(req({ ip, cookie }), { route: "tutor", units: 1 }); // 2
    expect(second.ok).toBe(true);
    expect((await guardAi(req({ ip, cookie }), { route: "tutor", units: 1 })).ok).toBe(false);
    if (second.ok) await second.release();
    expect((await guardAi(req({ ip, cookie }), { route: "tutor", units: 1 })).ok).toBe(true);
  });

  it("сбой хранилища при release не роняет ответ", async () => {
    const g = await guardAi(req(), { route: "tutor", units: 1 });
    if (!g.ok) throw new Error("ожидали ok");
    const kv = holder.kv!;
    holder.kv = { ...kv, incrBy: async () => Promise.reject(new Error("down")) };
    await expect(g.release()).resolves.toBeUndefined();
  });

  it("недоступное хранилище не роняет маршрут: запрос проходит без учёта", async () => {
    const kv = holder.kv!;
    holder.kv = { ...kv, incrBy: async () => Promise.reject(new Error("down")) };
    const g = await guardAi(req(), { route: "tutor", units: 1 });
    expect(g.ok).toBe(true);
    if (g.ok) await expect(g.release()).resolves.toBeUndefined();
  });
});

describe("бесплатные для устройства запросы (отзыв после урока, units 0)", () => {
  it("у устройства свой потолок AI_FREE_DEVICE_DAILY, IP не считается, с сайта списывается 1", async () => {
    vi.stubEnv("AI_FREE_DEVICE_DAILY", "3");
    const day = kzDay();
    const ip = freshIp();
    const first = await guardAi(req({ ip }), { route: "feedback", units: 0 });
    if (!first.ok) throw new Error("ожидали ok");
    expect(first.units).toBe(0);
    const cookie = cookieOf(first.setCookie);
    expect((await guardAi(req({ ip, cookie }), { route: "feedback", units: 0 })).ok).toBe(true);
    expect((await guardAi(req({ ip, cookie }), { route: "feedback", units: 0 })).ok).toBe(true);
    expect(await holder.kv!.get(`ai:site:${day}`)).toBe(3);
    expect(await holder.kv!.get(`ai:ip:${day}:x`)).toBe(0);
    const over = await guardAi(req({ ip, cookie }), { route: "feedback", units: 0 });
    expect(over.ok).toBe(false);
    if (over.ok) return;
    expect(await bodyCode(over.response)).toBe("daily_limit");
    expect(await holder.kv!.get(`ai:site:${day}`)).toBe(3);
  });

  it("бесплатные запросы не съедают обращения устройства", async () => {
    vi.stubEnv("AI_DEVICE_DAILY_UNITS", "1");
    const ip = freshIp();
    const fb = await guardAi(req({ ip }), { route: "feedback", units: 0 });
    if (!fb.ok) throw new Error("ожидали ok");
    const cookie = cookieOf(fb.setCookie);
    expect((await guardAi(req({ ip, cookie }), { route: "tutor", units: 1 })).ok).toBe(true);
  });

  it("release отзыва возвращает бесплатный счёт устройства и 1 с сайта", async () => {
    vi.stubEnv("AI_FREE_DEVICE_DAILY", "1");
    const day = kzDay();
    const ip = freshIp();
    const g = await guardAi(req({ ip }), { route: "feedback", units: 0 });
    if (!g.ok) throw new Error("ожидали ok");
    const cookie = cookieOf(g.setCookie);
    expect((await guardAi(req({ ip, cookie }), { route: "feedback", units: 0 })).ok).toBe(false);
    await g.release();
    expect(await holder.kv!.get(`ai:site:${day}`)).toBe(0);
    expect((await guardAi(req({ ip, cookie }), { route: "feedback", units: 0 })).ok).toBe(true);
  });
});

describe("всплеск: окно 10 минут по IP", () => {
  it("tutor: 40 запросов за окно проходят, 41-й — 429 rate_limited; в новом окне снова можно", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T10:00:00Z"));
    const ip = freshIp();
    const { cookie } = await newDevice(ip); // 1-й
    for (let i = 1; i < 40; i++) expect((await guardAi(req({ ip, cookie }), { route: "tutor", units: 1 })).ok).toBe(true);
    const over = await guardAi(req({ ip, cookie }), { route: "tutor", units: 1 });
    expect(over.ok).toBe(false);
    if (over.ok) return;
    expect(over.response.status).toBe(429);
    expect(await bodyCode(over.response)).toBe("rate_limited");
    vi.setSystemTime(new Date(Date.now() + BURST_WINDOW_MS + 1000));
    expect((await guardAi(req({ ip, cookie }), { route: "tutor", units: 1 })).ok).toBe(true);
  });

  it("у маршрутов свои окна: фото-проверка — 15, расшифровка — 20; другой IP не задет", async () => {
    vi.stubEnv("AI_DEVICE_DAILY_UNITS", "100000");
    vi.stubEnv("AI_IP_DAILY_UNITS", "100000");
    vi.stubEnv("AI_SITE_DAILY_UNITS", "100000");
    const ip = freshIp();
    const first = await guardAi(req({ ip }), { route: "check", units: 1 });
    if (!first.ok) throw new Error("ожидали ok");
    const cookie = cookieOf(first.setCookie);
    for (let i = 1; i < 15; i++) expect((await guardAi(req({ ip, cookie }), { route: "check", units: 1 })).ok).toBe(true);
    expect((await guardAi(req({ ip, cookie }), { route: "check", units: 1 })).ok).toBe(false);
    // tutor с того же IP — своё окно
    expect((await guardAi(req({ ip, cookie }), { route: "tutor", units: 1 })).ok).toBe(true);
    expect((await guardAi(req({ ip: freshIp() }), { route: "check", units: 1 })).ok).toBe(true);
  });

  it("при отказе по лимиту дня важнее текст «лимит на сегодня», чем «подожди пару минут»", async () => {
    vi.stubEnv("AI_DEVICE_DAILY_UNITS", "1");
    const ip = freshIp();
    const { cookie } = await newDevice(ip);
    const over = await guardAi(req({ ip, cookie }), { route: "tutor", units: 1 });
    if (over.ok) throw new Error("ожидали отказ");
    expect(await bodyCode(over.response)).toBe("daily_limit");
  });

  it("kvRateLimit: окно по часам, отклонённый вызов тоже считается", async () => {
    const t0 = 1_000_000_000_000;
    expect(await kvRateLimit("k", 2, 60_000, t0)).toBe(true);
    expect(await kvRateLimit("k", 2, 60_000, t0 + 1)).toBe(true);
    expect(await kvRateLimit("k", 2, 60_000, t0 + 2)).toBe(false);
    expect(await kvRateLimit("k", 2, 60_000, t0 + 3)).toBe(false);
    expect(await kvRateLimit("k", 2, 60_000, t0 + 120_000)).toBe(true);
    expect(await kvRateLimit("other", 2, 60_000, t0)).toBe(true);
  });
});

describe("запрос с нашего сайта", () => {
  it("вне production запрос без Origin пропускается (curl, тесты)", async () => {
    expect((await guardAi(req(), { route: "tutor", units: 1 })).ok).toBe(true);
    expect(sameOrigin(req())).toBe(true);
  });

  it("в production без Origin — 403 forbidden_origin и ничего не списано", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const day = kzDay();
    const g = await guardAi(req(), { route: "tutor", units: 1 });
    expect(g.ok).toBe(false);
    if (g.ok) return;
    expect(g.response.status).toBe(403);
    expect(await bodyCode(g.response)).toBe("forbidden_origin");
    expect(g.response.headers.get("set-cookie")).toBeNull();
    expect(await holder.kv!.get(`ai:site:${day}`)).toBe(0);
  });

  it("в production: свой Origin проходит, чужой, null и кривой — нет", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const ok = await guardAi(req({ headers: { origin: "http://localhost" } }), { route: "tutor", units: 1 });
    expect(ok.ok).toBe(true);
    for (const origin of ["https://evil.example", "null", "not a url", "http://localhost.evil.com"]) {
      const g = await guardAi(req({ headers: { origin } }), { route: "tutor", units: 1 });
      expect(g.ok).toBe(false);
    }
  });

  it("Sec-Fetch-Site: если есть, должен быть same-origin (даже при совпадающем Origin и вне production)", async () => {
    for (const site of ["cross-site", "same-site", "none"]) {
      const g = await guardAi(req({ headers: { origin: "http://localhost", "sec-fetch-site": site } }), { route: "tutor", units: 1 });
      expect(g.ok).toBe(false);
    }
    const ok = await guardAi(req({ headers: { origin: "http://localhost", "sec-fetch-site": "same-origin" } }), { route: "tutor", units: 1 });
    expect(ok.ok).toBe(true);
  });

  it("Origin сверяется с x-forwarded-host за прокси", () => {
    const r = new Request("http://internal:3000/api/ai/tutor", {
      method: "POST",
      headers: { origin: "https://app.example", host: "internal:3000", "x-forwarded-host": "app.example" },
    });
    expect(sameOrigin(r)).toBe(true);
  });
});

describe("в логах нет IP и полного id устройства", () => {
  it("строка списания: route, units, dev (6 символов), site", async () => {
    const ip = "203.0.113.77";
    const g = await guardAi(req({ ip }), { route: "tutor", units: 2 });
    if (!g.ok) throw new Error("ожидали ok");
    const lines = vi.mocked(console.info).mock.calls.map((c) => String(c[0]));
    const line = lines.find((l) => l.startsWith("[ai] route=tutor units=2"));
    expect(line).toMatch(/^\[ai\] route=tutor units=2 dev=[A-Za-z0-9_-]{6} site=\d+$/);
    const id = cookieOf(g.setCookie).slice("inf_ai=".length, "inf_ai=".length + 22);
    for (const l of [...lines, ...vi.mocked(console.error).mock.calls.map((c) => String(c[0]))]) {
      expect(l).not.toContain(ip);
      expect(l).not.toContain(id);
    }
    expect(line).toContain(`dev=${id.slice(0, 6)}`);
  });

  it("в ключах хранилища IP — только хеш", async () => {
    const seen: string[] = [];
    const kv = createMemoryKv();
    holder.kv = { ...kv, incrBy: (k, n, ttl) => (seen.push(k), kv.incrBy(k, n, ttl)) };
    await guardAi(req({ ip: "198.51.100.9" }), { route: "tutor", units: 1 });
    expect(seen.length).toBeGreaterThan(0);
    for (const k of seen) expect(k).not.toContain("198.51.100.9");
  });
});

describe("история чата с клиента", () => {
  const msg = (role: "user" | "assistant", n: number) => ({ role, content: "а".repeat(n) });

  it("не больше 12 последних, каждое до 2000 символов", () => {
    const raw = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
    const h = sanitizeHistory(raw);
    expect(h).toHaveLength(12);
    expect(h[11].content).toBe("m29");
    expect(sanitizeHistory([msg("user", 5000)])[0].content).toHaveLength(2000);
  });

  it("всего не больше 8000 символов: старые сообщения отбрасываются, последнее остаётся", () => {
    const h = sanitizeHistory([msg("user", 2000), msg("assistant", 2000), msg("user", 2000), msg("assistant", 2000), msg("user", 2000)]);
    const total = h.reduce((a, m) => a + m.content.length, 0);
    expect(total).toBeLessThanOrEqual(HISTORY_MAX_CHARS);
    expect(h).toHaveLength(4);
    expect(h[h.length - 1].role).toBe("user");
  });

  it("мусор отбрасывается: не массив, чужие роли, пустой и нестроковый текст", () => {
    expect(sanitizeHistory("x")).toEqual([]);
    expect(sanitizeHistory(null)).toEqual([]);
    expect(
      sanitizeHistory([null, 5, { role: "system", content: "x" }, { role: "user", content: "  " }, { role: "user", content: 7 }, { role: "user", content: "ок" }]),
    ).toEqual([{ role: "user", content: "ок" }]);
  });
});

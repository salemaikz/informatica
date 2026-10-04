import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getKv, kzDay } from "@/server/kv";
import { sameOrigin } from "@/server/context";
import { clientIp, kvRateLimit } from "@/server/rate-limit";

// Серверный страж маршрутов ИИ (решение #48, docs/specs/stage10.md → B1): ни один ученик, даже на «Безлимите»,
// не должен разорить нас запросами, в том числе прямыми (curl, скрипт, чужой сайт).
//
//   const g = await guardAi(req, { route: "tutor", units: 1 });
//   if (!g.ok) return g.response;          // 403 / 429 / 503
//   ... вызов модели ...
//   g.release();                           // модель не вызывалась (ошибка до запроса, ответ из кэша, кризисный ответ)
//   return withGuardHeaders(response, g);  // Set-Cookie нового устройства
//
// Что проверяется (сутки по Астане, kzDay):
// - запрос с нашего сайта (sameOrigin: в production Origin обязателен);
// - устройство: подписанная cookie `inf_ai` (HMAC), без неё или с чужой подписью выдаётся новое устройство;
//   новых устройств с одного IP — не больше AI_NEW_DEVICES_PER_IP в сутки (обход через удаление cookie);
// - потолки в «обращениях»: устройство, IP, весь сайт; всплеск — окно 10 минут по IP.
// Обращения списываются ДО вызова модели и возвращаются release(). Счётчики — в общем хранилище (server/kv.ts).
// В логах нет IP и полного id устройства.

// ---------- Числа (env с дефолтами) ----------

export const AI_LIMIT_DEFAULTS = {
  /** Обращений в сутки на устройство: потолок «Безлимита» (тариф сервер пока не знает). */
  deviceDaily: 100,
  /** Обращений в сутки на IP: класс или семья за одним адресом. */
  ipDaily: 1000,
  /** Обращений в сутки на весь сайт: общий бюджет, сверх — 503 ai_busy. */
  siteDaily: 3000,
  /** Новых устройств в сутки с одного IP. */
  newDevicesPerIp: 30,
  /** Бесплатных для устройства запросов (отзыв после урока) в сутки на устройство. */
  freeDeviceDaily: 30,
};

export type AiLimits = typeof AI_LIMIT_DEFAULTS;

/** Целое число > 0 из env; всё остальное («abc», «0», «-5», «12x», «1e3», пусто) — значение по умолчанию. */
export function envPositiveInt(raw: string | undefined, fallback: number): number {
  const t = raw?.trim() ?? "";
  if (!/^\d{1,9}$/.test(t)) return fallback;
  const n = Number(t);
  return n > 0 ? n : fallback;
}

/** Лимиты из env (читаются при каждом вызове — меняются без перезапуска в тестах). */
export function readLimits(env: Record<string, string | undefined> = process.env): AiLimits {
  return {
    deviceDaily: envPositiveInt(env.AI_DEVICE_DAILY_UNITS, AI_LIMIT_DEFAULTS.deviceDaily),
    ipDaily: envPositiveInt(env.AI_IP_DAILY_UNITS, AI_LIMIT_DEFAULTS.ipDaily),
    siteDaily: envPositiveInt(env.AI_SITE_DAILY_UNITS, AI_LIMIT_DEFAULTS.siteDaily),
    newDevicesPerIp: envPositiveInt(env.AI_NEW_DEVICES_PER_IP, AI_LIMIT_DEFAULTS.newDevicesPerIp),
    freeDeviceDaily: envPositiveInt(env.AI_FREE_DEVICE_DAILY, AI_LIMIT_DEFAULTS.freeDeviceDaily),
  };
}

/** Всплеск: запросов к маршруту с одного IP за BURST_WINDOW_MS (как было до этапа 10). */
export const BURST_WINDOW_MS = 10 * 60_000;
export const BURST_LIMITS: Record<string, number> = { tutor: 40, check: 15, feedback: 20, stt: 20 };
const BURST_DEFAULT = 30;

/** Верхняя граница units одного вызова: защита от опечатки в коде маршрута. */
const MAX_UNITS = 20;
const DAY_TTL = 2 * 86_400;

// ---------- Устройство: подписанная cookie ----------

export const DEVICE_COOKIE = "inf_ai";
const COOKIE_MAX_AGE = 400 * 86_400;
const ID_RE = /^[A-Za-z0-9_-]{22}$/;

let processSecret: string | null = null;

/**
 * Секрет подписи cookie: AI_DEVICE_SECRET; нет — производный от OPENAI_API_KEY (sha256 с солью, сам ключ нигде не
 * хранится и не логируется); нет и его — постоянная строка вне production, а в production — случайная на процесс
 * (cookie тогда живут до перезапуска; IP и сайт всё равно защищены).
 */
function deviceSecret(env: Record<string, string | undefined> = process.env): string {
  const own = env.AI_DEVICE_SECRET?.trim();
  if (own) return own;
  const key = env.OPENAI_API_KEY?.trim();
  if (key) return createHash("sha256").update(`informatica-ai-device-v1:${key}`).digest("hex");
  if (env.NODE_ENV !== "production") return "informatica-dev-device-secret";
  processSecret ??= randomBytes(32).toString("hex");
  return processSecret;
}

function sign(id: string, secret: string): string {
  return createHmac("sha256", secret).update(id).digest("base64url").slice(0, 22);
}

/** Значение cookie `<id>.<sig>` → id устройства, если подпись верна. */
export function verifyDeviceCookie(value: string, secret: string): string | null {
  const dot = value.indexOf(".");
  if (dot !== 22) return null;
  const id = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!ID_RE.test(id) || sig.length !== 22) return null;
  const want = Buffer.from(sign(id, secret));
  const got = Buffer.from(sig);
  return got.length === want.length && timingSafeEqual(got, want) ? id : null;
}

function readDeviceId(req: Request, secret: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const p = part.trim();
    if (!p.startsWith(`${DEVICE_COOKIE}=`)) continue;
    const id = verifyDeviceCookie(p.slice(DEVICE_COOKIE.length + 1), secret);
    if (id) return id;
  }
  return null;
}

function newDeviceCookie(secret: string, env: Record<string, string | undefined> = process.env): { id: string; header: string } {
  const id = randomBytes(16).toString("base64url");
  const secure = env.NODE_ENV === "production" ? "; Secure" : "";
  return { id, header: `${DEVICE_COOKIE}=${id}.${sign(id, secret)}; HttpOnly; SameSite=Lax; Path=/api; Max-Age=${COOKIE_MAX_AGE}${secure}` };
}

// ---------- Страж ----------

export interface GuardOk {
  ok: true;
  /** Первые 6 символов id устройства (для логов). */
  device: string;
  /** Сколько обращений списано с устройства (0 — бесплатный для устройства запрос). */
  units: number;
  /** Set-Cookie нового устройства; null — устройство уже известно. */
  setCookie: string | null;
  /** Вернуть списанное: модель не вызывалась. Повторный вызов ничего не делает. */
  release: () => Promise<void>;
}

export interface GuardDenied {
  ok: false;
  response: Response;
}

export type Guard = GuardOk | GuardDenied;

export interface GuardOptions {
  /** Имя маршрута для логов и окна всплеска: tutor | check | feedback | stt. */
  route: string;
  /**
   * Вес запроса в обращениях (lib/economy.ts → AI_UNITS): 1 — чат, подсказка; 2 — фото; 4 — голос.
   * 0 — бесплатный для устройства (отзыв после урока): у устройства свой потолок AI_FREE_DEVICE_DAILY,
   * IP не считается, с сайта списывается 1.
   */
  units: number;
}

function deny(status: number, code: string, cookie: string | null): GuardDenied {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (cookie) headers.append("Set-Cookie", cookie);
  return { ok: false, response: Response.json({ error: code }, { status, headers }) };
}

/** Добавляет Set-Cookie нового устройства к ответу маршрута (если он ещё не выдан). */
export function withGuardHeaders(res: Response, g: GuardOk): Response {
  if (!g.setCookie) return res;
  try {
    res.headers.append("Set-Cookie", g.setCookie);
    return res;
  } catch {
    // Заголовки ответа неизменяемы — пересобираем ответ с теми же телом и статусом.
    const headers = new Headers(res.headers);
    headers.append("Set-Cookie", g.setCookie);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  }
}

export async function guardAi(req: Request, opts: GuardOptions): Promise<Guard> {
  if (!sameOrigin(req)) return deny(403, "forbidden_origin", null);

  const lim = readLimits();
  const secret = deviceSecret();
  const units = Number.isFinite(opts.units) ? Math.min(MAX_UNITS, Math.max(0, Math.floor(opts.units))) : 1;
  const free = units === 0;
  const siteUnits = free ? 1 : units;
  const now = Date.now();
  const day = kzDay(now);
  // IP хранится в ключах только хешем: в Redis нет сырых адресов.
  const ip = createHmac("sha256", secret).update(`ip:${clientIp(req)}`).digest("hex").slice(0, 20);

  let id = readDeviceId(req, secret);
  let cookie: string | null = null;
  if (!id) {
    const created = newDeviceCookie(secret);
    id = created.id;
    cookie = created.header;
  }
  const dev = id.slice(0, 6);

  try {
    const kv = getKv();

    // Новое устройство: не больше N в сутки с одного IP (иначе удаление cookie снимало бы все лимиты устройства).
    if (cookie) {
      const n = await kv.incrBy(`ai:nd:${day}:${ip}`, 1, DAY_TTL);
      if (n > lim.newDevicesPerIp) return deny(429, "daily_limit", null);
    }

    const keys = {
      dev: free ? `ai:df:${day}:${id}` : `ai:d:${day}:${id}`,
      ip: `ai:ip:${day}:${ip}`,
      site: `ai:site:${day}`,
    };
    const devUnits = free ? 1 : units;
    const devCap = free ? lim.freeDeviceDaily : lim.deviceDaily;
    const burstLimit = BURST_LIMITS[opts.route] ?? BURST_DEFAULT;

    const [burstOk, devN, ipN, siteN] = await Promise.all([
      kvRateLimit(`ai:${opts.route}:${ip}`, burstLimit, BURST_WINDOW_MS, now),
      kv.incrBy(keys.dev, devUnits, DAY_TTL),
      free ? Promise.resolve(0) : kv.incrBy(keys.ip, units, DAY_TTL),
      kv.incrBy(keys.site, siteUnits, DAY_TTL),
    ]);

    const overDev = devN > devCap;
    const overIp = !free && ipN > lim.ipDaily;
    const overSite = siteN > lim.siteDaily;
    // Возврат списанного; сбой хранилища здесь не должен ни пропустить лишний запрос, ни уронить ответ.
    const undo = async () => {
      try {
        await Promise.all([
          kv.incrBy(keys.dev, -devUnits, DAY_TTL),
          free ? Promise.resolve(0) : kv.incrBy(keys.ip, -units, DAY_TTL),
          kv.incrBy(keys.site, -siteUnits, DAY_TTL),
        ]);
      } catch (e) {
        console.error("[ai-guard] undo failed", e instanceof Error ? e.message : e);
      }
    };

    if (overDev || overIp || overSite || !burstOk) {
      await undo();
      // Важнее для ученика: лимит дня (завтра снова), затем общий запас сайта, затем «подожди пару минут».
      if (overDev || overIp) return deny(429, "daily_limit", cookie);
      if (overSite) return deny(503, "ai_busy", cookie);
      return deny(429, "rate_limited", cookie);
    }

    console.info(`[ai] route=${opts.route} units=${units} dev=${dev} site=${siteN}`);

    let released = false;
    return {
      ok: true,
      device: dev,
      units,
      setCookie: cookie,
      release: async () => {
        if (released) return;
        released = true;
        await undo();
      },
    };
  } catch (e) {
    // Хранилище недоступно совсем (kv.ts сам падает на память, сюда доходит только непредвиденное):
    // сайт не роняем — пропускаем запрос без учёта, в лог — только сообщение.
    console.error("[ai-guard] kv error, request not counted", e instanceof Error ? e.message : e);
    return { ok: true, device: dev, units, setCookie: cookie, release: async () => {} };
  }
}

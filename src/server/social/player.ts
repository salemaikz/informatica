import "server-only";
import { createHmac } from "node:crypto";
import { cosmeticDef, type CosmeticId, type CosmeticSlot } from "@/lib/cosmetics";
import { envPositiveInt } from "@/server/ai-guard";
import { ipHash } from "@/server/ip-hash";
import { checkName, type NameFail } from "@/server/moderation/check-name";
import { kvRateLimit } from "@/server/rate-limit";
import { cookieHeader, newSignedId, readSignedCookie, signedValue } from "@/server/signed-id";
import { newFriendCode } from "@/server/social/code";
import type { KvOp } from "@/server/kv";
import { namesEnabled, requireSocialSecret, type CountingKv } from "@/server/social/kv";

// Профиль игрока соцчасти (docs/specs/duels.md §5–§7, Ф2). Личность до аккаунтов — pid в подписанной cookie `inf_pl`
// (HttpOnly, SameSite=Lax, Path=/api — нужна и /api/social, и /api/duel; 400 дней; подпись SOCIAL_SECRET).
// Отдельно от `inf_ai`: удаление профиля соревнований не сбрасывает лимиты ИИ.
//
// Ключи (TTL 180 дней, продлеваются при сохранении профиля):
//   pl:{pid}        HASH профиль: code, lv, lang, frame, title, ft, nameState, name?, nameTry?, created, seen
//                   (nameLockUntil пишет модерация, Ф3)
//   pl:c:{pid}      STRING карточка JSON {c,n,lv,fr,ti} — для массового чтения одним MGET (топ друзей)
//   pl:code:{CODE}  STRING → pid (SET NX)
// На сервер НЕ уходят: фото-аватар, класс, цель, дата и балл ЕНТ, серия, точный XP, город (§7).

export const PLAYER_COOKIE = "inf_pl";
/** Контекст подписи: та же пара id/секрет не подходит в другие cookie. */
const PLAYER_SIGN_CONTEXT = "pl";
const COOKIE_MAX_AGE = 400 * 86_400;
export const PROFILE_TTL_SEC = 180 * 86_400;
const DAY_MS = 86_400_000;

export const SOCIAL_LIMITS = {
  /** Новых игроков в сутки с одного ipHash (школьный Wi-Fi, CGNAT оператора), env SOCIAL_NEW_PLAYERS_PER_IP. */
  newPlayersPerIp: 300,
  /** Смен имени в сутки на игрока. */
  nameChangesPerDay: 5,
};

export const keys = {
  profile: (pid: string) => `pl:${pid}`,
  card: (pid: string) => `pl:c:${pid}`,
  code: (code: string) => `pl:code:${code}`,
  friends: (pid: string) => `pl:fr:${pid}`,
  requests: (pid: string) => `pl:frq:${pid}`,
  blocked: (pid: string) => `pl:blk:${pid}`,
  inbox: (pid: string) => `pl:inbox:${pid}`,
  history: (pid: string) => `du:h:${pid}`,
  topWeek: (week: string) => `top:w:${week}`,
};

// ---------- cookie игрока ----------

/** pid из подписанной cookie `inf_pl` или null. */
export function readPlayerId(req: Request, secret: string): string | null {
  return readSignedCookie(req, PLAYER_COOKIE, secret, PLAYER_SIGN_CONTEXT);
}

/** Set-Cookie игрока. */
export function playerCookie(pid: string, secret: string, env: Record<string, string | undefined> = process.env): string {
  return cookieHeader(PLAYER_COOKIE, signedValue(pid, secret, PLAYER_SIGN_CONTEXT), { path: "/api", maxAgeSec: COOKIE_MAX_AGE }, env);
}

/** Set-Cookie, снимающий cookie игрока. */
export function clearPlayerCookie(env: Record<string, string | undefined> = process.env): string {
  return cookieHeader(PLAYER_COOKIE, "", { path: "/api", maxAgeSec: 0 }, env);
}

// ---------- карточка и профиль ----------

/** Кто виден другим. name: null → клиент рисует «Игрок 4821» / «Ойыншы 4821» на языке зрителя. */
export interface PublicCard {
  /** Код друга в хранимом виде (8 знаков без дефиса; показ — «K7QF-29XM»). */
  code: string;
  name: string | null;
  lv: number;
  frame: CosmeticId | null;
  title: CosmeticId | null;
  bot?: true;
}

/**
 * Состояние имени: none — не задано; ok — прошло фильтр; rejected — не прошло (показывается номер);
 * hidden — скрыто модерацией (Ф3); off — имена выключены (SOCIAL_NAMES=0).
 */
export type NameState = "none" | "ok" | "rejected" | "hidden" | "off";

export interface MyProfile extends PublicCard {
  nameState: NameState;
  lang: "ru" | "kk";
  /** Показывать мои очки в топе друзей. */
  ft: boolean;
}

const NAME_STATES: readonly NameState[] = ["none", "ok", "rejected", "hidden", "off"];

const clampLv = (x: unknown): number => {
  const n = typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN;
  return Number.isFinite(n) ? Math.min(999, Math.max(1, Math.floor(n))) : 1;
};

/** Украшение нужного слота или null (чужой id, другой слот — null). */
function cosmeticOf(slot: CosmeticSlot, x: unknown): CosmeticId | null {
  const def = cosmeticDef(x);
  return def && def.slot === slot ? def.id : null;
}

/** Профиль из хеша; null — профиля нет (истёк, удалён). Имена выключены — имя не отдаём. */
export function profileFromHash(h: Record<string, string>, names = namesEnabled()): MyProfile | null {
  if (!h.code) return null;
  const stored = NAME_STATES.includes(h.nameState as NameState) ? (h.nameState as NameState) : "none";
  const nameState: NameState = names ? stored : "off";
  return {
    code: h.code,
    name: nameState === "ok" && h.name ? h.name : null,
    lv: clampLv(h.lv),
    frame: cosmeticOf("frame", h.frame),
    title: cosmeticOf("title", h.title),
    nameState,
    lang: h.lang === "kk" ? "kk" : "ru",
    ft: h.ft !== "0",
  };
}

/** Карточка для pl:c:{pid} (короткие поля: читается пачками). h: 1 — игрок скрыл свои очки в топе друзей (ft = false, Ф3). */
export function cardJson(p: PublicCard & { ft?: boolean }): string {
  return JSON.stringify({ c: p.code, n: p.name, lv: p.lv, fr: p.frame, ti: p.title, ...(p.ft === false ? { h: 1 } : {}) });
}

/** Карточка из pl:c:{pid}; null — нет или мусор. Имена выключены — имени нет. */
export function cardFromJson(raw: string | null, names = namesEnabled()): PublicCard | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (typeof o.c !== "string" || !o.c) return null;
    return {
      code: o.c,
      name: names && typeof o.n === "string" && o.n ? o.n : null,
      lv: clampLv(o.lv),
      frame: cosmeticOf("frame", o.fr),
      title: cosmeticOf("title", o.ti),
    };
  } catch {
    return null;
  }
}

// ---------- ввод профиля ----------

export interface ProfileInput {
  /** null — имя не задано (стереть). */
  name: string | null;
  lang: "ru" | "kk";
  lv: number;
  frame: CosmeticId | null;
  title: CosmeticId | null;
  ft: boolean;
}

/** Тело POST /api/social/me → ввод; null — не объект. Лишнее отбрасывается, неверное — по умолчанию. */
export function parseProfileInput(raw: unknown): ProfileInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const cos = o.cosmetics && typeof o.cosmetics === "object" ? (o.cosmetics as Record<string, unknown>) : {};
  return {
    name: typeof o.name === "string" && o.name.trim() !== "" ? o.name.slice(0, 200) : null,
    lang: o.lang === "kk" ? "kk" : "ru",
    lv: clampLv(o.lv),
    frame: cosmeticOf("frame", cos.frame),
    title: cosmeticOf("title", cos.title),
    ft: o.ft !== false,
  };
}

// ---------- сохранение ----------

export type SaveResult =
  | { ok: true; player: MyProfile; created: boolean; hint?: NameFail | "limit" | "locked" }
  | { ok: false; status: 429; error: "daily_limit" };

/** Имя как его сравнивает сервер: NFC, без крайних пробелов, пробелы схлопнуты. */
const normName = (s: string): string => s.normalize("NFC").trim().replace(/\s+/gu, " ");
/**
 * Отпечаток отклонённого ввода (само имя не храним): HMAC с SOCIAL_SECRET и pid. Без соли короткое имя или номер
 * телефона (отказ «contact») восстанавливались бы перебором по хешу.
 */
const nameTry = (pid: string, s: string): string =>
  createHmac("sha256", requireSocialSecret()).update(`name-try:${pid}:${normName(s).toLowerCase()}`).digest("base64url").slice(0, 12);

/** Счётчик лимита в общем хранилище (kvRateLimit: INCRBY + EXPIRE = 2 команды). */
async function limited(kv: CountingKv, key: string, limit: number, windowMs: number, now: number): Promise<boolean> {
  kv.addCmds(2);
  return !(await kvRateLimit(key, limit, windowMs, now));
}

/** Свободный код друга: SET pl:code:{CODE} pid NX (коллизия — следующий). */
async function claimCode(kv: CountingKv, pid: string): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = newFriendCode();
    if (await kv.set(keys.code(code), pid, { nx: true, ttlSec: PROFILE_TTL_SEC })) return code;
  }
  throw new Error("social: friend code space exhausted");
}

/**
 * Создать или обновить профиль. pid — из cookie (null — новый игрок). Новый игрок: не больше N в сутки с одного ipHash.
 * Имя проверяется сервером всегда; смен имени — не больше 5 в сутки; SOCIAL_NAMES=0 — имя не хранится.
 */
export async function saveProfile(
  kv: CountingKv,
  req: Request,
  pidIn: string | null,
  input: ProfileInput,
  now: number,
): Promise<SaveResult & { pid?: string }> {
  let pid = pidIn;
  let cur: Record<string, string> = {};
  if (pid) cur = await kv.hgetAllStr(keys.profile(pid));
  const created = !pid || !cur.code;

  if (created) {
    const cap = envPositiveInt(process.env.SOCIAL_NEW_PLAYERS_PER_IP, SOCIAL_LIMITS.newPlayersPerIp);
    if (await limited(kv, `social:np:${ipHash(req)}`, cap, DAY_MS, now)) return { ok: false, status: 429, error: "daily_limit" };
    pid ??= newSignedId();
  }
  const playerId = pid as string;
  const code = cur.code || (await claimCode(kv, playerId));

  // Имя. Тот же ввод, что уже сохранён (принятый, скрытый или отклонённый), не проверяется заново и не тратит смены имени.
  const names = namesEnabled();
  let nameState: NameState = NAME_STATES.includes(cur.nameState as NameState) ? (cur.nameState as NameState) : "none";
  let name: string | null = cur.name || null;
  /** Отпечаток последнего отклонённого ввода и код отказа: «<hash>:<code>» (само отклонённое имя не храним). */
  let tryMark: string | null = nameState === "rejected" ? cur.nameTry || null : null;
  let hint: NameFail | "limit" | "locked" | undefined;
  if (!names) {
    nameState = "off";
    name = null;
    tryMark = null;
  } else if (input.name === null) {
    if (nameState !== "hidden") {
      nameState = "none";
      name = null;
      tryMark = null;
    }
  } else {
    const wanted = normName(input.name);
    const mark = nameTry(playerId, input.name);
    const same =
      ((nameState === "ok" || nameState === "hidden") && wanted === name) || (nameState === "rejected" && tryMark?.split(":")[0] === mark);
    if (same) {
      if (nameState === "rejected") hint = (tryMark?.split(":")[1] as NameFail | undefined) ?? "blocked";
    } else if ((Number(cur.nameLockUntil) || 0) > now) hint = "locked";
    else if (await limited(kv, `social:nm:${playerId}`, SOCIAL_LIMITS.nameChangesPerDay, DAY_MS, now)) hint = "limit";
    else {
      const res = checkName(input.name);
      if (res.ok) {
        nameState = "ok";
        name = res.name;
        tryMark = null;
      } else {
        nameState = "rejected";
        name = null;
        tryMark = `${mark}:${res.code}`;
        hint = res.code;
      }
    }
  }

  const player: MyProfile = {
    code,
    name: nameState === "ok" ? name : null,
    lv: input.lv,
    frame: input.frame,
    title: input.title,
    nameState,
    lang: input.lang,
    ft: input.ft,
  };
  const fields: Record<string, string | number> = {
    code,
    lv: player.lv,
    lang: player.lang,
    frame: player.frame ?? "",
    title: player.title ?? "",
    ft: player.ft ? "1" : "0",
    nameState,
    seen: now,
    ...(created ? { created: now } : {}),
    ...(player.name ? { name: player.name } : {}),
    ...(tryMark ? { nameTry: tryMark } : {}),
  };
  const drop = [...(player.name ? [] : ["name"]), ...(tryMark ? [] : ["nameTry"])];
  await kv.pipeline([
    { op: "hset", key: keys.profile(playerId), fields, ttlSec: PROFILE_TTL_SEC },
    { op: "hdel", key: keys.profile(playerId), fields: drop },
    { op: "set", key: keys.card(playerId), value: cardJson(player), ttlSec: PROFILE_TTL_SEC },
    { op: "expire", key: keys.code(code), ttlSec: PROFILE_TTL_SEC },
  ]);
  return { ok: true, player, created, pid: playerId, ...(hint ? { hint } : {}) };
}

/**
 * Профиль игрока (1 команда); null — нет.
 * SOCIAL_NAMES=0 включили, а в профиле осталось имя (или отпечаток отклонённого) с тех времён, когда имена были
 * включены, — убираем их из хранилища при первом же чтении владельцем (GET /me или /home) (+4 команды, один раз). Наружу имя не уходит
 * сразу после переключения; у игроков, которые больше не заходят, оно истечёт вместе с профилем (TTL 180 дней).
 */
export async function loadProfile(kv: CountingKv, pid: string): Promise<MyProfile | null> {
  const h = await kv.hgetAllStr(keys.profile(pid));
  const player = profileFromHash(h);
  if (player && !namesEnabled() && (h.name || h.nameTry)) await purgeStoredName(kv, pid, player, h.nameState === "hidden");
  return player;
}

/** Стереть сохранённое имя из профиля и карточки (имена выключены). Скрытие модерацией («hidden») сохраняется. */
async function purgeStoredName(kv: CountingKv, pid: string, player: MyProfile, hidden: boolean): Promise<void> {
  await kv.pipeline([
    { op: "hdel", key: keys.profile(pid), fields: ["name", "nameTry"] },
    { op: "hset", key: keys.profile(pid), fields: { nameState: hidden ? "hidden" : "off" }, ttlSec: PROFILE_TTL_SEC },
    { op: "set", key: keys.card(pid), value: cardJson({ ...player, name: null }), ttlSec: PROFILE_TTL_SEC },
  ]);
}

// ---------- удаление ----------

/** Неделя ISO по Астане (UTC+5): «2026-W41». TODO(слияние с duel-core): брать kzWeek из @/lib/duel/week. */
export function kzIsoWeek(now: number): string {
  const d = new Date(now + 5 * 3_600_000);
  const dow = d.getUTCDay() || 7;
  const thursday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - dow);
  const year = new Date(thursday).getUTCFullYear();
  const week = Math.floor((thursday - Date.UTC(year, 0, 1)) / DAY_MS / 7) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Недели, ключи топа которых могут быть ещё живы (TTL top:w — 15 дней от последней записи): текущая и три прошлые. */
export function liveWeeks(now: number): string[] {
  return [...new Set([0, 7, 14, 21].map((d) => kzIsoWeek(now - d * DAY_MS)))];
}

/**
 * «Удалить мой профиль соревнований» (§7): профиль, карточка, код, друзья с обеих сторон, заявки, блокировки, входящие,
 * история, места в топах недели. Заявки, которые этот игрок отправил другим (их pl:frq), найти нельзя — они повиснут
 * и отпадут при ответе (профиля нет) или по TTL 14 дней.
 */
export async function deletePlayer(kv: CountingKv, pid: string, now: number): Promise<void> {
  const [code, friends] = await kv.pipeline([
    { op: "hget", key: keys.profile(pid), field: "code" },
    { op: "smembers", key: keys.friends(pid) },
  ] as const);
  const owner = code ? await kv.getStr(keys.code(code)) : null;
  await kv.pipeline([
    ...friends.slice(0, 500).map((f) => ({ op: "srem", key: keys.friends(f), members: [pid] }) as KvOp),
    {
      op: "del",
      keys: [
        keys.profile(pid),
        keys.card(pid),
        keys.friends(pid),
        keys.requests(pid),
        keys.blocked(pid),
        keys.inbox(pid),
        keys.history(pid),
        ...(code && owner === pid ? [keys.code(code)] : []),
      ],
    },
    ...liveWeeks(now).map((w) => ({ op: "zrem", key: keys.topWeek(w), members: [pid] }) as KvOp),
  ]);
}

// ---------- главная соцчасти ----------

export interface HomeView {
  player: MyProfile | null;
  /** Входящие (приглашения, итоги вызовов) — формат записей задаёт Ф3; здесь — разобранный JSON. */
  inbox: unknown[];
  /** Число входящих заявок в друзья. */
  requests: number;
}

/** Профиль + входящие + число заявок — одним конвейером из 3 команд. */
export async function loadHome(kv: CountingKv, pid: string): Promise<HomeView> {
  const [h, inbox, requests] = await kv.pipeline([
    { op: "hgetAllStr", key: keys.profile(pid) },
    { op: "lrange", key: keys.inbox(pid), start: 0, stop: 19 },
    { op: "scard", key: keys.requests(pid) },
  ] as const);
  const player = profileFromHash(h);
  if (!player) return { player: null, inbox: [], requests: 0 };
  if (!namesEnabled() && (h.name || h.nameTry)) await purgeStoredName(kv, pid, player, h.nameState === "hidden");
  const items = inbox.flatMap((s) => {
    try {
      return [JSON.parse(s) as unknown];
    } catch {
      return [];
    }
  });
  return { player, inbox: items, requests };
}

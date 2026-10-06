import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { SIGNED_ID_RE } from "@/server/signed-id";
import { requireSocialSecret } from "@/server/social/kv";

// Подписанное место в матче и подписанный старт (docs/specs/duels.md §5):
//   token = base64url(JSON{m,s,pid,mode,seed,band,n,startAt,endsAt,deckTag}) + "." + HMAC-SHA256(SOCIAL_SECRET)
// - место (seat, заголовок x-duel-seat): проверка ответа не читает Redis — всё нужное для пересборки набора в токене;
// - старт (start): тот же токен без матча — одиночная запись вызова и игра против записи (ch — id вызова), 0 команд Redis.
// Вид токена входит в подпись («seat:» / «start:»): старт нельзя предъявить как место и наоборот.
// Сравнение подписи — за постоянное время. Секрет — только SOCIAL_SECRET (один на все копии сервера).

// TODO(слияние с пакетом duel-core): DuelModeId и полосы брать из @/lib/duel/types.
export const DUEL_MODE_IDS = ["blitz", "truth", "ten", "topic"] as const;
export type DuelModeId = (typeof DUEL_MODE_IDS)[number];
export type DuelBand = 1 | 2 | 3 | 4;
export type SeatSide = "a" | "b";

export const SEAT_HEADER = "x-duel-seat";
/** Потолок длины токена: защита разбора от мусора. */
export const SEAT_MAX_LEN = 1024;
/** Самый длинный матч (с запасом): места на более долгий срок не подписываем и не принимаем. */
export const SEAT_MAX_SPAN_MS = 60 * 60_000;

/** Общие поля места и старта: всё, чтобы сервер пересобрал набор заданий и проверил время. */
export interface DeckClaims {
  pid: string;
  mode: DuelModeId;
  seed: number;
  band: DuelBand;
  /** Число заданий в наборе. */
  n: number;
  /** Тема ЕНТ / раздел курса (только режим topic). */
  topic?: string;
  startAt: number;
  endsAt: number;
  deckTag: string;
}

export interface SeatClaims extends DeckClaims {
  /** id матча. */
  m: string;
  /** Сторона в матче. */
  s: SeatSide;
}

export interface StartClaims extends DeckClaims {
  /** id вызова, против записи которого идёт игра (нет — запись своего вызова). */
  ch?: string;
}

type Kind = "seat" | "start";

const ID_RE = /^[A-Za-z0-9_-]{6,32}$/;
const TAG_RE = /^[A-Za-z0-9_-]{1,32}$/;
const TOPIC_RE = /^[a-z0-9][a-z0-9_.-]{0,47}$/;

const isInt = (x: unknown, min: number, max: number): x is number => typeof x === "number" && Number.isInteger(x) && x >= min && x <= max;

function mac(kind: Kind, payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`${kind}:${payload}`).digest("base64url");
}

/** Общие поля в фиксированном порядке (лишнее в токен не попадает). */
function deckPart(c: DeckClaims): Record<string, unknown> {
  return {
    pid: c.pid,
    mode: c.mode,
    seed: c.seed,
    band: c.band,
    n: c.n,
    ...(c.topic !== undefined ? { topic: c.topic } : {}),
    startAt: c.startAt,
    endsAt: c.endsAt,
    deckTag: c.deckTag,
  };
}

/** Проверка общих полей; null — что-то не так. */
function parseDeck(o: Record<string, unknown>): DeckClaims | null {
  const { pid, mode, seed, band, n, topic, startAt, endsAt, deckTag } = o;
  if (typeof pid !== "string" || !SIGNED_ID_RE.test(pid)) return null;
  if (typeof mode !== "string" || !(DUEL_MODE_IDS as readonly string[]).includes(mode)) return null;
  if (!isInt(seed, 0, 0xffff_ffff)) return null;
  if (!isInt(band, 1, 4)) return null;
  if (!isInt(n, 1, 200)) return null;
  if (topic !== undefined && (typeof topic !== "string" || !TOPIC_RE.test(topic))) return null;
  if (mode === "topic" && topic === undefined) return null;
  if (!isInt(startAt, 0, Number.MAX_SAFE_INTEGER) || !isInt(endsAt, 0, Number.MAX_SAFE_INTEGER)) return null;
  if (endsAt <= startAt || endsAt - startAt > SEAT_MAX_SPAN_MS) return null;
  if (typeof deckTag !== "string" || !TAG_RE.test(deckTag)) return null;
  return { pid, mode: mode as DuelModeId, seed, band: band as DuelBand, n, ...(topic !== undefined ? { topic } : {}), startAt, endsAt, deckTag };
}

function sign(kind: Kind, body: Record<string, unknown>, secret: string): string {
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${payload}.${mac(kind, payload, secret)}`;
}

/** Подпись верна → разобранный объект; иначе null. Подпись проверяется ДО разбора JSON. */
function open(kind: Kind, token: unknown, secret: string): Record<string, unknown> | null {
  if (typeof token !== "string" || token.length === 0 || token.length > SEAT_MAX_LEN) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^[A-Za-z0-9_-]+$/.test(payload)) return null;
  const want = Buffer.from(mac(kind, payload, secret));
  const got = Buffer.from(sig);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const o = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function assertValid<T>(parsed: T | null, what: string): T {
  if (!parsed) throw new Error(`duel: invalid ${what} claims`);
  return parsed;
}

/** Подписать место в матче. Неверные поля — ошибка (баг в коде маршрута, а не ввод ученика). */
export function signSeat(c: SeatClaims, secret: string = requireSocialSecret()): string {
  const body = { m: c.m, s: c.s, ...deckPart(c) };
  assertValid(parseSeat(body), "seat");
  return sign("seat", body, secret);
}

function parseSeat(o: Record<string, unknown>): SeatClaims | null {
  if (typeof o.m !== "string" || !ID_RE.test(o.m)) return null;
  if (o.s !== "a" && o.s !== "b") return null;
  const deck = parseDeck(o);
  return deck ? { m: o.m, s: o.s, ...deck } : null;
}

/** Место из токена: подпись своим секретом и все поля в порядке; иначе null. */
export function verifySeat(token: unknown, secret: string = requireSocialSecret()): SeatClaims | null {
  const o = open("seat", token, secret);
  return o ? parseSeat(o) : null;
}

/** Место из заголовка x-duel-seat. */
export function readSeat(req: Request, secret: string = requireSocialSecret()): SeatClaims | null {
  return verifySeat(req.headers.get(SEAT_HEADER), secret);
}

/** Подписать старт (без матча). */
export function signStart(c: StartClaims, secret: string = requireSocialSecret()): string {
  const body = { ...deckPart(c), ...(c.ch !== undefined ? { ch: c.ch } : {}) };
  assertValid(parseStart(body), "start");
  return sign("start", body, secret);
}

function parseStart(o: Record<string, unknown>): StartClaims | null {
  if (o.ch !== undefined && (typeof o.ch !== "string" || !ID_RE.test(o.ch))) return null;
  const deck = parseDeck(o);
  return deck ? { ...deck, ...(o.ch !== undefined ? { ch: o.ch as string } : {}) } : null;
}

/** Старт из токена: подпись своим секретом и все поля в порядке; иначе null. */
export function verifyStart(token: unknown, secret: string = requireSocialSecret()): StartClaims | null {
  const o = open("start", token, secret);
  return o ? parseStart(o) : null;
}

/** Окно приёма ответов по месту/старту: [startAt, endsAt + graceMs] по серверным часам. */
export function withinWindow(c: Pick<DeckClaims, "startAt" | "endsAt">, now: number, graceMs = 3000): boolean {
  return now >= c.startAt && now <= c.endsAt + graceMs;
}

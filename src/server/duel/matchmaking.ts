import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { DUEL_MODES, bandOf, isDuelBand } from "@/lib/duel/modes";
import type { DuelBand, MatchJoin } from "@/lib/duel/types";
import type { ZEntry } from "@/server/kv";
import type { CountingKv } from "@/server/social/kv";
import { keys } from "@/server/social/player";
import { joinOf, matchFields, newMatchId, newMatchSeed, scheduleFrom, seatClaims, writeMatchOp } from "./match";
import type { SeatClaims } from "./seat";

// Подбор случайного соперника в «Блице» (docs/specs/duels.md §2.1): «захват через ZREM», без Lua — одинаково в памяти
// и в Upstash. Очередь du:q:blitz:{deckTag} — ZSET, member «ticket|pid», score — когда ждущий последний раз был жив
// (каждая попытка захвата обновляет). Билет «<id12>.<полоса>.<начало поиска base36>.<подпись>»: полоса и время ожидания —
// в нём, подпись — HMAC(SOCIAL_SECRET, pid + билет): чужой или самодельный билет (своя полоса, «давнее» начало ради широкого
// допуска, обход лимита создания поиска) не принимается; билет живёт не дольше QUEUE_TTL_SEC.
//   1) конвейер: [ZREM q own (повторная попытка)] + ZRANGE q 0 9 + SMEMBERS pl:blk:{я};
//      ZREM own = 0 — меня уже забрали (или поиск отменён): читаю du:tk:{own};
//   2) кандидат: другой pid, полоса в допуске по времени ожидания, не в моём блок-листе, не «мёртвый» (давно не обновлялся);
//   3) конвейер: SISMEMBER pl:blk:{кандидат} я + ZREM q cand. ZREM = 1 — кандидат мой (заблокировал меня — возвращаю
//      его на место); = 0 — следующий;
//   4) захватил: HSET du:m:{id} (+EXPIRE) + SET du:tk:{cand} = его место + SET du:tk:{own} = моё место (60 с) — отвечаю
//      «matched» (своё место в tk нужно отмене: ответ мог потеряться, пока ученик выбирал Бита);
//   5) никого — конвейер ZADD q own (+EXPIRE 120 с) + GET du:tk:{own}: если за время попытки поиск отменили (DELETE
//      ставит «cancel») или пришло место — ZREM own и отвечаю по tk; иначе «waiting».
// Двойного матча нет: каждого забирает только тот, у кого ZREM вернул 1, а ищущий в момент поиска сам вне очереди.
// Захват упал после ZREM (функция умерла): у ждущего ZREM own = 0, а tk пуст — он ставит «limbo» на 2 с и затем
// заново встаёт в очередь (limbo не удаляем: место от медленного захвата перезапишет его и найдётся шагом 5);
// сиротский матч истекает сам (никто не подтвердит готовность).

export const QUEUE_TTL_SEC = 120;
export const TICKET_TTL_SEC = 60;
/** Ждущий без обновления дольше этого — ушёл (закрыл вкладку): чистим из очереди. Попытка захвата — раз в 3 с. */
export const STALE_MS = 9_000;
/** Сколько ждём записи места после того, как нас забрали, прежде чем снова встать в очередь, мс. */
export const LIMBO_MS = 2_000;
/** Сколько кандидатов пробуем за одну попытку. */
const MAX_TRIES = 3;

export const queueKey = (deckTag: string) => `du:q:blitz:${deckTag}`;
export const ticketKey = (ticket: string) => `du:tk:${ticket}`;

const TICKET_RE = /^([A-Za-z0-9_-]{12})\.([1-4])\.([0-9a-z]{6,10})\.([A-Za-z0-9_-]{16})$/;

export interface Ticket {
  ticket: string;
  band: DuelBand;
  /** Начало поиска, мс. */
  since: number;
}

const ticketSig = (body: string, pid: string, secret: string) => createHmac("sha256", secret).update(`duel-ticket:${pid}:${body}`).digest("base64url").slice(0, 16);

export function newTicket(band: DuelBand, now: number, pid: string, secret: string): Ticket {
  const body = `${randomBytes(9).toString("base64url")}.${band}.${Math.floor(now).toString(36)}`;
  return { ticket: `${body}.${ticketSig(body, pid, secret)}`, band, since: Math.floor(now) };
}

/** Разбор формы билета (участники очереди — их писал сервер; подпись не проверяется). */
export function parseTicket(raw: unknown): Ticket | null {
  const m = typeof raw === "string" ? TICKET_RE.exec(raw) : null;
  if (!m) return null;
  const band = Number(m[2]);
  const since = parseInt(m[3], 36);
  if (!isDuelBand(band) || !Number.isFinite(since)) return null;
  return { ticket: raw as string, band, since };
}

/** Билет от клиента: форма, подпись этого игрока и срок; иначе null. */
export function verifyTicket(raw: unknown, pid: string, secret: string, now: number): Ticket | null {
  const t = parseTicket(raw);
  if (!t) return null;
  const dot = t.ticket.lastIndexOf(".");
  const want = Buffer.from(ticketSig(t.ticket.slice(0, dot), pid, secret));
  const got = Buffer.from(t.ticket.slice(dot + 1));
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  if (t.since > now + 60_000 || now - t.since > QUEUE_TTL_SEC * 1000) return null;
  return t;
}

export const memberOf = (ticket: string, pid: string) => `${ticket}|${pid}`;

/** Допуск по полосе от времени ожидания: сначала своя полоса, с 5 с — соседняя, с 12 с — любая. */
export function bandTolerance(waitMs: number): number {
  if (waitMs < 5_000) return 0;
  if (waitMs < 12_000) return 1;
  return 3;
}

export type QueueReply = { state: "waiting"; ticket: string } | { state: "matched"; join: MatchJoin } | { state: "cancelled" };

/** Значение du:tk: место владельца билета (JSON claims без подписи), «limbo:<мс>» или «cancel» (поиск отменён). */
type TicketValue = { kind: "join"; claims: SeatClaims } | { kind: "limbo"; at: number } | { kind: "cancel" } | null;

const CANCELLED = "cancel";

function readTicketValue(raw: string | null): TicketValue {
  if (!raw) return null;
  if (raw === CANCELLED) return { kind: "cancel" };
  if (raw.startsWith("limbo:")) return { kind: "limbo", at: Number(raw.slice(6)) || 0 };
  try {
    const c = JSON.parse(raw) as SeatClaims;
    return c && typeof c === "object" && typeof c.m === "string" ? { kind: "join", claims: c } : null;
  } catch {
    return null;
  }
}

interface Seeker {
  pid: string;
  lv: number;
  t: Ticket;
  deckTag: string;
}

/**
 * Попытка подбора. first — новый поиск (своего билета в очереди ещё нет); иначе сначала ZREM своего member.
 * Возвращает matched (с моим местом), waiting или — для повторной попытки — то, что лежит в du:tk.
 */
export async function attempt(kv: CountingKv, me: Seeker, now: number, secret: string, first: boolean): Promise<QueueReply> {
  const q = queueKey(me.deckTag);
  const own = memberOf(me.t.ticket, me.pid);
  const scan = [
    { op: "zrange", key: q, start: 0, stop: 9 },
    { op: "smembers", key: keys.blocked(me.pid) },
  ] as const;
  let removed = 1;
  let entries: ZEntry[];
  let blocked: string[];
  if (first) [entries, blocked] = await kv.pipeline(scan);
  else [removed, entries, blocked] = await kv.pipeline([{ op: "zrem", key: q, members: [own] }, ...scan] as const);
  if (removed === 0) {
    // Меня уже нет в очереди: забрали (место в du:tk) или захват в процессе / упал.
    const tk = readTicketValue(await kv.getStr(ticketKey(me.t.ticket)));
    if (tk?.kind === "join") return matchedFrom(tk.claims, me.pid, secret);
    if (tk?.kind === "cancel") return { state: "cancelled" };
    if (tk?.kind === "limbo" && now - tk.at < LIMBO_MS) return { state: "waiting", ticket: me.t.ticket };
    if (!tk) {
      await kv.set(ticketKey(me.t.ticket), `limbo:${now}`, { nx: true, ttlSec: TICKET_TTL_SEC });
      return { state: "waiting", ticket: me.t.ticket };
    }
    // limbo истёк, место так и не появилось — снова в очередь (ниже обычный поиск). limbo не удаляем: DEL мог бы стереть
    // место, которое медленный захват записал только что; его найдёт GET в конце попытки.
  }
  const blockedSet = new Set(blocked);
  const myWait = now - me.t.since;
  const stale: string[] = [];
  let tries = 0;
  for (const e of entries) {
    if (tries >= MAX_TRIES) break;
    const [ticket, pid] = e.member.split("|");
    const t = parseTicket(ticket);
    if (!t || !pid) {
      stale.push(e.member);
      continue;
    }
    if (now - e.score > STALE_MS) {
      stale.push(e.member);
      continue;
    }
    if (pid === me.pid || blockedSet.has(pid)) continue;
    if (Math.abs(t.band - me.t.band) > bandTolerance(Math.max(myWait, now - t.since))) continue;
    tries++;
    const [blocksMe, got] = await kv.pipeline([
      { op: "sismember", key: keys.blocked(pid), member: me.pid },
      { op: "zrem", key: q, members: [e.member] },
    ] as const);
    if (got !== 1) continue;
    if (blocksMe) {
      // Кандидат заблокировал меня — возвращаем его на место (с прежней отметкой жизни).
      await kv.zadd(q, e.score, e.member, { ttlSec: QUEUE_TTL_SEC });
      continue;
    }
    return await createLiveMatch(kv, me, { pid, t }, now, secret);
  }
  const res = await kv.pipeline([
    ...(stale.length ? [{ op: "zrem" as const, key: q, members: stale }] : []),
    { op: "zadd", key: q, score: now, member: own, ttlSec: QUEUE_TTL_SEC },
    { op: "getStr", key: ticketKey(me.t.ticket) },
  ]);
  // Пока шла попытка, поиск отменили («Сыграть с Битом», закрыта вкладка) или пришло место — не оставляем «призрака».
  const after = readTicketValue((res[res.length - 1] as string | null) ?? null);
  if (after?.kind === "cancel" || after?.kind === "join") {
    await kv.zrem(q, [own]);
    return after.kind === "join" ? matchedFrom(after.claims, me.pid, secret) : { state: "cancelled" };
  }
  return { state: "waiting", ticket: me.t.ticket };
}

function matchedFrom(claims: SeatClaims, pid: string, secret: string): QueueReply {
  // Место в du:tk записано для владельца билета; чужой билет — как будто его нет.
  if (claims.pid !== pid) return { state: "cancelled" };
  return { state: "matched", join: joinOf(claims, secret) };
}

/** Захватил кандидата: матч (a — я, b — он), его место — в du:tk:{его билет}. */
async function createLiveMatch(kv: CountingKv, me: Seeker, cand: { pid: string; t: Ticket }, now: number, secret: string): Promise<QueueReply> {
  const [cardMe, cardThem] = await kv.mget([keys.card(me.pid), keys.card(cand.pid)]);
  const band = Math.min(me.t.band, cand.t.band) as DuelBand;
  const id = newMatchId();
  const seed = newMatchSeed();
  const lvOf = (raw: string | null, fallback: number) => {
    try {
      const lv = raw ? Number((JSON.parse(raw) as { lv?: unknown }).lv) : NaN;
      return Number.isFinite(lv) && lv >= 1 ? Math.floor(lv) : fallback;
    } catch {
      return fallback;
    }
  };
  const fields = matchFields({
    kind: "live",
    mode: "blitz",
    seed,
    band,
    deckTag: me.deckTag,
    created: now,
    a: { pid: me.pid, card: cardMe, lv: lvOf(cardMe, me.lv) },
    b: { pid: cand.pid, card: cardThem, lv: lvOf(cardThem, cand.t.band === 1 ? 1 : 5) },
  });
  const sched = scheduleFrom("blitz", band, now);
  const base = { id, mode: "blitz" as const, seed, band, n: DUEL_MODES.blitz.n, deckTag: me.deckTag, startAt: sched.startAt, endsAt: sched.endsAt };
  const theirs = seatClaims(base, "b", cand.pid);
  const mine = seatClaims(base, "a", me.pid);
  await kv.pipeline([
    writeMatchOp(id, fields),
    { op: "set", key: ticketKey(cand.t.ticket), value: JSON.stringify(theirs), ttlSec: TICKET_TTL_SEC },
    // Своё место — тоже в tk: если ответ потерялся, а ученик нажал «Сыграть с Битом», отмена вернёт это место.
    { op: "set", key: ticketKey(me.t.ticket), value: JSON.stringify(mine), ttlSec: TICKET_TTL_SEC },
  ]);
  return { state: "matched", join: joinOf(mine, secret) };
}

/** Опрос ждущего без попытки захвата: только GET du:tk (1 команда). */
export async function peek(kv: CountingKv, ticket: Ticket, pid: string, secret: string): Promise<QueueReply> {
  const tk = readTicketValue(await kv.getStr(ticketKey(ticket.ticket)));
  if (tk?.kind === "join") return matchedFrom(tk.claims, pid, secret);
  if (tk?.kind === "cancel") return { state: "cancelled" };
  return { state: "waiting", ticket: ticket.ticket };
}

/**
 * Отмена поиска (в том числе «Сыграть с Битом»): ZREM своего member + SET du:tk «cancel» (NX) + GET du:tk. Забрали
 * раньше (или своя попытка уже захватила соперника) — отвечаем «matched»: ученик входит в живой матч с пояснением
 * (гонка «выбрал Бита, а меня забрали», §10). Метка «cancel» не даёт идущей в этот момент попытке снова поставить
 * билет в очередь (шаг 5 в attempt).
 */
export async function cancel(kv: CountingKv, ticket: Ticket, pid: string, deckTag: string, secret: string): Promise<QueueReply> {
  const [, , raw] = await kv.pipeline([
    { op: "zrem", key: queueKey(deckTag), members: [memberOf(ticket.ticket, pid)] },
    { op: "set", key: ticketKey(ticket.ticket), value: CANCELLED, nx: true, ttlSec: TICKET_TTL_SEC },
    { op: "getStr", key: ticketKey(ticket.ticket) },
  ] as const);
  const tk = readTicketValue(raw);
  if (tk?.kind === "join") return matchedFrom(tk.claims, pid, secret);
  return { state: "cancelled" };
}

/** Полоса подбора по уровню, который сообщил клиент. */
export const queueBand = (lv: number): DuelBand => bandOf(lv);

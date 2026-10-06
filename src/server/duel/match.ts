import "server-only";
import { createHmac, randomBytes, randomInt } from "node:crypto";
import { buildDeck, deckLevels } from "@/lib/duel/deck";
import { DUEL_MODES, LATE_GRACE_MS, isDuelBand, isDuelMode, itemLimitMs, matchDurationMs } from "@/lib/duel/modes";
import { cheatFlagCount, eventsOf, judgeAnswers, type JudgedAnswer, type PlausibleFlag } from "@/lib/duel/plausible";
import { countedFor, technicalResult, totals, winner, type SideStatus, type SideTotals } from "@/lib/duel/score";
import { kzDay, pairKey } from "@/lib/duel/week";
import type { AnswerIn, DuelBand, DuelItem, DuelModeId, MatchJoin, MatchView, NotCountedWhy, PublicCard, SideView } from "@/lib/duel/types";
import type { KvOp } from "@/server/kv";
import type { CountingKv } from "@/server/social/kv";
import { cardFromJson, cardJson, keys } from "@/server/social/player";
import { awardWeekOps } from "@/server/social/tops";
import { signSeat, type SeatClaims, type SeatSide } from "./seat";

// Живой матч (docs/specs/duels.md §2, §5, §6, §10; duels-design/1-server.md §3): HASH du:m:{id}, TTL 1 ч от создания.
//   мета: kind (live|room), mode, topic, seed, band, n, tag (deckTag), created, rdyBy, startAt, endsAt, a, b (pid),
//         ca/cb (карточки JSON на момент входа), la/lb (уровни), room (код комнаты), go (старт комнаты, HSETNX);
//   стороны: {s}_rdy (HSETNX — первая готовность), {s}_seen, {s}_done, {s}_left, {s}_rm — время, мс;
//         ответы {s}:{i} = «ok.t.ms.flags» через HSETNX (повтор и вторая вкладка не перезапишут);
//   итог: res (JSON через HSETNX — ровно одно завершение, со счётом на момент итога), rm (JSON реванша).
// Состояния: lobby (комната ждёт друга / ждём готовности обоих) → countdown (оба готовы, до startAt) → playing → finished;
// cancelled — не подтвердил готовность в срок, ушёл до старта или комната истекла (сердечко не списано: платят в startAt).
// Случайный матч: готовность — 6 с, старт — через 7,5 с после создания. Комната: друг вошёл — у обоих 60 с на готовность
// (хозяин в это время часто в мессенджере, а вкладка на паузе); старт — через 5 с после второй готовности (HSETNX go),
// места переподписываются с настоящим стартом (до этого — «предварительный» старт в конце окна готовности).
// Завершение ленивое: любое чтение, увидевшее конец, читает счётчики пары и суток, считает итог и пишет его HSETNX res;
// только победитель гонки начисляет очки недели, лимиты и историю в том же запросе (не в after()). Падение между итогом
// и начислением теряет очки этого матча, но не «вешает» матч: итог уже записан.
// Приватность (3-safety §3): случайному сопернику код друга не уходит — вместо него непрозрачная метка (HMAC от pid),
// по ней же «Игрок 4821»; в историю случайного матча код соперника не пишется.

export const MATCH_TTL_SEC = 3600;
/** Готовность обоих — за столько после создания случайного матча, мс. */
export const READY_MS = 6_000;
/** Старт — через столько после создания: успеть узнать о матче (опрос 1,5–2 с), скачать набор и показать VS. */
export const START_MS = 7_500;
/** Комната: окно готовности после входа друга, мс. */
export const ROOM_READY_MS = 60_000;
/** Комната: старт через столько после второй готовности (второй узнаёт опросом за ≤ 2 с), мс. */
export const ROOM_COUNTDOWN_MS = 5_000;
/** Комната ждёт друга столько, мс (как du:room). */
export const ROOM_LOBBY_MS = 10 * 60_000;
/** Реванш: второй должен согласиться за столько после первого, мс. */
export const REMATCH_WINDOW_MS = 20_000;
/**
 * Писать в хеш по подписанному месту можно, пока ключ точно жив: TTL 1 ч от создания, а старт — не позже ~11,5 мин
 * после создания (комната 10 мин + окно готовности 60 с + отсчёт), поэтому 45 мин от старта — с запасом ≥ 3 мин.
 */
const SEAT_WRITE_MS = 45 * 60_000;

const HISTORY_MAX = 20;
const HISTORY_TTL_SEC = 30 * 86_400;
const DAY_COUNTER_TTL_SEC = 2 * 86_400;

export const matchKey = (id: string) => `du:m:${id}`;
const pairCounterKey = (day: string, a: string, b: string) => `du:pair:${day}:${pairKey(a, b)}`;
const dayCounterKey = (day: string, pid: string) => `du:cnt:${day}:${pid}`;

export const MATCH_ID_RE = /^[A-Za-z0-9_-]{12}$/;
/** id матча: 12 знаков base64url (подходит в место, seat.ts). */
export const newMatchId = (): string => randomBytes(9).toString("base64url");
/** seed набора (uint32). */
export const newMatchSeed = (): number => randomInt(0, 0x1_0000_0000);

export type MatchKind = "live" | "room";
type CancelWhy = NonNullable<MatchView["cancelled"]>;

export interface SideData {
  pid: string;
  card: PublicCard;
  rdy: number;
  seen: number;
  done: number;
  left: number;
  rm: number;
  /** Принятые ответы подряд от 0. */
  answers: JudgedAnswer[];
}

export interface StoredResult {
  /** Победитель: a, b или ничья. */
  w: "a" | "b" | "draw";
  r: NonNullable<MatchView["result"]>["reason"];
  pa: number;
  pb: number;
  ca: boolean;
  cb: boolean;
  ya?: NotCountedWhy;
  yb?: NotCountedWhy;
  /** Счёт, верные и число ответов сторон на момент итога: поздняя запись ответа не меняет показанный итог. */
  sa: number;
  sb: number;
  ka: number;
  kb: number;
  na: number;
  nb: number;
}

interface RematchInfo {
  id: string;
  seed: number;
  startAt: number;
  endsAt: number;
}

export interface MatchData {
  id: string;
  kind: MatchKind;
  mode: DuelModeId;
  topic?: string;
  seed: number;
  band: DuelBand;
  n: number;
  deckTag: string;
  created: number;
  rdyBy: number;
  /** 0 — комната ещё ждёт друга. */
  startAt: number;
  endsAt: number;
  room?: string;
  /** Комната: старт назначен (оба готовы, HSETNX go). */
  go: boolean;
  a: SideData;
  b: SideData | null;
  res: StoredResult | null;
  rm: RematchInfo | null;
}

// ---------- ответы в хеше ----------

const FLAG_BITS: Record<PlausibleFlag, number> = { fast: 1, sum: 2, late: 4 };

export function encodeJudged(j: JudgedAnswer): string {
  const f = j.flags.reduce((m, x) => m | FLAG_BITS[x], 0);
  return `${j.ok ? 1 : 0}.${j.t}.${j.ms}.${f}`;
}

function decodeJudged(i: number, raw: string | undefined, mode: DuelModeId): JudgedAnswer | null {
  const m = raw ? /^([01])\.(\d{1,9})\.(\d{1,9})\.(\d{1,2})$/.exec(raw) : null;
  if (!m) return null;
  const ok = m[1] === "1";
  const bits = Number(m[4]);
  const flags = (Object.keys(FLAG_BITS) as PlausibleFlag[]).filter((f) => bits & FLAG_BITS[f]);
  const { pts } = DUEL_MODES[mode];
  return { i, a: -1, ms: Number(m[3]), ok, pts: ok ? pts.ok : pts.bad, t: Number(m[2]), flags };
}

/** Ответы стороны подряд от 0 (дырка — конец: принимаем только следующее задание). */
function sideAnswers(h: Record<string, string>, side: SeatSide, n: number, mode: DuelModeId): JudgedAnswer[] {
  const out: JudgedAnswer[] = [];
  for (let i = 0; i < n; i++) {
    const j = decodeJudged(i, h[`${side}:${i}`], mode);
    if (!j) break;
    out.push(j);
  }
  return out;
}

// ---------- разбор хеша ----------

const num = (x: string | undefined): number => {
  const v = Number(x);
  return Number.isFinite(v) && v > 0 ? v : 0;
};

function json<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Карточка из хеша; нет — запасная (код пустой, имя — номер у зрителя). */
function cardOf(raw: string | undefined, lv: string | undefined): PublicCard {
  return cardFromJson(raw ?? null) ?? { code: "", name: null, lv: Math.max(1, Math.min(999, Math.floor(num(lv)) || 1)), frame: null, title: null };
}

function sideOf(h: Record<string, string>, s: SeatSide, n: number, mode: DuelModeId): SideData | null {
  const pid = h[s];
  if (!pid) return null;
  return {
    pid,
    card: cardOf(h[`c${s}`], h[`l${s}`]),
    rdy: num(h[`${s}_rdy`]),
    seen: num(h[`${s}_seen`]),
    done: num(h[`${s}_done`]),
    left: num(h[`${s}_left`]),
    rm: num(h[`${s}_rm`]),
    answers: sideAnswers(h, s, n, mode),
  };
}

/** Матч из хеша; null — нет (истёк) или испорчен. */
export function parseMatch(id: string, h: Record<string, string>): MatchData | null {
  const mode = h.mode;
  const band = Number(h.band);
  if (!isDuelMode(mode) || !isDuelBand(band) || !h.a || !h.tag) return null;
  const n = DUEL_MODES[mode].n;
  const a = sideOf(h, "a", n, mode);
  if (!a) return null;
  // Комната: назначенный старт (go) заменяет предварительный.
  const go = num(h.go);
  const startAt = go || num(h.startAt);
  const endsAt = go ? go + durationOf(mode, band) : num(h.endsAt);
  return {
    id,
    kind: h.kind === "room" ? "room" : "live",
    mode,
    ...(h.topic ? { topic: h.topic } : {}),
    seed: Number(h.seed) >>> 0,
    band,
    n,
    deckTag: h.tag,
    created: num(h.created),
    rdyBy: num(h.rdyBy),
    startAt,
    endsAt,
    ...(h.room ? { room: h.room } : {}),
    go: go > 0,
    a,
    b: sideOf(h, "b", n, mode),
    res: json<StoredResult>(h.res),
    rm: json<RematchInfo>(h.rm),
  };
}

export function sideFor(m: MatchData, pid: string): SeatSide | null {
  if (m.a.pid === pid) return "a";
  if (m.b?.pid === pid) return "b";
  return null;
}

const other = (s: SeatSide): SeatSide => (s === "a" ? "b" : "a");

// ---------- создание ----------

export interface NewMatch {
  kind: MatchKind;
  mode: DuelModeId;
  topic?: string;
  seed: number;
  band: DuelBand;
  deckTag: string;
  created: number;
  a: { pid: string; card: string | null; lv: number };
  b?: { pid: string; card: string | null; lv: number };
  room?: string;
}

/** Длительность матча режима и полосы, мс. */
export function durationOf(mode: DuelModeId, band: DuelBand): number {
  return matchDurationMs(mode, deckLevels(mode, band));
}

/** Сроки матча, в который оба вошли в момент at. */
export function scheduleFrom(mode: DuelModeId, band: DuelBand, at: number): { rdyBy: number; startAt: number; endsAt: number } {
  const startAt = at + START_MS;
  return { rdyBy: at + READY_MS, startAt, endsAt: startAt + durationOf(mode, band) };
}

/**
 * Комната: друг вошёл в момент at — 60 с на готовность обоих. Предварительный старт — сразу после окна готовности
 * (startAt − rdyBy = START_MS − READY_MS, как у случайного матча: маршрут готовности считает срок по месту одинаково);
 * настоящий старт назначит вторая готовность (go).
 */
export function roomScheduleFrom(mode: DuelModeId, band: DuelBand, at: number): { rdyBy: number; startAt: number; endsAt: number } {
  return scheduleFrom(mode, band, at + ROOM_READY_MS - READY_MS);
}

/** Поля нового матча (HSET). Комната без второго игрока — без сроков (их ставит вход друга). */
export function matchFields(m: NewMatch): Record<string, string | number> {
  const f: Record<string, string | number> = {
    kind: m.kind,
    mode: m.mode,
    seed: m.seed >>> 0,
    band: m.band,
    tag: m.deckTag,
    created: m.created,
    a: m.a.pid,
    la: m.a.lv,
  };
  if (m.topic) f.topic = m.topic;
  if (m.room) f.room = m.room;
  if (m.a.card) f.ca = m.a.card;
  if (m.b) {
    const sched = scheduleFrom(m.mode, m.band, m.created);
    Object.assign(f, sched);
    // Реванш в комнате: оба на экране итогов — старт сразу назначен, как у случайного матча.
    if (m.kind === "room") f.go = sched.startAt;
    f.b = m.b.pid;
    f.lb = m.b.lv;
    if (m.b.card) f.cb = m.b.card;
  }
  return f;
}

export const writeMatchOp = (id: string, fields: Record<string, string | number>): KvOp => ({ op: "hset", key: matchKey(id), fields, ttlSec: MATCH_TTL_SEC });

/** Подписанное место стороны (всё для пересборки набора; проверка ответа не читает Redis). */
export function seatClaims(
  m: Pick<MatchData, "id" | "mode" | "topic" | "seed" | "band" | "n" | "deckTag" | "startAt" | "endsAt">,
  side: SeatSide,
  pid: string,
): SeatClaims {
  return {
    m: m.id,
    s: side,
    pid,
    mode: m.mode,
    seed: m.seed,
    band: m.band,
    n: m.n,
    ...(m.topic ? { topic: m.topic } : {}),
    startAt: m.startAt,
    endsAt: m.endsAt,
    deckTag: m.deckTag,
  };
}

/** Место → MatchJoin для клиента. */
export function joinOf(c: SeatClaims, secret: string): MatchJoin {
  return {
    matchId: c.m,
    seat: signSeat(c, secret),
    seed: c.seed,
    mode: c.mode,
    band: c.band,
    n: c.n,
    deckTag: c.deckTag,
    startAt: c.startAt,
    endsAt: c.endsAt,
    ...(c.topic ? { topic: c.topic } : {}),
  };
}

/** Можно ли писать в хеш по этому месту без чтения (ключ ещё точно жив). */
export const seatWritable = (c: SeatClaims, now: number): boolean => now < c.startAt + SEAT_WRITE_MS;

// ---------- набор для проверки ответов (кэш копии сервера) ----------

const decks = new Map<string, DuelItem[]>();
const DECK_CACHE_MAX = 64;

export function deckOf(m: Pick<MatchData, "mode" | "seed" | "band" | "topic">): DuelItem[] {
  const k = `${m.mode}:${m.seed}:${m.band}:${m.topic ?? ""}`;
  let d = decks.get(k);
  if (!d) {
    d = buildDeck(m.mode, m.seed, m.band, m.topic);
    decks.set(k, d);
    if (decks.size > DECK_CACHE_MAX) decks.delete(decks.keys().next().value as string);
  }
  return d;
}

// ---------- состояние ----------

/** Оба подтвердили готовность в срок (первая отметка хранится HSETNX и не позже rdyBy). */
export function bothReady(m: MatchData): boolean {
  const ok = (s: SideData | null) => !!s && s.rdy > 0 && s.rdy <= m.rdyBy;
  return ok(m.a) && ok(m.b);
}

/**
 * Комната: оба готовы, старта ещё нет — назначить его (HSETNX go = сейчас + 5 с; гонку двух запросов решает HSETNX,
 * проигравший читает чужой go). Для остальных матчей — без команд.
 */
export async function ensureRoomStart(kv: CountingKv, m: MatchData, now: number): Promise<MatchData> {
  if (m.kind !== "room" || m.go || !m.b || m.res || !bothReady(m)) return m;
  const key = matchKey(m.id);
  let go = now + ROOM_COUNTDOWN_MS;
  if (!(await kv.hsetnx(key, "go", go))) go = num((await kv.hget(key, "go")) ?? undefined) || go;
  return { ...m, go: true, startAt: go, endsAt: go + durationOf(m.mode, m.band) };
}

export function phaseOf(m: MatchData, now: number): { state: MatchView["state"]; cancelled?: CancelWhy } {
  if (m.res) return { state: "finished" };
  if (!m.b || !m.startAt) {
    if (m.a.left) return { state: "cancelled", cancelled: "left" };
    if (now >= m.created + ROOM_LOBBY_MS) return { state: "cancelled", cancelled: "expired" };
    return { state: "lobby" };
  }
  const leftEarly = (s: SideData) => s.left > 0 && s.left < m.startAt;
  if (leftEarly(m.a) || leftEarly(m.b)) return { state: "cancelled", cancelled: "left" };
  const ready = bothReady(m);
  // Комната: оба готовы, а старт ещё не назначен (назначит этот же запрос — ensureRoomStart).
  if (m.kind === "room" && !m.go) {
    if (ready) return { state: "countdown" };
    return now >= m.rdyBy ? { state: "cancelled", cancelled: "no_ready" } : { state: "lobby" };
  }
  if (now < m.startAt) {
    if (ready) return { state: "countdown" };
    return now >= m.rdyBy ? { state: "cancelled", cancelled: "no_ready" } : { state: "lobby" };
  }
  if (!ready) return { state: "cancelled", cancelled: "no_ready" };
  return { state: "playing" };
}

const clockEnd = (m: MatchData): number | null => {
  const c = DUEL_MODES[m.mode].clockMs;
  return c == null ? null : m.startAt + c + LATE_GRACE_MS;
};

/** Доиграла ли сторона: ответила на всё, сказала «готово» или кончились общие часы режима. */
function sideDone(m: MatchData, s: SideData, now: number): boolean {
  if (s.done > 0 || s.answers.length >= m.n) return true;
  const end = clockEnd(m);
  return end != null && now >= end;
}

function sideStatus(m: MatchData, s: SideData, now: number): SideStatus {
  const level = deckLevels(m.mode, m.band)[s.answers.length];
  return {
    done: sideDone(m, s, now),
    left: s.left >= m.startAt && s.left > 0,
    idleMs: Math.max(0, now - Math.max(s.seen, s.rdy, m.startAt)),
    itemLimitMs: level ? itemLimitMs(m.mode, level) : null,
  };
}

export interface Verdict {
  winner: "a" | "b" | "draw";
  reason: NonNullable<MatchView["result"]>["reason"];
  void?: boolean;
}

/** Пора ли завершать матч и с каким итогом (null — играем дальше). Чистая функция. */
export function verdictOf(m: MatchData, now: number): Verdict | null {
  if (!m.b || phaseOf(m, now).state !== "playing") return null;
  const sa = sideStatus(m, m.a, now);
  const sb = sideStatus(m, m.b, now);
  const tech = technicalResult(sa, sb, true);
  if (tech === "void") return { winner: "draw", reason: "left", void: true };
  if (tech) return { winner: tech.winner, reason: tech.reason };
  if ((sa.done && sb.done) || now >= m.endsAt + LATE_GRACE_MS) {
    const w = winner(totalsOf(m, m.a), totalsOf(m, m.b));
    return { winner: w.winner, reason: w.reason };
  }
  return null;
}

const totalsOf = (m: MatchData, s: SideData): SideTotals => totals(m.mode, eventsOf(s.answers));

// ---------- завершение ----------

/**
 * Завершить матч ровно один раз. Сначала счётчики пары и суток (3 GET), затем итог целиком — HSETNX res: итог и есть
 * замок, поэтому падение после него не оставляет матч «без итога навсегда». Победитель гонки одним конвейером начисляет
 * очки недели, счётчики и историю; проигравший берёт записанный итог (HGET). null — итога нет (сбой чтения).
 */
export async function settle(kv: CountingKv, m: MatchData, v: Verdict, now: number): Promise<StoredResult | null> {
  if (!m.b) return null;
  const key = matchKey(m.id);
  const a = m.a;
  const b = m.b;
  const day = kzDay(now);
  const [pairRaw, cntA, cntB] = await kv.pipeline([
    { op: "getStr", key: pairCounterKey(day, a.pid, b.pid) },
    { op: "getStr", key: dayCounterKey(day, a.pid) },
    { op: "getStr", key: dayCounterKey(day, b.pid) },
  ] as const);
  const pairToday = Number(pairRaw) || 0;
  const count = (s: SideData, today: string | null) =>
    v.void
      ? { counted: false as const }
      : countedFor({ opponent: "human", flags: cheatFlagCount(s.answers), answered: s.answers.length, pairToday, countedToday: Number(today) || 0 });
  const ca = count(a, cntA);
  const cb = count(b, cntB);
  const loser = v.winner === "a" ? "b" : v.winner === "b" ? "a" : undefined;
  const { ops, pts } = awardWeekOps({
    pidA: a.pid,
    pidB: b.pid,
    result: v.winner,
    counted: { a: ca.counted, b: cb.counted },
    ...(v.reason === "left" && loser ? { left: loser } : {}),
    now,
  });
  const ta = totalsOf(m, a);
  const tb = totalsOf(m, b);
  const res: StoredResult = {
    w: v.winner,
    r: v.reason,
    pa: pts.a,
    pb: pts.b,
    ca: ca.counted,
    cb: cb.counted,
    ...("why" in ca && ca.why ? { ya: ca.why } : {}),
    ...("why" in cb && cb.why ? { yb: cb.why } : {}),
    sa: ta.score,
    sb: tb.score,
    ka: ta.correct,
    kb: tb.correct,
    na: ta.answered,
    nb: tb.answered,
  };
  if (!(await kv.hsetnx(key, "res", JSON.stringify(res)))) return json<StoredResult>((await kv.hget(key, "res")) ?? undefined);
  // Случайному сопернику код друга не уходит — и в историю его не пишем (3-safety §3).
  const oppCode = (opp: SideData) => (m.kind === "room" ? opp.card.code : "");
  const hist = (you: SideTotals, them: SideTotals, opp: SideData, out: string) =>
    JSON.stringify({ m: m.id, mode: m.mode, kind: m.kind, opp: oppCode(opp), you: you.score, them: them.score, res: out, at: now });
  const outcome = (s: "a" | "b") => (v.winner === "draw" ? "draw" : v.winner === s ? "win" : "loss");
  const tail: KvOp[] = v.void
    ? []
    : [
        { op: "incrBy", key: pairCounterKey(day, a.pid, b.pid), n: 1, ttlSec: DAY_COUNTER_TTL_SEC },
        ...(ca.counted ? [{ op: "incrBy", key: dayCounterKey(day, a.pid), n: 1, ttlSec: DAY_COUNTER_TTL_SEC } as KvOp] : []),
        ...(cb.counted ? [{ op: "incrBy", key: dayCounterKey(day, b.pid), n: 1, ttlSec: DAY_COUNTER_TTL_SEC } as KvOp] : []),
        { op: "lpush", key: keys.history(a.pid), value: hist(ta, tb, b, outcome("a")), max: HISTORY_MAX, ttlSec: HISTORY_TTL_SEC },
        { op: "lpush", key: keys.history(b.pid), value: hist(tb, ta, a, outcome("b")), max: HISTORY_MAX, ttlSec: HISTORY_TTL_SEC },
      ];
  const award = [...ops, ...tail];
  if (award.length) {
    try {
      await kv.pipeline(award);
    } catch (e) {
      // Итог уже записан: ученики его увидят; теряются только очки и история этого матча.
      console.error(`[duel] award failed m=${m.id.slice(0, 6)}`, e instanceof Error ? e.message : e);
    }
  }
  return res;
}

/** Матч с учётом ленивого завершения: пора — завершаем (или берём итог, записанный другим запросом). */
export async function settled(kv: CountingKv, m: MatchData, now: number): Promise<MatchData> {
  if (m.res) return m;
  const v = verdictOf(m, now);
  if (!v) return m;
  const res = await settle(kv, m, v, now);
  return res ? { ...m, res } : m;
}

/** Шаг матча при любом запросе: назначить старт комнаты (оба готовы) и лениво завершить. */
export async function advance(kv: CountingKv, m: MatchData, now: number): Promise<MatchData> {
  return settled(kv, await ensureRoomStart(kv, m, now), now);
}

// ---------- реванш ----------

/** Оба согласились на реванш (в окне 20 с) и его ещё нет. */
export function rematchDue(m: MatchData, now: number): boolean {
  if (!m.res || m.rm || !m.b || m.res.r === "left") return false;
  const ra = m.a.rm;
  const rb = m.b.rm;
  return ra > 0 && rb > 0 && Math.abs(ra - rb) <= REMATCH_WINDOW_MS && now - Math.min(ra, rb) <= REMATCH_WINDOW_MS + 5_000;
}

/** Создать реванш (новый seed, те же стороны и режим). Гонку двух запросов решает HSETNX rm; проигравший удаляет свой хеш. */
export async function createRematch(kv: CountingKv, m: MatchData, now: number): Promise<MatchData> {
  if (!m.b) return m;
  const id = newMatchId();
  const seed = newMatchSeed();
  const fields = matchFields({
    kind: m.kind,
    mode: m.mode,
    topic: m.topic,
    seed,
    band: m.band,
    deckTag: m.deckTag,
    created: now,
    a: { pid: m.a.pid, card: m.a.card.code ? cardJson(m.a.card) : null, lv: m.a.card.lv },
    b: { pid: m.b.pid, card: m.b.card.code ? cardJson(m.b.card) : null, lv: m.b.card.lv },
  });
  const info: RematchInfo = { id, seed, startAt: Number(fields.startAt), endsAt: Number(fields.endsAt) };
  await kv.pipeline([writeMatchOp(id, fields)]);
  if (await kv.hsetnx(matchKey(m.id), "rm", JSON.stringify(info))) return { ...m, rm: info };
  // Реванш уже создал второй запрос: свой лишний хеш убираем, берём его.
  const [, raw] = await kv.pipeline([
    { op: "del", keys: [matchKey(id)] },
    { op: "hget", key: matchKey(m.id), field: "rm" },
  ] as const);
  return { ...m, rm: json<RematchInfo>(raw ?? undefined) };
}

// ---------- вид для клиента ----------

/**
 * Непрозрачная метка игрока для случайного соперника вместо кода друга: «~» + 10 знаков HMAC(pid). Постоянна для игрока
 * (тот же «Игрок 4821» в разных матчах, как tag в 3-safety §2), по ней нельзя ни найти игрока, ни отправить заявку
 * («~» не бывает в коде друга). Жалоба на случайного соперника адресуется матчем (matchId + своё место), а не меткой.
 */
export function anonHandle(pid: string, secret: string): string {
  return `~${createHmac("sha256", secret).update(`duel-anon:${pid}`).digest("base64url").slice(0, 10)}`;
}

/** Карточка стороны для соперника: в случайном матче — без кода друга. */
function cardFor(m: MatchData, s: SideData, secret: string): PublicCard {
  return m.kind === "live" ? { ...s.card, code: anonHandle(s.pid, secret) } : s.card;
}

function sideView(m: MatchData, s: SideData, side: SeatSide, now: number, card: PublicCard): SideView {
  const t = totalsOf(m, s);
  const st = m.startAt ? sideStatus(m, s, now) : null;
  // Итог записан — счёт с итога (ответ, принятый в гонке с завершением, не меняет показанный счёт).
  const r = m.res;
  const frozen = r && typeof r.sa === "number" ? (side === "a" ? { score: r.sa, correct: r.ka, answered: r.na } : { score: r.sb, correct: r.kb, answered: r.nb }) : null;
  return {
    card,
    answered: frozen?.answered ?? t.answered,
    correct: frozen?.correct ?? t.correct,
    score: frozen?.score ?? t.score,
    done: frozen ? true : (st?.done ?? false),
    idleMs: st && now >= m.startAt ? st.idleMs : 0,
    ready: s.rdy > 0,
  };
}

/** MatchView для стороны side. */
export function viewFor(m: MatchData, side: SeatSide, now: number, secret: string, mine = false): MatchView {
  const me = side === "a" ? m.a : (m.b as SideData);
  const opp = side === "a" ? m.b : m.a;
  const oside = other(side);
  const ph = phaseOf(m, now);
  const you = sideView(m, me, side, now, me.card);
  const oppView = opp ? sideView(m, opp, oside, now, cardFor(m, opp, secret)) : null;
  const view: MatchView = {
    id: m.id,
    kind: m.kind,
    state: ph.state,
    serverNow: now,
    you,
    opp: oppView,
    oppTl: opp && m.startAt ? eventsOf(opp.answers).slice(0, oppView?.answered) : [],
    ...(mine ? { youTl: eventsOf(me.answers).slice(0, you.answered) } : {}),
    ...(ph.cancelled ? { cancelled: ph.cancelled } : {}),
  };
  if (m.res) {
    const r = m.res;
    const mine = side === "a" ? { pts: r.pa, counted: r.ca, why: r.ya } : { pts: r.pb, counted: r.cb, why: r.yb };
    view.result = {
      winner: r.w === "draw" ? "draw" : r.w === side ? "you" : "opp",
      reason: r.r,
      weekPts: mine.pts,
      counted: mine.counted,
      ...(mine.why ? { why: mine.why } : {}),
    };
    if (opp) {
      const next = m.rm ? joinOf(seatClaims({ ...m, id: m.rm.id, seed: m.rm.seed, startAt: m.rm.startAt, endsAt: m.rm.endsAt }, side, me.pid), secret) : undefined;
      view.rematch = { you: me.rm > 0, opp: opp.rm > 0, ...(next ? { next } : {}) };
    }
  }
  if ((ph.state === "lobby" || ph.state === "countdown") && m.b && m.startAt) view.join = joinOf(seatClaims(m, side, me.pid), secret);
  return view;
}

// ---------- ответы ----------

export interface AnswerBatch {
  /** Принятые ответы (по порядку). */
  accepted: JudgedAnswer[];
  /** Поля для HSETNX. */
  ops: KvOp[];
}

/** Проверить пачку ответов стороны против серверного времени (plausible.ts) — без записи. */
export function judgeBatch(m: MatchData, side: SeatSide, answers: readonly AnswerIn[], now: number): AnswerBatch {
  const s = side === "a" ? m.a : m.b;
  if (!s || !m.startAt) return { accepted: [], ops: [] };
  const res = judgeAnswers(m.mode, deckOf(m), answers.slice(0, 5), now - m.startAt, s.answers);
  const key = matchKey(m.id);
  const ops: KvOp[] = res.accepted.map((j) => ({ op: "hsetnx", key, field: `${side}:${j.i}`, value: encodeJudged(j) }));
  return { accepted: res.accepted, ops };
}

/** Дописать принятые ответы в разобранный матч (вид после записи без второго чтения). */
export function withAnswers(m: MatchData, side: SeatSide, accepted: readonly JudgedAnswer[], wrote: readonly boolean[]): MatchData {
  const s = side === "a" ? m.a : m.b;
  if (!s) return m;
  const add: JudgedAnswer[] = [];
  for (let k = 0; k < accepted.length; k++) {
    if (!wrote[k]) break;
    add.push(accepted[k]);
  }
  const next = { ...s, answers: [...s.answers, ...add] };
  return side === "a" ? { ...m, a: next } : { ...m, b: next };
}

/** Отметка стороны в разобранном матче (после HSET без второго чтения). */
export function withMark(m: MatchData, side: SeatSide, field: "rdy" | "seen" | "done" | "left" | "rm", at: number): MatchData {
  const s = side === "a" ? m.a : m.b;
  if (!s) return m;
  const next = { ...s, [field]: at };
  return side === "a" ? { ...m, a: next } : { ...m, b: next };
}

export { other as otherSide };

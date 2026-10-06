import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { buildDeck, DECK_TAG, deckLevels } from "@/lib/duel/deck";
import { bandOf, CLOCK_SLACK_MS, DUEL_MODES, isDuelMode, matchDurationMs } from "@/lib/duel/modes";
import { cheatFlagCount, eventsOf, judgeAnswers, type JudgedAnswer } from "@/lib/duel/plausible";
import { challengePoints, totals, winner, type SideTotals } from "@/lib/duel/score";
import { decodeTimeline, encodeTimeline } from "@/lib/duel/timeline";
import { isDuelTopic } from "@/lib/duel/topics";
import type { AnswerIn, DuelEvent, DuelModeId, NotCountedWhy } from "@/lib/duel/types";
import { signStart, verifyStart, withinWindow, type StartClaims } from "@/server/duel/seat";
import type { CountingKv } from "@/server/social/kv";
import { inboxPushOp } from "@/server/social/inbox";
import { cardFromJson, keys, type PublicCard } from "@/server/social/player";
import { awardWeek } from "@/server/social/tops";

// Асинхронный вызов в любом режиме (docs/specs/duels.md §5–§6, Ф3). Сервер не доверяет клиенту: сам пересобирает набор
// из seed подписанного старта (deck.ts — только сервер), сам проверяет каждый ответ (plausible.ts) и сам считает счёт.
//
// 1) POST /api/duel/start → подписанный старт (seat.ts, 0 команд Redis): режим, seed, полоса, тег набора, окно времени.
// 2) Ученик играет один («запись для друга») и шлёт ответы: POST /api/duel/challenge {start, answers} → du:ch:{id}.
// 3) Друг открывает /duel/c/<id>, «Принять вызов» → POST …/accept → подписанный старт с ch = id против записи (призрак).
// 4) POST …/result {start, answers} → проверка, du:ch:{id}:r, входящие вызвавшего, очки недели принявшему.
//
// Время. Ответы приходят одной пачкой в конце игры, поэтому срок каждого задания по часам сервера проверить нельзя
// (живой матч Ф4 это умеет). Проверяем: каждое ms ≥ MIN_MS (быстрее — неверно и флаг), лимит задания и общие часы режима
// по накопленному времени клиента, и что накопленное время не больше прошедшего по часам сервера + 1,5 с; вся запись —
// в окне подписанного старта. Ставка — только топ друзей (§3: seed у клиента, «закрытый набор» — фаза 2).
//
// Ключи (TTL 30 дней):
//   du:ch:{id}    HASH: m (режим), sd (seed), b (полоса), tp (тема), tag, by (pid), s/c/a/t (счёт, верных, отвечено, время),
//                 tl (запись «1.4210,0.8800»), f (флаги), at
//   du:ch:{id}:p  SET pid сыгравших (каждый — один раз); срок — до конца du:ch:{id} (challengeTtlLeft), не продлевается
//   du:ch:{id}:r  LIST ≤ 20 итогов принявших {p, s, c, a, t, w, at}; срок — так же
//   du:st:{hash}  STRING → id: старт уже записан (повторная отправка того же старта вернёт тот же вызов)

export const CHALLENGE_TTL_SEC = 30 * 86_400;
const RESULTS_MAX = 20;
/** Запас окна старта сверх длительности режима: загрузка, «VS», отсчёт, окно «Сердечки закончились», разбор ответов. */
export const START_SLACK_MS = 15 * 60_000;
export const CHALLENGE_ID_RE = /^[A-Za-z0-9_-]{10}$/;

export const chKeys = {
  hash: (id: string) => `du:ch:${id}`,
  played: (id: string) => `du:ch:${id}:p`,
  results: (id: string) => `du:ch:${id}:r`,
  used: (token: string) => `du:st:${createHash("sha256").update(token).digest("base64url").slice(0, 22)}`,
};

export const newChallengeId = (): string => randomBytes(8).toString("base64url").slice(0, 10);

// ---------- подписанный старт ----------

export interface StartInput {
  mode: DuelModeId;
  topic?: string;
  lv: number;
}

/** Разбор тела POST /api/duel/start; null — неверный режим или тема. */
export function parseStartInput(raw: unknown): (StartInput & { deckTag: string }) | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (!isDuelMode(o.mode)) return null;
  const needsTopic = DUEL_MODES[o.mode].needsTopic;
  if (needsTopic && !isDuelTopic(o.topic)) return null;
  const lv = typeof o.lv === "number" && Number.isFinite(o.lv) ? Math.min(999, Math.max(1, Math.floor(o.lv))) : 1;
  const deckTag = typeof o.deckTag === "string" ? o.deckTag.slice(0, 40) : "";
  return { mode: o.mode, ...(needsTopic ? { topic: o.topic as string } : {}), lv, deckTag };
}

/** Что получает клиент со стартом: всё, чтобы взять тот же набор (GET /api/duel/deck) и сыграть. */
export interface StartView {
  start: string;
  mode: DuelModeId;
  seed: number;
  band: StartClaims["band"];
  n: number;
  topic?: string;
  deckTag: string;
  startAt: number;
  endsAt: number;
}

export function startView(token: string, c: StartClaims): StartView {
  return { start: token, mode: c.mode, seed: c.seed, band: c.band, n: c.n, ...(c.topic ? { topic: c.topic } : {}), deckTag: c.deckTag, startAt: c.startAt, endsAt: c.endsAt };
}

/** Подписать старт (seed — новый или из вызова). Без записи в хранилище. */
export function issueStart(pid: string, p: { mode: DuelModeId; topic?: string; band: StartClaims["band"]; seed?: number; ch?: string }, now: number): StartView {
  const meta = DUEL_MODES[p.mode];
  const seed = p.seed ?? randomInt(0, 0xffff_ffff);
  const duration = matchDurationMs(p.mode, deckLevels(p.mode, p.band));
  const claims: StartClaims = {
    pid,
    mode: p.mode,
    seed,
    band: p.band,
    n: meta.n,
    ...(meta.needsTopic && p.topic ? { topic: p.topic } : {}),
    startAt: now,
    endsAt: now + duration + START_SLACK_MS,
    deckTag: DECK_TAG,
    ...(p.ch ? { ch: p.ch } : {}),
  };
  const token = signStart(claims);
  return startView(token, claims);
}

/** Полоса по уровню, который сообщил клиент (влияет только на набор, очков не даёт: §3). */
export const bandForLevel = (lv: number) => bandOf(lv);

// ---------- проверка записи ----------

/** Тело с ответами: массив ≤ n записей {i, a, ms}; мусор отбрасывается (судья отвергнет неверные номера). */
export function parseAnswers(raw: unknown, n: number): AnswerIn[] | null {
  if (!Array.isArray(raw) || raw.length > n) return null;
  const out: AnswerIn[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") return null;
    const { i, a, ms } = x as Record<string, unknown>;
    if (typeof i !== "number" || typeof ms !== "number" || !(typeof a === "boolean" || typeof a === "number")) return null;
    out.push({ i, a, ms });
  }
  return out;
}

export interface JudgedRecord {
  judged: JudgedAnswer[];
  events: DuelEvent[];
  totals: SideTotals;
  flags: number;
}

/**
 * Проверка записи, пришедшей одной пачкой. Каждый ответ судится как пришедший в «своё» время клиента (накопленное t),
 * затем вся запись сверяется с часами сервера: t больше прошедшего + 1,5 с — неверно и флаг sum.
 * null — набор не собрался (не должно случаться).
 */
export function judgeRecord(c: StartClaims, answers: readonly AnswerIn[], now: number): JudgedRecord | null {
  const deck = buildDeck(c.mode, c.seed, c.band, c.topic);
  if (deck.length !== c.n) return null;
  const meta = DUEL_MODES[c.mode];
  const elapsed = Math.max(0, now - c.startAt);
  let judged: JudgedAnswer[] = [];
  for (const a of answers) {
    const last = judged[judged.length - 1];
    const pause = last && !last.ok ? meta.errorPauseMs : 0;
    const ms = Number.isFinite(a.ms) ? Math.max(0, Math.round(a.ms)) : 0;
    const tClaim = (last?.t ?? 0) + pause + ms;
    const res = judgeAnswers(c.mode, deck, [a], Math.min(elapsed, tClaim), judged);
    judged = [...judged, ...res.accepted];
  }
  judged = judged.map((j) =>
    j.t > elapsed + CLOCK_SLACK_MS && !j.flags.includes("sum") ? { ...j, ok: false, pts: meta.pts.bad, flags: [...j.flags, "sum"] } : j,
  );
  const events = eventsOf(judged);
  return { judged, events, totals: totals(c.mode, events), flags: cheatFlagCount(judged) };
}

/**
 * Старт из тела: подпись, свой pid, окно времени, нужный вызов (ch), тот же банк заданий. stale — между стартом и
 * отправкой вышла новая сборка (другой DECK_TAG): набор по seed уже другой, ответы к старому набору не судим.
 */
export function openStart(token: unknown, pid: string, now: number, ch: string | null): StartClaims | "bad" | "expired" | "stale" {
  const c = verifyStart(token);
  if (!c || c.pid !== pid || (c.ch ?? null) !== ch) return "bad";
  if (!withinWindow(c, now)) return "expired";
  if (c.deckTag !== DECK_TAG) return "stale";
  return c;
}

// ---------- хранение ----------

export interface ChallengeRes {
  score: number;
  correct: number;
  answered: number;
  timeMs: number;
}

const resOf = (t: SideTotals): ChallengeRes => ({ score: t.score, correct: t.correct, answered: t.answered, timeMs: t.timeMs });

export interface StoredChallenge {
  id: string;
  mode: DuelModeId;
  seed: number;
  band: StartClaims["band"];
  topic?: string;
  tag: string;
  by: string;
  res: ChallengeRes;
  tl: DuelEvent[];
  at: number;
}

function parseChallenge(id: string, h: Record<string, string>): StoredChallenge | null {
  if (!h.by || !isDuelMode(h.m)) return null;
  const band = Number(h.b);
  if (band !== 1 && band !== 2 && band !== 3 && band !== 4) return null;
  const n = DUEL_MODES[h.m].n;
  const tl = decodeTimeline(h.tl ?? "", n);
  if (!tl) return null;
  const num = (v: string | undefined) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    id,
    mode: h.m,
    seed: num(h.sd),
    band,
    ...(h.tp ? { topic: h.tp } : {}),
    tag: h.tag ?? "",
    by: h.by,
    res: { score: num(h.s), correct: num(h.c), answered: num(h.a), timeMs: num(h.t) },
    tl,
    at: num(h.at),
  };
}

export async function loadChallenge(kv: CountingKv, id: string): Promise<StoredChallenge | null> {
  if (!CHALLENGE_ID_RE.test(id)) return null;
  return parseChallenge(id, await kv.hgetAllStr(chKeys.hash(id)));
}

/**
 * Записать вызов по проверенной игре. Тот же старт второй раз — тот же вызов (existing). null — набор не собрался.
 * Сначала HSET вызова, потом SET NX метки старта: кто увидел метку — увидит и готовый вызов (двойное нажатие, повтор сети).
 * Проигравший гонку удаляет свою лишнюю запись. Команды: HSET/EXPIRE + SET NX (≈ 3); повтор — ещё DEL + GET + HGETALL.
 */
export async function createChallenge(
  kv: CountingKv,
  pid: string,
  token: string,
  c: StartClaims,
  answers: readonly AnswerIn[],
  now: number,
): Promise<{ id: string; res: ChallengeRes; existing: boolean } | null> {
  const rec = judgeRecord(c, answers, now);
  if (!rec) return null;
  const id = newChallengeId();
  const usedTtl = Math.max(60, Math.ceil((c.endsAt - now) / 1000) + 600);
  const res = resOf(rec.totals);
  await kv.pipeline([
    {
      op: "hset",
      key: chKeys.hash(id),
      fields: {
        m: c.mode,
        sd: c.seed,
        b: c.band,
        ...(c.topic ? { tp: c.topic } : {}),
        tag: c.deckTag,
        by: pid,
        s: res.score,
        c: res.correct,
        a: res.answered,
        t: res.timeMs,
        tl: encodeTimeline(rec.events),
        f: rec.flags,
        at: now,
      },
      ttlSec: CHALLENGE_TTL_SEC,
    },
  ]);
  if (!(await kv.set(chKeys.used(token), id, { nx: true, ttlSec: usedTtl }))) {
    const [, prev] = await kv.pipeline([
      { op: "del", keys: [chKeys.hash(id)] },
      { op: "getStr", key: chKeys.used(token) },
    ] as const);
    const old = prev && CHALLENGE_ID_RE.test(prev) ? await loadChallenge(kv, prev) : null;
    return old ? { id: old.id, res: old.res, existing: true } : null;
  }
  return { id, res, existing: false };
}

// ---------- просмотр и принятие ----------

export interface ChallengeResultRow {
  card: PublicCard;
  score: number;
  correct: number;
  /** Итог для вызвавшего: win — вызвавший выиграл у принявшего. */
  w: "win" | "loss" | "draw";
  at: number;
}

export interface ChallengeView {
  id: string;
  mode: DuelModeId;
  topic?: string;
  band: StartClaims["band"];
  by: PublicCard;
  res: ChallengeRes;
  /** Задания обновились (другой тег набора): вызов устарел. */
  stale: boolean;
  /** Вызов мой. */
  mine: boolean;
  /** Я уже сыграл против этой записи. */
  played: boolean;
  /** Итоги принявших — только вызвавшему. */
  results?: ChallengeResultRow[];
  expiresAt: number;
}

/** Публичная карточка вызова (+ итоги принявших, если вызов мой). null — нет, истёк, автор удалил профиль или блокирует меня. */
export async function viewChallenge(kv: CountingKv, id: string, me: string | null): Promise<ChallengeView | null> {
  const ch = await loadChallenge(kv, id);
  if (!ch) return null;
  const mine = me === ch.by;
  const [rawCard, played, blocked] = await kv.pipeline([
    { op: "getStr", key: keys.card(ch.by) },
    { op: "sismember", key: chKeys.played(id), member: me ?? "-" },
    { op: "sismember", key: keys.blocked(ch.by), member: me ?? "-" },
  ] as const);
  const by = cardFromJson(rawCard);
  if (!by || (me && blocked)) return null;
  const view: ChallengeView = {
    id,
    mode: ch.mode,
    ...(ch.topic ? { topic: ch.topic } : {}),
    band: ch.band,
    by,
    res: ch.res,
    stale: ch.tag !== DECK_TAG,
    mine,
    played: !!me && played,
    expiresAt: ch.at + CHALLENGE_TTL_SEC * 1000,
  };
  if (mine) view.results = await resultRows(kv, await kv.pipeline([{ op: "lrange", key: chKeys.results(id), start: 0, stop: RESULTS_MAX - 1 }] as const).then((r) => r[0]));
  return view;
}

async function resultRows(kv: CountingKv, raw: readonly string[]): Promise<ChallengeResultRow[]> {
  const rows = raw.flatMap((s) => {
    try {
      const o = JSON.parse(s) as { p?: unknown; s?: unknown; c?: unknown; w?: unknown; at?: unknown };
      return typeof o.p === "string" ? [o] : [];
    } catch {
      return [];
    }
  });
  if (!rows.length) return [];
  const cards = await kv.mget(rows.map((r) => keys.card(r.p as string)));
  return rows.flatMap((r, k) => {
    const card = cardFromJson(cards[k] ?? null);
    if (!card) return [];
    const w = r.w === "win" || r.w === "loss" ? r.w : "draw";
    return [{ card, score: Number(r.s) || 0, correct: Number(r.c) || 0, w, at: Number(r.at) || 0 }];
  });
}

export type AcceptError = "not_found" | "self" | "stale" | "already";

/** «Принять вызов»: подписанный старт против записи (ничего не пишет). */
export async function acceptChallenge(
  kv: CountingKv,
  id: string,
  me: string,
  now: number,
): Promise<{ ok: true; start: StartView; tl: DuelEvent[]; by: PublicCard; res: ChallengeRes } | { ok: false; error: AcceptError }> {
  const ch = await loadChallenge(kv, id);
  if (!ch) return { ok: false, error: "not_found" };
  if (ch.by === me) return { ok: false, error: "self" };
  const [rawCard, played, blocked] = await kv.pipeline([
    { op: "getStr", key: keys.card(ch.by) },
    { op: "sismember", key: chKeys.played(id), member: me },
    { op: "sismember", key: keys.blocked(ch.by), member: me },
  ] as const);
  const by = cardFromJson(rawCard);
  if (!by || blocked) return { ok: false, error: "not_found" };
  if (ch.tag !== DECK_TAG) return { ok: false, error: "stale" };
  if (played) return { ok: false, error: "already" };
  const start = issueStart(me, { mode: ch.mode, topic: ch.topic, band: ch.band, seed: ch.seed, ch: id }, now);
  return { ok: true, start, tl: ch.tl, by, res: ch.res };
}

export interface GhostResult {
  you: ChallengeRes;
  rival: ChallengeRes;
  result: "win" | "loss" | "draw";
  /** Результат сохранён (первая игра против этой записи). */
  stored: boolean;
  counted: boolean;
  why?: NotCountedWhy;
  weekPts: number;
}

/** Сколько ещё жить подключам вызова (:p, :r): до конца самого вызова, а не 30 дней от каждой новой записи. */
export const challengeTtlLeft = (ch: Pick<StoredChallenge, "at">, now: number): number =>
  Math.max(60, Math.ceil((ch.at + CHALLENGE_TTL_SEC * 1000 - now) / 1000));

/**
 * Итог игры против записи: проверка, сохранение (один раз на игрока), входящие вызвавшего, очки недели принявшему.
 * Вызвавший успел заблокировать принявшего или удалил профиль — отвечаем как обычно, но во входящие и в итоги вызова
 * ничего не пишем (и не создаём заново pl:inbox удалённого игрока).
 */
export async function challengeResult(
  kv: CountingKv,
  id: string,
  me: string,
  c: StartClaims,
  answers: readonly AnswerIn[],
  now: number,
): Promise<GhostResult | "not_found" | null> {
  const ch = await loadChallenge(kv, id);
  if (!ch || ch.by === me || ch.seed !== c.seed || ch.mode !== c.mode || ch.band !== c.band) return "not_found";
  const rec = judgeRecord(c, answers, now);
  if (!rec) return null;
  const you = resOf(rec.totals);
  const w = winner(rec.totals, ch.res);
  const result = w.winner === "draw" ? "draw" : w.winner === "a" ? "win" : "loss";
  const ttl = challengeTtlLeft(ch, now);
  const [added, blocked, byCard] = await kv.pipeline([
    { op: "sadd", key: chKeys.played(id), members: [me], ttlSec: ttl },
    { op: "sismember", key: keys.blocked(ch.by), member: me },
    { op: "getStr", key: keys.card(ch.by) },
  ] as const);
  if (!added) return { you, rival: ch.res, result, stored: false, counted: false, weekPts: 0 };
  // Для вызвавшего итог зеркальный.
  const forBy = result === "win" ? "loss" : result === "loss" ? "win" : "draw";
  if (!blocked && byCard)
    await kv.pipeline([
      {
        op: "lpush",
        key: chKeys.results(id),
        value: JSON.stringify({ p: me, s: you.score, c: you.correct, a: you.answered, t: you.timeMs, w: forBy, at: now }),
        max: RESULTS_MAX,
        ttlSec: ttl,
      },
      inboxPushOp(ch.by, { k: "chr", id, m: ch.mode, ...(ch.topic ? { tp: ch.topic } : {}), p: me, s: you, r: ch.res, w: forBy, at: now }),
    ]);
  const beat = result === "win";
  const [award] = await awardWeek(
    kv,
    [{ pid: me, opponent: "ghost", flags: rec.flags, answered: you.answered, points: (counted) => challengePoints(beat, counted) }],
    [me, ch.by],
    now,
  );
  return { you, rival: ch.res, result, stored: true, counted: award.counted, ...(award.why ? { why: award.why } : {}), weekPts: award.weekPts };
}

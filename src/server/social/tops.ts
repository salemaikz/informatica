import "server-only";
import { countedFor, type CountInput } from "@/lib/duel/score";
import type { NotCountedWhy } from "@/lib/duel/types";
import { kzDay, kzWeek, kzWeekResetsAt, pairKey } from "@/lib/duel/week";
import type { KvOp } from "@/server/kv";
import type { CountingKv } from "@/server/social/kv";
import { cardFromJson, keys, type PublicCard } from "@/server/social/player";
import { FRIENDS_MAX } from "@/server/social/friends";

// Очки недели и топ друзей (docs/specs/duels.md §5, §8, Ф3).
// top:w:{kzWeek} — ВНУТРЕННИЙ ZSET (pid → очки недели), 15 дней: в фазе 1 читается только ZMSCORE по списку друзей.
// Начисляет ТОЛЬКО сервер и только за результаты, которые он сам проверил (вызовы — Ф3, живые матчи — Ф4 через awardWeek).
// Бот не идёт никогда. Потолки (score.ts → countedFor): 3-й и дальше матч одной пары за сутки — 0, не больше 10 засчитанных
// в сутки на игрока, 3+ флага честной игры — 0, меньше 5 ответов — 0.
//   du:pair:{kzDay}:{pidA|pidB} — сколько матчей пары засчитано сегодня, 2 дня
//   du:cnt:{kzDay}:{pid}        — сколько матчей игрока засчитано сегодня, 2 дня

export const WEEK_TTL_SEC = 15 * 86_400;
const COUNTER_TTL_SEC = 2 * 86_400;

export const topKeys = {
  week: (now: number) => keys.topWeek(kzWeek(now)),
  pair: (now: number, a: string, b: string) => `du:pair:${kzDay(now)}:${pairKey(a, b)}`,
  daily: (now: number, pid: string) => `du:cnt:${kzDay(now)}:${pid}`,
};

/** Одна сторона матча для начисления. points(counted) — очки недели по правилу режима (score.ts: weekPoints / challengePoints). */
export interface AwardSide {
  pid: string;
  opponent: CountInput["opponent"];
  /** Флаги честной игры этой стороны (plausible → cheatFlagCount). */
  flags: number;
  answered: number;
  points: (counted: boolean) => number;
}

export interface AwardResult {
  pid: string;
  counted: boolean;
  why?: NotCountedWhy;
  weekPts: number;
}

/**
 * Начислить очки недели за один матч (общий помощник Ф3 и Ф4). sides — стороны, получающие очки (вызов — одна сторона,
 * живой матч — обе); pair — pid обеих сторон пары (null — нет пары, например бот). Счётчик пары растёт один раз за матч,
 * если засчитан хотя бы один игрок. Читает 1 конвейер (пара + сутки сторон), пишет 1 конвейер (≈ 2–5 команд).
 */
export async function awardWeek(kv: CountingKv, sides: readonly AwardSide[], pair: readonly [string, string] | null, now: number): Promise<AwardResult[]> {
  const humans = sides.filter((s) => s.opponent !== "bot");
  let pairToday = 0;
  const daily = new Map<string, number>();
  if (humans.length) {
    const reads: KvOp[] = [...(pair ? [{ op: "getStr", key: topKeys.pair(now, pair[0], pair[1]) } as KvOp] : []), ...humans.map((s) => ({ op: "getStr", key: topKeys.daily(now, s.pid) }) as KvOp)];
    const got = (await kv.pipeline(reads)) as (string | null)[];
    if (pair) pairToday = Number(got.shift() ?? 0) || 0;
    humans.forEach((s, k) => daily.set(s.pid, Number(got[k] ?? 0) || 0));
  }
  const results: AwardResult[] = sides.map((s) => {
    const c = countedFor({ opponent: s.opponent, flags: s.flags, answered: s.answered, pairToday, countedToday: daily.get(s.pid) ?? 0 });
    const weekPts = Math.max(0, Math.floor(s.points(c.counted)));
    return { pid: s.pid, counted: c.counted, ...(c.why ? { why: c.why } : {}), weekPts };
  });
  const counted = results.filter((r) => r.counted);
  if (counted.length) {
    const week = topKeys.week(now);
    const writes: KvOp[] = [
      ...(pair ? [{ op: "incrBy", key: topKeys.pair(now, pair[0], pair[1]), n: 1, ttlSec: COUNTER_TTL_SEC } as KvOp] : []),
      ...counted.map((r) => ({ op: "incrBy", key: topKeys.daily(now, r.pid), n: 1, ttlSec: COUNTER_TTL_SEC }) as KvOp),
      ...counted.filter((r) => r.weekPts > 0).map((r) => ({ op: "zincrBy", key: week, n: r.weekPts, member: r.pid, ttlSec: WEEK_TTL_SEC }) as KvOp),
    ];
    await kv.pipeline(writes);
  }
  return results;
}

/** Строка топа друзей: score null — друг скрыл свои очки (переключатель «Показывать мои очки в топе друзей»). */
export interface TopRow {
  card: PublicCard;
  score: number | null;
  me?: true;
}

export interface FriendsTop {
  rows: TopRow[];
  week: string;
  /** Когда начнётся новая неделя (понедельник 00:00 по Астане), мс. */
  resetsAt: number;
}

/** Скрыл ли игрок очки (поле h карточки). */
function hidesScore(raw: string | null): boolean {
  if (!raw) return false;
  try {
    return (JSON.parse(raw) as { h?: unknown }).h === 1;
  } catch {
    return false;
  }
}

/** Топ друзей за неделю: я и мои друзья. SMEMBERS + ZMSCORE + MGET = 3 команды на любое число друзей. */
export async function friendsTop(kv: CountingKv, me: string, now: number): Promise<FriendsTop> {
  const friends = (await kv.smembers(keys.friends(me))).filter((f) => f !== me).slice(0, FRIENDS_MAX);
  const ids = [me, ...friends];
  const [scores, cards] = await kv.pipeline([
    { op: "zmscore", key: topKeys.week(now), members: ids },
    { op: "mget", keys: ids.map(keys.card) },
  ] as const);
  const rows: TopRow[] = [];
  ids.forEach((id, k) => {
    const card = cardFromJson(cards[k] ?? null);
    if (!card) return;
    const mine = id === me;
    // Свои очки видно себе всегда; чужие скрытые — без числа.
    const score = !mine && hidesScore(cards[k] ?? null) ? null : Math.max(0, Math.round(scores[k] ?? 0));
    rows.push({ card, score, ...(mine ? { me: true as const } : {}) });
  });
  rows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.card.lv - a.card.lv || a.card.code.localeCompare(b.card.code));
  return { rows, week: kzWeek(now), resetsAt: kzWeekResetsAt(now) };
}

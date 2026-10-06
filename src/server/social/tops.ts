import "server-only";
import { serverNow } from "@/server/clock";
import type { KvOp } from "@/server/kv";
import { weekPoints } from "@/lib/duel/score";
import { kzWeek } from "@/lib/duel/week";
import type { CountingKv } from "@/server/social/kv";
import { keys } from "@/server/social/player";

// Очки недели за дуэли (docs/specs/duels.md §5, §8): top:w:{kzWeek} — ZSET pid → очки, TTL 15 дней (EXPIRE при каждом
// начислении). Фаза 1 читает его только ZMSCORE по списку друзей (топ друзей). Сюда идут только очки, проверенные сервером.
// TODO(слияние с Ф3): минимальная версия для живых матчей (Ф4); если Ф3 принесла свою awardWeek с той же сигнатурой — взять её.

/** Сколько живёт ключ недели после последнего начисления. */
export const TOP_WEEK_TTL_SEC = 15 * 86_400;

export type WeekSide = "a" | "b";

export interface AwardInput {
  pidA: string;
  pidB: string;
  /** Итог матча: победитель или ничья. */
  result: WeekSide | "draw";
  /** Засчитан ли матч (общий флаг или по сторонам: флаги честности, «мало ответов», лимиты пары и суток). */
  counted: boolean | { a: boolean; b: boolean };
  /** Сторона, ушедшая кнопкой «Выйти» после старта: ей 0 очков. */
  left?: WeekSide;
  now?: number;
}

/** Очки недели сторон по итогу (без записи): победа 3, ничья 2, доигранный 1, ушёл или не засчитан — 0. */
export function weekAward(input: AwardInput): { a: number; b: number } {
  const counted = typeof input.counted === "boolean" ? { a: input.counted, b: input.counted } : input.counted;
  const outcome = (side: WeekSide) =>
    input.left === side ? ("left" as const) : input.result === "draw" ? ("draw" as const) : input.result === side ? ("win" as const) : ("loss" as const);
  return { a: weekPoints(outcome("a"), counted.a), b: weekPoints(outcome("b"), counted.b) };
}

/** Операции начисления (для общего конвейера): ZINCRBY + EXPIRE на сторону с очками > 0. */
export function awardWeekOps(input: AwardInput): { ops: KvOp[]; pts: { a: number; b: number } } {
  const pts = weekAward(input);
  const key = keys.topWeek(kzWeek(input.now ?? serverNow()));
  const ops: KvOp[] = [];
  if (pts.a > 0) ops.push({ op: "zincrBy", key, n: pts.a, member: input.pidA, ttlSec: TOP_WEEK_TTL_SEC });
  if (pts.b > 0) ops.push({ op: "zincrBy", key, n: pts.b, member: input.pidB, ttlSec: TOP_WEEK_TTL_SEC });
  return { ops, pts };
}

/** Начислить очки недели обеим сторонам матча (одним конвейером). Возвращает начисленное. */
export async function awardWeek(kv: CountingKv, input: AwardInput): Promise<{ a: number; b: number }> {
  const { ops, pts } = awardWeekOps(input);
  if (ops.length) await kv.pipeline(ops);
  return pts;
}

import "server-only";
import { ipHash } from "@/server/ip-hash";
import { kvRateLimit } from "@/server/rate-limit";
import type { CountingKv } from "@/server/social/kv";

// Лимиты соцчасти (docs/specs/duels-design/1-server.md §8): счётчик окна в общем хранилище (kvRateLimit: INCRBY + EXPIRE =
// 2 команды, учитываются в логе `cmds=`). Ключи — по pid игрока или по хешу IP (сам IP не хранится).

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Потолки (за окно). */
export const SOCIAL_RATE = {
  /** Заявки в друзья: на игрока и на IP за час. */
  requestPid: { limit: 20, windowMs: HOUR },
  requestIp: { limit: 60, windowMs: HOUR },
  /** Неудачный поиск кода (код не найден) — на IP за час: перебор кодов. */
  missIp: { limit: 30, windowMs: HOUR },
  /** Прочие изменения дружбы (ответ, удаление, блок) — на игрока за 10 минут. */
  mutatePid: { limit: 60, windowMs: 10 * 60_000 },
  /** Новые ссылки-приглашения — на игрока за сутки. */
  invitePid: { limit: 10, windowMs: DAY },
  /** Принять приглашение — на игрока за час. */
  joinPid: { limit: 30, windowMs: HOUR },
  /** Жалобы: на игрока и на IP за сутки. */
  reportPid: { limit: 10, windowMs: DAY },
  reportIp: { limit: 40, windowMs: DAY },
  /** Записи вызовов — на игрока за сутки. */
  challengePid: { limit: 20, windowMs: DAY },
} as const;

type Rule = (typeof SOCIAL_RATE)[keyof typeof SOCIAL_RATE];

/** true — лимит исчерпан (запрос не выполнять). Считается каждый вызов. */
export async function overLimit(kv: CountingKv, key: string, rule: Rule, now: number): Promise<boolean> {
  kv.addCmds(2);
  return !(await kvRateLimit(`social:${key}`, rule.limit, rule.windowMs, now));
}

/** Лимит по IP запроса (хеш с солью, как в ai-guard). */
export function overIpLimit(kv: CountingKv, req: Request, name: string, rule: Rule, now: number): Promise<boolean> {
  return overLimit(kv, `${name}:${ipHash(req)}`, rule, now);
}

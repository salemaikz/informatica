import "server-only";
import { bindOps, commandsFor, getStrictKv, type Kv, type KvOp, type KvStrictOps } from "@/server/kv";

// Хранилище и выключатели соцчасти (друзья, дуэли, топ) — docs/specs/duels.md §2, §7.
// - getSocialKv(): БЕЗ тихого отката в память. Upstash не ответил → ошибка → маршрут отвечает 503 social_unavailable
//   («Соревнования временно недоступны, учёба работает»). Разные копии сервера с разной памятью дали бы разные матчи.
// - socialEnabled(): нужен SOCIAL_SECRET (подпись cookie игрока и мест в матче одинакова на всех копиях) и Upstash;
//   память процесса — только явно (SOCIAL_MEMORY_OK=1: dev и e2e, один процесс).
// - namesEnabled(): SOCIAL_NAMES=0 — имена не хранятся и не отдаются (все — «Игрок 4821»), на случай ответа юриста.

type Env = Record<string, string | undefined>;

/** Секрет соцчасти (SOCIAL_SECRET) или null. Производного и случайного секрета нет: на разных копиях подписи разошлись бы. */
export function socialSecret(env: Env = process.env): string | null {
  return env.SOCIAL_SECRET?.trim() || null;
}

/** Секрет соцчасти или ошибка (вызывать только после socialEnabled()). */
export function requireSocialSecret(env: Env = process.env): string {
  const s = socialSecret(env);
  if (!s) throw new Error("social: SOCIAL_SECRET is not set");
  return s;
}

/** Соцчасть включена: есть SOCIAL_SECRET и общее хранилище (Upstash) или явно разрешённая память процесса. */
export function socialEnabled(env: Env = process.env): boolean {
  if (!socialSecret(env)) return false;
  return getStrictKv().kind === "upstash" || env.SOCIAL_MEMORY_OK === "1";
}

/** Имена игроков хранятся и показываются (SOCIAL_NAMES=0 — нет). */
export function namesEnabled(env: Env = process.env): boolean {
  return env.SOCIAL_NAMES?.trim() !== "0";
}

/** Строгое хранилище соцчасти (без отката в память при сбое Upstash). */
export function getSocialKv(): Kv {
  return getStrictKv();
}

/** Хранилище запроса со счётчиком команд Redis — для лога `[social] … cmds=N` и бюджета Upstash. */
export interface CountingKv extends KvStrictOps {
  readonly kind: Kv["kind"];
  /** Сколько команд Redis отправлено этим запросом. */
  cmds(): number;
  /** Учесть команды, ушедшие мимо (например, kvRateLimit: INCRBY + EXPIRE = 2). */
  addCmds(n: number): void;
}

export function countingKv(inner: Kv): CountingKv {
  let n = 0;
  const run = async (ops: readonly KvOp[]): Promise<unknown[]> => {
    n += ops.reduce((c, op) => c + commandsFor(op), 0);
    return (await inner.pipeline(ops)) as unknown[];
  };
  return {
    kind: inner.kind,
    ...bindOps(run),
    cmds: () => n,
    addCmds: (k) => {
      n += k;
    },
  };
}

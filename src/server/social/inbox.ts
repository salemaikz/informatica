import "server-only";
import type { KvOp } from "@/server/kv";
import type { CountingKv } from "@/server/social/kv";
import { cardFromJson, keys } from "@/server/social/player";

// Входящие игрока (docs/specs/duels.md §5, Ф3): pl:inbox:{pid} — LIST ≤ 20 записей JSON, 7 дней. Пишут вызовы (итог
// игры против записи: k = "chr"), Ф4 — приглашения в комнату. Запись хранит pid автора в поле `p` (не карточку): при
// чтении карточки берутся свежими одним MGET — скрытое модерацией имя скрыто и во входящих. pid наружу не уходит.

export const INBOX_MAX = 20;
export const INBOX_TTL_SEC = 7 * 86_400;

/** Положить запись во входящие (операция для конвейера). item.p — pid автора (заменится карточкой при чтении). */
export function inboxPushOp(pid: string, item: Record<string, unknown> & { k: string; at: number }): KvOp {
  return { op: "lpush", key: keys.inbox(pid), value: JSON.stringify(item), max: INBOX_MAX, ttlSec: INBOX_TTL_SEC };
}

/**
 * Записи входящих → для клиента: поле `p` (pid) заменяется карточкой автора `from` (null — автор удалил профиль).
 * Одна команда MGET на все записи (без записей с автором — 0 команд).
 */
export async function resolveInbox(kv: CountingKv, items: readonly unknown[]): Promise<Record<string, unknown>[]> {
  const objs = items.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x)).slice(0, INBOX_MAX);
  const pids = [...new Set(objs.map((o) => o.p).filter((p): p is string => typeof p === "string" && p.length > 0))];
  const raw = pids.length ? await kv.mget(pids.map(keys.card)) : [];
  const cards = new Map(pids.map((p, k) => [p, cardFromJson(raw[k] ?? null)]));
  return objs.map((o) => {
    const { p, ...rest } = o;
    return typeof p === "string" ? { ...rest, from: cards.get(p) ?? null } : rest;
  });
}

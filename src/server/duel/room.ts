import "server-only";
import { randomBytes } from "node:crypto";
import { FRIEND_CODE_ALPHABET } from "@/lib/friend-code";
import { normalizeRoomCode, ROOM_CODE_LEN } from "@/lib/duel/live";
import { DUEL_MODES, bandOf } from "@/lib/duel/modes";
import type { DuelBand, DuelModeId, MatchJoin } from "@/lib/duel/types";
import type { CountingKv } from "@/server/social/kv";
import { keys } from "@/server/social/player";
import { joinOf, matchFields, matchKey, newMatchId, newMatchSeed, parseMatch, roomScheduleFrom, seatClaims, writeMatchOp } from "./match";

// Комната — живой бой с другом (docs/specs/duels.md §5, §9; 1-server.md §5). Хозяин создаёт матч в «лобби» и код из 6 знаков
// Крокфорда: du:room:{CODE} → id матча (SET NX, 10 минут). Ссылка /duel/r/{CODE}. Друг входит (POST по кнопке на странице
// ссылки — не превью мессенджера): HSETNX b (второе место занимает ровно один); с этого момента у обоих 60 с на готовность,
// старт назначит вторая готовность (match.ts → ensureRoomStart); полоса набора — меньшая из двух (честнее к слабому).
// Ошибки: expired (нет комнаты, матч отменён или хозяин заблокировал гостя — блок не раскрываем), full (место занято),
// self (своя ссылка), update_needed (другая сборка).

export const ROOM_TTL_SEC = 600;
export const roomKey = (code: string) => `du:room:${code}`;

export function newRoomCode(): string {
  const bytes = randomBytes(ROOM_CODE_LEN);
  let out = "";
  for (const b of bytes) out += FRIEND_CODE_ALPHABET[b % FRIEND_CODE_ALPHABET.length];
  return out;
}

export interface RoomCreated {
  code: string;
  matchId: string;
  expiresAt: number;
}

/** Создать комнату (до 5 попыток при совпадении кода). */
export async function createRoom(
  kv: CountingKv,
  host: { pid: string; lv: number },
  opts: { mode: DuelModeId; topic?: string; deckTag: string },
  now: number,
): Promise<RoomCreated> {
  const card = await kv.getStr(keys.card(host.pid));
  const id = newMatchId();
  for (let i = 0; i < 5; i++) {
    const code = newRoomCode();
    if (!(await kv.set(roomKey(code), id, { nx: true, ttlSec: ROOM_TTL_SEC }))) continue;
    const fields = matchFields({
      kind: "room",
      mode: opts.mode,
      ...(DUEL_MODES[opts.mode].needsTopic && opts.topic ? { topic: opts.topic } : {}),
      seed: newMatchSeed(),
      band: bandOf(host.lv),
      deckTag: opts.deckTag,
      created: now,
      a: { pid: host.pid, card, lv: host.lv },
      room: code,
    });
    await kv.pipeline([writeMatchOp(id, fields)]);
    return { code, matchId: id, expiresAt: now + ROOM_TTL_SEC * 1000 };
  }
  throw new Error("duel: room code space exhausted");
}

export type JoinReply =
  | { ok: true; join: MatchJoin }
  | { ok: false; status: 404 | 409; error: "expired" | "full" | "self" | "update_needed"; matchId?: string };

/** Войти в комнату другом. Повторный вход того же игрока — то же место (перезагрузка страницы). */
export async function joinRoom(kv: CountingKv, rawCode: string, guest: { pid: string; lv: number }, deckTag: string, now: number, secret: string): Promise<JoinReply> {
  const code = normalizeRoomCode(rawCode);
  if (!code) return { ok: false, status: 404, error: "expired" };
  const [id, card] = await kv.pipeline([
    { op: "getStr", key: roomKey(code) },
    { op: "getStr", key: keys.card(guest.pid) },
  ] as const);
  if (!id) return { ok: false, status: 404, error: "expired" };
  const m = parseMatch(id, await kv.hgetAllStr(matchKey(id)));
  if (!m || m.kind !== "room") return { ok: false, status: 404, error: "expired" };
  if (m.a.pid === guest.pid) return { ok: false, status: 409, error: "self", matchId: id };
  if (m.deckTag !== deckTag) return { ok: false, status: 409, error: "update_needed" };
  if (m.b) {
    if (m.b.pid !== guest.pid) return { ok: false, status: 409, error: "full" };
    if (m.startAt) return { ok: true, join: joinOf(seatClaims(m, "b", guest.pid), secret) };
    // Место за этим гостем, а расписание не записалось (сбой второй записи или параллельный повтор входа) — дописываем
    // заново: сюда попадает только выигравший HSETNX b, запись идемпотентна.
  } else {
    if (m.a.left || now >= m.created + ROOM_TTL_SEC * 1000) return { ok: false, status: 404, error: "expired" };
    // Заблокированный хозяином не может вызвать его на бой (3-safety §3) — ответ как у закрытой комнаты.
    if (await kv.sismember(keys.blocked(m.a.pid), guest.pid)) return { ok: false, status: 404, error: "expired" };
    if (!(await kv.hsetnx(matchKey(id), "b", guest.pid))) return { ok: false, status: 409, error: "full" };
  }
  const band = Math.min(m.band, bandOf(guest.lv)) as DuelBand;
  const sched = roomScheduleFrom(m.mode, band, now);
  await kv.pipeline([
    { op: "hset", key: matchKey(id), fields: { band, lb: guest.lv, ...(card ? { cb: card } : {}), ...sched, joined: now } },
  ]);
  return { ok: true, join: joinOf(seatClaims({ ...m, band, ...sched }, "b", guest.pid), secret) };
}

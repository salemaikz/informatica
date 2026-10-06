import "server-only";
import { randomBytes } from "node:crypto";
import { normalizeFriendCode } from "@/lib/friend-code";
import type { KvOp } from "@/server/kv";
import type { CountingKv } from "@/server/social/kv";
import { serverNow } from "@/server/clock";
import { cardFromJson, freshRequest, freshRequests, keys, PROFILE_TTL_SEC, REQUEST_TTL_SEC, type PublicCard } from "@/server/social/player";

// Друзья (docs/specs/duels.md §5–§7, Ф3; 3-safety.md §3). Найти друг друга можно только намеренно: по коду (заявка, владелец
// кода принимает) или по ссылке-приглашению /f/<token> (её создал сам приглашающий — это и есть его согласие; добавление —
// только POST по кнопке, GET ничего не меняет). Дружба взаимная: pl:fr:{pid} у обоих.
//
// Ключи:
//   pl:fr:{pid}    SET друзей, ≤ 100, 180 дней
//   pl:frq:{pid}   ZSET входящих заявок: pid отправителя → время заявки (мс), ≤ 20; заявка живёт 14 дней от СВОЕГО времени
//                  (старые отбрасываются при чтении и вычищаются при новой заявке — новая не продлевает старые)
//   pl:blk:{pid}   SET заблокированных, 180 дней
//   pl:inv:{token} STRING → pid, 7 дней; pl:inv:{token}:n — сколько раз по ней добавились (≤ 30)
// Блокировку не раскрываем: заблокированный получает «sent» (как будто заявка ждёт ответа — отказ и так молчаливый),
// а по ссылке — «expired».

export const FRIENDS_MAX = 100;
export const REQUESTS_MAX = 20;
export { REQUEST_TTL_SEC, freshRequests };
export const INVITE_TTL_SEC = 7 * 86_400;
export const INVITE_MAX_USES = 30;
/** Ссылка-приглашение: 16 случайных байт base64url. */
export const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;

export const friendKeys = {
  invite: (token: string) => `pl:inv:${token}`,
  inviteUses: (token: string) => `pl:inv:${token}:n`,
};

export type RequestStatus = "sent" | "accepted" | "already" | "self" | "not_found" | "limit";

/** pid по коду друга (ввод ученика: регистр, дефис, похожие буквы); null — нет такого кода. 1 команда. */
export async function pidOfCode(kv: CountingKv, raw: unknown): Promise<string | null> {
  const code = typeof raw === "string" ? normalizeFriendCode(raw) : null;
  if (!code) return null;
  return kv.getStr(keys.code(code));
}

/** Сделать двух игроков друзьями (снимает встречные заявки и мою блокировку). */
function befriendOps(a: string, b: string): KvOp[] {
  return [
    { op: "sadd", key: keys.friends(a), members: [b], ttlSec: PROFILE_TTL_SEC },
    { op: "sadd", key: keys.friends(b), members: [a], ttlSec: PROFILE_TTL_SEC },
    { op: "zrem", key: keys.requests(a), members: [b] },
    { op: "zrem", key: keys.requests(b), members: [a] },
    { op: "srem", key: keys.blocked(a), members: [b] },
  ];
}

/** Состояние пары для решений о дружбе — один конвейер, 7 команд. */
async function pairState(kv: CountingKv, me: string, other: string, now: number) {
  const [myCode, otherCode, isFriend, blockedByThem, theyAskedAt, myCount, theirCount] = await kv.pipeline([
    { op: "hget", key: keys.profile(me), field: "code" },
    { op: "hget", key: keys.profile(other), field: "code" },
    { op: "sismember", key: keys.friends(me), member: other },
    { op: "sismember", key: keys.blocked(other), member: me },
    { op: "zscore", key: keys.requests(me), member: other },
    { op: "scard", key: keys.friends(me) },
    { op: "scard", key: keys.friends(other) },
  ] as const);
  return { meOk: !!myCode, otherOk: !!otherCode, isFriend, blockedByThem, theyAsked: freshRequest(theyAskedAt, now), myCount, theirCount };
}

/**
 * Заявка в друзья по коду. Он мне уже писал — сразу взаимная дружба («accepted»). Меня заблокировали — «sent», ничего не
 * пишем. null — у меня нет профиля (истёк): маршрут отвечает 401 no_player.
 */
export async function requestFriend(kv: CountingKv, me: string, other: string, now = serverNow()): Promise<RequestStatus | null> {
  if (other === me) return "self";
  const s = await pairState(kv, me, other, now);
  if (!s.meOk) return null;
  if (!s.otherOk) return "not_found";
  if (s.isFriend) return "already";
  if (s.blockedByThem) return "sent";
  if (s.myCount >= FRIENDS_MAX || s.theirCount >= FRIENDS_MAX) return "limit";
  if (s.theyAsked) {
    await kv.pipeline(befriendOps(me, other));
    return "accepted";
  }
  const entries = await kv.zrange(keys.requests(other), 0, -1);
  const fresh = freshRequests(entries, now).filter((p) => p !== me);
  if (fresh.length >= REQUESTS_MAX) return "limit";
  // Повторная заявка того же игрока обновляет время (14 дней от неё); просроченные чужие — вычищаются здесь же.
  const stale = entries.filter((e) => e.member !== me && !freshRequest(e.score, now)).map((e) => e.member);
  await kv.pipeline([
    ...(stale.length ? [{ op: "zrem", key: keys.requests(other), members: stale } as KvOp] : []),
    { op: "zadd", key: keys.requests(other), score: now, member: me, ttlSec: REQUEST_TTL_SEC },
    { op: "srem", key: keys.blocked(me), members: [other] },
  ]);
  return "sent";
}

export type RespondStatus = "accepted" | "declined" | "not_found" | "limit";

/** Ответ на заявку: принять — взаимная дружба, отклонить — молча убрать заявку. */
export async function respondFriend(kv: CountingKv, me: string, other: string, accept: boolean, now = serverNow()): Promise<RespondStatus> {
  const [askedAt, , otherCode, myCount, theirCount, blockedByThem] = await kv.pipeline([
    { op: "zscore", key: keys.requests(me), member: other },
    { op: "zrem", key: keys.requests(me), members: [other] },
    { op: "hget", key: keys.profile(other), field: "code" },
    { op: "scard", key: keys.friends(me) },
    { op: "scard", key: keys.friends(other) },
    { op: "sismember", key: keys.blocked(other), member: me },
  ] as const);
  // Заявки нет или она старше 14 дней (просроченная просто убрана) — «не найдена».
  if (!freshRequest(askedAt, now) || !otherCode) return "not_found";
  if (!accept) return "declined";
  // Он успел меня заблокировать — заявка просто исчезает (блокировку не раскрываем).
  if (blockedByThem) return "declined";
  if (myCount >= FRIENDS_MAX || theirCount >= FRIENDS_MAX) return "limit";
  await kv.pipeline(befriendOps(me, other));
  return "accepted";
}

/** Убрать из друзей — с обеих сторон, второго не уведомляем. */
export async function removeFriend(kv: CountingKv, me: string, other: string): Promise<void> {
  await kv.pipeline([
    { op: "srem", key: keys.friends(me), members: [other] },
    { op: "srem", key: keys.friends(other), members: [me] },
  ]);
}

/** Заблокировать (дружба и заявки с обеих сторон снимаются) или разблокировать. */
export async function blockPlayer(kv: CountingKv, me: string, other: string, on: boolean): Promise<void> {
  if (!on) {
    await kv.srem(keys.blocked(me), [other]);
    return;
  }
  await kv.pipeline([
    { op: "sadd", key: keys.blocked(me), members: [other], ttlSec: PROFILE_TTL_SEC },
    { op: "srem", key: keys.friends(me), members: [other] },
    { op: "srem", key: keys.friends(other), members: [me] },
    { op: "zrem", key: keys.requests(me), members: [other] },
    { op: "zrem", key: keys.requests(other), members: [me] },
  ]);
}

export interface FriendLists {
  friends: PublicCard[];
  requests: PublicCard[];
  blocked: PublicCard[];
}

/**
 * Друзья, входящие заявки (только действующие, новые первыми) и заблокированные с карточками: SMEMBERS ×2 + ZRANGE + MGET =
 * 4 команды. Удалившиеся — пропускаются.
 */
export async function friendLists(kv: CountingKv, me: string, now = serverNow()): Promise<FriendLists> {
  const [fr, rq, bl] = await kv.pipeline([
    { op: "smembers", key: keys.friends(me) },
    { op: "zrange", key: keys.requests(me), start: 0, stop: -1 },
    { op: "smembers", key: keys.blocked(me) },
  ] as const);
  const groups = [fr.slice(0, FRIENDS_MAX), freshRequests(rq, now).slice(0, REQUESTS_MAX), bl.slice(0, FRIENDS_MAX)];
  const ids = [...new Set(groups.flat())];
  const raw = ids.length ? await kv.mget(ids.map(keys.card)) : [];
  const card = new Map(ids.map((id, k) => [id, cardFromJson(raw[k] ?? null)]));
  const cards = (list: string[]) =>
    list.flatMap((id) => {
      const c = card.get(id);
      return c ? [c] : [];
    });
  const byLevel = (a: PublicCard, b: PublicCard) => b.lv - a.lv || a.code.localeCompare(b.code);
  return { friends: cards(groups[0]).sort(byLevel), requests: cards(groups[1]), blocked: cards(groups[2]) };
}

// ---------- ссылка-приглашение /f/<token> ----------

/** Новый токен ссылки. */
export const newInviteToken = (): string => randomBytes(16).toString("base64url");

/** Живую ссылку отдаём повторно, только если до её конца ещё не меньше суток (иначе друг откроет уже мёртвую). */
export const INVITE_REUSE_MIN_LEFT_MS = 86_400_000;

/**
 * Ссылка-приглашение игрока: живая (≥ 1 дня до конца и не исчерпана) переиспользуется, иначе новая. Токен и срок помним
 * в профиле (поля inv, invExp), чтобы не плодить ссылки. canMint вызывается только перед созданием новой ссылки (лимит
 * invitePid считает новые ссылки, а не каждое нажатие «Пригласить»). null — нет профиля; "limited" — новую создать нельзя.
 */
export async function inviteLink(kv: CountingKv, me: string, now: number, canMint: () => Promise<boolean>): Promise<string | "limited" | null> {
  const [code, cur, exp] = await kv.pipeline([
    { op: "hget", key: keys.profile(me), field: "code" },
    { op: "hget", key: keys.profile(me), field: "inv" },
    { op: "hget", key: keys.profile(me), field: "invExp" },
  ] as const);
  if (!code) return null;
  if (cur && INVITE_TOKEN_RE.test(cur) && Number(exp) - now >= INVITE_REUSE_MIN_LEFT_MS) {
    const [owner, uses] = await kv.pipeline([
      { op: "getStr", key: friendKeys.invite(cur) },
      { op: "getStr", key: friendKeys.inviteUses(cur) },
    ] as const);
    if (owner === me && Number(uses ?? 0) < INVITE_MAX_USES - 1) return cur;
  }
  if (!(await canMint())) return "limited";
  const token = newInviteToken();
  await kv.pipeline([
    { op: "set", key: friendKeys.invite(token), value: me, ttlSec: INVITE_TTL_SEC },
    { op: "hset", key: keys.profile(me), fields: { inv: token, invExp: now + INVITE_TTL_SEC * 1000 } },
  ]);
  return token;
}

/** Кто приглашает по ссылке (для страницы /f/<token>, только чтение). null — ссылки нет, она исчерпана или профиль удалён. */
export async function inviteInfo(kv: CountingKv, token: string): Promise<{ pid: string; card: PublicCard } | null> {
  if (!INVITE_TOKEN_RE.test(token)) return null;
  const [pid, uses] = await kv.pipeline([
    { op: "getStr", key: friendKeys.invite(token) },
    { op: "getStr", key: friendKeys.inviteUses(token) },
  ] as const);
  if (!pid || Number(uses ?? 0) >= INVITE_MAX_USES) return null;
  const card = cardFromJson(await kv.getStr(keys.card(pid)));
  return card ? { pid, card } : null;
}

/** Карточка для страницы /f/<token>: как inviteInfo, но тот, кого приглашающий заблокировал, видит «ссылки нет». */
export async function inviteView(kv: CountingKv, token: string, me: string | null): Promise<{ pid: string; card: PublicCard } | null> {
  const info = await inviteInfo(kv, token);
  if (!info || !me || me === info.pid) return info;
  return (await kv.sismember(keys.blocked(info.pid), me)) ? null : info;
}

export type JoinStatus = "accepted" | "already" | "self" | "expired" | "limit";

/** Добавиться в друзья по ссылке (POST по кнопке). null — у меня нет профиля. */
export async function acceptInvite(kv: CountingKv, me: string, token: string): Promise<{ status: JoinStatus; card?: PublicCard } | null> {
  const info = await inviteInfo(kv, token);
  if (!info) return { status: "expired" };
  if (info.pid === me) return { status: "self" };
  const s = await pairState(kv, me, info.pid, serverNow());
  if (!s.meOk) return null;
  if (!s.otherOk || s.blockedByThem) return { status: "expired" };
  if (s.isFriend) return { status: "already", card: info.card };
  if (s.myCount >= FRIENDS_MAX || s.theirCount >= FRIENDS_MAX) return { status: "limit" };
  await kv.pipeline([...befriendOps(me, info.pid), { op: "incrBy", key: friendKeys.inviteUses(token), n: 1, ttlSec: INVITE_TTL_SEC }]);
  return { status: "accepted", card: info.card };
}

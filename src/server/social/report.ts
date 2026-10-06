import "server-only";
import type { KvOp } from "@/server/kv";
import { namesEnabled, type CountingKv } from "@/server/social/kv";
import { keys, PROFILE_TTL_SEC } from "@/server/social/player";

// Жалобы на игроков и решения владельца (docs/specs/duels.md §7, Ф3; 3-safety.md §4). Свободного текста нет.
// - Жалоба сразу скрывает имя у пожаловавшегося (клиент: hiddenNames в сторе).
// - mod:rep:{pid}:{reason} — SET pid пожаловавшихся, 30 дней: повтор от того же игрока не считается.
// - Жалобы на имя от 3 разных игроков за 30 дней → имя скрыто у всех (nameState = hidden, в карточке n = null) до решения
//   владельца на /owner. Имя, которое владелец уже разрешил (поле modOk), автоматически больше не скрывается.
// - mod:queue — LIST ≤ 500 (180 дней): каждая новая жалоба; mod:log — LIST ≤ 1000 (180 дней): решения владельца.
// Решение владельца: allow — имя снова видно всем, жалобы на него сброшены; hide — имя скрыто, пока игрок не выберет другое.

export const REPORT_REASONS = ["name", "cheat", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_WHERE = ["friend", "request", "top", "challenge", "result", "match", "invite"] as const;
export type ReportWhere = (typeof REPORT_WHERE)[number];

/** Разных жалующихся на имя за 30 дней, чтобы скрыть имя у всех. */
export const NAME_HIDE_THRESHOLD = 3;
const REPORT_TTL_SEC = 30 * 86_400;
const MOD_TTL_SEC = 180 * 86_400;
export const MOD_QUEUE = "mod:queue";
export const MOD_LOG = "mod:log";
const QUEUE_MAX = 500;
const LOG_MAX = 1000;

export const reportKey = (pid: string, reason: ReportReason) => `mod:rep:${pid}:${reason}`;

export const isReportReason = (v: unknown): v is ReportReason => typeof v === "string" && (REPORT_REASONS as readonly string[]).includes(v);
export const isReportWhere = (v: unknown): v is ReportWhere => typeof v === "string" && (REPORT_WHERE as readonly string[]).includes(v);

/** Карточка с именем или без (переписать pl:c:{pid}, сохранив остальные поля). */
async function setCardName(kv: CountingKv, pid: string, name: string | null): Promise<KvOp | null> {
  const raw = await kv.getStr(keys.card(pid));
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    return { op: "set", key: keys.card(pid), value: JSON.stringify({ ...o, n: name }), ttlSec: PROFILE_TTL_SEC };
  } catch {
    return null;
  }
}

/** Скрыть имя у всех (карточка без имени, профиль — hidden; само имя остаётся у владельца профиля). */
export async function hideName(kv: CountingKv, pid: string, now: number, extra: Record<string, string | number> = {}): Promise<void> {
  const card = await setCardName(kv, pid, null);
  await kv.pipeline([{ op: "hset", key: keys.profile(pid), fields: { nameState: "hidden", hiddenAt: now, ...extra } }, ...(card ? [card] : [])]);
}

export interface ReportInput {
  target: string;
  reporter: string;
  reason: ReportReason;
  where: ReportWhere;
  matchId?: string;
}

/** Жалоба. Возвращает: учтена ли (не повтор) и скрыто ли имя у всех этой жалобой. */
export async function reportPlayer(kv: CountingKv, r: ReportInput, now: number): Promise<{ counted: boolean; hidden: boolean }> {
  const key = reportKey(r.target, r.reason);
  const [added, count, nameState, name, modOk] = await kv.pipeline([
    { op: "sadd", key, members: [r.reporter], ttlSec: REPORT_TTL_SEC },
    { op: "scard", key },
    { op: "hget", key: keys.profile(r.target), field: "nameState" },
    { op: "hget", key: keys.profile(r.target), field: "name" },
    { op: "hget", key: keys.profile(r.target), field: "modOk" },
  ] as const);
  if (!added) return { counted: false, hidden: false };
  const entry = { p: r.target, r: r.reason, w: r.where, ...(r.matchId ? { m: r.matchId } : {}), at: now };
  await kv.pipeline([{ op: "lpush", key: MOD_QUEUE, value: JSON.stringify(entry), max: QUEUE_MAX, ttlSec: MOD_TTL_SEC }]);
  const hide = r.reason === "name" && count >= NAME_HIDE_THRESHOLD && nameState === "ok" && !!name && modOk !== name;
  if (hide) await hideName(kv, r.target, now);
  return { counted: true, hidden: hide };
}

// ---------- владелец ----------

export interface ModCase {
  code: string;
  /** Настоящее имя (видит только владелец), null — имени нет. */
  name: string | null;
  nameState: string;
  /** Жалоб по причинам (новых, после последнего решения). */
  reasons: Record<ReportReason, number>;
  where: ReportWhere[];
  last: number;
}

/** Открытые жалобы для /owner: очередь, сгруппированная по игроку; решённые раньше (modAt) не показываются. */
export async function listCases(kv: CountingKv, limit = 100): Promise<ModCase[]> {
  const raw = await kv.pipeline([{ op: "lrange", key: MOD_QUEUE, start: 0, stop: QUEUE_MAX - 1 }] as const);
  const groups = new Map<string, { reasons: Record<ReportReason, number>; where: Set<ReportWhere>; last: number; first: number }>();
  for (const s of raw[0]) {
    let e: { p?: unknown; r?: unknown; w?: unknown; at?: unknown };
    try {
      e = JSON.parse(s) as typeof e;
    } catch {
      continue;
    }
    if (typeof e.p !== "string" || !isReportReason(e.r) || typeof e.at !== "number") continue;
    const g = groups.get(e.p) ?? { reasons: { name: 0, cheat: 0, other: 0 }, where: new Set<ReportWhere>(), last: 0, first: Infinity };
    g.reasons[e.r]++;
    if (isReportWhere(e.w)) g.where.add(e.w);
    g.last = Math.max(g.last, e.at);
    g.first = Math.min(g.first, e.at);
    groups.set(e.p, g);
  }
  const pids = [...groups.keys()].slice(0, limit);
  if (!pids.length) return [];
  const profiles = (await kv.pipeline(pids.map((p) => ({ op: "hgetAllStr", key: keys.profile(p) }) as KvOp))) as unknown as Record<string, string>[];
  const out: ModCase[] = [];
  pids.forEach((pid, k) => {
    const h = profiles[k] ?? {};
    const g = groups.get(pid)!;
    if (!h.code) return; // профиль удалён
    if ((Number(h.modAt) || 0) >= g.last) return; // уже решено
    out.push({ code: h.code, name: h.name || null, nameState: h.nameState || "none", reasons: g.reasons, where: [...g.where], last: g.last });
  });
  return out.sort((a, b) => b.reasons.name - a.reasons.name || b.last - a.last);
}

export type ModAction = "allow" | "hide";

/** Решение владельца по игроку (pid). false — профиля нет. */
export async function moderate(kv: CountingKv, pid: string, action: ModAction, now: number): Promise<boolean> {
  const h = await kv.hgetAllStr(keys.profile(pid));
  if (!h.code) return false;
  const reset: KvOp = { op: "del", keys: REPORT_REASONS.map((r) => reportKey(pid, r)) };
  const log: KvOp = { op: "lpush", key: MOD_LOG, value: JSON.stringify({ code: h.code, a: action, at: now }), max: LOG_MAX, ttlSec: MOD_TTL_SEC };
  if (action === "hide") {
    await hideName(kv, pid, now, { modAt: now });
    await kv.pipeline([reset, log]);
    return true;
  }
  const name = h.name || null;
  const card = name && namesEnabled() && h.nameState !== "rejected" && h.nameState !== "off" ? await setCardName(kv, pid, name) : null;
  await kv.pipeline([
    {
      op: "hset",
      key: keys.profile(pid),
      fields: { modAt: now, ...(card && name ? { nameState: "ok", modOk: name } : {}) },
    },
    ...(card ? [card] : []),
    reset,
    log,
  ]);
  return true;
}

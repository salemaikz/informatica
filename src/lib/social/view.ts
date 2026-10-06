import { isCosmeticId, type CosmeticId } from "../cosmetics";
import { isDuelMode } from "../duel/modes";
import type { DuelModeId, PublicCard } from "../duel/types";
import { isFriendCode } from "../friend-code";
import { hashString } from "../text";

// Соцчасть на клиенте (этап 16Д, Ф3): чистые функции без React и без сети — разбор ответов сервера (недоверенные данные:
// только форма), номер игрока вместо имени, скрытые имена. Тесты — tests/social-view.test.ts.

/** Номер игрока для «Игрок 4821» / «Ойыншы 4821»: 4 цифры из кода друга (имя не задано, не прошло фильтр или скрыто). */
export function playerTag(code: string): number {
  return 1000 + (hashString(`tag:${code}`) % 9000);
}

/** Показываемое имя: настоящее или null (тогда интерфейс рисует «Игрок {n}»). Скрытое мной (жалоба) — тоже null. */
export function visibleName(card: Pick<PublicCard, "code" | "name">, hidden: readonly string[]): string | null {
  if (!card.name || hidden.includes(card.code)) return null;
  return card.name;
}

const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);
const int = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : null;
const cosmetic = (v: unknown): CosmeticId | null => (isCosmeticId(v) ? v : null);

/** Карточка игрока из ответа сервера; null — не похоже на карточку. */
export function sanitizeCard(raw: unknown): PublicCard | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (!isFriendCode(o.code)) return null;
  return { code: o.code as string, name: str(o.name, 40), lv: int(o.lv, 1, 999) ?? 1, frame: cosmetic(o.frame), title: cosmetic(o.title) };
}

export const sanitizeCards = (raw: unknown): PublicCard[] =>
  Array.isArray(raw) ? raw.flatMap((x) => (sanitizeCard(x) ? [sanitizeCard(x) as PublicCard] : [])).slice(0, 200) : [];

/** Итоги одной стороны вызова. */
export interface ResView {
  score: number;
  correct: number;
  answered: number;
  timeMs: number;
}

export function sanitizeRes(raw: unknown): ResView | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const score = int(o.score, -10_000, 10_000);
  const correct = int(o.correct, 0, 1000);
  if (score === null || correct === null) return null;
  return { score, correct, answered: Math.max(correct, int(o.answered, 0, 1000) ?? correct), timeMs: int(o.timeMs, 0, 86_400_000) ?? 0 };
}

/** Запись входящих «мой вызов приняли»: from — кто принял (null — удалил профиль), their — его итог, mine — мой. */
export interface InboxChallengeResult {
  k: "chr";
  id: string;
  mode: DuelModeId;
  topic?: string;
  from: PublicCard | null;
  their: ResView;
  mine: ResView;
  /** Итог для меня (вызвавшего). */
  outcome: "win" | "loss" | "draw";
  at: number;
}

export type InboxItem = InboxChallengeResult;

const CH_ID_RE = /^[A-Za-z0-9_-]{10}$/;

/** Входящие из ответа /api/social/home: известные виды записей, остальное пропускаем (Ф4 добавит свои). */
export function sanitizeInbox(raw: unknown): InboxItem[] {
  if (!Array.isArray(raw)) return [];
  const out: InboxItem[] = [];
  for (const x of raw.slice(0, 20)) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (o.k !== "chr" || typeof o.id !== "string" || !CH_ID_RE.test(o.id) || !isDuelMode(o.m)) continue;
    const their = sanitizeRes(o.s);
    const mine = sanitizeRes(o.r);
    const at = int(o.at, 0, Number.MAX_SAFE_INTEGER);
    if (!their || !mine || !at) continue;
    const outcome = o.w === "win" || o.w === "loss" ? o.w : "draw";
    out.push({ k: "chr", id: o.id, mode: o.m, ...(str(o.tp, 32) ? { topic: o.tp as string } : {}), from: sanitizeCard(o.from), their, mine, outcome, at });
  }
  return out;
}

/** Строка топа друзей. */
export interface TopRowView {
  card: PublicCard;
  /** null — друг скрыл свои очки. */
  score: number | null;
  me: boolean;
}

export function sanitizeTop(raw: unknown): TopRowView[] {
  const rows = raw && typeof raw === "object" ? (raw as { rows?: unknown }).rows : null;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((r) => {
    if (!r || typeof r !== "object") return [];
    const o = r as Record<string, unknown>;
    const card = sanitizeCard(o.card);
    if (!card) return [];
    const score = o.score === null ? null : int(o.score, 0, 1_000_000) ?? 0;
    return [{ card, score, me: o.me === true }];
  });
}

/** Профиль игрока соцчасти (GET/POST /api/social/me). */
export interface MyPlayer extends PublicCard {
  nameState: "none" | "ok" | "rejected" | "hidden" | "off";
  ft: boolean;
}

const NAME_STATES = ["none", "ok", "rejected", "hidden", "off"] as const;

export function sanitizePlayer(raw: unknown): MyPlayer | null {
  const card = sanitizeCard(raw);
  if (!card) return null;
  const o = raw as Record<string, unknown>;
  const nameState = (NAME_STATES as readonly string[]).includes(o.nameState as string) ? (o.nameState as MyPlayer["nameState"]) : "none";
  return { ...card, nameState, ft: o.ft !== false };
}

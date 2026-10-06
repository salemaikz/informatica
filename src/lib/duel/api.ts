import { DUEL_MODES, isDuelBand, isDuelMode } from "./modes";
import type { DuelBand, DuelItem, DuelModeId, DuelTopic } from "./types";

// Клиент набора заданий дуэли с ботом (GET /api/duel/deck). Лёгкий модуль: банк живёт только на сервере.

export interface DuelDeckResponse {
  mode: DuelModeId;
  band: DuelBand;
  seed: number;
  topic?: DuelTopic;
  deckTag: string;
  items: DuelItem[];
}

export interface DuelDeckQuery {
  mode: DuelModeId;
  band: DuelBand;
  seed?: number;
  topic?: DuelTopic;
}

/** Адрес набора: параметры в постоянном порядке (кэш браузера и CDN). */
export function duelDeckUrl(q: DuelDeckQuery): string {
  const p = new URLSearchParams({ mode: q.mode, band: String(q.band) });
  if (q.seed !== undefined) p.set("seed", String(q.seed >>> 0));
  if (DUEL_MODES[q.mode].needsTopic && q.topic) p.set("topic", q.topic);
  return `/api/duel/deck?${p}`;
}

/** Ответ сервера похож на набор этого режима (данные из сети — недоверенные: только форма). */
export function isDeckResponse(v: unknown, mode: DuelModeId): v is DuelDeckResponse {
  if (!v || typeof v !== "object") return false;
  const r = v as Partial<DuelDeckResponse>;
  if (r.mode !== mode || !isDuelMode(r.mode) || !isDuelBand(r.band) || typeof r.seed !== "number" || typeof r.deckTag !== "string") return false;
  if (!Array.isArray(r.items) || r.items.length !== DUEL_MODES[mode].n) return false;
  return r.items.every(
    (it, i) =>
      !!it &&
      it.i === i &&
      it.mode === mode &&
      (it.shape === "statement" ? typeof it.statement?.value === "boolean" : it.shape === "choice" && Array.isArray(it.step?.options) && Number.isInteger(it.step?.correct)),
  );
}

/** Загрузить набор. Ошибка сети или ответа — исключение (экран показывает «Попробовать ещё раз»). */
export async function fetchDuelDeck(q: DuelDeckQuery, signal?: AbortSignal): Promise<DuelDeckResponse> {
  const res = await fetch(duelDeckUrl(q), { signal });
  if (!res.ok) throw new Error(`duel deck: HTTP ${res.status}`);
  const data: unknown = await res.json();
  if (!isDeckResponse(data, q.mode)) throw new Error("duel deck: bad response");
  return data;
}

/** Новый seed матча (uint32) — в обработчике нажатия, не в рендере. */
export function newDuelSeed(): number {
  try {
    const a = new Uint32Array(1);
    globalThis.crypto.getRandomValues(a);
    return a[0];
  } catch {
    return Math.floor(Math.random() * 0xffff_ffff);
  }
}

/**
 * Адрес экрана матча с ботом. entry — seed прерванного оплаченного матча: новый матч (другой набор) идёт по его оплате
 * (один бесплатный перезапуск после перезагрузки или выхода, см. DuelPlay).
 */
export function duelPlayHref(mode: DuelModeId, seed: number, topic?: DuelTopic, entry?: number): string {
  const p = new URLSearchParams({ mode });
  if (DUEL_MODES[mode].needsTopic && topic) p.set("topic", topic);
  p.set("seed", String(seed >>> 0));
  if (entry !== undefined) p.set("entry", String(entry >>> 0));
  return `/duel/play?${p}`;
}

/** seed из адреса: uint32 десятичной записью, иначе null. */
export function parseDuelSeed(raw: string | undefined): number | null {
  return raw && /^\d{1,10}$/.test(raw) && Number(raw) <= 0xffff_ffff ? Number(raw) : null;
}

/** id записи истории сыгранного матча: id матча + момент старта (по префиксу узнаём, что матч уже сыгран). */
export function duelPlayId(matchId: string, startedAt: number): string {
  return `${matchId}.${startedAt.toString(36)}`;
}

/** Матч уже сыгран и записан в историю (перезагрузка итогов не должна запускать его снова). */
export function duelPlayed(history: readonly { id: string }[], matchId: string): boolean {
  return history.some((r) => r.id.startsWith(`${matchId}.`));
}

const STARTED_KEY = "informatica-duel-started";
const STARTED_MAX = 20;

const readStarted = (): string[] => {
  try {
    const v: unknown = JSON.parse(sessionStorage.getItem(STARTED_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

/** Матч начался (сердечко списано, задания открыты) — отметка вкладки: перезагрузка не даёт сыграть тот же набор заново. */
export function markDuelStarted(matchId: string): void {
  try {
    const list = [matchId, ...readStarted().filter((x) => x !== matchId)].slice(0, STARTED_MAX);
    sessionStorage.setItem(STARTED_KEY, JSON.stringify(list));
  } catch {
    // хранилище недоступно (приватный режим) — остаётся проверка по оплаченному входу
  }
}

/** Этот матч уже начинался в этой вкладке. */
export function duelStartedHere(matchId: string): boolean {
  return readStarted().includes(matchId);
}

/** id матча с ботом: один и тот же для перезагрузки страницы (оплата входа по нему не повторяется 20 минут). */
export function botMatchId(mode: DuelModeId, seed: number, band: DuelBand, topic?: DuelTopic): string {
  return `bot.${mode}.${DUEL_MODES[mode].needsTopic && topic ? topic : "-"}.${band}.${seed >>> 0}`;
}

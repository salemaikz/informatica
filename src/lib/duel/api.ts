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

/** Адрес экрана матча с ботом. */
export function duelPlayHref(mode: DuelModeId, seed: number, topic?: DuelTopic): string {
  const p = new URLSearchParams({ mode });
  if (DUEL_MODES[mode].needsTopic && topic) p.set("topic", topic);
  p.set("seed", String(seed >>> 0));
  return `/duel/play?${p}`;
}

/** id матча с ботом: один и тот же для перезагрузки страницы (оплата входа по нему не повторяется 20 минут). */
export function botMatchId(mode: DuelModeId, seed: number, band: DuelBand, topic?: DuelTopic): string {
  return `bot.${mode}.${DUEL_MODES[mode].needsTopic && topic ? topic : "-"}.${band}.${seed >>> 0}`;
}

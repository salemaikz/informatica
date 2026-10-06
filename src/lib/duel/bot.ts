import { hashString, seeded } from "../text";
import type { Level, SkillId, Text } from "../types";
import { DUEL_MODES } from "./modes";
import type { DuelBand, DuelEvent, DuelItem } from "./types";

// Бот «Бит» (docs/specs/duels.md §4): чистый код без ИИ и без сервера. Подражает ученику уровня — по таблице точности
// и темпа полосы, смешанной 50/50 с освоением навыков самого ученика, плюс «резинка» по последним матчам.
// Детерминирован: один и тот же (набор, профиль, botSeed) → один и тот же таймлайн. Всегда помечен «бот».

export interface BandRow {
  /** Точность по уровню задания A/B/C. */
  acc: readonly [number, number, number];
  /** Медиана времени «на подумать» по уровню A/B/C, мс (задание на выбор; чтение — сверху). */
  medianMs: readonly [number, number, number];
}

/** Таблица полос (2-game.md §4): ур. 1–4, 5–9, 10–19, 20+. */
export const BOT_TABLE: Record<DuelBand, BandRow> = {
  1: { acc: [0.7, 0.55, 0.4], medianMs: [9_000, 14_000, 20_000] },
  2: { acc: [0.78, 0.64, 0.48], medianMs: [7_000, 11_000, 16_000] },
  3: { acc: [0.85, 0.72, 0.56], medianMs: [6_000, 9_000, 13_000] },
  4: { acc: [0.9, 0.8, 0.65], medianMs: [5_000, 8_000, 11_000] },
};

/** Разброс времени: логнормальное, σ логарифма. */
export const BOT_SIGMA = 0.35;
/** Скорость чтения: символов в секунду. */
export const READ_CHARS_PER_S = 18;
/** Быстрее этого бот не отвечает никогда, мс (с чтением). */
export const BOT_FLOOR_MS = 2_500;
/** Потолок точности: бот никогда не «сверхчеловек». */
export const BOT_ACC_CAP = 0.92;
/** Нижняя граница точности. */
export const BOT_ACC_MIN = 0.05;
/** После ошибки следующий ответ медленнее во столько раз. */
export const SLOW_AFTER_ERROR = 1.15;
/** Утверждение решается быстрее задания на выбор: множитель медианы. */
export const STATEMENT_TIME_FACTOR = 0.35;
/** С лимитом на задание бот отвечает не позже чем за столько до конца, мс. */
export const LIMIT_MARGIN_MS = 1_000;
/** Шаг и предел «резинки» точности. */
export const ADJ_STEP = 0.05;
export const ADJ_MAX = 0.1;
/** Штраф уровня в формуле освоения: 0,45 + 0,5·m − штраф. */
const MASTERY_LEVEL_PENALTY: readonly [number, number, number] = [0, 0.1, 0.22];

export interface BotProfile {
  band: DuelBand;
  row: BandRow;
  /** Освоение навыков ученика 0…1 (decayedMastery); нет навыка — только таблица. */
  mastery?: Readonly<Record<SkillId, number>>;
  /** «Резинка» точности, −0,1…+0,1 (хранится в сторе, duels.botAdj). */
  adj: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Профиль бота по полосе ученика, его освоению навыков и «резинке». */
export function botProfile(band: DuelBand, opts: { mastery?: Readonly<Record<SkillId, number>>; adj?: number } = {}): BotProfile {
  const adj = Number.isFinite(opts.adj) ? clamp(opts.adj as number, -ADJ_MAX, ADJ_MAX) : 0;
  return { band, row: BOT_TABLE[band], mastery: opts.mastery, adj };
}

/** Точность бота на задании: таблица (или 50/50 с освоением навыка) + резинка, в пределах [0,05; 0,92]. */
export function botAccuracy(p: BotProfile, skill: SkillId, level: Level): number {
  const table = p.row.acc[level - 1];
  const m = p.mastery?.[skill];
  const base = typeof m === "number" && Number.isFinite(m) ? 0.5 * table + 0.5 * (0.45 + 0.5 * clamp(m, 0, 1) - MASTERY_LEVEL_PENALTY[level - 1]) : table;
  return clamp(base + p.adj, BOT_ACC_MIN, BOT_ACC_CAP);
}

const len = (t: Text) => (typeof t === "string" ? t : t.ru).length;

/** Время чтения задания, мс (символы / 18 в секунду; по русскому тексту — чтобы не зависеть от языка). */
export function readMs(item: DuelItem): number {
  const chars = item.shape === "statement" ? len(item.statement.text) : len(item.step.prompt) + item.step.options.reduce((s, o) => s + len(o), 0);
  return Math.round((chars / READ_CHARS_PER_S) * 1000);
}

/** Медиана «на подумать» для задания, мс. */
export function thinkMedianMs(p: BotProfile, item: DuelItem): number {
  const m = p.row.medianMs[item.level - 1];
  return item.shape === "statement" ? m * STATEMENT_TIME_FACTOR : m;
}

/** Стандартное нормальное (Бокс — Мюллер), ровно два вызова rand. */
function normal(rand: () => number): number {
  const u1 = 1 - rand();
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Таймлайн бота по набору: {i, ok, t}. Режим берётся из заданий. Общие часы (блиц) — события до конца часов;
 * лимит на задание — бот успевает до него. После ошибки — пауза режима и на 15 % медленнее.
 */
export function botTimeline(deck: readonly DuelItem[], profile: BotProfile, botSeed: string | number): DuelEvent[] {
  if (!deck.length) return [];
  const mode = DUEL_MODES[deck[0].mode];
  const rand = seeded(hashString(`${botSeed}:bot`));
  const events: DuelEvent[] = [];
  let t = 0;
  let prevWrong = false;
  for (const item of deck) {
    // Ровно три вызова rand на задание: таймлайн устойчив к изменениям одного задания.
    const u = rand();
    const z = normal(rand);
    const ok = u < botAccuracy(profile, item.skill, item.level);
    const think = thinkMedianMs(profile, item) * Math.exp(BOT_SIGMA * z) * (prevWrong ? SLOW_AFTER_ERROR : 1);
    let dt = Math.max(BOT_FLOOR_MS, readMs(item) + think);
    if (item.limitMs != null) dt = Math.min(dt, Math.max(BOT_FLOOR_MS, item.limitMs - LIMIT_MARGIN_MS));
    const at = t + (prevWrong ? mode.errorPauseMs : 0) + Math.round(dt);
    if (mode.clockMs != null && at > mode.clockMs) break;
    events.push({ i: item.i, ok, t: at });
    t = at;
    prevWrong = !ok;
  }
  return events;
}

export type DuelOutcome = "win" | "loss" | "draw";

/**
 * «Резинка» после матча с ботом: results — исходы ученика против бота, последний — в конце. Каждые 3 победы подряд —
 * бот точнее на 0,05, каждые 3 поражения подряд — слабее; предел ±0,1. Ничья прерывает серию.
 */
export function nextBotAdj(adj: number, results: readonly DuelOutcome[]): number {
  const cur = Number.isFinite(adj) ? clamp(adj, -ADJ_MAX, ADJ_MAX) : 0;
  const last = results[results.length - 1];
  if (last !== "win" && last !== "loss") return cur;
  let run = 0;
  for (let k = results.length - 1; k >= 0 && results[k] === last; k--) run++;
  if (run === 0 || run % 3 !== 0) return cur;
  const next = cur + (last === "win" ? ADJ_STEP : -ADJ_STEP);
  return Math.round(clamp(next, -ADJ_MAX, ADJ_MAX) * 100) / 100;
}

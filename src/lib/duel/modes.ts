import type { Level } from "../types";
import type { DuelBand, DuelModeId, DuelShape } from "./types";

// Режимы дуэлей (docs/specs/duels.md §3, §5). Только данные и маленькие чистые функции; строки интерфейса —
// в словаре (ключи duel.mode.<id>), здесь их нет.

export interface DuelModeMeta {
  id: DuelModeId;
  /** Имя иконки lucide (компонент выбирают в components). */
  icon: string;
  shape: DuelShape;
  /** Размер набора заданий. В режимах на время — с запасом: столько за отведённое время честно не ответить. */
  n: number;
  /** Общие часы, мс (блиц, «верю — не верю»); null — лимит на каждое задание. */
  clockMs: number | null;
  /** Лимит на задание по уровню A/B/C, мс; null — общие часы. */
  perItemMs: readonly [number, number, number] | null;
  /** Ступенька уровней A/B/C (сумма = n); null — уровни растут по полосе (bandLevels). */
  ladder: readonly [number, number, number] | null;
  /** Очки: верно / неверно. Со штрафом случайное нажатие в среднем не приносит очков (§3). */
  pts: { ok: number; bad: number };
  /** Пауза после ошибки, мс (её же учитывает проверка суммы времени). Блиц 1,5 с (§3), «верю — не верю» 2,5 с. */
  errorPauseMs: number;
  /** Доступен случайным соперникам (очередь). В фазе 1 — только блиц. */
  random: boolean;
  /** Нужна тема (режим «по теме»). */
  needsTopic: boolean;
}

export const DUEL_MODES: Record<DuelModeId, DuelModeMeta> = {
  blitz: {
    id: "blitz",
    icon: "zap",
    shape: "choice",
    n: 40,
    clockMs: 60_000,
    perItemMs: null,
    ladder: null,
    pts: { ok: 2, bad: -1 },
    errorPauseMs: 1_500,
    random: true,
    needsTopic: false,
  },
  truth: {
    id: "truth",
    icon: "scale",
    shape: "statement",
    n: 50,
    clockMs: 45_000,
    perItemMs: null,
    ladder: null,
    pts: { ok: 1, bad: -1 },
    // Дольше, чем в блице: «верю» на всё подряд за 0,5 с с паузой 1,5 с давало слишком много попыток наугад.
    errorPauseMs: 2_500,
    random: false,
    needsTopic: false,
  },
  ten: {
    id: "ten",
    icon: "list-ordered",
    shape: "choice",
    n: 10,
    clockMs: null,
    perItemMs: [20_000, 30_000, 45_000],
    ladder: [5, 3, 2],
    pts: { ok: 1, bad: 0 },
    errorPauseMs: 0,
    random: false,
    needsTopic: false,
  },
  topic: {
    id: "topic",
    icon: "book-open",
    shape: "choice",
    n: 10,
    clockMs: null,
    perItemMs: [20_000, 30_000, 45_000],
    ladder: [5, 3, 2],
    pts: { ok: 1, bad: 0 },
    errorPauseMs: 0,
    random: false,
    needsTopic: true,
  },
};

export const DUEL_MODE_IDS: readonly DuelModeId[] = ["blitz", "truth", "ten", "topic"];

export function isDuelMode(v: unknown): v is DuelModeId {
  return typeof v === "string" && (DUEL_MODE_IDS as readonly string[]).includes(v);
}

export function isDuelBand(v: unknown): v is DuelBand {
  return v === 1 || v === 2 || v === 3 || v === 4;
}

/** Полоса по уровню игрока (как TIER_STARTS: 1–4, 5–9, 10–19, 20+). Мусор → 1. */
export function bandOf(level: number): DuelBand {
  if (!(level >= 5)) return 1;
  if (level < 10) return 2;
  if (level < 20) return 3;
  return 4;
}

/** Подпись полосы для карточки бота: «ур. 5–9». */
export const BAND_LEVELS: Record<DuelBand, { from: number; to: number | null }> = {
  1: { from: 1, to: 4 },
  2: { from: 5, to: 9 },
  3: { from: 10, to: 19 },
  4: { from: 20, to: null },
};

/** Диапазон уровней заданий в режимах на время: сложность растёт по набору от min к max. */
export function bandLevels(band: DuelBand): { min: Level; max: Level } {
  switch (band) {
    case 1:
      return { min: 1, max: 2 };
    case 2:
    case 3:
      return { min: 1, max: 3 };
    case 4:
      return { min: 2, max: 3 };
  }
}

/** Лимит на задание уровня level, мс (null — общие часы). */
export function itemLimitMs(mode: DuelModeId, level: Level): number | null {
  const per = DUEL_MODES[mode].perItemMs;
  return per ? per[level - 1] : null;
}

/** Минимальное правдоподобное время ответа по форме, мс (§3): быстрее — «неверно» и флаг. */
export const MIN_MS: Record<DuelShape, number> = { statement: 500, choice: 700 };

/** Допуск часов: сумма времени клиента может превышать прошедшее по серверу на столько, мс. */
export const CLOCK_SLACK_MS = 1_500;

/** Сервер принимает ответы до конца матча + столько, мс; столько же — допуск к сроку задания с лимитом (сеть, пачки). */
export const LATE_GRACE_MS = 3_000;

/** Длительность матча, мс: общие часы режима или сумма лимитов заданий набора. */
export function matchDurationMs(mode: DuelModeId, levels: readonly Level[]): number {
  const m = DUEL_MODES[mode];
  if (m.clockMs != null) return m.clockMs;
  return levels.reduce((s, lv) => s + (itemLimitMs(mode, lv) ?? 0), 0);
}

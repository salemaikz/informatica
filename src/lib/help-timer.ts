// «Нужна помощь?» по времени чтения (этап 16В, P8; ТЗ — docs/specs/stage16c.md, §11).
// Через сколько после показа шага Бит выглядывает и предлагает помощь: оценка времени шага по объёму текста
// и виду действия, порог плашки, часы активного времени и правила «один раз на шаг / не больше 3 за урок».
// Чистая логика без React (тесты — tests/help-timer.test.ts; отчёт по всему курсу — npm run step-times).

import { TICK_CAP_MS } from "./active-time";
import { plainText, tx } from "./text";
import type { ClozeToken, Lang, Level, Scene, Step, Text } from "./types";

// ---------- Параметры (всё в одном месте: владелец может поменять) ----------

/** Скорость чтения учебного текста, слов в секунду. Казахский — медленнее: слова длиннее, термины новее. */
export const READ_WORDS_PER_SEC: Record<Lang, number> = { ru: 3, kk: 2.5 };
/** Формулы, числа и код читаются медленнее обычного текста: такое «слово» весит как два. */
export const HEAVY_WORD_WEIGHT = 2;
/** Множитель к времени шага по уровню: A ×1, B ×1,3, C ×1,6. */
export const LEVEL_FACTOR: Record<Level, number> = { 1: 1, 2: 1.3, 3: 1.6 };
/** Плашка выходит, когда прошло столько ожидаемого времени шага. */
export const HELP_FACTOR = 1.75;
/** Границы порога плашки, мс: не раньше 20 с и не позже 3 минут. */
export const HELP_MIN_MS = 20_000;
export const HELP_MAX_MS = 180_000;
/** Сколько раз за урок или тренировку Бит может предложить помощь. */
export const MAX_HELP_OFFERS = 3;
/** Взгляд на рисунок-схему (картинку без текста), мс. */
const SCENE_GLANCE_MS = 2_500;
/** Условие задачи с кодом лежит в практикуме, не в шаге: на его чтение — фиксированное время, мс. */
const CODE_TASK_READ_MS = 20_000;

/** Время на само действие по виду шага, мс (после чтения): выбор ≈ 6 с, ввод ≈ 12 с, порядок и пары ≈ 15 с, рассказ — 0. */
export const ACTION_MS: Record<Step["type"], number> = {
  choice: 6_000,
  multi: 9_000,
  input: 12_000,
  bits: 12_000,
  ladder: 15_000,
  match: 15_000,
  order: 15_000,
  entmatch: 12_000,
  cloze: 0, // по числу пропусков — clozeActionMs
  solution: 90_000,
  code: 60_000,
  theory: 0,
  story: 0,
  worked: 0,
  video: 0,
  explore: 30_000, // песочница: действие — часть шага
};

/** Время на один пропуск «решаем вместе» (выбор плашки), мс; всего — не меньше 10 и не больше 40 с. */
const CLOZE_BLANK_MS = 5_000;

// ---------- Объём текста ----------

/** «Тяжёлое» слово: число, формула, код (цифры, знаки действий и скобок, подстрочные и надстрочные индексы). */
export function isHeavyToken(token: string): boolean {
  return /[\d=+*/<>()[\]{}_\\|&^%⁰-⁹₀-₉²³¹]/.test(token);
}

/** Вес текста в «обычных словах»: разметка не считается, тяжёлые слова весят вдвое. */
export function textWeight(text: string): number {
  let w = 0;
  for (const token of plainText(text).split(/\s+/)) {
    if (!token) continue;
    w += isHeavyToken(token) ? HEAVY_WORD_WEIGHT : 1;
  }
  return w;
}

/** Вес строки кода: каждый токен — тяжёлый. */
const codeWeight = (line: string): number => line.split(/\s+/).filter(Boolean).length * HEAVY_WORD_WEIGHT;

/** Вес и «пустые» взгляды рисунка: текст сцены читают, а картинку просто разглядывают. */
function sceneParts(scene: Scene | undefined, lang: Lang): { weight: number; glances: number } {
  if (!scene) return { weight: 0, glances: 0 };
  const t = (x: Text | undefined) => (x === undefined ? 0 : textWeight(tx(x, lang)));
  switch (scene.kind) {
    case "code":
      return { weight: scene.lines.reduce((s, line) => s + codeWeight(line), 0) + t(scene.caption), glances: 0 };
    case "table": {
      const cell = (x: Text) => (scene.mono ? codeWeight(tx(x, lang)) : textWeight(tx(x, lang)));
      const head = (scene.columns ?? []).reduce((s, c) => s + cell(c), 0);
      const body = scene.rows.reduce((s, row) => s + row.reduce((a, c) => a + cell(c), 0), 0);
      return { weight: head + body + t(scene.caption), glances: 0 };
    }
    case "message":
      return { weight: t(scene.from) + t(scene.subject) + t(scene.text), glances: 0 };
    case "tape":
      return { weight: scene.cells.length * HEAVY_WORD_WEIGHT * 0.5 + t(scene.caption), glances: 1 };
    default: {
      const caption = "caption" in scene ? (scene.caption as Text | undefined) : undefined;
      return { weight: t(caption), glances: 1 };
    }
  }
}

/** Пропуск «решаем вместе» — не текст, а поле. */
const isBlankToken = (token: ClozeToken): boolean => typeof token === "object" && "blank" in token;

/** Что читают на шаге: вес текста и число взглядов на схему. */
function stepReading(step: Step, lang: Lang): { weight: number; glances: number } {
  const t = (x: Text | undefined) => (x === undefined ? 0 : textWeight(tx(x, lang)));
  const sum = (xs: readonly Text[]) => xs.reduce((s, x) => s + t(x), 0);
  let weight = 0;
  // Схема-условие шага (у теории и ситуации — их сцена, у задания — `scene`) и схемы подшагов разбора.
  const scenes: (Scene | undefined)[] = [step.scene];
  switch (step.type) {
    case "video":
      weight = t(step.title);
      break;
    case "theory":
    case "story":
      weight = t(step.title) + t(step.body);
      break;
    case "worked":
      weight = t(step.title) + step.steps.reduce((s, x) => s + t(x.text), 0) + t(step.result);
      scenes.push(...step.steps.map((x) => x.scene));
      break;
    case "explore":
      weight = t(step.title) + t(step.body) + (step.goal ? t(step.goal.text) : 0);
      break;
    case "choice":
    case "multi":
      weight = t(step.prompt) + sum(step.options);
      break;
    case "input":
    case "bits":
    case "ladder":
    case "solution":
    case "code":
      weight = t(step.prompt);
      break;
    case "match":
      weight = t(step.prompt) + step.pairs.reduce((s, p) => s + t(p.left) + t(p.right), 0);
      break;
    case "order":
      weight = t(step.prompt) + sum(step.items);
      break;
    case "cloze":
      weight = t(step.prompt) + (step.bank ? sum(step.bank) : 0);
      for (const line of step.lines)
        for (const token of line) weight += isBlankToken(token) ? 1 : textWeight(tx(token as Text, lang));
      break;
    case "entmatch":
      weight = t(step.prompt) + sum(step.items) + sum(step.choices);
      break;
  }
  let glances = 0;
  for (const scene of new Set(scenes)) {
    const p = sceneParts(scene, lang);
    weight += p.weight;
    glances += p.glances;
  }
  return { weight, glances };
}

/** Время чтения всего, что на шаге (условие, варианты, подписи, схема, код), мс. */
export function readingMs(step: Step, lang: Lang): number {
  const { weight, glances } = stepReading(step, lang);
  const codeTask = step.type === "code" ? CODE_TASK_READ_MS : 0;
  return Math.round((weight / READ_WORDS_PER_SEC[lang]) * 1000 + glances * SCENE_GLANCE_MS + codeTask);
}

/** Время на действие, мс: по виду шага; «решаем вместе» — по числу пропусков. */
export function actionMs(step: Step): number {
  if (step.type === "cloze") {
    const blanks = step.lines.reduce((n, line) => n + line.filter(isBlankToken).length, 0);
    return Math.min(40_000, Math.max(10_000, blanks * CLOZE_BLANK_MS));
  }
  return ACTION_MS[step.type];
}

/** Множитель уровня A/B/C; уровня нет — как у A. */
export const levelFactor = (level: Level | undefined): number => LEVEL_FACTOR[level ?? 1];

/**
 * Сколько времени шаг занимает у типичного ученика, мс: чтение + действие, умноженные на уровень.
 * `level` не задан — берётся уровень самого шага (у шага-рассказа его нет — ×1).
 */
export function expectedStepMs(step: Step, lang: Lang, level?: Level): number {
  const base = readingMs(step, lang) + actionMs(step);
  return Math.round(base * levelFactor(level ?? step.level));
}

/** Порог плашки по ожидаемому времени: expected × 1,75, не меньше 20 и не больше 180 секунд. */
export function helpAfterMs(expectedMs: number): number {
  return Math.min(HELP_MAX_MS, Math.max(HELP_MIN_MS, Math.round(expectedMs * HELP_FACTOR)));
}

/**
 * Окно ожидания, на которое выставляется порог, мс: время шага; у пошагового разбора — время одного подшага
 * (подшаги открываются по нажатию, и счёт идёт заново после каждого).
 */
export function helpWindowMs(step: Step, lang: Lang, level?: Level): number {
  const expected = expectedStepMs(step, lang, level);
  return step.type === "worked" ? Math.round(expected / Math.max(1, step.steps.length)) : expected;
}

/** Через сколько активного времени на шаге Бит предложит помощь, мс. */
export const stepHelpAfterMs = (step: Step, lang: Lang, level?: Level): number => helpAfterMs(helpWindowMs(step, lang, level));

// ---------- Что предложить ----------

/**
 * Какую помощь предлагает Бит на шаге: «hint» — подсказка к заданию, «simpler» — «объяснить проще» на шаге-рассказе,
 * null — не предлагает (видео: время шага — само видео).
 */
export function helpKindFor(step: Step): "hint" | "simpler" | null {
  switch (step.type) {
    case "video":
      return null;
    case "theory":
    case "story":
    case "worked":
    case "explore":
      return "simpler";
    default:
      return "hint";
  }
}

/**
 * Что предлагает плашка в этом месте плеера. Плеер — урок («Учиться», «Проверить себя») и тренировка: там плашка есть.
 * Тест (мини-тест группы, `testMode`) — нет: до ответа ИИ-помощи там нет, как на ЕНТ. Пробный ЕНТ, тесты по теме и разделу
 * и игры плеер не используют вовсе (там ИИ выключен, решения #17, #20), поэтому до этой функции не доходят.
 */
export function helpKindIn(step: Step | undefined, ctx: { testMode: boolean }): "hint" | "simpler" | null {
  return !step || ctx.testMode ? null : helpKindFor(step);
}

// ---------- Правила показа ----------

/** Можно ли предложить помощь на шаге: не больше трёх раз за урок, один раз на шаг, подсказка на шаге не взята. */
export function canOfferHelp(offered: readonly string[], stepKey: string, helped: boolean): boolean {
  return !helped && offered.length < MAX_HELP_OFFERS && !offered.includes(stepKey);
}

// ---------- Часы шага ----------

/** Часы одного шага: сколько активного времени уже прошло. */
export interface HelpClock {
  elapsed: number;
  last: number;
}

export const startHelpClock = (now: number): HelpClock => ({ elapsed: 0, last: now });

/**
 * Тик: прибавить время с прошлого тика, если часы идут (`running` — вкладка видна и нет паузы: шторка, сцена проводника).
 * Один интервал не длиннее TICK_CAP_MS: спящий ноутбук и притормаживание фоновой вкладки не дают скачка.
 * Это не «часы активности» урока (lib/active-clock.ts): они останавливаются через минуту без касаний, а «долго думаешь» — как раз без касаний.
 */
export function tickHelpClock(c: HelpClock, now: number, running: boolean): HelpClock {
  const dt = Math.max(0, Math.min(TICK_CAP_MS, now - c.last));
  return { last: now, elapsed: running ? c.elapsed + dt : c.elapsed };
}

/** Пора ли показывать плашку. */
export const helpDue = (c: HelpClock, afterMs: number): boolean => c.elapsed >= afterMs;

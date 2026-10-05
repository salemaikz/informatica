import type { EntTopicId, Level, Lesson, QuestionStep, SkillId } from "./types";
import { weakSkills, type SkillStat } from "./mastery";
import { levelFromMastery } from "./ent";
import { bankFor } from "./bank";
import { dueLessons, type LessonStat } from "./review";
import { isQuestion } from "./evaluate";
import { entStepFromRef, isEntRef } from "./ent-steps";
import { MAX_WRONG_PER_ENTRY, openWrong, type HistoryEntry } from "./history";
import { hashString, seeded } from "./text";
import { shuffleOptions } from "./bank/pool";
import { LESSONS, findStep } from "@/content/course";
import {
  CHECK_MIN,
  DRILL_COUNT,
  EXTERN_MAX,
  EXTERN_MIN,
  externLessons,
  hasBank,
  skillsOfLessons,
  skillsOfTopic,
  smartSkills,
} from "./drill-meta";

export * from "./drill-meta";

const uniq = <T,>(a: T[]): T[] => [...new Set(a)];

// Сборка сессий тренировки, «экстерна» и урока игрой. Чистая логика без React (тесты — tests/drill.test.ts).
// Все задания берутся из банка навыков (lib/bank): он же питает уроки, игры и пробный ЕНТ.

// ---------- Сборка заданий из банка ----------

/** Ключ для отсева повторов (как в bank.draw: без хвоста уникальности пула). */
export const stepKey = (step: QuestionStep): string => step.id.split("#")[0].split(":").slice(0, 4).join(":");

const clampLevel = (v: number, min: Level, max: Level): Level => Math.min(max, Math.max(min, v)) as Level;

export interface BankDrillOptions {
  count?: number;
  seed?: number;
  /** Уровни заданий (по умолчанию A…C). */
  minLevel?: Level;
  maxLevel?: Level;
  /** Каждый навык (если их не больше count) встретится минимум один раз. */
  cover?: boolean;
}

/**
 * count заданий из банка по навыкам: слабые встречаются чаще, уровень по освоению навыка,
 * последняя треть — на уровень сложнее; итог отсортирован A → B → C.
 */
export function buildFromBank(skills: SkillId[], stats: Record<string, SkillStat>, opts: BankDrillOptions = {}): QuestionStep[] {
  const count = opts.count ?? DRILL_COUNT;
  const min = opts.minLevel ?? 1;
  const max = opts.maxLevel ?? 3;
  const pool = uniq(skills).filter(hasBank);
  if (!pool.length || count <= 0) return [];
  const rand = seeded(opts.seed ?? Date.now());
  // Вес ~ (1.1 − освоение)²: слабые навыки выпадают в разы чаще освоенных.
  const weights = pool.map((s) => (1.1 - (stats[s]?.mastery ?? 0.5)) ** 2);
  const total = weights.reduce((a, b) => a + b, 0);
  const cover = opts.cover && pool.length <= count ? pool : [];
  const steps: QuestionStep[] = [];
  const seen = new Set<string>();
  let guard = 0;
  let turn = 0;
  while (steps.length < count && guard++ < count * 12) {
    let skill: SkillId;
    if (turn < cover.length) skill = cover[turn];
    else {
      let r = rand() * total;
      let idx = 0;
      while (r > weights[idx] && idx < weights.length - 1) r -= weights[idx++];
      skill = pool[idx];
    }
    turn++;
    const base = levelFromMastery(stats[skill]?.mastery ?? 0);
    const level = clampLevel(base + (steps.length >= Math.ceil((count * 2) / 3) ? 1 : 0), min, max);
    const step = bankFor(skill)!.question(level, Math.floor(rand() * 1e9));
    const key = stepKey(step);
    if (seen.has(key)) continue;
    seen.add(key);
    steps.push(step);
  }
  return sortByLevel(steps);
}

/** Стабильная сортировка по уровню: A, потом B, потом C. */
export function sortByLevel<T extends { level?: Level }>(steps: T[]): T[] {
  return steps
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (a.s.level ?? 1) - (b.s.level ?? 1) || a.i - b.i)
    .map((x) => x.s);
}

// ---------- Умная тренировка и навык ----------

export function buildSmart(lessons: Record<string, LessonStat>, stats: Record<string, SkillStat>, seed: number): QuestionStep[] {
  return buildFromBank(smartSkills(lessons), stats, { seed, count: DRILL_COUNT });
}

/** Любой навык с банком — свободный режим, без замков. */
export function buildSkill(skill: SkillId, stats: Record<string, SkillStat>, seed: number): QuestionStep[] {
  return buildFromBank([skill], stats, { seed, count: DRILL_COUNT });
}

/** 8 заданий по навыкам темы ЕНТ. */
export function buildTopic(topic: EntTopicId, stats: Record<string, SkillStat>, seed: number): QuestionStep[] {
  return buildFromBank(skillsOfTopic(topic), stats, { seed, count: DRILL_COUNT, cover: true });
}

// ---------- Работа над ошибками ----------

export interface MistakeLike {
  stepId: string;
  lessonId?: string;
  skill?: string;
}

/**
 * Исходные задания для работы над ошибками; map — id задания → id ошибки. По очереди пробуем:
 * исходный шаг урока, задание ЕНТ по ссылке «ent:…», свежее задание банка на тот же навык.
 */
export function buildMistakes(
  mistakes: MistakeLike[],
  stats: Record<string, SkillStat>,
  seed: number,
  limit = DRILL_COUNT,
): { steps: QuestionStep[]; map: Record<string, string> } {
  const steps: QuestionStep[] = [];
  const map: Record<string, string> = {};
  mistakes.slice(0, limit).forEach((m, i) => {
    const original = findStep(m.lessonId, m.stepId);
    let step: QuestionStep | undefined = original && isQuestion(original) && original.type !== "solution" ? original : undefined;
    // Задание ЕНТ в работе над ошибками — варианты перемешаны (у части заданий верный вариант стоит первым).
    if (!step && isEntRef(m.stepId)) {
      const ent = entStepFromRef(m.stepId);
      step = ent && shuffleOptions(ent, hashString(m.stepId));
    }
    if (!step && m.skill && hasBank(m.skill)) {
      const lvl = levelFromMastery(stats[m.skill]?.mastery ?? 0);
      step = bankFor(m.skill)!.question(lvl, seed + i);
    }
    if (step && !steps.some((x) => x.id === step!.id)) {
      steps.push(step);
      map[step.id] = m.stepId;
    }
  });
  return { steps, map };
}

/** Работа над ошибками одного теста из истории: только ещё не исправленные ошибки записи. */
export function buildHistoryRedo(
  entry: HistoryEntry,
  stats: Record<string, SkillStat>,
  seed: number,
): { steps: QuestionStep[]; map: Record<string, string> } {
  return buildMistakes(openWrong(entry), stats, seed, MAX_WRONG_PER_ENTRY);
}

// ---------- Повторение (разминка) ----------

export interface ReviewSession {
  steps: QuestionStep[];
  /** Уроки, чьи навыки вошли в разминку: по итогам сдвигаем их расписание повторения. */
  lessons: string[];
  /** Нечего повторять — собрана умная тренировка. */
  fallback: boolean;
}

/**
 * Разминка: навыки уроков, которые пора повторить (от самых «остывших»), плюс до двух слабых навыков.
 * Каждый навык разминки получает минимум одно задание. Если повторять нечего — умная тренировка.
 */
export function buildReview(
  lessons: Record<string, LessonStat>,
  stats: Record<string, SkillStat>,
  now: number,
  seed: number,
  count = DRILL_COUNT,
): ReviewSession {
  const pool = new Set<SkillId>();
  const picked: string[] = [];
  for (const { id } of dueLessons(lessons, now)) {
    const sk = skillsOfLessons([id]);
    if (!sk.length) continue;
    const extra = sk.filter((s) => !pool.has(s));
    // Навыки урока должны поместиться в разминку целиком (иначе точность по уроку нечестна). Первый урок — всегда.
    if (picked.length && pool.size + extra.length > count) continue;
    extra.forEach((s) => pool.add(s));
    picked.push(id);
  }
  let weakAdded = 0;
  for (const s of weakSkills(stats)) {
    if (weakAdded >= 2 || pool.size >= count) break;
    if (hasBank(s) && !pool.has(s)) {
      pool.add(s);
      weakAdded++;
    }
  }
  if (!pool.size) return { steps: buildSmart(lessons, stats, seed), lessons: [], fallback: true };
  const steps = buildFromBank([...pool], stats, { seed, count, cover: true });
  return { steps, lessons: picked, fallback: false };
}

export interface ExternSession {
  steps: QuestionStep[];
  /** Уроки, которые засчитаем при зачёте: только те, чьи навыки все попали в задания. */
  lessons: string[];
}

/**
 * По 2 задания уровня B–C на навык (если навыков больше 6 — по одному), всего до 12;
 * если навыков мало — больше заданий на навык, чтобы набрать минимум 6.
 * Навыки сверх 12 в задания не попадают — их уроки экстерн не засчитывает (иначе урок засчитался бы без проверки).
 */
export function buildExternSession(unitId: string | undefined, done: Record<string, LessonStat>, seed: number): ExternSession {
  const candidates = externLessons(unitId, done);
  const skills = skillsOfLessons(candidates).slice(0, EXTERN_MAX);
  if (!skills.length) return { steps: [], lessons: [] };
  const per = skills.length * 2 <= EXTERN_MAX ? Math.max(2, Math.ceil(EXTERN_MIN / skills.length)) : 1;
  const rand = seeded(seed);
  const steps: QuestionStep[] = [];
  const seen = new Set<string>();
  skills.forEach((skill, si) => {
    for (let j = 0; j < per; j++) {
      // Несколько заданий на навык: B, C, B, …; одно — по очереди B / C.
      const level: Level = per >= 2 ? ((2 + (j % 2)) as Level) : ((2 + (si % 2)) as Level);
      for (let attempt = 0; attempt < 8; attempt++) {
        const step = bankFor(skill)!.question(level, Math.floor(rand() * 1e9));
        const key = stepKey(step);
        if (seen.has(key)) continue;
        seen.add(key);
        steps.push(step);
        break;
      }
    }
  });
  const tested = new Set(steps.map((s) => s.skill));
  const lessons = candidates.filter((id) => LESSONS[id].skills.every((s) => tested.has(s)));
  return { steps: sortByLevel(steps), lessons };
}

/** Только задания экстерна (см. buildExternSession). */
export function buildExtern(unitId: string | undefined, done: Record<string, LessonStat>, seed: number): QuestionStep[] {
  return buildExternSession(unitId, done, seed).steps;
}

// ---------- Проверка себя (урок в режиме check) ----------

/**
 * «Проверить себя»: только задания урока (порядок A → B → C); если их меньше CHECK_MIN — добираем из банка навыков урока.
 */
export function buildCheck(lesson: Lesson, seed: number, minCount = CHECK_MIN): QuestionStep[] {
  const own = sortByLevel(lesson.steps.filter(isQuestion));
  if (own.length >= minCount) return own;
  const have = new Set(own.map(stepKey));
  const skills = lesson.skills.filter(hasBank);
  const extra: QuestionStep[] = [];
  const rand = seeded(seed);
  let guard = 0;
  while (own.length + extra.length < minCount && skills.length && guard++ < minCount * 12) {
    const skill = skills[Math.floor(rand() * skills.length)];
    const level = (1 + Math.floor(rand() * 3)) as Level;
    const step = bankFor(skill)!.question(level, Math.floor(rand() * 1e9));
    const key = stepKey(step);
    if (have.has(key)) continue;
    have.add(key);
    extra.push(step);
  }
  return sortByLevel([...own, ...extra]);
}

import type { AnswerRecord, EntTopicId, Level, Lesson, QuestionStep, SkillId, Unit } from "./types";
import { weakSkills, type SkillStat } from "./mastery";
import { levelFromMastery } from "./ent";
import { bankFor, hasShape, skillsWithShape } from "./bank";
import { dueLessons, type LessonStat } from "./review";
import { isQuestion } from "./evaluate";
import { entStepFromRef, isEntRef } from "./ent-steps";
import { MAX_WRONG_PER_ENTRY, openWrong, type HistoryEntry } from "./history";
import { hashString, seeded } from "./text";
import { shuffleOptions } from "./bank/pool";
import { LESSONS, UNITS, findStep } from "@/content/course";
import { SKILLS } from "@/content/skills";
import type { GameMeta } from "@/games/types";
import { collectWorked } from "@/games/build/logic";

// Сборка сессий тренировки, «экстерна» и урока игрой. Чистая логика без React (тесты — tests/drill.test.ts).
// Все задания берутся из банка навыков (lib/bank): он же питает уроки, игры и пробный ЕНТ.

/**
 * history — работа над ошибками одного теста из истории (/drill?mode=history&entry=<id>).
 * Этап 14: practice / minitest — узел «Практика» группы (&node=practice:<урок>), recap — «Повторение» раздела (&unit=u3),
 * context — контекстное задание практикума (&item=<id задания ЕНТ>).
 * Этап 15: codeview — «Чтение кода» как на ЕНТ (&area=py|db|sql|sheet|web|mix, lib/code-review-drill.ts).
 */
export type DrillMode = "smart" | "mistakes" | "skill" | "review" | "extern" | "topic" | "history" | "practice" | "recap" | "minitest" | "context" | "codeview";

const MODES: readonly DrillMode[] = ["smart", "mistakes", "skill", "review", "extern", "topic", "history", "practice", "recap", "minitest", "context", "codeview"];

/** Режим из адреса; неизвестный — «умная тренировка». */
export function parseDrillMode(v: unknown): DrillMode {
  return typeof v === "string" && (MODES as readonly string[]).includes(v) ? (v as DrillMode) : "smart";
}

/** Режим урока из адреса: check — «Проверить себя»; всё остальное — learn. */
export function parseLessonMode(v: unknown): "learn" | "check" {
  return v === "check" ? "check" : "learn";
}

/** Первое значение параметра адреса (Next отдаёт строку или массив). */
export function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Сколько заданий в обычной тренировке и разминке. */
export const DRILL_COUNT = 8;
/** «Экстерн»: порог зачёта раздела и максимум заданий. */
export const EXTERN_PASS = 0.8;
export const EXTERN_MAX = 12;
/** «Экстерн»: минимум заданий — раздел не засчитывается за 2 угаданных ответа. */
export const EXTERN_MIN = 6;
/** Урок игрой: порог зачёта урока (доля верных) и минимум ответов (2 из 2 — ещё не урок). */
export const GAME_PASS = 0.7;
export const GAME_MIN_TOTAL = 5;
/** Проверка себя: минимум заданий (добираем из банка). */
export const CHECK_MIN = 6;

/** Множитель XP для показа: 0.5 → «0,5» (и по-русски, и по-казахски — запятая). */
export function formatFactor(f: number): string {
  return String(Math.round(f * 100) / 100).replace(".", ",");
}

// ---------- Навыки и уроки ----------

/** У навыка есть банк заданий (его можно тренировать). */
export const hasBank = (skill: SkillId): boolean => !!bankFor(skill);

/** Все навыки, у которых есть банк. */
export function bankSkillIds(): SkillId[] {
  return SKILLS.filter((s) => hasBank(s.id)).map((s) => s.id);
}

const uniq = <T,>(a: T[]): T[] => [...new Set(a)];
const isDone = (st: LessonStat | undefined): boolean => (st?.completions ?? 0) > 0;

/** Навыки уроков (только с банком), без повторов. */
export function skillsOfLessons(lessonIds: string[]): SkillId[] {
  return uniq(lessonIds.flatMap((id) => LESSONS[id]?.skills ?? [])).filter(hasBank);
}

/** Готовые уроки раздела (в порядке курса). */
export function readyLessons(unit: Unit | undefined): Lesson[] {
  if (!unit) return [];
  return unit.lessons.filter((r) => r.status === "available" && LESSONS[r.id]).map((r) => LESSONS[r.id]);
}

export const unitById = (id: string | undefined): Unit | undefined => UNITS.find((u) => u.id === id);

/** Навыки темы ЕНТ (только с банком). */
export function skillsOfTopic(topic: EntTopicId): SkillId[] {
  return SKILLS.filter((s) => s.ent === topic && hasBank(s.id)).map((s) => s.id);
}

/** Раздел, к которому относится навык: по готовым урокам, затем по теме ЕНТ, иначе последний раздел. */
export function unitOfSkill(skill: SkillId): Unit {
  const byLesson = UNITS.find((u) => readyLessons(u).some((l) => l.skills.includes(skill)));
  if (byLesson) return byLesson;
  const ent = SKILLS.find((s) => s.id === skill)?.ent;
  const byTopic = ent ? UNITS.find((u) => u.entTopics?.includes(ent)) : undefined;
  return byTopic ?? UNITS[UNITS.length - 1];
}

export interface UnitSkills {
  unit: Unit;
  skills: { id: SkillId; hasBank: boolean }[];
}

/**
 * Навык только школьных уроков (этап 15): без темы ЕНТ и ни в одном готовом уроке карты ЕНТ. В разделах курса ЕНТ
 * его не показываем (он попал бы в последний раздел «Как решать ЕНТ»); его тренируют со школьной карты.
 */
export function isSchoolOnlySkill(skill: SkillId): boolean {
  if (SKILLS.find((s) => s.id === skill)?.ent) return false;
  if (UNITS.some((u) => readyLessons(u).some((l) => l.skills.includes(skill)))) return false;
  return Object.values(LESSONS).some((l) => l.school && l.skills.includes(skill));
}

/** Навыки, сгруппированные по разделам курса (пустые разделы не возвращаются; навыки только школьных уроков — нет). */
export function skillsByUnit(): UnitSkills[] {
  const groups = new Map<string, UnitSkills>(UNITS.map((u) => [u.id, { unit: u, skills: [] }]));
  for (const s of SKILLS) {
    if (isSchoolOnlySkill(s.id)) continue;
    groups.get(unitOfSkill(s.id).id)?.skills.push({ id: s.id, hasBank: hasBank(s.id) });
  }
  return [...groups.values()].filter((g) => g.skills.length > 0);
}

/** Следующий готовый урок курса после текущего: сначала ещё не пройденный, иначе просто следующий. Null — урок последний. */
export function nextLessonId(lessonId: string, done: Record<string, LessonStat> = {}): string | null {
  // Школьный урок (этап 15) — не на карте ЕНТ: «следующий урок» с карты ЕНТ увёл бы школьника в ЕНТ.
  if (LESSONS[lessonId]?.school) return null;
  const ready = UNITS.flatMap((u) => u.lessons).filter((r) => r.status === "available" && LESSONS[r.id]);
  const idx = ready.findIndex((r) => r.id === lessonId);
  const after = idx >= 0 ? ready.slice(idx + 1) : ready;
  const fresh = after.find((r) => !isDone(done[r.id]));
  return (fresh ?? after[0])?.id ?? null;
}

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

/** Навыки для «умной» тренировки: по пройденным урокам, а если их нет — по навыкам первого раздела. */
export function smartSkills(lessons: Record<string, LessonStat>): SkillId[] {
  const own = skillsOfLessons(Object.keys(lessons).filter((id) => isDone(lessons[id])));
  if (own.length) return own;
  for (const u of UNITS) {
    const sk = skillsOfLessons(readyLessons(u).map((l) => l.id));
    if (sk.length) return sk;
  }
  return bankSkillIds();
}

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

/** Точность (0..1) по заданиям навыков каждого урока (только первые попытки). Уроки без ответов не возвращаются. */
export function lessonAccuracies(answers: AnswerRecord[], lessonIds: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const first = answers.filter((a) => !a.retry && a.skill);
  for (const id of lessonIds) {
    const skills = new Set<string>(LESSONS[id]?.skills ?? []);
    const rel = first.filter((a) => skills.has(a.skill!));
    if (rel.length) out[id] = rel.reduce((s, a) => s + a.score, 0) / rel.length;
  }
  return out;
}

// ---------- «Сдать экстерном» ----------

/** Уроки раздела, которые экстерн засчитает: готовые, ещё не пройденные, и все их навыки есть в банке. */
export function externLessons(unitId: string | undefined, done: Record<string, LessonStat>): string[] {
  return readyLessons(unitById(unitId))
    .filter((l) => !isDone(done[l.id]) && l.skills.length > 0 && l.skills.every(hasBank))
    .map((l) => l.id);
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

/** С какого урока начать, если экстерн не сдан: первый готовый непройденный урок раздела. */
export function externStartLesson(unitId: string | undefined, done: Record<string, LessonStat>): string | undefined {
  return readyLessons(unitById(unitId)).find((l) => !isDone(done[l.id]))?.id;
}

export const externPassed = (accuracy: number): boolean => accuracy >= EXTERN_PASS;

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

// ---------- Урок игрой ----------

export interface GameContext {
  lessonId?: string;
  skills: SkillId[];
}

const MAX_CONTEXT_SKILLS = 12;

/**
 * Контекст из адреса `/game/<id>?lesson=<урок>` или `?skills=a,b`: параметры — недоверенные, берём только известное.
 * Урок задаёт навыки сам; список навыков без урока — тренировка по теме (без зачёта урока).
 */
export function resolveGameContext(p: { lesson?: string; skills?: string }): GameContext {
  const lesson = p.lesson && LESSONS[p.lesson] ? LESSONS[p.lesson] : undefined;
  if (lesson) return { lessonId: lesson.id, skills: lesson.skills.slice(0, MAX_CONTEXT_SKILLS) };
  const known = new Set(SKILLS.map((s) => s.id));
  const skills = uniq((p.skills ?? "").split(",").map((s) => s.trim()).filter((s) => known.has(s))).slice(0, MAX_CONTEXT_SKILLS);
  return { skills };
}

type GameLike = Pick<GameMeta, "shape" | "skills" | "source">;

/** Навыки, по которым в уроках есть пошаговые разборы для игры «Собери решение». */
export function skillsWithWorked(skills: SkillId[]): SkillId[] {
  return skills.filter((s) => collectWorked([s]).length > 0);
}

/** Навыки, которые игра реально возьмёт: универсальная — любые с нужной формой, остальные — только свои. */
export function gameSkillsFor(meta: GameLike, skills: SkillId[]): SkillId[] {
  if (meta.shape) return skillsWithShape(skills, meta.shape);
  if (meta.source === "worked") return skillsWithWorked(skills);
  return skills.filter((s) => meta.skills.includes(s) && hasBank(s));
}

/** Игра подходит под эти навыки (есть что играть). Без навыков — всегда да (игра берёт свои). */
export function gameSupportsSkills(meta: GameLike, skills: SkillId[]): boolean {
  if (!skills.length) return true;
  return gameSkillsFor(meta, skills).length > 0;
}

/** Игра открыта на странице «Тренировка»: у её навыков (или у навыков пройденных уроков) есть нужная форма. */
export function gameOpen(meta: GameLike, completedSkills: SkillId[]): boolean {
  if (meta.source === "worked") return true;
  if (meta.shape) {
    const shape = meta.shape;
    return [...meta.skills, ...completedSkills].some((s) => hasShape(s, shape));
  }
  return meta.skills.some(hasBank);
}

/** Игра засчитывает урок: ответов не меньше GAME_MIN_TOTAL и доля верных ≥ 70%. */
export function gamePassed(correct: number, total: number): boolean {
  return total >= GAME_MIN_TOTAL && correct / total >= GAME_PASS;
}

/** Игра пишет урок в прогресс: урок ещё не пройден или пора повторить (иначе игра «накручивала» бы счётчик прохождений). */
export function gameCanCredit(stat: LessonStat | undefined, now: number = Date.now()): boolean {
  if (!stat || stat.completions <= 0) return true;
  return stat.dueAt !== undefined && now >= stat.dueAt;
}

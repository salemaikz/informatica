import type { AnswerRecord, EntTopicId, LessonMeta, SkillId, Unit } from "./types";
import type { LessonStat } from "./review";
import { LESSON_META, hasBank, hasShape, lessonMeta, skillsWithShape, skillsWithWorked } from "@/content/catalog";
import { UNITS } from "@/content/course-map";
import { isSchoolSkill, SKILLS } from "@/content/skills";
import type { GameMeta } from "@/games/types";

// Лёгкая часть тренировки (этап 16, скорость): режимы и параметры адреса, пороги, навыки уроков и разделов, правила игр.
// Без банков заданий и содержимого уроков — её можно импортировать на карте, в «Практике», профиле и меню.
// Сборка заданий (банк, уроки, задания ЕНТ) — lib/drill.ts; он реэкспортирует всё отсюда.

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

/** У навыка есть банк заданий (его можно тренировать). Лёгкая проверка по каталогу (этап 16). */
export { hasBank };

/** Все навыки, у которых есть банк. */
export function bankSkillIds(): SkillId[] {
  return SKILLS.filter((s) => hasBank(s.id)).map((s) => s.id);
}

const uniq = <T,>(a: T[]): T[] => [...new Set(a)];
const isDone = (st: LessonStat | undefined): boolean => (st?.completions ?? 0) > 0;

/** Навыки уроков (только с банком), без повторов. */
export function skillsOfLessons(lessonIds: string[]): SkillId[] {
  return uniq(lessonIds.flatMap((id) => LESSON_META[id]?.skills ?? [])).filter(hasBank);
}

/** Готовые уроки раздела (в порядке курса). */
export function readyLessons(unit: Unit | undefined): LessonMeta[] {
  if (!unit) return [];
  return unit.lessons.filter((r) => r.status === "available" && LESSON_META[r.id]).map((r) => LESSON_META[r.id]);
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

/** Навыки, сгруппированные по разделам курса (пустые разделы не возвращаются; навыки только школьных уроков — нет). */
export function skillsByUnit(): UnitSkills[] {
  const groups = new Map<string, UnitSkills>(UNITS.map((u) => [u.id, { unit: u, skills: [] }]));
  for (const s of SKILLS) {
    // Навык школьного урока (этап 15) — не раздел курса ЕНТ: иначе он попал бы в последний раздел «Как решать ЕНТ».
    if (isSchoolSkill(s.id)) continue;
    groups.get(unitOfSkill(s.id).id)?.skills.push({ id: s.id, hasBank: hasBank(s.id) });
  }
  return [...groups.values()].filter((g) => g.skills.length > 0);
}

/** Следующий готовый урок курса после текущего: сначала ещё не пройденный, иначе просто следующий. Null — урок последний. */
export function nextLessonId(lessonId: string, done: Record<string, LessonStat> = {}): string | null {
  // Школьный урок (этап 15) — не на карте ЕНТ: «следующий урок» с карты ЕНТ увёл бы школьника в ЕНТ.
  if (LESSON_META[lessonId]?.school) return null;
  const ready = UNITS.flatMap((u) => u.lessons).filter((r) => r.status === "available" && LESSON_META[r.id]);
  const idx = ready.findIndex((r) => r.id === lessonId);
  const after = idx >= 0 ? ready.slice(idx + 1) : ready;
  const fresh = after.find((r) => !isDone(done[r.id]));
  return (fresh ?? after[0])?.id ?? null;
}

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

/** Точность (0..1) по заданиям навыков каждого урока (только первые попытки). Уроки без ответов не возвращаются. */
export function lessonAccuracies(answers: AnswerRecord[], lessonIds: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const first = answers.filter((a) => !a.retry && a.skill);
  for (const id of lessonIds) {
    const skills = new Set<string>(LESSON_META[id]?.skills ?? []);
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

/** С какого урока начать, если экстерн не сдан: первый готовый непройденный урок раздела. */
export function externStartLesson(unitId: string | undefined, done: Record<string, LessonStat>): string | undefined {
  return readyLessons(unitById(unitId)).find((l) => !isDone(done[l.id]))?.id;
}

export const externPassed = (accuracy: number): boolean => accuracy >= EXTERN_PASS;

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
  const lesson = p.lesson ? lessonMeta(p.lesson) : undefined;
  if (lesson) return { lessonId: lesson.id, skills: lesson.skills.slice(0, MAX_CONTEXT_SKILLS) };
  const known = new Set(SKILLS.map((s) => s.id));
  const skills = uniq((p.skills ?? "").split(",").map((s) => s.trim()).filter((s) => known.has(s))).slice(0, MAX_CONTEXT_SKILLS);
  return { skills };
}

type GameLike = Pick<GameMeta, "shape" | "skills" | "source">;

/** Навыки, по которым в уроках есть пошаговые разборы для игры «Собери решение». */
export { skillsWithWorked };

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

import type { AnswerRecord, EntItem, Level, QuestionStep, SkillId } from "./types";
import type { SkillStat } from "./mastery";
import type { LessonStat } from "./review";
import { COURSE_GROUPS, type CourseGroup } from "@/content/groups";
import { LESSONS } from "@/content/course";
import { ENT_POOL } from "@/content/ent";
import { buildFromBank, skillsOfLessons, sortByLevel, stepKey } from "./drill";
import { entRef, entStepFromRef } from "./ent-steps";
import { shuffleEntItem } from "./exam";
import { seeded, shuffle } from "./text";

// Практика после группы и повторение раздела собираются кодом из банков: 50% текущая группа (раздел),
// 30% три предыдущие группы, 20% всё с начала курса; слабые и давние навыки — чаще (#46, #81).
// Прошлые навыки берём только «тронутые» (ученик уже решал их или проходил урок с ними).
// stats — уже с затуханием (decaySkills): давно не тренированные навыки выглядят слабее и выпадают чаще.
// Чистая логика без React (тесты — tests/course-mix.test.ts).

/** Заданий в «Практике», «Повторении» и мини-тесте. */
export const PRACTICE_COUNT = 12;
export const RECAP_COUNT = 15;
export const MINITEST_COUNT = 6;
/** В мини-тесте меньше стольких заданий ЕНТ быть не может — тогда мини-теста нет. */
export const MINITEST_MIN = 3;
/** Сколько групп перед текущей считаются «недавними». */
export const RECENT_GROUPS = 3;

// ---------- Доли «текущее / недавнее / давнее» ----------

export interface MixSets {
  /** Навыки текущей группы (раздела): тронутые и нет. */
  current: SkillId[];
  /** Навыки трёх групп перед ней — только тронутые. */
  recent: SkillId[];
  /** Навыки всего, что раньше, — только тронутые. */
  old: SkillId[];
}

export interface MixCounts {
  current: number;
  recent: number;
  old: number;
}

/** Доли без учёта пустых наборов: давние 20%, недавние 30%, текущая — остальное (12 → 2/4/6, 15 → 3/5/7). */
export function mixShares(n: number): MixCounts {
  const old = Math.round(0.2 * n);
  const recent = Math.round(0.3 * n);
  return { old, recent, current: n - old - recent };
}

/** Доли с перераспределением: пустой набор отдаёт долю следующему (давние → недавние → текущая); текущей нет — заданий нет. */
export function mixCounts(n: number, sets: MixSets): MixCounts {
  if (!sets.current.length) return { current: 0, recent: 0, old: 0 };
  const s = mixShares(n);
  let { old, recent, current } = s;
  if (!sets.old.length) {
    recent += old;
    old = 0;
  }
  if (!sets.recent.length) {
    current += recent;
    recent = 0;
  }
  return { current, recent, old };
}

/** Навык «тронут»: по нему есть попытки или пройден (запись в `lessons`) урок с этим навыком. */
export function touchedSkills(lessons: Record<string, LessonStat>, stats: Record<string, SkillStat>): Set<SkillId> {
  const out = new Set<SkillId>();
  for (const [id, st] of Object.entries(stats)) if ((st?.attempts ?? 0) > 0) out.add(id);
  for (const id of Object.keys(lessons)) for (const s of LESSONS[id]?.skills ?? []) out.add(s);
  return out;
}

const skillsOfGroups = (groups: readonly CourseGroup[]): SkillId[] => skillsOfLessons(groups.flatMap((g) => g.lessons));

/** Три набора навыков для группы(п) на позиции firstIdx в порядке курса. */
function setsFor(current: readonly CourseGroup[], firstIdx: number, lessons: Record<string, LessonStat>, stats: Record<string, SkillStat>): MixSets {
  const touched = touchedSkills(lessons, stats);
  const cur = skillsOfGroups(current);
  const curSet = new Set(cur);
  const from = Math.max(0, firstIdx - RECENT_GROUPS);
  const recent = skillsOfGroups(COURSE_GROUPS.slice(from, Math.max(0, firstIdx))).filter((s) => touched.has(s) && !curSet.has(s));
  const recentSet = new Set(recent);
  const old = skillsOfGroups(COURSE_GROUPS.slice(0, from)).filter((s) => touched.has(s) && !curSet.has(s) && !recentSet.has(s));
  return { current: cur, recent, old };
}

/** Собрать n заданий по трём наборам: доли → buildFromBank → без повторов → A → C. */
function assemble(sets: MixSets, stats: Record<string, SkillStat>, n: number, seed: number): QuestionStep[] {
  const c = mixCounts(n, sets);
  const parts = [
    c.current ? buildFromBank(sets.current, stats, { count: c.current, seed, cover: true }) : [],
    c.recent ? buildFromBank(sets.recent, stats, { count: c.recent, seed: seed + 1 }) : [],
    c.old ? buildFromBank(sets.old, stats, { count: c.old, seed: seed + 2 }) : [],
  ];
  const out: QuestionStep[] = [];
  const seenId = new Set<string>();
  const seenKey = new Set<string>();
  const push = (s: QuestionStep) => {
    const key = stepKey(s);
    if (out.length >= n || seenId.has(s.id) || seenKey.has(key)) return;
    seenId.add(s.id);
    seenKey.add(key);
    out.push(s);
  };
  // Порознь собранные доли перемешиваем «по кругу»: внутри уровня текущее, недавнее и давнее чередуются.
  const longest = Math.max(0, ...parts.map((p) => p.length));
  for (let i = 0; i < longest; i++) for (const p of parts) if (p[i]) push(p[i]);
  // Банк не дал нужного числа разных заданий (редкие мелкие банки) — добираем по текущей теме.
  for (let k = 0; out.length < n && k < 4 && sets.current.length; k++) {
    for (const s of buildFromBank(sets.current, stats, { count: n - out.length + 4, seed: seed + 10 + k })) push(s);
  }
  return sortByLevel(out);
}

// ---------- Практика и повторение ----------

/** «Практика» после группы уроков. */
export function buildPractice(group: CourseGroup, lessons: Record<string, LessonStat>, stats: Record<string, SkillStat>, seed: number): QuestionStep[] {
  const idx = Math.max(0, COURSE_GROUPS.findIndex((g) => g.id === group.id));
  return assemble(setsFor([group], idx, lessons, stats), stats, PRACTICE_COUNT, seed);
}

/** «Повторение» в конце раздела unitId: текущий раздел 50%, три группы перед ним 30%, всё раньше 20%. */
export function buildRecap(unitId: string, lessons: Record<string, LessonStat>, stats: Record<string, SkillStat>, seed: number): QuestionStep[] {
  const groups = COURSE_GROUPS.filter((g) => g.unitId === unitId);
  if (!groups.length) return [];
  const first = COURSE_GROUPS.indexOf(groups[0]);
  return assemble(setsFor(groups, first, lessons, stats), stats, RECAP_COUNT, seed);
}

// ---------- Мини-тест ----------

/** Задания ЕНТ навыков группы, кроме контекстных (у них 5 вопросов — для мини-теста слишком длинно). */
export function miniTestPool(group: Pick<CourseGroup, "lessons">): EntItem[] {
  const skills = new Set(group.lessons.flatMap((id) => LESSONS[id]?.skills ?? []));
  return ENT_POOL.filter((i) => i.kind !== "context" && skills.has(i.skill));
}

/** В группе хватает заданий ЕНТ для мини-теста (в листе практики кнопка «Мини-тест»). */
export const hasMiniTest = (group: Pick<CourseGroup, "lessons">): boolean => miniTestPool(group).length >= MINITEST_MIN;

type MiniKind = "single" | "multi" | "match";

/** Ближайший к level неиспользованный элемент: тот же уровень, затем −1, +1, −2, +2. */
function nearest<T extends { level: Level }>(items: readonly T[], used: ReadonlySet<T>, level: number): T | undefined {
  for (const d of [0, -1, 1, -2, 2]) {
    const found = items.find((x) => !used.has(x) && x.level === level + d);
    if (found) return found;
  }
  return undefined;
}

/**
 * 6 заданий ЕНТ из пула в настоящем формате: 4 single + 1 multi + 1 match (чего не хватает — добираем single);
 * уровни по возможности 3 A + 2 B + 1 C. Выбор детерминирован по seed. Меньше MINITEST_MIN — [].
 */
export function pickMiniTest(pool: readonly EntItem[], seed: number): QuestionStep[] {
  const items = pool.filter((i) => i.kind !== "context");
  if (items.length < MINITEST_MIN) return [];
  const rand = seeded(seed);
  const by: Record<MiniKind, EntItem[]> = { single: [], multi: [], match: [] };
  for (const i of shuffle(items, rand)) by[i.kind as MiniKind].push(i);
  const hasMulti = by.multi.length > 0;
  const hasMatch = by.match.length > 0;
  // Уровни: multi — C, match — B, остальное (A A A B [C]) — single.
  const rest: number[] = [1, 1, 1, 2, 2, 3];
  const take = (v: number) => rest.splice(rest.indexOf(v), 1);
  if (hasMulti) take(3);
  if (hasMatch) take(2);
  const slots: { kind: MiniKind; level: number }[] = rest.map((level) => ({ kind: "single", level }));
  if (hasMatch) slots.push({ kind: "match", level: 2 });
  if (hasMulti) slots.push({ kind: "multi", level: 3 });

  const used = new Set<EntItem>();
  const picked: EntItem[] = [];
  for (const slot of slots) {
    const item = nearest(by[slot.kind], used, slot.level);
    if (!item) continue;
    used.add(item);
    picked.push(item);
  }
  // Не хватило single — добираем чем есть (сначала лёгкое).
  const target = Math.min(MINITEST_COUNT, items.length);
  if (picked.length < target) {
    for (const item of [...items].sort((a, b) => a.level - b.level)) {
      if (picked.length >= target) break;
      if (used.has(item)) continue;
      used.add(item);
      picked.push(item);
    }
  }

  const steps: QuestionStep[] = [];
  for (const item of picked) {
    // Варианты перемешиваем (в пуле верный вариант чаще стоит первым), id шага остаётся ссылкой ent:<id>.
    const step = entStepFromRef(entRef(item.id), [shuffleEntItem(item, seed)]);
    if (!step) continue;
    // Это тест — подсказок нет.
    const test = { ...step };
    delete test.hint;
    steps.push(test);
  }
  return sortByLevel(steps);
}

/** Мини-тест группы: задания ЕНТ навыков группы в настоящем формате (single, multi на 6, «соответствие» 2×4). */
export function buildMiniTest(group: CourseGroup, seed: number): QuestionStep[] {
  return pickMiniTest(miniTestPool(group), seed);
}

// ---------- Итог мини-теста ----------

/** Максимум баллов за задание, как на ЕНТ: «несколько верных» и «соответствие» — 2, остальное — 1. */
export const stepMaxPoints = (step: Pick<QuestionStep, "type">): number => (step.type === "multi" || step.type === "entmatch" ? 2 : 1);

type ScoredAnswer = Pick<AnswerRecord, "stepId" | "score"> & Partial<Pick<AnswerRecord, "retry" | "skipped" | "skill">>;

/** Баллы «как на ЕНТ» по первым попыткам: балл = оценка × максимум задания (пропуск и отсутствие ответа — 0). */
export function miniTestPoints(steps: readonly QuestionStep[], answers: readonly ScoredAnswer[]): { points: number; max: number } {
  const first = new Map<string, ScoredAnswer>();
  for (const a of answers) if (!a.retry && !first.has(a.stepId)) first.set(a.stepId, a);
  let points = 0;
  let max = 0;
  for (const s of steps) {
    const m = stepMaxPoints(s);
    max += m;
    const a = first.get(s.id);
    if (a && !a.skipped) points += Math.round(Math.max(0, Math.min(1, a.score)) * m);
  }
  return { points, max };
}

/** Слабое место мини-теста: навык, на котором потеряно больше всего (при равенстве — тот, что встретился раньше). Без ошибок — undefined. */
export function weakestSkill(answers: readonly ScoredAnswer[]): SkillId | undefined {
  const lost = new Map<SkillId, number>();
  const seen = new Set<string>();
  for (const a of answers) {
    if (a.retry || a.skipped || !a.skill || seen.has(a.stepId)) continue;
    seen.add(a.stepId);
    const miss = 1 - Math.max(0, Math.min(1, a.score));
    if (miss > 0) lost.set(a.skill, (lost.get(a.skill) ?? 0) + miss);
  }
  let best: SkillId | undefined;
  let bestLost = 0;
  for (const [skill, v] of lost) {
    if (v > bestLost) {
      best = skill;
      bestLost = v;
    }
  }
  return best;
}

import type { Grade, Track } from "./types";
import { SCHOOL_PROGRAM, type SchoolGrade, type SchoolGradePlan, type SchoolSection, type SchoolTopic } from "@/content/school-program";

// Школьный трек: прогресс по классу, следующий урок, проверка данных программы.
// Чистая логика без React; данные — content/school-program.ts. Урок «пройден», если у него есть хотя бы одно завершение.
// Прогресс ОБЩИЙ с подготовкой к ЕНТ (v0.9.1): у школьной карты и у карты курса («Путь», «Карта ЕНТ») один источник —
// `lessons` и `skills` стора, ключи — id уроков курса, а `profile.track` на них не влияет. Урок, пройденный в одном
// режиме, пройден в обоих; «пройден» везде определяет `isPassedStat` (components/learn/map.ts тоже зовёт её).
// Тест: tests/school.test.ts, «общий прогресс школы и ЕНТ».

/** Режим обучения в контексте ИИ (расширяет StudentContext, пока поле не добавлено в lib/ai-types.ts). */
export interface WithTrack {
  track: Track;
}

export const SCHOOL_GRADES: SchoolGrade[] = ["5", "6", "7", "8", "9", "10", "11"];

/**
 * Единая точка решения (#52): показывать ли ЕНТ-элементы — пробный ЕНТ, цель по баллу и прогноз, план подготовки,
 * «до ЕНТ N дней». Ученик школьного трека их не видит. Профиль без трека (старое сохранение) считается «ЕНТ».
 * Все экраны и меню спрашивают это здесь, а не сравнивают `track` у себя.
 */
export function entVisible(profile: { track?: Track } | null | undefined): boolean {
  return profile?.track !== "school";
}

/**
 * Разделы только для подготовки к ЕНТ: в школьном треке на них — карточка «Переключиться на ЕНТ» (components/school/EntOnly).
 * `/exam/run` — прохождение пробного (вне оболочки приложения, страж с `fullscreen`); результаты старых попыток
 * `/exam/result/[id]` остаются доступны. Тест tests/school-ent-ui.test.ts проверяет, что на странице каждого пути есть страж.
 */
export const ENT_ONLY_PATHS = ["/exam", "/plan", "/exam/run", "/diagnostic"] as const;

/** Нужен только факт завершения урока — берём минимум от LessonStat, чтобы функции не зависели от стора. */
export type LessonsDone = Record<string, { completions: number } | undefined>;

/** Класс профиля → класс программы; «другое» — null (программа не выбрана). */
export function toSchoolGrade(g: Grade | undefined): SchoolGrade | null {
  return g && g !== "other" && (SCHOOL_GRADES as string[]).includes(g) ? (g as SchoolGrade) : null;
}

/** Единое определение «урок пройден» для школьной карты и карты курса ЕНТ: есть хотя бы одно завершение. */
export function isPassedStat(stat: { completions: number } | undefined): boolean {
  return (stat?.completions ?? 0) > 0;
}

export function isLessonDone(id: string, lessons: LessonsDone): boolean {
  return isPassedStat(lessons[id]);
}

export interface TopicProgress {
  /** Сколько уроков привязано к теме. */
  total: number;
  /** Сколько из них пройдено. */
  done: number;
  /** У темы есть уроки. */
  ready: boolean;
  /** Все уроки темы пройдены (у темы без уроков — всегда false). */
  complete: boolean;
  /** Первый непройденный урок (null — все пройдены или уроков нет). */
  nextLessonId: string | null;
}

export function topicProgress(topic: SchoolTopic, lessons: LessonsDone): TopicProgress {
  const total = topic.lessonIds.length;
  const done = topic.lessonIds.filter((id) => isLessonDone(id, lessons)).length;
  return {
    total,
    done,
    ready: total > 0,
    complete: total > 0 && done === total,
    nextLessonId: topic.lessonIds.find((id) => !isLessonDone(id, lessons)) ?? null,
  };
}

export interface SectionProgress {
  topics: number;
  /** Тем с готовыми уроками. */
  readyTopics: number;
  /** Тем, у которых пройдены все уроки. */
  doneTopics: number;
}

export function sectionProgress(section: SchoolSection, lessons: LessonsDone): SectionProgress {
  let readyTopics = 0;
  let doneTopics = 0;
  for (const t of section.topics) {
    const p = topicProgress(t, lessons);
    if (p.ready) readyTopics++;
    if (p.complete) doneTopics++;
  }
  return { topics: section.topics.length, readyTopics, doneTopics };
}

export interface GradeProgress {
  topics: number;
  readyTopics: number;
  doneTopics: number;
  /** Уникальные уроки класса: урок, привязанный к нескольким темам, считается один раз. */
  lessonsTotal: number;
  lessonsDone: number;
  /** Доля пройденных уроков класса, 0..1 (нет уроков — 0). */
  ratio: number;
}

export function gradeProgress(plan: SchoolGradePlan, lessons: LessonsDone): GradeProgress {
  const unique = new Set<string>();
  let topics = 0;
  let readyTopics = 0;
  let doneTopics = 0;
  for (const s of plan.sections) {
    const sp = sectionProgress(s, lessons);
    topics += sp.topics;
    readyTopics += sp.readyTopics;
    doneTopics += sp.doneTopics;
    for (const t of s.topics) for (const id of t.lessonIds) unique.add(id);
  }
  const ids = [...unique];
  const lessonsDone = ids.filter((id) => isLessonDone(id, lessons)).length;
  return { topics, readyTopics, doneTopics, lessonsTotal: ids.length, lessonsDone, ratio: ids.length ? lessonsDone / ids.length : 0 };
}

/** Следующий урок класса: первый непройденный по порядку программы. Всё пройдено или уроков нет — null. */
export function nextSchoolLesson(plan: SchoolGradePlan, lessons: LessonsDone): { lessonId: string; sectionId: string; topicId: string } | null {
  for (const s of plan.sections) {
    for (const t of s.topics) {
      const next = topicProgress(t, lessons).nextLessonId;
      if (next) return { lessonId: next, sectionId: s.id, topicId: t.id };
    }
  }
  return null;
}

/** Все уникальные id уроков класса (для проверок и показа). */
export function gradeLessonIds(plan: SchoolGradePlan): string[] {
  const set = new Set<string>();
  for (const s of plan.sections) for (const t of s.topics) for (const id of t.lessonIds) set.add(id);
  return [...set];
}

/**
 * Проверка данных программы: уникальные id, двуязычные названия, существующие уроки.
 * Возвращает список проблем (пустой — всё в порядке). knownLessonIds — id уроков из LESSONS.
 */
export function validateSchoolProgram(program: SchoolGradePlan[], knownLessonIds: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const gradesSeen = new Set<string>();
  const note = (id: string, msg: string) => problems.push(`${id}: ${msg}`);
  const unique = (id: string) => {
    if (seen.has(id)) note(id, "id повторяется");
    seen.add(id);
  };
  for (const plan of program) {
    if (gradesSeen.has(plan.grade)) note(`grade ${plan.grade}`, "класс повторяется");
    gradesSeen.add(plan.grade);
    if (!plan.sections.length) note(`grade ${plan.grade}`, "нет разделов");
    for (const s of plan.sections) {
      unique(s.id);
      if (!s.title.ru?.trim() || !s.title.kk?.trim()) note(s.id, "нет названия ru/kk");
      if (!s.topics.length) note(s.id, "нет тем");
      for (const t of s.topics) {
        unique(t.id);
        if (!t.title.ru?.trim() || !t.title.kk?.trim()) note(t.id, "нет названия ru/kk");
        if (new Set(t.lessonIds).size !== t.lessonIds.length) note(t.id, "урок указан дважды");
        for (const id of t.lessonIds) if (!knownLessonIds.has(id)) note(t.id, `нет урока «${id}»`);
      }
    }
  }
  return problems;
}

/** Готова ли программа для проверок: все классы 5–11 на месте и по порядку. */
export function missingGrades(program: SchoolGradePlan[] = SCHOOL_PROGRAM): SchoolGrade[] {
  const have = new Set(program.map((p) => p.grade));
  return SCHOOL_GRADES.filter((g) => !have.has(g));
}

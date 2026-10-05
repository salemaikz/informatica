// Шкала «пройдено X% курса» без React (#71): курс ЕНТ или программа класса (школьный трек, #52).
// Общая для хука useCourseView (экраны прогресса), карточки «поделиться» и отчёта родителю (#72–#74).

import { schoolPlan } from "@/content/school-program";
import type { Grade, SchoolDirection } from "./types";
import { courseProgress, schoolSkillSections, unitSkillSections, type SkillSection } from "./progress";
import { entVisible, gradeProgress, toSchoolGrade, type LessonsDone } from "./school";
import type { Profile } from "./store";

/**
 * Что показывать в шкале: курс (ЕНТ) или программа класса.
 * `anyDone` — пройден хоть один урок на карте, в том числе в разделе «Старт», который не входит в процент
 * (пустое состояние «Пройди первый урок» — только когда не пройдено вообще ничего).
 */
export type CourseView =
  | { kind: "course"; done: number; total: number; soon: number; ratio: number; skipBasics: boolean; anyDone: boolean }
  | { kind: "class"; grade: string; done: number; total: number; soon: number; ratio: number; anyDone: boolean };

export interface CourseViewInput {
  lessons: LessonsDone;
  track: Profile["track"];
  grade: Grade | undefined;
  /** Направление 10–11 классов (ЕМН по умолчанию). */
  direction?: SchoolDirection;
  skipBasics: boolean | undefined;
}

/**
 * Ученик ЕНТ — готовые уроки на карте курса (раздел «Старт» не входит, если основы знакомы);
 * школьник — уроки своего класса. Класс не выбран («другое») — как курс.
 */
export function courseViewOf({ lessons, track, grade: gradeRaw, direction, skipBasics }: CourseViewInput): CourseView {
  if (!entVisible({ track })) {
    const grade = toSchoolGrade(gradeRaw);
    const plan = grade ? schoolPlan(grade, direction) : undefined;
    if (grade && plan) {
      const g = gradeProgress(plan, lessons);
      return { kind: "class", grade, done: g.lessonsDone, total: g.lessonsTotal, soon: g.topics - g.readyTopics, ratio: g.ratio, anyDone: g.lessonsDone > 0 };
    }
  }
  const c = courseProgress(lessons, { skipBasics });
  // «Старт» исключён из процента, но пройденные в нём уроки — всё равно пройденные: сравниваем со счётом по всей карте.
  const anyDone = skipBasics ? courseProgress(lessons).done > 0 : c.done > 0;
  return { kind: "course", done: c.done, total: c.ready, soon: c.total - c.ready, ratio: c.ratio, skipBasics: !!skipBasics, anyDone };
}

/**
 * Разделы трека для группировки навыков на «Прогрессе» (этап 16В): ученик ЕНТ — разделы курса, школьник — разделы программы
 * его класса; класс не выбран («другое») — как курс (то же решение, что в `courseViewOf`).
 */
export function skillSectionsOf({ track, grade: gradeRaw, direction, skipBasics }: Omit<CourseViewInput, "lessons">): SkillSection[] {
  if (!entVisible({ track })) {
    const grade = toSchoolGrade(gradeRaw);
    const plan = grade ? schoolPlan(grade, direction) : undefined;
    if (plan) return schoolSkillSections(plan);
  }
  return unitSkillSections({ skipBasics });
}

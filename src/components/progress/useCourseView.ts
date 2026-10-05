"use client";

import { useMemo } from "react";
import { schoolPlan } from "@/content/school-program";
import { courseProgress } from "@/lib/progress";
import { entVisible, gradeProgress, toSchoolGrade } from "@/lib/school";
import { useApp } from "@/lib/store";

/**
 * Что показывать в шкале: курс (ЕНТ) или программа класса (школьный трек, #52, #71).
 * `anyDone` — пройден хоть один урок на карте, в том числе в разделе «Старт», который не входит в процент
 * (пустое состояние «Пройди первый урок» — только когда не пройдено вообще ничего).
 */
export type CourseView =
  | { kind: "course"; done: number; total: number; soon: number; ratio: number; skipBasics: boolean; anyDone: boolean }
  | { kind: "class"; grade: string; done: number; total: number; soon: number; ratio: number; anyDone: boolean };

/**
 * Шкала прогресса из стора. Ученик ЕНТ — готовые уроки на карте курса (раздел «Старт» не входит, если основы знакомы);
 * школьник — уроки своего класса. Класс не выбран («другое») — как курс.
 */
export function useCourseView(): CourseView {
  const lessons = useApp((s) => s.lessons);
  const track = useApp((s) => s.profile.track);
  const gradeRaw = useApp((s) => s.profile.grade);
  const skipBasics = useApp((s) => s.profile.skipBasics);
  return useMemo(() => {
    if (!entVisible({ track })) {
      const grade = toSchoolGrade(gradeRaw);
      const plan = grade ? schoolPlan(grade) : undefined;
      if (grade && plan) {
        const g = gradeProgress(plan, lessons);
        return { kind: "class", grade, done: g.lessonsDone, total: g.lessonsTotal, soon: g.topics - g.readyTopics, ratio: g.ratio, anyDone: g.lessonsDone > 0 };
      }
    }
    const c = courseProgress(lessons, { skipBasics });
    // «Старт» исключён из процента, но пройденные в нём уроки — всё равно пройденные: сравниваем со счётом по всей карте.
    const anyDone = skipBasics ? courseProgress(lessons).done > 0 : c.done > 0;
    return { kind: "course", done: c.done, total: c.ready, soon: c.total - c.ready, ratio: c.ratio, skipBasics, anyDone };
  }, [lessons, track, gradeRaw, skipBasics]);
}

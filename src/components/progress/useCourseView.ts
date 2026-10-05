"use client";

import { useMemo } from "react";
import { schoolPlan } from "@/content/school-program";
import { courseProgress } from "@/lib/progress";
import { entVisible, gradeProgress, toSchoolGrade } from "@/lib/school";
import { useApp } from "@/lib/store";

/** Что показывать в шкале: курс (ЕНТ) или программа класса (школьный трек, #52, #71). */
export type CourseView =
  | { kind: "course"; done: number; total: number; soon: number; ratio: number; skipBasics: boolean }
  | { kind: "class"; grade: string; done: number; total: number; soon: number; ratio: number };

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
        return { kind: "class", grade, done: g.lessonsDone, total: g.lessonsTotal, soon: g.topics - g.readyTopics, ratio: g.ratio };
      }
    }
    const c = courseProgress(lessons, { skipBasics });
    return { kind: "course", done: c.done, total: c.ready, soon: c.total - c.ready, ratio: c.ratio, skipBasics };
  }, [lessons, track, gradeRaw, skipBasics]);
}

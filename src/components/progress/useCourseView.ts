"use client";

import { useMemo } from "react";
import { courseViewOf, type CourseView } from "@/lib/course-view";
import { useApp } from "@/lib/store";

export type { CourseView } from "@/lib/course-view";

/** Шкала прогресса из стора (курс ЕНТ или программа класса) — см. lib/course-view.ts. */
export function useCourseView(): CourseView {
  const lessons = useApp((s) => s.lessons);
  const track = useApp((s) => s.profile.track);
  const grade = useApp((s) => s.profile.grade);
  const direction = useApp((s) => s.profile.direction);
  const skipBasics = useApp((s) => s.profile.skipBasics);
  return useMemo(() => courseViewOf({ lessons, track, grade, direction, skipBasics }), [lessons, track, grade, direction, skipBasics]);
}

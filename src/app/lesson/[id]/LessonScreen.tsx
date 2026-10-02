"use client";

import { getLesson } from "@/content/course";
import { useT } from "@/i18n/useT";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";

export function LessonScreen({ id }: { id: string }) {
  const { l } = useT();
  const lesson = getLesson(id)!;
  return <LessonPlayer kind="lesson" lessonId={lesson.id} title={l(lesson.title)} steps={lesson.steps} />;
}

"use client";

import { useState } from "react";
import { getLesson } from "@/content/course";
import { useT } from "@/i18n/useT";
import { buildCheck } from "@/lib/drill";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";

export function LessonScreen({ id, mode }: { id: string; mode: "learn" | "check" }) {
  const { l } = useT();
  const lesson = getLesson(id)!;
  // «Проверить себя»: только задания (A → B → C), недостающее добираем из банка. Набор собираем один раз при входе.
  const [check] = useState(() => (mode === "check" ? buildCheck(lesson, Date.now()) : []));
  if (mode === "check" && check.length > 0) {
    return <LessonPlayer kind="lesson" via="check" lessonId={lesson.id} title={l(lesson.title)} steps={check} />;
  }
  return <LessonPlayer kind="lesson" lessonId={lesson.id} title={l(lesson.title)} steps={lesson.steps} />;
}

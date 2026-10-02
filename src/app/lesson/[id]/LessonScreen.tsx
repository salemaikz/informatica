"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { getLesson } from "@/content/course";
import { useT } from "@/i18n/useT";
import { buildCheck } from "@/lib/drill";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";
import { OutOfHearts } from "@/components/economy/OutOfHearts";
import { useHearts } from "@/components/economy/useEconomy";

/**
 * Вход в урок: нет сердечек (и не безлимит) — вместо плеера экран «Сердечки закончились».
 * Допуск запоминаем: если сердечки кончатся уже внутри урока, плеер не пропадает (там своя шторка).
 * Дети (плеер) приходят готовым элементом — пересчёт таймера сердечек плеер не перерисовывает.
 */
function HeartsGate({ lessonId, children }: { lessonId: string; children: ReactNode }) {
  const router = useRouter();
  const v = useHearts();
  const [admitted, setAdmitted] = useState(false);
  const canPlay = v.unlimited || v.count > 0;
  // «Предыдущее значение» при рендере (без эффекта с setState): сердечко вернулось или куплено — впускаем.
  if (!admitted && canPlay) setAdmitted(true);
  if (admitted || canPlay) return <>{children}</>;
  return (
    <OutOfHearts
      layout="screen"
      onResume={() => setAdmitted(true)}
      onExit={() => router.push("/learn")}
      theoryHref={`/theory/${lessonId}`}
    />
  );
}

export function LessonScreen({ id, mode }: { id: string; mode: "learn" | "check" }) {
  const { l } = useT();
  const lesson = getLesson(id)!;
  // «Проверить себя»: только задания (A → B → C), недостающее добираем из банка. Набор собираем один раз при входе.
  const [check] = useState(() => (mode === "check" ? buildCheck(lesson, Date.now()) : []));
  const player =
    mode === "check" && check.length > 0 ? (
      <LessonPlayer kind="lesson" via="check" lessonId={lesson.id} title={l(lesson.title)} steps={check} />
    ) : (
      <LessonPlayer kind="lesson" lessonId={lesson.id} title={l(lesson.title)} steps={lesson.steps} />
    );
  return <HeartsGate lessonId={lesson.id}>{player}</HeartsGate>;
}

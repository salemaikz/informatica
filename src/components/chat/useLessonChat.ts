"use client";

import { useRouter } from "next/navigation";
import { UNITS } from "@/content/course-map";
import { findLessonChat } from "@/lib/chats";
import { useApp } from "@/lib/store";
import { lessonEntTopic } from "@/lib/theory";
import type { EntTopicId, L } from "@/lib/types";
import { useT } from "@/i18n/useT";

/**
 * «Спросить Бита об этой теме» (этап 16В, P6): открывает чат по теме урока — один на урок, повторно открывается тот же.
 * Новый чат — свободный, с названием урока и темой ЕНТ урока; название и конспект урока сервер добавляет сам по id урока
 * (клиент содержимое курса не грузит). Пока чат открывается страницей /tutor/<id>.
 */
export function useOpenLessonChat() {
  const { l } = useT();
  const router = useRouter();
  return (lesson: { id: string; unitId: string; title: L; entTopics?: EntTopicId[] }) => {
    const app = useApp.getState();
    const id = findLessonChat(app.chats, lesson.id)?.id ?? app.createChat("free", l(lesson.title), lessonEntTopic(lesson, UNITS), lesson.id);
    router.push(`/tutor/${id}`);
  };
}

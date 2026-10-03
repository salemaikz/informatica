"use client";

import type { EntTopicId } from "@/lib/types";
import type { QuizSummary } from "@/lib/chats";

export interface ChatQuizProps {
  /** Тема ЕНТ; нет — задания по пройденным урокам (как умная тренировка). */
  topic?: EntTopicId;
  /** Сколько заданий (5 или 10). */
  count?: number;
  /** Итог: оценка, ошибки — чат сохранит карточку итога. */
  onDone: (summary: QuizSummary) => void;
  onCancel?: () => void;
}

// ЗАГЛУШКА: «Дай задачи» в чате делает исполнитель C2 по docs/specs/chat2.md. Пропсы не менять.
export function ChatQuiz({ onCancel }: ChatQuizProps) {
  return (
    <button type="button" onClick={onCancel} className="rounded-2xl border-2 border-dashed border-border p-4 text-sm text-muted">
      quiz
    </button>
  );
}

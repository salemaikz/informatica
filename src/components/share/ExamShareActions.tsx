"use client";

import type { ExamKind } from "@/lib/exam";
import type { EntTopicId } from "@/lib/types";

/** Строка темы для карточки: баллы по теме в этой попытке. */
export interface ExamTopicRow {
  topic: EntTopicId;
  points: number;
  max: number;
}

/**
 * Итоги пробника (#72, #73): «Поделиться результатом» (карточка-картинка + ссылка /r/<код>) и «Вызвать друга»
 * (та же ссылка с текстом-вызовом). Для контрольной (`kind === "unit"`) — ничего. ЗАГЛУШКА каркаса: делает пакет A.
 */
export function ExamShareActions(props: {
  kind: ExamKind;
  seed: number;
  topics: EntTopicId[];
  points: number;
  max: number;
  /** Тег банка попытки (`ExamAttempt.pool` / `ExamSummary.pool`); нет — берётся `currentPoolTag()`. */
  pool: string | undefined;
  topicRows: ExamTopicRow[];
}) {
  void props;
  return null;
}

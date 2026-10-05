"use client";

import { Swords, Trophy } from "lucide-react";
import { useMemo } from "react";
import type { ExamKind } from "@/lib/exam";
import { UNKNOWN_POOL } from "@/lib/challenge";
import { encodeShare, type ShareResult } from "@/lib/share-code";
import type { EntTopicId } from "@/lib/types";
import { useT } from "@/i18n/useT";
import { ShareSheet } from "./ShareSheet";
import { topicRowsToCard } from "./labels";

/** Строка темы для карточки: баллы по теме в этой попытке. */
export interface ExamTopicRow {
  topic: EntTopicId;
  points: number;
  max: number;
}

/**
 * Итоги пробника (#72, #73): «Поделиться результатом» (карточка-картинка + ссылка /r/<код>) и «Вызвать друга»
 * (та же ссылка с текстом-вызовом, без картинки). Для контрольной (`kind === "unit"`) и негодных чисел — ничего.
 * Тег банка у старых попыток не записан — берётся текущий; банк заданий тяжёлый, поэтому подгружается только по нажатию.
 */
export function ExamShareActions({
  kind,
  seed,
  topics,
  points,
  max,
  pool,
  topicRows,
}: {
  kind: ExamKind;
  seed: number;
  topics: EntTopicId[];
  points: number;
  max: number;
  /**
   * Тег банка попытки (`ExamAttempt.pool` / `ExamSummary.pool`). Нет (попытка из версии без тегов) — `UNKNOWN_POOL`:
   * банк с тех пор мог смениться, поэтому другу честно скажем «вариант может отличаться» (а не текущий тег).
   */
  pool: string | undefined;
  topicRows: ExamTopicRow[];
}) {
  const { t, lang } = useT();
  const topicsKey = topics.join(",");

  const build = useMemo(() => {
    if (kind === "unit") return null;
    const list = topicsKey ? (topicsKey.split(",") as EntTopicId[]) : [];
    const r: ShareResult = { t: "exam", kind, points, max, lang, seed: seed >>> 0, pool: pool ?? UNKNOWN_POOL, topics: kind === "topic" ? list : [] };
    return encodeShare(r) ? r : null;
  }, [kind, seed, points, max, pool, lang, topicsKey]);

  const rows = useMemo(() => topicRowsToCard(lang, topicRows), [lang, topicRows]);

  if (!build) return null;
  // Две кнопки в ряд — только с планшета: на телефоне (до 430 px) длинные подписи не помещаются.
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      <ShareSheet source={build} what="exam" topics={rows} label={t("share.btn.exam")} icon={<Trophy size={18} aria-hidden />} variant="primary" block />
      <ShareSheet source={build} what="challenge" label={t("share.btn.challenge")} icon={<Swords size={18} aria-hidden />} variant="secondary" block />
    </div>
  );
}

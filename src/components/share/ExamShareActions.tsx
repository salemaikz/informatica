"use client";

import { Swords, Trophy } from "lucide-react";
import { useMemo } from "react";
import type { ExamKind } from "@/lib/exam";
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

/** Заглушка тега, чтобы проверить остальные поля кода до подгрузки банка (настоящий тег подставляется по нажатию). */
const PLACEHOLDER_POOL = "0000";

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
  /** Тег банка попытки (`ExamAttempt.pool` / `ExamSummary.pool`); нет — берётся `currentPoolTag()`. */
  pool: string | undefined;
  topicRows: ExamTopicRow[];
}) {
  const { t, lang } = useT();
  const topicsKey = topics.join(",");

  const build = useMemo(() => {
    if (kind === "unit") return null;
    const list = topicsKey ? (topicsKey.split(",") as EntTopicId[]) : [];
    const make = (p: string): ShareResult => ({ t: "exam", kind, points, max, lang, seed: seed >>> 0, pool: p, topics: kind === "topic" ? list : [] });
    return {
      valid: encodeShare(make(pool ?? PLACEHOLDER_POOL)) !== null,
      resolve: async (): Promise<ShareResult | null> => {
        const p = pool ?? (await import("@/lib/exam-pool")).currentPoolTag();
        const r = make(p);
        return encodeShare(r) ? r : null;
      },
    };
  }, [kind, seed, points, max, pool, lang, topicsKey]);

  const rows = useMemo(() => topicRowsToCard(lang, topicRows), [lang, topicRows]);

  if (!build || !build.valid) return null;
  return (
    <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2">
      <ShareSheet source={build.resolve} what="exam" topics={rows} label={t("share.btn.exam")} icon={<Trophy size={18} aria-hidden />} variant="primary" block />
      <ShareSheet source={build.resolve} what="challenge" label={t("share.btn.challenge")} icon={<Swords size={18} aria-hidden />} variant="secondary" block />
    </div>
  );
}

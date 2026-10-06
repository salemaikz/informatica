"use client";

import { useEffect, useState } from "react";
import type { L } from "@/lib/types";

/**
 * Тексты заданий для «Повторяющихся ошибок» на обоих языках: ищем задание в контенте по id (урок или ссылка «ent:…»).
 * Контент тяжёлый — подгружаем отдельным куском, только когда на странице есть повторяющиеся ошибки.
 * Не нашлось (задание из банка или переписанный урок) — запись остаётся со своим текстом из журнала (missPromptText).
 */
export function useRepeatPrompts(items: readonly { stepId: string; lessonId?: string }[]): Record<string, L> {
  const [map, setMap] = useState<Record<string, L>>({});
  useEffect(() => {
    if (items.length === 0) return;
    let off = false;
    void (async () => {
      const [{ findStep }, { entStepFromRef }, { isEntRef }, { isQuestion }, { plain, tx }] = await Promise.all([
        import("@/content/course"),
        import("@/lib/ent-steps"),
        import("@/lib/ent-ref"),
        import("@/lib/evaluate"),
        import("@/lib/text"),
      ]);
      const out: Record<string, L> = {};
      for (const it of items) {
        const found = findStep(it.lessonId, it.stepId) ?? (isEntRef(it.stepId) ? entStepFromRef(it.stepId) : undefined);
        if (!found || !isQuestion(found)) continue;
        out[it.stepId] = { ru: plain(tx(found.prompt, "ru")), kk: plain(tx(found.prompt, "kk")) };
      }
      if (!off) setMap(out);
    })();
    return () => {
      off = true;
    };
  }, [items]);
  return map;
}

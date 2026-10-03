"use client";

import { ChevronRight, Shapes } from "lucide-react";
import { ENT_TOPICS } from "@/content/ent-topics";
import type { EntTopicId } from "@/lib/types";
import { useT } from "@/i18n/useT";

/** Выбор темы ЕНТ: 13 тем и (для «Дай задачи») «Любая тема». */
export function TopicPicker({ withAny, onPick }: { withAny?: boolean; onPick: (topic: EntTopicId | undefined) => void }) {
  const { t, l } = useT();
  const row = "flex min-h-12 w-full items-center gap-3 rounded-2xl border-2 border-border bg-surface px-3 py-2 text-left font-bold hover:border-ai/40 hover:bg-ai-soft";
  return (
    <ul className="flex flex-col gap-2">
      {withAny && (
        <li>
          <button type="button" onClick={() => onPick(undefined)} className={row}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ai-soft text-ai" aria-hidden>
              <Shapes size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block">{t("chat2.topic.any")}</span>
              <span className="block text-xs font-semibold text-muted">{t("chat2.topic.anyHint")}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
          </button>
        </li>
      )}
      {ENT_TOPICS.map((topic, i) => (
        <li key={topic.id}>
          <button type="button" onClick={() => onPick(topic.id)} className={row}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-sm font-extrabold text-muted" aria-hidden>
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">{l(topic.title)}</span>
            <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

"use client";

import { lessonMeta } from "@/content/catalog";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { Mascot } from "@/components/mascot/Mascot";

const QUESTIONS: DictKey[] = ["theory16c.chat.q1", "theory16c.chat.q2", "theory16c.chat.q3"];

/**
 * Первое сообщение чата по теме урока — статическое, без ИИ (в историю для ИИ не попадает и ничего не стоит):
 * «Спрашивай всё про «{урок}». Например:». Остаётся над перепиской, пока чат открыт.
 */
export function LessonIntro({ lessonId }: { lessonId: string }) {
  const { t, l } = useT();
  const meta = lessonMeta(lessonId);
  return (
    <div className="flex items-end gap-2">
      <Mascot mood="happy" size={44} className="size-11 shrink-0" />
      <p className="max-w-[88%] rounded-2xl rounded-bl-md border-2 border-ai/20 bg-surface px-4 py-3 font-semibold">
        {t("theory16c.chat.intro", { lesson: meta ? l(meta.title) : "" })}
      </p>
    </div>
  );
}

/** Три подсказки-кнопки пустого чата по теме урока: нажатие отправляет вопрос. */
export function LessonChips({ onSend }: { onSend: (text: string) => void }) {
  const { t } = useT();
  return (
    <div className="flex flex-wrap gap-2 pl-[3.25rem]">
      {QUESTIONS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onSend(t(k))}
          className="rounded-2xl border-2 border-ai/30 bg-ai-soft px-3.5 py-2 text-left text-sm font-bold text-ai hover:brightness-95"
        >
          {t(k)}
        </button>
      ))}
    </div>
  );
}

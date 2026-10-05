"use client";

import { ArrowRight, BookmarkPlus, ClipboardCheck, Play } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Lesson } from "@/lib/types";
import { useT } from "@/i18n/useT";
import { Markdown } from "@/components/Markdown";
import { Button, ButtonLink } from "@/components/ui/Button";
import { AskBit, MD_WIDE } from "./TheoryBlocks";

/** Последняя карточка: конспект урока (итог) с «Спросить Бита по конспекту». id = «conspect» — на него ведёт поиск. */
export function ConspectCard({ lesson, onAsk }: { lesson: Lesson; onAsk: () => void }) {
  const { t, l } = useT();
  return (
    <section id="conspect" className="flex min-w-0 scroll-mt-20 flex-col gap-3 rounded-3xl border-2 border-primary/30 bg-surface p-4 sm:p-5">
      <div>
        <h2 className="text-2xl font-extrabold">{t("theory.conspect")}</h2>
        <p className="text-sm font-semibold text-muted">{t("theory.conspectHint")}</p>
      </div>
      <Markdown className={cn("text-[17px]", MD_WIDE)}>{l(lesson.conspect)}</Markdown>
      <AskBit onClick={onAsk} label={t("theory.askConspect")} />
    </section>
  );
}

/** Кнопки под конспектом: «Пройти урок», «Проверить себя», «Сохранить в конспекты», «Следующий урок теории». */
export function ConspectActions({ lesson, nextLessonId, onSave }: { lesson: Lesson; nextLessonId: string | null; onSave: () => void }) {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-3">
      <ButtonLink href={`/lesson/${lesson.id}`} size="lg" block icon={<Play size={20} />}>
        {t("theory.start")}
      </ButtonLink>
      <ButtonLink href={`/lesson/${lesson.id}?mode=check`} variant="secondary" size="lg" block icon={<ClipboardCheck size={20} />}>
        {t("theory.check")}
      </ButtonLink>
      <Button variant="secondary" size="lg" block icon={<BookmarkPlus size={20} />} onClick={onSave}>
        {t("theory.save")}
      </Button>
      {nextLessonId && (
        <ButtonLink href={`/theory/${nextLessonId}`} variant="secondary" size="lg" block icon={<ArrowRight size={20} />}>
          {t("theory16c.nextLesson")}
        </ButtonLink>
      )}
    </div>
  );
}

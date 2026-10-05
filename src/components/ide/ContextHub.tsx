"use client";

import { ArrowLeft, ChevronRight, FileCode } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Mascot } from "@/components/mascot/Mascot";
import { ButtonLink } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { LESSONS } from "@/content/course";
import { skillById } from "@/content/skills";
import { contextItems, contextLessonId } from "@/lib/context-drill";
import { plain } from "@/lib/text";
import type { EntContext } from "@/lib/types";
import { useT } from "@/i18n/useT";
import { clip, LEVEL_LETTER } from "./shell-helpers";

/** Первое предложение условия (без разметки) — чтобы отличать задания одного урока. */
function firstSentence(text: string): string {
  const s = plain(text);
  const end = s.search(/[.!?](\s|$)/);
  return clip(end > 0 ? s.slice(0, end + 1) : s, 80);
}

function ContextCard({ item }: { item: EntContext }) {
  const { t, l } = useT();
  const skill = skillById(item.skill);
  const lesson = LESSONS[contextLessonId(item.id)];
  const skillTitle = skill ? l(skill.title) : item.skill;
  // Название урока — только если оно не повторяет название навыка (у части уроков они совпадают).
  const lessonTitle = lesson && l(lesson.title) !== skillTitle ? l(lesson.title) : "";
  const letter = LEVEL_LETTER[item.level];

  return (
    <Link
      href={`/drill?mode=context&item=${encodeURIComponent(item.id)}`}
      className="flex h-full min-h-16 flex-col gap-2 rounded-3xl border-2 border-border bg-surface p-4 transition-colors hover:bg-surface-2 active:translate-y-px"
    >
      <span className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <FileCode size={26} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold leading-tight">{skillTitle}</span>
          {lessonTitle && <span className="block truncate text-sm font-semibold text-muted">{lessonTitle}</span>}
        </span>
        <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden />
      </span>
      <span className="text-sm font-semibold">{firstSentence(l(item.text))}</span>
      <span className="flex flex-wrap gap-2">
        <Pill tone="primary">{t("ide.level", { l: letter })}</Pill>
        <Pill tone="muted">{t("iderun.ctx.count", { n: item.questions.length })}</Pill>
      </span>
    </Link>
  );
}

/** /code/context: список контекстных заданий (программа + 5 вопросов), каждое открывается в тренировке с запуском программы. */
export function ContextHub() {
  const { t } = useT();
  const items = useMemo(() => contextItems(), []);

  return (
    <div className="flex flex-col gap-5">
      <ButtonLink href="/code" variant="ghost" size="sm" icon={<ArrowLeft size={16} />} className="-ml-2 self-start">
        {t("ide.back.all")}
      </ButtonLink>

      <div>
        <h1 className="text-2xl font-extrabold">{t("iderun.ctx.title")}</h1>
        <p className="font-semibold text-muted">{t("iderun.ctx.subtitle")}</p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border bg-surface p-6 text-center">
          <Mascot mood="thinking" size={72} />
          <p className="max-w-sm font-semibold text-muted">{t("iderun.ctx.empty")}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className="min-w-0">
              <ContextCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

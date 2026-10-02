"use client";

import { ArrowLeft, ArrowRight, BookmarkPlus, ClipboardCheck, Eye, Play } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { getLesson, UNITS } from "@/content/course";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { adjacentLessons, blockContext, conspectContext, infoSteps, pluralIndex, readableLessonIds, readingStats } from "@/lib/theory";
import { useApp } from "@/lib/store";
import { Markdown } from "@/components/Markdown";
import { AiPanel } from "@/components/ai/AiPanel";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { useSaveToNotes } from "@/components/notes/saveToNotesBus";
import { AskBit, InfoBlock, MD_WIDE, type WorkedMode } from "./TheoryBlocks";
import { useHashScroll } from "./useHashScroll";

const CARDS_KEY: DictKey[] = ["theory.cards.one", "theory.cards.few", "theory.cards.many"];
const SUGGESTIONS: DictKey[] = ["tutor.q.simpler", "tutor.q.example", "tutor.q.why"];
const ORDER = readableLessonIds(UNITS);

/**
 * Чтение урока без заданий: все информационные шаги подряд, затем конспект.
 * Ничего не пишет в прогресс. Якоря: `#<id шага>` и `#conspect` — на них ведёт поиск.
 */
export function TheoryReader({ id }: { id: string }) {
  const { t, l, lang } = useT();
  const lesson = getLesson(id);
  const openSave = useSaveToNotes((s) => s.open);
  const done = useApp((s) => (s.lessons[id]?.completions ?? 0) > 0);
  const [mode, setMode] = useState<WorkedMode>("all");
  const [revealed, setRevealed] = useState<Record<string, number>>({});
  const [askId, setAskId] = useState<string | null>(null);

  const steps = useMemo(() => (lesson ? infoSteps(lesson) : []), [lesson]);
  const stats = useMemo(() => (lesson ? readingStats(lesson, lang) : null), [lesson, lang]);
  const unit = UNITS.find((u) => u.id === lesson?.unitId);
  const { prev, next } = adjacentLessons(ORDER, id);
  const prevLesson = prev ? getLesson(prev) : undefined;
  const nextLesson = next ? getLesson(next) : undefined;
  const hasWorked = steps.some((s) => s.type === "worked");

  // Переход по ссылке с якорем (из поиска): доскролл и короткая подсветка блока.
  useHashScroll(id);

  const askTask = useMemo(() => {
    if (!lesson || !askId) return null;
    if (askId === "conspect") return conspectContext(lesson, lang);
    const step = steps.find((s) => s.id === askId);
    return step ? blockContext(step, lesson, lang) : null;
  }, [lesson, steps, askId, lang]);

  if (!lesson || !stats) return null;

  const saveConspect = () => openSave({ source: "lesson", lessonId: lesson.id, title: l(lesson.title), text: l(lesson.conspect) });
  const reveal = (stepId: string, total: number) => setRevealed((r) => ({ ...r, [stepId]: Math.min(total, (r[stepId] ?? 1) + 1) }));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <Link href={`/theory#${lesson.unitId}`} className="-ml-2 flex h-10 items-center gap-1.5 self-start rounded-xl px-2 text-sm font-extrabold text-primary hover:bg-primary-soft">
          <ArrowLeft size={16} /> {t("theory.back")}
        </Link>
        {unit && (
          <p className="text-sm font-extrabold uppercase" style={{ color: unit.color }}>
            {l(unit.title)}
          </p>
        )}
        <h1 className="text-3xl font-extrabold leading-tight">{l(lesson.title)}</h1>
        <p className="font-semibold text-muted">{l(lesson.description)}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="muted">{t(CARDS_KEY[lang === "ru" ? pluralIndex(stats.cards) : 2], { n: stats.cards })}</Pill>
          <Pill tone="muted">{t("theory.readMin", { n: stats.minutes })}</Pill>
          {done && <Pill tone="success">{t("theory.done")}</Pill>}
        </div>
        <p className="flex items-start gap-2 rounded-2xl bg-surface-2 px-3 py-2 text-sm font-semibold text-muted">
          <Eye size={16} className="mt-0.5 shrink-0" aria-hidden /> {t("theory.readOnly")}
        </p>
      </header>

      {(steps.length > 1 || hasWorked) && (
        <nav aria-label={t("theory.toc")} className="flex flex-col gap-3">
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
            {steps.map((s, i) => (
              <li key={s.id} className="shrink-0">
                <a
                  href={`#${s.id}`}
                  className="flex h-10 max-w-[220px] items-center gap-1.5 rounded-full border-2 border-border bg-surface px-3 text-sm font-bold hover:bg-surface-2"
                >
                  <span className="text-muted">{i + 1}</span>
                  <span className="truncate">{blockTitle(s, lesson.title[lang], lang)}</span>
                </a>
              </li>
            ))}
            <li className="shrink-0">
              <a href="#conspect" className="flex h-10 items-center whitespace-nowrap rounded-full border-2 border-primary/40 bg-primary-soft px-3 text-sm font-extrabold text-primary">
                {t("theory.conspect")}
              </a>
            </li>
          </ul>
          {hasWorked && (
            <div role="group" aria-label={t("theory.modeLabel")} className="flex self-start rounded-2xl bg-surface-2 p-1">
              {(["all", "steps"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "h-10 rounded-xl px-4 text-sm font-extrabold transition-colors",
                    mode === m ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text",
                  )}
                >
                  {t(m === "all" ? "theory.modeAll" : "theory.modeSteps")}
                </button>
              ))}
            </div>
          )}
        </nav>
      )}

      {steps.map((step) => (
        <InfoBlock
          key={step.id}
          step={step}
          mode={mode}
          revealed={revealed[step.id] ?? 1}
          onReveal={() => step.type === "worked" && reveal(step.id, step.steps.length)}
          onAsk={() => setAskId(step.id)}
        />
      ))}

      <section id="conspect" className="flex min-w-0 scroll-mt-20 flex-col gap-3 rounded-3xl border-2 border-primary/30 bg-surface p-4 sm:p-5">
        <div>
          <h2 className="text-2xl font-extrabold">{t("theory.conspect")}</h2>
          <p className="text-sm font-semibold text-muted">{t("theory.conspectHint")}</p>
        </div>
        <Markdown className={cn("text-[17px]", MD_WIDE)}>{l(lesson.conspect)}</Markdown>
        <AskBit onClick={() => setAskId("conspect")} label={t("theory.askConspect")} />
      </section>

      <div className="flex flex-col gap-3">
        <ButtonLink href={`/lesson/${lesson.id}`} size="lg" block icon={<Play size={20} />}>
          {t("theory.start")}
        </ButtonLink>
        <ButtonLink href={`/lesson/${lesson.id}?mode=check`} variant="secondary" size="lg" block icon={<ClipboardCheck size={20} />}>
          {t("theory.check")}
        </ButtonLink>
        <Button variant="secondary" size="lg" block icon={<BookmarkPlus size={20} />} onClick={saveConspect}>
          {t("theory.save")}
        </Button>
      </div>

      {(prevLesson || nextLesson) && (
        <nav className="grid grid-cols-2 gap-3">
          {prevLesson ? (
            <Link href={`/theory/${prevLesson.id}`} className="flex min-w-0 flex-col gap-0.5 rounded-2xl border-2 border-border bg-surface p-3 hover:bg-surface-2">
              <span className="flex items-center gap-1 text-xs font-extrabold text-muted">
                <ArrowLeft size={14} /> {t("theory.prev")}
              </span>
              <span className="line-clamp-2 text-sm font-extrabold">{l(prevLesson.title)}</span>
            </Link>
          ) : (
            <span />
          )}
          {nextLesson ? (
            <Link href={`/theory/${nextLesson.id}`} className="flex min-w-0 flex-col items-end gap-0.5 rounded-2xl border-2 border-border bg-surface p-3 text-right hover:bg-surface-2">
              <span className="flex items-center gap-1 text-xs font-extrabold text-muted">
                {t("theory.next")} <ArrowRight size={14} />
              </span>
              <span className="line-clamp-2 text-sm font-extrabold">{l(nextLesson.title)}</span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}

      {askId && askTask && (
        <AiPanel key={askId} open onClose={() => setAskId(null)} mode="ask" task={askTask} noteKey={lesson.id} suggestions={SUGGESTIONS} />
      )}
    </div>
  );
}

/** Короткий заголовок блока для содержания. */
function blockTitle(step: ReturnType<typeof infoSteps>[number], lessonTitle: string, lang: "ru" | "kk"): string {
  if (step.type === "story") return step.title?.[lang] ?? lessonTitle;
  return step.title[lang];
}

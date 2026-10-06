"use client";

import { ChevronDown, ChevronRight, CircleCheckBig, Clock, Play } from "lucide-react";
import Link from "next/link";
import { LESSON_META } from "@/content/catalog";
import type { SchoolSection, SchoolTopic } from "@/content/school-program";
import { sectionProgress, topicProgress, type LessonsDone } from "@/lib/school";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import { Pill } from "@/components/ui/Pill";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { unitVars } from "@/components/learn/useLearn";

// Карточка раздела школьной программы: заголовок с прогрессом и список тем.
// Тема с уроками — ссылка на первый непройденный урок; без уроков — «скоро».

function TopicRow({ topic, lessons }: { topic: SchoolTopic; lessons: LessonsDone }) {
  const { t, l } = useT();
  const p = topicProgress(topic, lessons);
  const started = p.done > 0 && !p.complete;
  const target = p.nextLessonId ?? topic.lessonIds[0];
  const lesson = target ? LESSON_META[target] : undefined;

  const icon = p.complete ? (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-action-success text-white">
      <CircleCheckBig size={20} />
    </span>
  ) : p.ready ? (
    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", started ? "bg-warning text-white" : "bg-(--u-fill) text-white")}>
      <Play size={17} fill="currentColor" />
    </span>
  ) : (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
      <Clock size={18} />
    </span>
  );

  const body = (
    <>
      {icon}
      <span className="min-w-0 flex-1">
        <span className={cn("block font-bold leading-snug", !p.ready && "text-muted")}>{l(topic.title)}</span>
        {p.ready && lesson && (
          <span className="mt-0.5 block text-xs font-semibold text-muted">
            {p.total > 1 ? `${t("school.topic.lessons", { done: p.done, total: p.total })} · ` : ""}
            {l(lesson.title)}
          </span>
        )}
      </span>
      {p.complete ? (
        <Pill tone="success">{t("school.topic.repeat")}</Pill>
      ) : p.ready ? (
        <span className="flex shrink-0 items-center gap-1 text-sm font-extrabold text-(--u-ink)">
          {started ? t("school.topic.continue") : t("school.topic.start")}
          <ChevronRight size={18} />
        </span>
      ) : (
        <Pill tone="muted">{t("school.topic.soon")}</Pill>
      )}
    </>
  );

  const base = "flex min-h-14 items-center gap-3 rounded-2xl px-2.5 py-2";
  if (!p.ready || !target) {
    return (
      <li>
        <div className={base} title={t("school.topic.soonHint")}>
          {body}
        </div>
      </li>
    );
  }
  return (
    <li>
      <Link
        href={`/lesson/${target}`}
        className={cn(base, "transition-colors hover:bg-surface-2 active:bg-surface-2 focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-primary")}
      >
        {body}
      </Link>
    </li>
  );
}

export function SchoolSectionCard({
  section,
  index,
  color,
  lessons,
  open,
  onToggle,
}: {
  section: SchoolSection;
  index: number;
  color: string;
  lessons: LessonsDone;
  open: boolean;
  onToggle: () => void;
}) {
  const { t, l } = useT();
  const sp = sectionProgress(section, lessons);
  const complete = sp.doneTopics === sp.topics && sp.topics > 0;
  const panelId = `school-sec-${section.id}`;
  return (
    <section style={unitVars(color)} className="overflow-hidden rounded-3xl border-2 border-border bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center gap-3 bg-(--u-soft) p-3.5 text-left focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-primary"
      >
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold text-white shadow-[0_3px_0_var(--u-edge)]", complete ? "bg-action-success" : "bg-(--u-fill)")}>
          {complete ? <CircleCheckBig size={22} /> : index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold leading-snug text-(--u-ink)">{l(section.title)}</span>
          <span className="mt-1 flex items-center gap-2">
            <ProgressBar value={sp.topics ? sp.doneTopics / sp.topics : 0} color="var(--u-fill)" height={8} className="max-w-32" />
            <span className="text-xs font-bold text-muted">{t("school.section.count", { done: sp.doneTopics, n: sp.topics })}</span>
          </span>
        </span>
        <ChevronDown size={22} className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul id={panelId} className="flex animate-fade-in flex-col gap-0.5 p-1.5">
          {section.topics.map((topic) => (
            <TopicRow key={topic.id} topic={topic} lessons={lessons} />
          ))}
        </ul>
      )}
    </section>
  );
}

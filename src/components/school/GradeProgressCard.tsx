"use client";

import { ArrowRight, GraduationCap, PartyPopper } from "lucide-react";
import { LESSON_META } from "@/content/catalog";
import type { SchoolGrade } from "@/content/school-program";
import type { GradeProgress } from "@/lib/school";
import { useT } from "@/i18n/useT";
import { ButtonLink } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";

// Карточка класса: прогресс по готовым урокам и кнопка «Продолжить» со следующим уроком программы.

export function GradeProgressCard({ grade, progress, nextLessonId, resume }: { grade: SchoolGrade; progress: GradeProgress; nextLessonId: string | null; resume?: { lessonId: string; step: number; total: number } | null }) {
  const { t, l } = useT();
  // Незаконченный урок важнее «следующего по программе» (этап 16Б).
  const goId = resume?.lessonId ?? nextLessonId;
  const next = goId ? LESSON_META[goId] : undefined;
  const none = progress.lessonsTotal === 0;
  const finished = !none && !next;
  return (
    <section className="flex flex-col gap-3 rounded-3xl border-2 border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_4px_0_var(--primary-strong)]">
          <GraduationCap size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold leading-tight">{t("school.progress.title", { n: grade })}</h2>
          {!none && <p className="text-sm font-bold text-muted">{t("school.progress.lessons", { done: progress.lessonsDone, total: progress.lessonsTotal })}</p>}
        </div>
      </div>

      {none ? (
        <p className="font-semibold text-muted">{t("school.noneReady")}</p>
      ) : (
        <>
          <ProgressBar value={progress.ratio} color="var(--primary)" height={12} label={t("school.progress.title", { n: grade })} />
          <p className="text-sm font-semibold text-muted">{t("school.progress.topics", { ready: progress.readyTopics, topics: progress.topics })}</p>
        </>
      )}

      {next && goId && (
        <div className="flex flex-col gap-2 rounded-2xl bg-primary-soft p-3">
          <p className="text-xs font-extrabold uppercase tracking-wide text-primary">{resume ? t("resume.label") : t("school.next.label")}</p>
          <p className="font-extrabold leading-snug">{l(next.title)}</p>
          {resume && <p className="text-sm font-bold text-muted">{t("resume.step", { x: resume.step, y: resume.total })}</p>}
          <ButtonLink href={`/lesson/${goId}`} data-tour="continue" size="lg" block icon={<ArrowRight size={20} />} className="flex-row-reverse">
            {resume ? t("resume.cta", { title: l(next.title) }) : t("school.next.cta")}
          </ButtonLink>
        </div>
      )}

      {finished && (
        <p className="flex items-start gap-2 rounded-2xl bg-success-soft p-3 font-bold text-success-strong">
          <PartyPopper size={20} className="mt-0.5 shrink-0" /> {t("school.allDone", { n: grade })}
        </p>
      )}
    </section>
  );
}

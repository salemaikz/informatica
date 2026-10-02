"use client";

import { BookOpen, ChevronLeft, NotebookPen, Play, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UNITS, getLesson } from "@/content/course";
import { Markdown } from "@/components/Markdown";
import { NoteCard } from "@/components/notes/NoteCard";
import { useSaveToNotes } from "@/components/notes/saveToNotesBus";
import { useCleanEmptyNotes } from "@/components/notes/useCleanEmptyNotes";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useT } from "@/i18n/useT";
import { systemFolderId } from "@/lib/notebook";
import { useApp } from "@/lib/store";

/** Конспект урока: шпаргалка (lesson.conspect), под ней — записи ученика к уроку. */
export function LessonNotesScreen({ id }: { id: string }) {
  const { t, l, lang } = useT();
  const router = useRouter();
  const lesson = getLesson(id);
  const passed = useApp((s) => !!s.lessons[id]);
  const notes = useApp((s) => s.notebook.notes);
  const createNote = useApp((s) => s.createNote);
  useCleanEmptyNotes();

  const mine = notes.filter((n) => n.lessonId === id).sort((a, b) => b.updatedAt - a.updatedAt);
  const unit = UNITS.find((u) => u.lessons.some((r) => r.id === id));

  const back = (
    <Link href="/notes" className="flex min-h-11 w-fit items-center gap-1 font-bold text-muted hover:text-text">
      <ChevronLeft size={20} aria-hidden /> {t("notes.title")}
    </Link>
  );

  // «Скоро» (урока нет в курсе) — страницы конспекта нет.
  if (!lesson)
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <NotebookPen size={32} className="text-muted" aria-hidden />
          <p className="font-extrabold">{unit ? l(unit.lessons.find((r) => r.id === id)!.title) : t("notes2.lesson.title")}</p>
          <p className="font-semibold text-muted">{t("notes2.lesson.soon")}</p>
          <ButtonLink href="/notes">{t("notes2.toNotes")}</ButtonLink>
        </Card>
      </div>
    );

  const addNote = () => {
    const noteId = createNote({ source: "own", body: "", lessonId: id, folderId: systemFolderId("lessons") });
    router.push(`/notes/${noteId}`);
  };

  return (
    <div className="flex flex-col gap-4">
      {back}
      <div>
        <p className="text-sm font-extrabold uppercase tracking-wide" style={{ color: unit?.color }}>
          {unit ? l(unit.title) : t("notes2.lesson.title")}
        </p>
        <h1 className="text-2xl font-extrabold">{l(lesson.title)}</h1>
        {passed && <span className="mt-1 inline-block rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-extrabold text-success-strong">{t("notes2.passed")}</span>}
      </div>

      <Card>
        <Markdown className="[&_table]:block [&_table]:overflow-x-auto">{lesson.conspect[lang]}</Markdown>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <ButtonLink href={`/lesson/${id}`} icon={<Play size={18} aria-hidden />}>
          {t("notes2.lesson.start")}
        </ButtonLink>
        <ButtonLink href={`/theory/${id}`} variant="secondary" icon={<BookOpen size={18} aria-hidden />}>
          {t("notes2.lesson.theory")}
        </ButtonLink>
      </div>
      <Button
        variant="secondary"
        block
        icon={<NotebookPen size={18} aria-hidden />}
        onClick={() => useSaveToNotes.getState().open({ source: "lesson", lessonId: id, title: l(lesson.title), text: lesson.conspect[lang] })}
      >
        {t("notes2.lesson.toMine")}
      </Button>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted">{t("notes2.lesson.mine")}</h2>
        {mine.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-border px-4 py-5 text-center font-semibold text-muted">{t("notes2.lesson.noNotes")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {mine.map((n) => (
              <li key={n.id}>
                <NoteCard note={n} showFolder={false} />
              </li>
            ))}
          </ul>
        )}
        <Button variant="secondary" block icon={<Plus size={20} aria-hidden />} onClick={addNote}>
          {t("notes2.lesson.add")}
        </Button>
      </section>
    </div>
  );
}

"use client";

import { ChevronLeft, Lock, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getLesson } from "@/content/course";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Markdown } from "@/components/Markdown";

export function NoteScreen({ id }: { id: string }) {
  const { t, l, lang } = useT();
  const lesson = id === "general" ? undefined : getLesson(id);
  const completed = useApp((s) => !!s.lessons[id]);
  // Временная версия на конспектах 2.0 (страница переделывается в этапе 3, волна 2).
  const lessonKey = id === "general" ? undefined : id;
  const allNotes = useApp((s) => s.notebook.notes);
  const ownNote = allNotes.find((n) => n.source === "own" && n.lessonId === lessonKey);
  const saved = allNotes.filter((n) => n.source === "ai" && n.lessonId === lessonKey);
  const note = { own: ownNote?.body ?? "", saved: saved.map((n) => ({ id: n.id, text: n.body, at: n.createdAt })) };
  const setOwnNote = (_key: string, text: string) => {
    const existing = useApp.getState().notebook.notes.find((n) => n.source === "own" && n.lessonId === lessonKey);
    if (existing) useApp.getState().updateNote(existing.id, { body: text });
    else useApp.getState().createNote({ source: "own", body: text, lessonId: lessonKey });
  };
  const removeSavedNote = (_key: string, noteId: string) => useApp.getState().deleteNote(noteId);
  const ownText = () => useApp.getState().notebook.notes.find((n) => n.source === "own" && n.lessonId === lessonKey)?.body ?? "";
  const [draft, setDraft] = useState(note.own);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Автосохранение заметки через полсекунды после ввода.
  useEffect(() => {
    if (draft === ownText()) return;
    const timer = setTimeout(() => {
      setOwnNote(id, draft.slice(0, 4000));
      setSavedAt(Date.now());
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, id]);

  const title = lesson ? l(lesson.title) : t("notes.general");
  const locked = !!lesson && !completed;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/notes" className="flex w-fit items-center gap-1 font-bold text-muted hover:text-text">
        <ChevronLeft size={20} /> {t("notes.title")}
      </Link>
      <h1 className="text-2xl font-extrabold">{title}</h1>

      {locked ? (
        <Card className="flex flex-col items-center gap-3 py-8 text-center text-muted">
          <Lock size={32} />
          <p className="font-bold">{t("notes.locked")}</p>
          <ButtonLink href={`/lesson/${id}`}>{t("common.start")}</ButtonLink>
        </Card>
      ) : (
        <>
          {lesson && (
            <Card>
              <Markdown>{lesson.conspect[lang]}</Markdown>
            </Card>
          )}

          <Card>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-extrabold">{t("notes.mine")}</p>
              {savedAt && <span className="text-xs font-bold text-success">{t("common.saved")}</span>}
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                // Сохраняем сразу при уходе из поля (переход по ссылке не потеряет последние символы).
                if (draft !== ownText()) {
                  setOwnNote(id, draft.slice(0, 4000));
                  setSavedAt(Date.now());
                }
              }}
              placeholder={t("notes.minePlaceholder")}
              rows={5}
              className="w-full resize-y rounded-2xl border-2 border-border bg-surface-2 p-3 font-semibold outline-none focus:border-primary"
            />
          </Card>

          {!!note?.saved.length && (
            <div className="flex flex-col gap-3">
              <p className="flex items-center gap-1.5 font-extrabold text-ai">
                <Sparkles size={18} /> {t("notes.fromAi")}
              </p>
              {note.saved.map((s) => (
                <Card key={s.id} className="border-ai/25">
                  <Markdown>{s.text}</Markdown>
                  <div className="mt-2 flex items-center justify-between text-xs font-bold text-muted">
                    <span>{new Date(s.at).toLocaleDateString(lang === "kk" ? "kk-KZ" : "ru-RU")}</span>
                    <button type="button" onClick={() => removeSavedNote(id, s.id)} className="flex items-center gap-1 hover:text-danger">
                      <Trash2 size={14} /> {t("common.delete")}
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <ButtonLink href="/tutor" variant="ai" block icon={<Sparkles size={18} />}>
            {t("notes.askAi")}
          </ButtonLink>
        </>
      )}
    </div>
  );
}

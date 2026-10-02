"use client";

import { ChevronLeft, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FOLDER_STYLE, FolderIcon, FolderSheet, useFolderName } from "@/components/notes/folder-ui";
import { NoteCard } from "@/components/notes/NoteCard";
import { useCleanEmptyNotes } from "@/components/notes/useCleanEmptyNotes";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { notesInFolder } from "@/lib/notebook";
import { useApp } from "@/lib/store";

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Папка конспектов: записи (закреплённые сверху), изменить/удалить папку, «+ Запись в эту папку». */
export function FolderScreen({ id: rawId }: { id: string }) {
  const id = safeDecode(rawId);
  const { t } = useT();
  const router = useRouter();
  const notebook = useApp((s) => s.notebook);
  const createNote = useApp((s) => s.createNote);
  const nameOf = useFolderName();
  const [editing, setEditing] = useState(false);
  useCleanEmptyNotes();

  const folder = notebook.folders.find((f) => f.id === id);
  const notes = useMemo(() => notesInFolder(notebook, id), [notebook, id]);
  // Папку удалили на этом экране — пока идёт переход, не мигаем сообщением «не найдена».
  const [seen, setSeen] = useState(false);
  if (folder && !seen) setSeen(true);

  if (!folder)
    return seen ? null : (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-lg font-extrabold">{t("notes2.folder.notFound")}</p>
        <p className="font-semibold text-muted">{t("notes2.folder.notFoundHint")}</p>
        <ButtonLink href="/notes">{t("notes2.toNotes")}</ButtonLink>
      </Card>
    );

  const addNote = () => {
    const noteId = createNote({ source: "own", body: "", folderId: folder.id });
    router.push(`/notes/${noteId}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <Link href="/notes" className="flex min-h-11 w-fit items-center gap-1 font-bold text-muted hover:text-text">
        <ChevronLeft size={20} aria-hidden /> {t("notes.title")}
      </Link>

      <div className={cn("flex items-center gap-3 rounded-3xl border-2 p-4", FOLDER_STYLE[folder.color].card)}>
        <FolderIcon folder={folder} size={30} />
        <div className="min-w-0 flex-1">
          <h1 className="line-clamp-3 text-xl leading-tight font-extrabold break-words text-text">{nameOf(folder)}</h1>
          <p className="text-sm font-bold opacity-80">{t("notes2.notesCount", { n: notes.length })}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={t("notes2.folder.edit")}
          title={t("notes2.folder.edit")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface/70 text-text hover:bg-surface"
        >
          <Pencil size={18} aria-hidden />
        </button>
      </div>

      <Button block icon={<Plus size={20} aria-hidden />} onClick={addNote}>
        {t("notes2.newNote")}
      </Button>

      {notes.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-border px-4 py-8 text-center font-semibold text-muted">{t("notes2.folder.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <li key={n.id}>
              <NoteCard note={n} showFolder={false} />
            </li>
          ))}
        </ul>
      )}

      <FolderSheet open={editing} onClose={() => setEditing(false)} folder={folder} onDeleted={() => router.replace("/notes")} />
    </div>
  );
}

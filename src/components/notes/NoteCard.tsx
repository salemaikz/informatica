"use client";

import { Image as ImageIcon, Pin, Sparkles } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { bodyWithoutTitleLine, noteDate, noteSnippet } from "@/lib/note-markdown";
import { titleFromBody, type Note } from "@/lib/notebook";
import { FOLDER_STYLE, FolderIcon, useFolderName } from "./folder-ui";
import { useApp } from "@/lib/store";

/** Текст с подсветкой найденных фрагментов (<mark> на токене warning, читается в обеих темах). */
export function Highlighted({ text, ranges }: { text: string; ranges: [number, number][] }) {
  const parts: React.ReactNode[] = [];
  let at = 0;
  ranges.forEach(([a, b], i) => {
    if (a > at) parts.push(<Fragment key={`t${i}`}>{text.slice(at, a)}</Fragment>);
    parts.push(
      <mark key={`m${i}`} className="rounded bg-warning-soft px-0.5 font-extrabold text-text">
        {text.slice(a, b)}
      </mark>,
    );
    at = b;
  });
  if (at < text.length) parts.push(<Fragment key="end">{text.slice(at)}</Fragment>);
  return <>{parts}</>;
}

/** Тело записи без строки, ставшей заголовком, — чтобы заголовок не дублировался в сниппете. */
function bodyForSnippet(n: Note): string {
  const own = n.title.trim();
  return !own || own === titleFromBody(n.body) ? bodyWithoutTitleLine(n.body) : n.body;
}

/** Карточка записи в списках: заголовок, начало текста, папка и дата. */
export function NoteCard({ note, showFolder = true }: { note: Note; showFolder?: boolean }) {
  const { t, lang } = useT();
  const folder = useApp((s) => s.notebook.folders.find((f) => f.id === note.folderId));
  const folderName = useFolderName();
  const title = note.title.trim() || titleFromBody(note.body) || t("notes2.note.untitled");
  const snippet = noteSnippet(bodyForSnippet(note), 110);
  const hasImg = !!note.images?.length;
  return (
    <Link
      href={`/notes/${encodeURIComponent(note.id)}`}
      className="flex flex-col gap-1 rounded-2xl border-2 border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-2 active:scale-[0.99]"
    >
      <span className="flex items-center gap-1.5">
        {note.source === "ai" && <Sparkles size={15} className="shrink-0 text-ai" aria-label={t("notes2.fromAi")} />}
        <span className="min-w-0 flex-1 truncate font-extrabold">{title}</span>
        {hasImg && <ImageIcon size={15} className="shrink-0 text-muted" aria-hidden />}
        {note.pinned && <Pin size={15} className="shrink-0 text-primary" aria-label={t("notes2.pinnedBadge")} />}
      </span>
      {snippet && <span className="line-clamp-2 text-sm font-semibold text-muted">{snippet}</span>}
      <span className="mt-0.5 flex items-center gap-2 text-xs font-bold text-muted">
        {showFolder && folder && (
          <span className={cn("flex min-w-0 items-center gap-1 rounded-full border px-2 py-0.5", FOLDER_STYLE[folder.color].card)}>
            <FolderIcon folder={folder} size={12} />
            <span className="truncate">{folderName(folder)}</span>
          </span>
        )}
        <span className="ml-auto shrink-0">{noteDate(note.updatedAt, lang)}</span>
      </span>
    </Link>
  );
}

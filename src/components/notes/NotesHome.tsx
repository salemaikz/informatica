"use client";

import { ChevronDown, ChevronRight, Check, FolderPlus, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LESSONS, UNITS } from "@/content/course";
import { ICONS } from "@/components/scenes/icons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { buildIndex, noteDocs, search, type SearchDoc } from "@/lib/search";
import { useApp } from "@/lib/store";
import { FolderSheet, FolderTile } from "./folder-ui";
import { Highlighted, NoteCard } from "./NoteCard";
import { useCleanEmptyNotes } from "./useCleanEmptyNotes";

/** Главная конспектов: поиск, закреплённые, папки, недавние записи и конспекты уроков. */
export function NotesHome() {
  const { t, lang } = useT();
  const router = useRouter();
  const notebook = useApp((s) => s.notebook);
  const lessons = useApp((s) => s.lessons);
  const createNote = useApp((s) => s.createNote);
  const [query, setQuery] = useState("");
  const [folderOpen, setFolderOpen] = useState(false);

  useCleanEmptyNotes();

  const pinned = notebook.notes.filter((n) => n.pinned).sort((a, b) => b.updatedAt - a.updatedAt);
  const recent = [...notebook.notes].sort((a, b) => b.updatedAt - a.updatedAt).filter((n) => !n.pinned).slice(0, 5);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of notebook.notes) m.set(n.folderId, (m.get(n.folderId) ?? 0) + 1);
    return m;
  }, [notebook.notes]);

  // Индекс поиска: записи ученика + шпаргалки готовых уроков. Пересобирается при смене записей или языка.
  const index = useMemo(() => {
    const docs: SearchDoc[] = noteDocs(notebook.notes);
    for (const unit of UNITS) {
      for (const ref of unit.lessons) {
        const lesson = LESSONS[ref.id];
        if (!lesson) continue;
        docs.push({
          id: `conspect:${lesson.id}`,
          kind: "conspect",
          title: lesson.title[lang],
          text: lesson.conspect[lang],
          href: `/notes/lesson/${lesson.id}`,
          lessonId: lesson.id,
          unitId: unit.id,
        });
      }
    }
    return buildIndex(docs);
  }, [notebook.notes, lang]);
  const q = query.trim();
  const results = useMemo(() => (q.length >= 2 ? search(index, q, 40) : []), [index, q]);
  const noteResults = results.filter((r) => r.doc.kind === "note");
  const lessonResults = results.filter((r) => r.doc.kind === "conspect");

  const addNote = () => {
    const id = createNote({ source: "own", body: "" });
    router.push(`/notes/${id}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">{t("notes.title")}</h1>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search size={20} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("notes2.search.placeholder")}
            aria-label={t("notes2.search.placeholder")}
            className="h-12 w-full rounded-2xl border-2 border-border bg-surface pl-11 pr-11 font-semibold outline-none [appearance:none] focus:border-primary [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("notes2.search.clear")}
              className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-muted hover:text-text"
            >
              <X size={18} aria-hidden />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button icon={<Plus size={20} aria-hidden />} onClick={addNote}>
            {t("notes2.newNote")}
          </Button>
          <Button variant="secondary" icon={<FolderPlus size={20} aria-hidden />} onClick={() => setFolderOpen(true)}>
            {t("notes2.newFolder")}
          </Button>
        </div>
      </div>

      {q ? (
        <div className="flex flex-col gap-5" aria-live="polite">
          {results.length === 0 && (
            <Card className="py-8 text-center">
              <p className="font-extrabold">{t("notes2.search.empty")}</p>
              <p className="text-sm font-semibold text-muted">{t("notes2.search.emptyHint")}</p>
            </Card>
          )}
          {[
            { key: "notes", title: t("notes2.search.group.notes"), items: noteResults },
            { key: "lessons", title: t("notes2.search.group.lessons"), items: lessonResults },
          ]
            .filter((g) => g.items.length)
            .map((g) => (
              <section key={g.key}>
                <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-muted">{g.title}</h2>
                <ul className="flex flex-col gap-2">
                  {g.items.map((r) => (
                    <li key={r.doc.id}>
                      <Link href={r.doc.href} className="flex flex-col gap-0.5 rounded-2xl border-2 border-border bg-surface px-4 py-3 hover:bg-surface-2">
                        <span className="truncate font-extrabold">{r.doc.title || t("notes2.note.untitled")}</span>
                        <span className="line-clamp-2 text-sm font-semibold text-muted">
                          <Highlighted text={r.snippet.text} ranges={r.snippet.ranges} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      ) : (
        <>
          {pinned.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-muted">{t("notes2.pinned")}</h2>
              <ul className="flex flex-col gap-2">
                {pinned.map((n) => (
                  <li key={n.id}>
                    <NoteCard note={n} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-muted">{t("notes2.folders")}</h2>
            <div className="grid grid-cols-2 gap-3">
              {notebook.folders.map((f) => (
                <FolderTile key={f.id} folder={f} count={counts.get(f.id) ?? 0} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-muted">{t("notes2.recent")}</h2>
            {recent.length === 0 && pinned.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-border px-4 py-5 text-center font-semibold text-muted">{t("notes2.empty")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {recent.map((n) => (
                  <li key={n.id}>
                    <NoteCard note={n} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <LessonConspects lessons={lessons} />
        </>
      )}

      <FolderSheet open={folderOpen} onClose={() => setFolderOpen(false)} onCreated={(id) => router.push(`/notes/folder/${encodeURIComponent(id)}`)} />
    </div>
  );
}

/** Конспекты готовых уроков, сгруппированные по разделам (раздел сворачивается). */
function LessonConspects({ lessons }: { lessons: Record<string, unknown> }) {
  const { t, l } = useT();
  const groups = UNITS.map((u) => ({ unit: u, items: u.lessons.filter((r) => LESSONS[r.id]) })).filter((g) => g.items.length);
  // Открыты разделы с пройденными уроками; если таких нет — первый.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const defaultOpen = (unitId: string, items: { id: string }[], i: number) => items.some((r) => lessons[r.id]) || (i === 0 && !groups.some((g) => g.items.some((r) => lessons[r.id])));
  if (groups.length === 0) return null;
  return (
    <section>
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted">{t("notes2.lessons")}</h2>
      <p className="mb-2 text-sm font-semibold text-muted">{t("notes2.lessonsHint")}</p>
      <div className="flex flex-col gap-2">
        {groups.map(({ unit, items }, i) => {
          const open = toggled[unit.id] ?? defaultOpen(unit.id, items, i);
          const Icon = unit.icon ? ICONS[unit.icon] : undefined;
          return (
            <div key={unit.id} className="overflow-hidden rounded-2xl border-2 border-border bg-surface">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setToggled((s) => ({ ...s, [unit.id]: !open }))}
                className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2 text-left"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: unit.color }}>
                  {Icon && <Icon size={18} aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-extrabold">{l(unit.title)}</span>
                  <span className="block text-xs font-bold text-muted">{t("notes2.lessonsCount", { n: items.length })}</span>
                </span>
                <ChevronDown size={18} aria-hidden className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")} />
              </button>
              {open && (
                <ul className="border-t-2 border-border">
                  {items.map((r) => (
                    <li key={r.id} className="border-b border-border last:border-b-0">
                      <Link href={`/notes/lesson/${r.id}`} className="flex min-h-12 items-center gap-2 px-3.5 py-2 font-bold hover:bg-surface-2">
                        <span className="min-w-0 flex-1">{l(r.title)}</span>
                        {lessons[r.id] ? (
                          <span className="flex shrink-0 items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-extrabold text-success-strong">
                            <Check size={12} aria-hidden /> {t("notes2.passed")}
                          </span>
                        ) : null}
                        <ChevronRight size={16} aria-hidden className="shrink-0 text-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

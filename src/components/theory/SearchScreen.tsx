"use client";

import { BookOpen, Dumbbell, FileText, ListChecks, NotebookPen, SearchX, Target } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { lessonMeta } from "@/content/catalog";
import { useApp } from "@/lib/store";
import { titleFromBody } from "@/lib/notebook";
import { buildIndex, noteDocs, queryTokens, type SearchResult } from "@/lib/search";
import { groupResults, highlightRanges, searchAll, searchHref, type SearchGroup } from "@/lib/theory";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { Mascot } from "@/components/mascot/Mascot";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Highlight } from "./Highlight";
import { SearchField } from "./SearchField";
import { useCourseIndex } from "./useCourseIndex";
import { useRecentQueries } from "./useRecentQueries";

const GROUP_ICON: Record<SearchGroup, typeof BookOpen> = {
  lesson: BookOpen,
  theory: FileText,
  conspect: ListChecks,
  note: NotebookPen,
  skill: Dumbbell,
};
const POPULAR: DictKey[] = ["search.pop.1", "search.pop.2", "search.pop.3", "search.pop.4", "search.pop.5", "search.pop.6"];
/** Сколько результатов группы видно сразу. */
const GROUP_VISIBLE = 5;

function Chip({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-10 rounded-full border-2 border-border bg-surface px-4 text-sm font-extrabold hover:bg-surface-2"
    >
      {children}
    </button>
  );
}

function ResultItem({ r, query, onOpen }: { r: SearchResult; query: string; onOpen: () => void }) {
  const { t, l } = useT();
  const { doc } = r;
  const lesson = doc.lessonId ? lessonMeta(doc.lessonId) : undefined;
  const Icon = doc.kind === "topic" ? Target : GROUP_ICON[doc.kind === "skill" ? "skill" : doc.kind];
  // Куда ведёт: у теории и конспектов — урок, у навыка/темы — вид записи.
  const meta =
    doc.kind === "skill" || doc.kind === "topic"
      ? t(doc.kind === "skill" ? "search.kind.skill" : "search.kind.topic")
      : lesson && doc.kind !== "lesson"
        ? t("search.inLesson", { title: l(lesson.title) })
        : null;
  return (
    <li>
      <Link
        href={doc.href}
        onClick={onOpen}
        className="flex items-start gap-3 rounded-2xl border-2 border-border bg-surface p-3 transition-colors hover:bg-surface-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span aria-hidden className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold leading-snug">
            <Highlight text={doc.title} ranges={highlightRanges(doc.title, query)} />
          </p>
          {meta && <p className="text-xs font-bold text-muted">{meta}</p>}
          {r.snippet.text && (
            <p className="mt-1 line-clamp-3 break-words text-sm font-semibold text-muted">
              <Highlight text={r.snippet.text} ranges={r.snippet.ranges} />
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}

/** Поиск по урокам, теории, конспектам, навыкам и записям ученика. Запрос живёт в URL (`?q=`). */
export function SearchScreen() {
  const { t, lang } = useT();
  const params = useSearchParams();
  const notes = useApp((s) => s.notebook.notes);
  const [query, setQuery] = useState(() => (params.get("q") ?? "").slice(0, 200));
  const [expanded, setExpanded] = useState<Set<SearchGroup>>(new Set());
  const { recent, remember, clear } = useRecentQueries();

  // Индекс курса строится один раз на язык (грузится отдельным куском, null — ещё грузится);
  // записи ученика — отдельный маленький индекс (меняется при правках).
  const { index: courseIndex, failed: courseFailed, retry: retryCourse } = useCourseIndex(lang);
  const noteIndex = useMemo(
    () =>
      buildIndex(
        noteDocs(
          notes.map((n) => {
            // Записи из localStorage (в том числе старые сохранения) — поля могут быть не строками.
            const body = typeof n.body === "string" ? n.body : "";
            return { id: String(n.id), title: (typeof n.title === "string" && n.title) || titleFromBody(body), body, lessonId: n.lessonId };
          }),
        ),
      ),
    [notes],
  );

  // Популярные темы — только те, по которым в курсе уже что-то есть (готовы не все уроки).
  const popular = useMemo(
    () => (courseIndex ? POPULAR.map((key) => t(key)).filter((q) => searchAll([{ index: courseIndex, limit: 1 }], q, 1).results.length > 0) : []),
    [courseIndex, t],
  );

  const deferred = useDeferredValue(query);
  const tokens = useMemo(() => queryTokens(deferred), [deferred]);
  // Точный поиск, а если пусто — мягкий (без окончаний): matched — по какому запросу нашлось, для подсветки.
  const { groups, matched } = useMemo(() => {
    if (!tokens.length) return { groups: [], matched: deferred };
    const found = searchAll(
      [
        ...(courseIndex ? [{ index: courseIndex, limit: 120 }] : []),
        { index: noteIndex, limit: 30 },
      ],
      deferred,
      150,
    );
    return { groups: groupResults(found.results), matched: found.query };
  }, [courseIndex, noteIndex, deferred, tokens.length]);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  // Адрес страницы повторяет запрос (можно скопировать ссылку); без перерисовки роутера.
  useEffect(() => {
    const id = window.setTimeout(() => window.history.replaceState(window.history.state, "", searchHref(query)), 250);
    return () => window.clearTimeout(id);
  }, [query]);

  const typed = query.trim().length > 0;
  const courseLoading = !courseIndex && !courseFailed;
  const toggle = (g: SearchGroup) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(g)) next.add(g);
      return next;
    });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">{t("search.title")}</h1>
      <SearchField value={query} onChange={setQuery} onSubmit={() => remember(query)} placeholder={t("search.placeholder")} autoFocus={!query} />
      {/* Для экранного диктора: сколько найдено (весь список в live-регион не кладём — его зачитывало бы на каждую букву). */}
      <p role="status" className="sr-only">
        {tokens.length > 0 ? (total > 0 ? t("search.found", { n: total }) : courseLoading ? t("common.loading") : t("search.empty")) : ""}
      </p>

      {!typed && (
        <div className="flex flex-col gap-5">
          {recent.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-extrabold uppercase text-muted">{t("search.recent")}</h2>
                <button type="button" onClick={clear} className="-mr-2 h-10 rounded-xl px-2 text-sm font-extrabold text-primary hover:bg-primary-soft">
                  {t("search.clearRecent")}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recent.map((q) => (
                  <Chip key={q} onClick={() => setQuery(q)}>
                    {q}
                  </Chip>
                ))}
              </div>
            </section>
          )}
          {popular.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-extrabold uppercase text-muted">{t("search.popular")}</h2>
              <div className="flex flex-wrap gap-2">
                {popular.map((q) => (
                  <Chip key={q} onClick={() => setQuery(q)}>
                    {q}
                  </Chip>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {typed && tokens.length === 0 && <p className="font-semibold text-muted">{t("search.short")}</p>}

      {tokens.length > 0 && total === 0 && courseLoading && <p className="font-semibold text-muted">{t("common.loading")}</p>}

      {typed && courseFailed && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-warning-soft px-4 py-3 text-sm font-bold text-warning-strong">
          <span>{t("common.loadFailed")}</span>
          <Button size="sm" variant="secondary" onClick={retryCourse}>
            {t("common.retry")}
          </Button>
        </div>
      )}

      {tokens.length > 0 && total === 0 && !courseLoading && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border px-4 py-8 text-center">
          <Mascot mood="thinking" size={88} />
          <p className="flex items-center gap-2 text-lg font-extrabold">
            <SearchX size={20} aria-hidden className="text-muted" /> {t("search.empty")}
          </p>
          <p className="max-w-xs font-semibold text-muted">{t("search.emptyHint")}</p>
          <ButtonLink href={`/tutor?q=${encodeURIComponent(query.trim())}`} variant="ai" size="md">
            {t("search.askBit")}
          </ButtonLink>
        </div>
      )}

      {total > 0 && (
        <div className="flex flex-col gap-5">
          <p aria-hidden className="text-sm font-bold text-muted">
            {t("search.found", { n: total })}
          </p>
          {groups.map(({ group, items }) => {
            const Icon = GROUP_ICON[group];
            const open = expanded.has(group);
            const shown = open ? items : items.slice(0, GROUP_VISIBLE);
            return (
              <section key={group}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase text-muted">
                  <Icon size={16} aria-hidden /> {t(`search.group.${group}` as DictKey)}
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">{items.length}</span>
                </h2>
                <ul className="flex flex-col gap-2">
                  {shown.map((r) => (
                    <ResultItem key={r.doc.id} r={r} query={matched} onOpen={() => remember(query)} />
                  ))}
                </ul>
                {items.length > GROUP_VISIBLE && (
                  <button
                    type="button"
                    onClick={() => toggle(group)}
                    className={cn("mt-2 h-10 w-full rounded-xl text-sm font-extrabold text-primary hover:bg-primary-soft")}
                  >
                    {open ? t("search.less") : t("search.more", { n: items.length - GROUP_VISIBLE })}
                  </button>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

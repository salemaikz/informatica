"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { getLesson, UNITS } from "@/content/course";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { readingStats, searchHref } from "@/lib/theory";
import { iconFor } from "@/components/scenes/icons";
import { LessonCard } from "./LessonCard";
import { SearchField } from "./SearchField";
import { useHashScroll } from "./useHashScroll";

/** Справочник теории: поиск, чипы разделов, уроки по разделам (готовые первыми, «скоро» — серыми в конце). */
export function TheoryHome() {
  const { t, l, lang } = useT();
  const router = useRouter();
  const lessons = useApp((s) => s.lessons);
  const [query, setQuery] = useState("");

  // Статистика чтения не зависит от прогресса — считаем один раз на язык.
  const sections = useMemo(
    () =>
      UNITS.map((unit) => {
        const ready = unit.lessons.flatMap((ref) => {
          const lesson = ref.status === "available" ? getLesson(ref.id) : undefined;
          return lesson ? [{ lesson, stats: readingStats(lesson, lang) }] : [];
        });
        const soon = unit.lessons.filter((ref) => ref.status !== "available" || !getLesson(ref.id));
        return { unit, ready, soon };
      }),
    [lang],
  );

  // Переход по ссылке «/theory#u3» (из урока, с карты курса): доскролл к разделу.
  useHashScroll("theory", false);

  // Пустой запрос — тоже на поиск: там популярные темы и недавние запросы.
  const go = () => router.push(searchHref(query));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">{t("theory.title")}</h1>
        <p className="font-semibold text-muted">{t("theory.subtitle")}</p>
      </div>

      <SearchField value={query} onChange={setQuery} onSubmit={go} placeholder={t("theory.searchPlaceholder")} />

      <nav aria-label={t("theory.units")} className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {sections.map(({ unit }) => {
            const Icon = iconFor(unit.icon ?? "box");
            return (
              <li key={unit.id}>
                <a
                  href={`#${unit.id}`}
                  className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-border bg-surface px-3 text-sm font-extrabold hover:bg-surface-2"
                >
                  <Icon size={16} aria-hidden style={{ color: unit.color }} />
                  {l(unit.title)}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {sections.map(({ unit, ready, soon }) => {
        const Icon = iconFor(unit.icon ?? "box");
        return (
          <section key={unit.id} id={unit.id} className="scroll-mt-20">
            <div className="mb-3 flex items-start gap-3">
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `color-mix(in srgb, ${unit.color} 16%, transparent)`, color: unit.color }}
              >
                <Icon size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-extrabold leading-tight">{l(unit.title)}</h2>
                <p className="text-sm font-semibold text-muted">{l(unit.description)}</p>
                {soon.length > 0 && (
                  <p className="mt-0.5 text-xs font-bold text-muted">{t("theory.ready", { n: ready.length, m: ready.length + soon.length })}</p>
                )}
              </div>
            </div>
            <ul className="flex flex-col gap-2">
              {ready.map(({ lesson, stats }) => (
                <LessonCard
                  key={lesson.id}
                  id={lesson.id}
                  title={lesson.title}
                  description={lesson.description}
                  stats={stats}
                  done={(lessons[lesson.id]?.completions ?? 0) > 0}
                  color={unit.color}
                />
              ))}
              {soon.map((ref) => (
                <LessonCard key={ref.id} id={ref.id} title={ref.title} stats={null} color={unit.color} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

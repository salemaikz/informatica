"use client";

import { BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { lessonMeta } from "@/content/catalog";
import { UNITS } from "@/content/course-map";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store";
import { CONSPECT_ID, paramValue, theoryCardHref, UNIT_PARAM } from "@/lib/theory-href";
import { useT } from "@/i18n/useT";
import {
  continueTarget,
  initialOpenUnit,
  lessonPlace,
  lessonReadStatus,
  readableLessonIds,
  searchHref,
  unitReadableIds,
  unitSummary,
} from "@/lib/theory";
import { iconFor } from "@/components/scenes/icons";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { LessonCard } from "./LessonCard";
import { SearchField } from "./SearchField";
import { TheoryCost } from "./TheoryCost";
import { useHashScroll } from "./useHashScroll";

const ORDER = readableLessonIds(UNITS);

/**
 * Справочник теории (этап 16В, «Теория 2.0»): поиск, «Продолжить чтение» и разделы списком — свёрнутые, со сводкой
 * «прочитано N из M»; раскрыт не больше одного (при входе — по адресу `?unit=u3` (старое `#u3` при полной загрузке тоже)
 * или раздел текущего урока). Внутри — уроки по порядку с номерами и статусами: пройден / прочитан / не начат / скоро.
 */
export function TheoryHome() {
  const { t, l, lang } = useT();
  const router = useRouter();
  // Раздел из адреса (`?unit=u3`): параметр актуален с первого рендера и при переходе внутри приложения (у `#u3` — нет).
  const unitParam = paramValue(useSearchParams().get(UNIT_PARAM));
  const reduce = useReduceMotion();
  const lessons = useApp((s) => s.lessons);
  const theoryRead = useApp((s) => s.theoryRead);
  const last = useApp((s) => s.theoryLast);
  const [query, setQuery] = useState("");

  // Что продолжить: последний открытый урок с того же места или, если он дочитан, следующий по курсу.
  const cont = useMemo(() => continueTarget(last, ORDER, (id) => lessonMeta(id)?.reading[lang].cards ?? null), [last, lang]);
  const contMeta = cont ? lessonMeta(cont.id) : undefined;
  const contPlace = cont ? lessonPlace(UNITS, cont.id) : null;

  // Страницы показываются после гидратации стора (Providers): адрес и стор читаются сразу, раздел раскрыт с первого кадра.
  const [open, setOpen] = useState<string | null>(() =>
    initialOpenUnit(UNITS, typeof window === "undefined" ? "" : window.location.hash, cont?.id ?? last?.id, unitParam),
  );
  const toggled = useRef<string | null>(null);

  const sections = useMemo(
    () =>
      UNITS.map((unit, index) => {
        const ready = unitReadableIds(unit).flatMap((id) => {
          const meta = lessonMeta(id);
          return meta ? [{ id, meta }] : [];
        });
        const soon = unit.lessons.filter((ref) => !ready.some((r) => r.id === ref.id));
        return { unit, index, ready, soon };
      }),
    [],
  );

  const isDone = (id: string) => (lessons[id]?.completions ?? 0) > 0;
  const isRead = (id: string) => !!theoryRead[id];

  // Переход по ссылке «/theory?unit=u3» (из урока, с карты курса): доскролл к разделу (только к известному — как и раскрытие).
  useHashScroll("theory", false, unitParam && UNITS.some((u) => u.id === unitParam) ? unitParam : null);

  // Раскрыли раздел — его шапка в начало экрана (свёрнутый выше раздел сдвигает страницу).
  useEffect(() => {
    const id = toggled.current;
    toggled.current = null;
    if (id && open === id) document.getElementById(id)?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, [open, reduce]);

  const toggle = (id: string) => {
    toggled.current = id;
    setOpen((cur) => (cur === id ? null : id));
  };

  // Пустой запрос — тоже на поиск: там популярные темы и недавние запросы.
  const go = () => router.push(searchHref(query));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">{t("theory.title")}</h1>
        <p className="font-semibold text-muted">{t("theory.subtitle")}</p>
      </div>

      <SearchField value={query} onChange={setQuery} onSubmit={go} placeholder={t("theory.searchPlaceholder")} />

      {cont && contMeta && (
        <Link
          // Дочитанный последний урок (подпись «Конспект») открываем на конспекте; иначе — с того места, где остановились (theoryLast).
          href={!cont.next && cont.card >= cont.cards ? theoryCardHref(cont.id, CONSPECT_ID) : theoryCardHref(cont.id)}
          className="flex items-center gap-3 rounded-3xl border-2 border-primary/40 bg-primary-soft p-4 transition-[filter] hover:brightness-95 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-primary">
            <BookOpen size={24} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-extrabold uppercase tracking-wide text-primary">{t("theory16c.home.continue")}</span>
            <span className="block font-extrabold leading-snug">{l(contMeta.title)}</span>
            <span className="block text-sm font-semibold text-muted">
              {contPlace && `${t("learn.unit", { n: contPlace.unitIndex + 1 })} · `}
              {cont.next
                ? t("theory16c.home.continueNext")
                : cont.card >= cont.cards
                  ? t("theory.conspect")
                  : t("theory16c.home.continueAt", { n: cont.card + 1, m: cont.cards })}
            </span>
          </span>
          <TheoryCost id={cont.id} />
          <ChevronRight size={22} className="shrink-0 text-primary" aria-hidden />
        </Link>
      )}

      <ul aria-label={t("theory.units")} className="flex flex-col gap-3" data-tour="theory-units">
        {sections.map(({ unit, index, ready, soon }) => {
          const Icon = iconFor(unit.icon ?? "box");
          const isOpen = open === unit.id;
          const sum = unitSummary(
            ready.map((r) => r.id),
            isDone,
            isRead,
          );
          return (
            <li key={unit.id} id={unit.id} className="scroll-mt-20 rounded-3xl border-2 border-border bg-surface">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${unit.id}-lessons`}
                aria-label={`${t("learn.unit", { n: index + 1 })}. ${l(unit.title)}. ${t(isOpen ? "theory16c.unit.close" : "theory16c.unit.open")}`}
                onClick={() => toggle(unit.id)}
                className="flex w-full items-center gap-3 rounded-3xl p-3.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `color-mix(in srgb, ${unit.color} 16%, transparent)`, color: unit.color }}
                >
                  <Icon size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-extrabold uppercase tracking-wide" style={{ color: unit.color }}>
                    {t("learn.unit", { n: index + 1 })}
                  </span>
                  <span className="block font-extrabold leading-tight">{l(unit.title)}</span>
                  <span className="mt-0.5 block text-sm font-semibold text-muted">
                    {sum.total > 0 ? t("theory16c.unit.summary", { n: sum.read, m: sum.total }) : t("theory16c.unit.none")}
                  </span>
                  {sum.total > 0 && <ProgressBar value={sum.read / sum.total} color={unit.color} height={6} className="mt-2" label={t("theory16c.unit.summary", { n: sum.read, m: sum.total })} />}
                </span>
                <ChevronDown size={22} aria-hidden className={cn("shrink-0 text-muted transition-transform", isOpen && "rotate-180")} />
              </button>

              {isOpen && (
                <div id={`${unit.id}-lessons`} className="flex flex-col gap-2 px-3 pb-3.5">
                  <p className="px-1 text-sm font-semibold text-muted">{l(unit.description)}</p>
                  <ol className="flex flex-col gap-2">
                    {ready.map(({ id, meta }, i) => (
                      <LessonCard
                        key={id}
                        id={id}
                        number={i + 1}
                        title={meta.title}
                        stats={meta.reading[lang]}
                        status={lessonReadStatus({ done: isDone(id), read: isRead(id) })}
                        color={unit.color}
                      />
                    ))}
                  </ol>
                  {soon.length > 0 && (
                    <ul className="flex flex-col gap-1.5">
                      {soon.map((ref) => (
                        <LessonCard key={ref.id} id={ref.id} title={ref.title} stats={null} color={unit.color} />
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

"use client";

import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { UNITS } from "@/content/course-map";
import { cn } from "@/lib/cn";
import { ENTRY_COST } from "@/lib/economy";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import type { Lesson } from "@/lib/types";
import {
  adjacentLessons,
  blockContext,
  cardIndexFromHash,
  CONSPECT_ID,
  clampCard,
  conspectContext,
  infoSteps,
  initialCard,
  lessonPlace,
  liveCardParam,
  lessonReadStatus,
  pluralIndex,
  readableLessonIds,
  readingStats,
  theoryCardIds,
  withoutCardAnchor,
  type LessonReadStatus,
} from "@/lib/theory";
import { CARD_PARAM, paramValue } from "@/lib/theory-href";
import { useApp } from "@/lib/store";
import { AiPanel } from "@/components/ai/AiPanel";
import { useOpenLessonChat } from "@/components/chat/useLessonChat";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { OutOfHearts } from "@/components/economy/OutOfHearts";
import { springSoft } from "@/components/motion/presets";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { useSaveToNotes } from "@/components/notes/saveToNotesBus";
import { InfoBlock } from "./TheoryBlocks";
import { CardProgress } from "./TheoryCards";
import { ConspectActions, ConspectCard } from "./TheoryConspect";
import { TheoryCrumbs } from "./TheoryCrumbs";
import { useHashScroll } from "./useHashScroll";
import { useSwipe } from "./useSwipe";
import { useTheoryAccess } from "./useTheoryAccess";

const CARDS_KEY: DictKey[] = ["theory.cards.one", "theory.cards.few", "theory.cards.many"];
const SUGGESTIONS: DictKey[] = ["tutor.q.simpler", "tutor.q.example", "tutor.q.why"];
const ORDER = readableLessonIds(UNITS);

/**
 * Чтение урока без заданий (этап 16В, «Теория 2.0»): карточки урока — по одной (как шаги урока), последняя — конспект.
 * Сверху «где я»: раздел, номер урока, лента уроков раздела. Переключатель «По карточкам / Всё сразу» запоминается.
 * Ничего не пишет в прогресс уроков; запоминает последнюю карточку (theoryLast) и прочитанный до конспекта урок (theoryRead).
 * Адрес карточки: `?card=<id шага>` и `?card=conspect` (на них ведёт поиск; страница читает параметр на сервере и передаёт
 * сюда как initialCard). Старые ссылки с `#<id шага>` при полной загрузке тоже открывают нужную карточку. После первого листания
 * `?card=` из адреса убирается; при «Назад» к такой записи параметр с сервера устарел — его сверяем с useSearchParams (liveCardParam).
 * Плата (решение #113): ½ сердечка списывается при открытии темы (useTheoryAccess), без бесплатной карточки, ворот и пояснений
 * на странице; «Безлимит» и повтор той же темы за сутки — бесплатно. Нет сердечек — «Сердечки закончились», текста темы нет.
 * Урок приходит с сервера (страница /theory/[id]): клиент не грузит содержимое всех уроков (этап 16).
 */
export function TheoryReader({ lesson, initialCard: cardParam = null }: { lesson: Lesson; initialCard?: string | null }) {
  const id = lesson.id;
  const { t, l, lang } = useT();
  const router = useRouter();
  const reduce = useReduceMotion();
  const { access, resume } = useTheoryAccess(id);
  const open = access === "open";
  const openSave = useSaveToNotes((s) => s.open);
  const openChat = useOpenLessonChat();
  const lessons = useApp((s) => s.lessons);
  const theoryRead = useApp((s) => s.theoryRead);
  const mode = useApp((s) => s.theoryMode);
  const setMode = useApp((s) => s.setTheoryMode);

  const steps = useMemo(() => infoSteps(lesson), [lesson]);
  const cardIds = useMemo(() => theoryCardIds(steps), [steps]);
  const total = cardIds.length;
  const last = total - 1;
  const stats = useMemo(() => readingStats(lesson, lang), [lesson, lang]);
  const place = useMemo(() => lessonPlace(UNITS, id), [id]);
  const nextLessonId = adjacentLessons(ORDER, id).next;

  const statusOf = (lid: string): LessonReadStatus => lessonReadStatus({ done: (lessons[lid]?.completions ?? 0) > 0, read: !!theoryRead[lid] });
  const status = statusOf(id);

  // Страницы показываются только после гидратации стора (Providers), поэтому якорь и сохранённая карточка читаются сразу.
  // Параметр ?card= — от сервера (при переходе внутри приложения window.location.hash ещё старый); хэш — только старые ссылки.
  // Но «Назад» к записи, где ?card= уже убрали при листании (go), поднимает прежние пропсы с карточкой из поиска: сверяем с адресом
  // роутера (useSearchParams — в первом рендере он уже новый, в отличие от window.location). Устарел — открываем theoryLast.
  const urlCard = paramValue(useSearchParams().get(CARD_PARAM));
  const [startCard] = useState(() => liveCardParam(cardParam, urlCard));
  const [index, setIndex] = useState(() =>
    initialCard({
      card: startCard,
      hash: typeof window === "undefined" ? "" : window.location.hash,
      cardIds,
      lessonId: id,
      last: useApp.getState().theoryLast,
    }),
  );
  const [dir, setDir] = useState<1 | -1>(1);
  const [askId, setAskId] = useState<string | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const conspectRef = useRef<HTMLDivElement>(null);

  // Запоминаем, где остановились: «Продолжить чтение» на странице «Теория». Пока тема не открыта (оплата, нет сердечек),
  // ученик ничего не читал — не пишем: запись о карточке (особенно о конспекте, `?card=conspect` из поиска) выглядела бы как «дочитан».
  useEffect(() => {
    if (open) useApp.getState().noteTheoryOpen(id, index);
  }, [id, index, open]);

  // «Прочитан»: конспект (последняя карточка) открыт.
  useEffect(() => {
    if (open && mode === "cards" && index === last) useApp.getState().markTheoryRead(id);
  }, [open, mode, index, last, id]);

  // То же в режиме «Всё сразу»: конспект показался на экране.
  useEffect(() => {
    const el = conspectRef.current;
    if (mode !== "all" || !open || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        const app = useApp.getState();
        app.markTheoryRead(id);
        app.noteTheoryOpen(id, last);
        io.disconnect();
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mode, open, id, last]);

  // Якорь сменился без перезагрузки (кнопки «назад»/«вперёд» браузера): открываем нужную карточку.
  useEffect(() => {
    const onHash = () => {
      const i = cardIndexFromHash(window.location.hash, cardIds);
      if (i !== null) setIndex(i);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [cardIds]);

  // Переход по ссылке на карточку (из поиска): доскролл и короткая подсветка (в режиме карточек она уже открыта).
  // Пока тема не открыта (оплата, нет сердечек), блоков на странице нет: ключ меняется при открытии — доскролл перезапускается.
  useHashScroll(open ? id : `${id}:closed`, true, open && startCard && cardIds.includes(startCard) ? startCard : null);

  const askTask = useMemo(() => {
    if (!askId) return null;
    if (askId === CONSPECT_ID) return conspectContext(lesson, lang);
    const step = steps.find((s) => s.id === askId);
    return step ? blockContext(step, lesson, lang) : null;
  }, [lesson, steps, askId, lang]);

  const go = (i: number) => {
    const next = clampCard(i, total);
    if (next === index) return;
    setDir(next > index ? 1 : -1);
    setIndex(next);
    // Якорь из адреса (?card= или #…) сработал при входе; дальше он только мешал бы (обновление страницы вернуло бы к нему, а не к месту, где остановились).
    const clean = withoutCardAnchor(window.location.pathname, window.location.search, window.location.hash);
    if (clean !== null) window.history.replaceState(window.history.state, "", clean);
    // Новая карточка — с её начала (шапка урока остаётся выше).
    areaRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  };

  const swipe = useSwipe({ onPrev: () => go(index - 1), onNext: () => go(index + 1) });

  const saveConspect = () => openSave({ source: "lesson", lessonId: lesson.id, title: l(lesson.title), text: l(lesson.conspect) });

  const card =
    index === last ? (
      <ConspectCard lesson={lesson} onAsk={() => setAskId(CONSPECT_ID)} />
    ) : (
      <InfoBlock step={steps[index]} onAsk={() => setAskId(steps[index].id)} />
    );

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3">
        {place ? (
          <TheoryCrumbs place={place} lessonId={id} statusOf={statusOf} />
        ) : (
          <Link href="/theory" className="-ml-2 flex h-10 items-center gap-1.5 self-start rounded-xl px-2 text-sm font-extrabold text-primary hover:bg-primary-soft">
            <ArrowLeft size={16} /> {t("theory.back")}
          </Link>
        )}
        <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{l(lesson.title)}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="muted">{t(CARDS_KEY[lang === "ru" ? pluralIndex(stats.cards) : 2], { n: stats.cards })}</Pill>
          <Pill tone="muted">{t("theory.readMin", { n: stats.minutes })}</Pill>
          {status === "done" && (
            <Pill tone="success" icon={<Check size={12} strokeWidth={3.5} />}>
              {t("theory16c.status.done")}
            </Pill>
          )}
          {status === "read" && <Pill tone="primary">{t("theory16c.status.read")}</Pill>}
        </div>
        {open && (
          <Button variant="ai" block icon={<Sparkles size={20} aria-hidden />} onClick={() => openChat(lesson)} data-tour="theory-ask">
            {t("theory16c.ask.button")}
          </Button>
        )}
      </header>

      {/* Текст темы — только когда она открыта: пока идёт списание или нет сердечек, ни одной карточки на странице нет. */}
      {open && <div className="flex flex-col gap-4">
        <div role="group" aria-label={t("theory16c.mode.label")} className="flex self-start rounded-2xl bg-surface-2 p-1">
          {(["cards", "all"] as const).map((m2) => (
            <button
              key={m2}
              type="button"
              aria-pressed={mode === m2}
              onClick={() => setMode(m2)}
              className={cn(
                "h-10 rounded-xl px-4 text-sm font-extrabold transition-colors",
                mode === m2 ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text",
              )}
            >
              {t(m2 === "cards" ? "theory16c.mode.cards" : "theory16c.mode.all")}
            </button>
          ))}
        </div>

        {mode === "cards" ? (
          <>
            <div ref={areaRef} className="scroll-mt-20">
              <CardProgress index={index} total={total} onGo={go} />
            </div>
            <div {...swipe}>
              <m.div
                key={index}
                className="flex min-w-0 flex-col gap-4"
                initial={reduce ? false : { opacity: 0, x: dir * 28 }}
                animate={{ opacity: 1, x: 0 }}
                transition={springSoft}
              >
                {card}
              </m.div>
            </div>
            {index === last && <ConspectActions lesson={lesson} nextLessonId={nextLessonId} onSave={saveConspect} />}
            <nav className={cn("grid gap-3", index < last ? "grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-1")}>
              <Button variant="secondary" size="lg" block={index === last} disabled={index === 0} icon={<ArrowLeft size={20} />} onClick={() => go(index - 1)} className="px-3">
                {t("theory16c.nav.back")}
              </Button>
              {index < last && (
                <Button size="lg" block icon={<ArrowRight size={20} />} onClick={() => go(index + 1)} data-tour="theory-next" className="flex-row-reverse px-3">
                  {t("theory16c.nav.next")}
                </Button>
              )}
            </nav>
          </>
        ) : (
          <>
            {cardIds.map((cid, i) =>
              cid === CONSPECT_ID ? (
                <div key={cid} ref={conspectRef} className="flex flex-col gap-4">
                  <ConspectCard lesson={lesson} onAsk={() => setAskId(CONSPECT_ID)} />
                </div>
              ) : (
                <InfoBlock key={cid} step={steps[i]} onAsk={() => setAskId(cid)} />
              ),
            )}
            <ConspectActions lesson={lesson} nextLessonId={nextLessonId} onSave={saveConspect} />
          </>
        )}
      </div>}

      {/* Нет сердечек: обычное окно «Сердечки закончились»; закрыть его = выйти к списку теории (onClose не задан). */}
      <OutOfHearts
        open={access === "locked"}
        need={ENTRY_COST.theory}
        what="theory"
        onResume={resume}
        onExit={() => router.push("/theory")}
      />

      {askId && askTask && (
        <AiPanel key={askId} open onClose={() => setAskId(null)} mode="ask" task={askTask} noteKey={lesson.id} suggestions={SUGGESTIONS} />
      )}
    </div>
  );
}

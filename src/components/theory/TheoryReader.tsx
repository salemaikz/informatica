"use client";

import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  cardToRemember,
  CONSPECT_ID,
  clampCard,
  conspectContext,
  infoSteps,
  initialCard,
  lessonPlace,
  lessonReadStatus,
  pluralIndex,
  readableLessonIds,
  readingStats,
  theoryCardIds,
  withoutCardAnchor,
  type LessonReadStatus,
} from "@/lib/theory";
import { isTheoryCardLocked, THEORY_FREE_CARDS } from "@/lib/theory-pay";
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
import { TheoryGate, TheoryPayButton, TheoryPayStatus } from "./TheoryPay";
import { useHashScroll } from "./useHashScroll";
import { useSwipe } from "./useSwipe";
import { useTheoryPay } from "./useTheoryPay";

const CARDS_KEY: DictKey[] = ["theory.cards.one", "theory.cards.few", "theory.cards.many"];
const SUGGESTIONS: DictKey[] = ["tutor.q.simpler", "tutor.q.example", "tutor.q.why"];
const ORDER = readableLessonIds(UNITS);

/**
 * Чтение урока без заданий (этап 16В, «Теория 2.0»): карточки урока — по одной (как шаги урока), последняя — конспект.
 * Сверху «где я»: раздел, номер урока, лента уроков раздела. Переключатель «По карточкам / Всё сразу» запоминается.
 * Ничего не пишет в прогресс уроков; запоминает последнюю карточку (theoryLast) и прочитанный до конспекта урок (theoryRead).
 * Адрес карточки: `?card=<id шага>` и `?card=conspect` (на них ведёт поиск; страница читает параметр на сервере и передаёт
 * сюда как initialCard). Старые ссылки с `#<id шага>` при полной загрузке тоже открывают нужную карточку.
 * Плата — явная (useTheoryPay): первая карточка бесплатна, дальше — кнопка «Читать дальше — 0,5»; «Безлимит» и повтор за сутки — бесплатно.
 * Урок приходит с сервера (страница /theory/[id]): клиент не грузит содержимое всех уроков (этап 16).
 */
export function TheoryReader({ lesson, initialCard: cardParam = null }: { lesson: Lesson; initialCard?: string | null }) {
  const id = lesson.id;
  const { t, l, lang } = useT();
  const router = useRouter();
  const reduce = useReduceMotion();
  const pay = useTheoryPay(id);
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
  const [index, setIndex] = useState(() =>
    initialCard({
      card: cardParam,
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

  const locked = isTheoryCardLocked(pay.state, index);
  const allUnlocked = pay.state !== "pay";

  // Запоминаем, где остановились: «Продолжить чтение» на странице «Теория». Карточку за платными воротами не пишем:
  // ученик её не прочитал, а «Продолжить» перескочил бы непрочитанный урок (конспект за воротами считался бы дочитанным).
  useEffect(() => {
    const card = cardToRemember(index, locked);
    if (card !== null) useApp.getState().noteTheoryOpen(id, card);
  }, [id, index, locked]);

  // «Прочитан»: конспект (последняя карточка) открыт — только оплаченным чтением, не превью.
  useEffect(() => {
    if (mode === "cards" && index === last && !locked) useApp.getState().markTheoryRead(id);
  }, [mode, index, last, locked, id]);

  // То же в режиме «Всё сразу»: конспект показался на экране.
  useEffect(() => {
    const el = conspectRef.current;
    if (mode !== "all" || !allUnlocked || !el || typeof IntersectionObserver === "undefined") return;
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
  }, [mode, allUnlocked, id, last]);

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
  useHashScroll(id, true, cardParam && cardIds.includes(cardParam) ? cardParam : null);

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

  // Свайп листает только по уже открытому: платные ворота — только кнопкой.
  const swipe = useSwipe({
    onPrev: () => go(index - 1),
    onNext: () => {
      if (!isTheoryCardLocked(pay.state, index + 1)) go(index + 1);
    },
  });

  /** Кнопка-ворота на превью: списать и открыть следующую карточку. */
  const payNext = () => {
    if (pay.unlock()) go(index + 1);
  };
  /** Не хватало сердечек — купили или дождались: списываем; кнопка была на превью — открываем следующую карточку. */
  const resume = () => {
    const wasPreview = mode === "cards" && index < THEORY_FREE_CARDS && index < last;
    if (pay.resume() && wasPreview) go(index + 1);
  };

  const saveConspect = () => openSave({ source: "lesson", lessonId: lesson.id, title: l(lesson.title), text: l(lesson.conspect) });

  const gateAt = index >= THEORY_FREE_CARDS && locked;
  const nextOpens = !isTheoryCardLocked(pay.state, index + 1);

  const card = gateAt ? (
    <TheoryGate onPay={() => void pay.unlock()} />
  ) : index === last ? (
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
        <TheoryPayStatus state={pay.state} paidAt={pay.paidAt} />
        <Button variant="ai" block icon={<Sparkles size={20} aria-hidden />} onClick={() => openChat(lesson)} data-tour="theory-ask">
          {t("theory16c.ask.button")}
        </Button>
      </header>

      <div className="flex flex-col gap-4">
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
            {index === last && !locked && <ConspectActions lesson={lesson} nextLessonId={nextLessonId} onSave={saveConspect} />}
            <nav className={cn("grid gap-3", index < last ? "grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-1")}>
              <Button variant="secondary" size="lg" block={index === last} disabled={index === 0} icon={<ArrowLeft size={20} />} onClick={() => go(index - 1)} className="px-3">
                {t("theory16c.nav.back")}
              </Button>
              {index < last &&
                (nextOpens ? (
                  <Button size="lg" block icon={<ArrowRight size={20} />} onClick={() => go(index + 1)} data-tour="theory-next" className="flex-row-reverse px-3">
                    {t("theory16c.nav.next")}
                  </Button>
                ) : gateAt ? null : (
                  <TheoryPayButton onClick={payNext} data-tour="theory-next" />
                ))}
            </nav>
          </>
        ) : (
          <>
            {cardIds.map((cid, i) => {
              if (isTheoryCardLocked(pay.state, i)) return null;
              return cid === CONSPECT_ID ? (
                <div key={cid} ref={conspectRef} className="flex flex-col gap-4">
                  <ConspectCard lesson={lesson} onAsk={() => setAskId(CONSPECT_ID)} />
                </div>
              ) : (
                <InfoBlock key={cid} step={steps[i]} onAsk={() => setAskId(cid)} />
              );
            })}
            {!allUnlocked && <TheoryGate onPay={() => void pay.unlock()} />}
            {allUnlocked && <ConspectActions lesson={lesson} nextLessonId={nextLessonId} onSave={saveConspect} />}
          </>
        )}
      </div>

      <OutOfHearts
        open={pay.sheetOpen}
        need={ENTRY_COST.theory}
        what="theory"
        onClose={() => pay.setSheetOpen(false)}
        onResume={resume}
        onExit={() => router.push("/theory")}
      />

      {askId && askTask && (
        <AiPanel key={askId} open onClose={() => setAskId(null)} mode="ask" task={askTask} noteKey={lesson.id} suggestions={SUGGESTIONS} />
      )}
    </div>
  );
}

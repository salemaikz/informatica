"use client";

import clsx from "clsx";
import { BookOpen, Check, Clapperboard, ClipboardCheck, Eye, Handshake, Hand, Lightbulb, Minus, Repeat, RotateCcw, Sparkles, Target, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AnswerRecord, Lang, LessonVia, QuestionStep, Scene, SessionResult, Step } from "@/lib/types";
import type { TaskContext } from "@/lib/ai-types";
import { evaluate, expectedText, isQuestion, isReady, promptText, type Answer, type StepResult } from "@/lib/evaluate";
import { levelInfo, xpForAnswer } from "@/lib/gamification";
import type { LessonRun } from "@/lib/lesson-run";
import { lessonXpFactorNow, useApp } from "@/lib/store";
import { activeMs } from "@/lib/active-clock";
import { track } from "@/lib/analytics";
import { finishEvent, playerHeartsWhere, quitEvent, sessionTotals, skipRecord, startEvent, taskEvent } from "@/lib/player-events";
import { getLesson } from "@/content/course";
import { scaleXp } from "@/lib/review";
import { formatFactor } from "@/lib/drill";
// В компоненте есть состояние `feedback` (отзыв ИИ), поэтому отклик звуком/вибрацией импортируем под другим именем.
import { feedback as giveFeedback } from "@/lib/feedback";
import { ignoreKey } from "@/lib/keys";
import { aiErrorKey, checkSolution } from "@/lib/ai";
import { buildStudentContext } from "@/lib/student-context";
import { plain, tx } from "@/lib/text";
import { useT } from "@/i18n/useT";
import type { DictKey } from "@/i18n/dict";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Pill } from "@/components/ui/Pill";
import { InlineMarkdown, Markdown } from "@/components/Markdown";
import { Mascot } from "@/components/mascot/Mascot";
import { AiCost } from "@/components/economy/AiCost";
import { HeartsBar } from "@/components/economy/HeartsBar";
import { NoChipsNotice } from "@/components/economy/NoChipsNotice";
import { OutOfHearts } from "@/components/economy/OutOfHearts";
import { AiPanel } from "@/components/ai/AiPanel";
import { ReportIssueButton } from "@/components/issue/ReportIssueButton";
import { Visual } from "@/components/visuals/Visuals";
import { SceneView } from "@/components/scenes/SceneView";
import { ToolboxButton } from "@/components/tools/Toolbox";
import { ComboFlame } from "@/components/motion/ComboFlame";
import { Shake } from "@/components/motion/Shake";
import { XpBurst } from "@/components/motion/XpBurst";
import { easeOut, springBouncy, springSoft } from "@/components/motion/presets";
import { LessonVideo } from "@/videos/LessonVideo";
import { ChoiceView, MultiView } from "./steps/ChoiceView";
import { InputView } from "./steps/InputView";
import { BitsView } from "./steps/BitsView";
import { LadderView } from "./steps/LadderView";
import { MatchView } from "./steps/MatchView";
import { OrderView } from "./steps/OrderView";
import { SolutionView } from "./steps/SolutionView";
import { ClozeView } from "./steps/ClozeView";
import { ExploreView } from "./steps/ExploreView";
import { StoryView } from "./steps/StoryView";
import { WorkedView } from "./steps/WorkedView";
import type { StepProps } from "./steps/types";
import { Results, requestLessonFeedback, type FeedbackState } from "./Results";
import { activeElapsed, buildRun, freshQueue, graceText, restoreRun, retryItem, type PlayerQueueItem } from "./run-snapshot";

export interface PlayerProps {
  kind: "lesson" | "drill";
  lessonId?: string;
  title: string;
  steps: Step[];
  /** Для работы над ошибками: id шага → id задания-ошибки, которую закрыть при верном ответе. */
  mistakeMap?: Record<string, string>;
  /** Режим урока: check — «Проверить себя» (пометка сверху, итог с via: "check"). По умолчанию learn. */
  via?: LessonVia;
  /** Режим тренировки (DrillMode) — попадает в историю тестов. */
  mode?: string;
  /** Вызывается один раз по завершении, после finishSession (тренировка: сдвиг повторения, зачёт экстерна). */
  onSessionFinish?: (result: SessionResult) => void;
  /** Блок на экране итогов (например, «Раздел засчитан»). */
  resultsExtra?: ReactNode;
  /** Цена входа в сердечках (#40): списывается при первом ответе (или «Пропустить»). Нет или 0 — бесплатно (тренировка). */
  entryCost?: number;
  /** Продолжить сохранённое прохождение (#41) — только урок в режиме «Учиться». */
  resume?: LessonRun;
  /** Сохранять прохождение после каждого шага (#41) — только урок в режиме «Учиться». */
  saveRun?: boolean;
}

const PRAISE: DictKey[] = ["fb.correct.1", "fb.correct.2", "fb.correct.3", "fb.correct.4"];

/** Цвета панели ответа (токены, работают и в тёмной теме). */
const TONE_PANEL = {
  success: "border-success/30 bg-success-soft",
  danger: "border-danger/30 bg-danger-soft",
  warning: "border-warning/30 bg-warning-soft",
} as const;
const TONE_ICON = { success: "bg-success", danger: "bg-danger", warning: "bg-warning" } as const;
/** Типы заданий, у которых нет собственной подсветки ошибки: встряхиваем всю область ответа. */
const SHAKE_AREA = new Set<QuestionStep["type"]>(["bits", "ladder", "order"]);

function QuestionView(props: StepProps<QuestionStep>) {
  const { step } = props;
  switch (step.type) {
    case "choice":
      return <ChoiceView {...props} step={step} />;
    case "multi":
      return <MultiView {...props} step={step} />;
    case "input":
      return <InputView {...props} step={step} />;
    case "bits":
      return <BitsView {...props} step={step} />;
    case "ladder":
      return <LadderView {...props} step={step} />;
    case "match":
      return <MatchView {...props} step={step} />;
    case "order":
      return <OrderView {...props} step={step} />;
    case "solution":
      return <SolutionView {...props} step={step} />;
    case "cloze":
      return <ClozeView {...props} step={step} />;
  }
}

/** «Предскажи → проверь»: схема-раскрытие выезжает под заданием после проверки ответа. */
function RevealCard({ scene }: { scene: Scene }) {
  const ref = useRef<HTMLDivElement>(null);
  // Нижняя панель обратной связи перекрывает низ экрана — подкручиваем схему в видимую область (scroll-mb у карточки).
  useEffect(() => {
    const id = window.setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 350);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <m.div ref={ref} className="scroll-mb-64" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springSoft, delay: 0.1 }}>
      <SceneView scene={scene} />
    </m.div>
  );
}

/** Кнопка «Спросить Бита» под теорией и другими информационными шагами. */
/** Статический разбор выбранного неверного варианта (choice / multi) или null. */
function wrongReason(q: QuestionStep, a: Answer | null, lang: Lang): string | null {
  if (!a) return null;
  let idx = -1;
  if (q.type === "choice" && a.type === "choice") idx = a.index;
  if (q.type === "multi" && a.type === "multi") idx = a.indices.find((i) => !q.correct.includes(i)) ?? -1;
  if (idx < 0 || (q.type !== "choice" && q.type !== "multi")) return null;
  const why = q.whyWrong?.[idx];
  return why ? tx(why, lang) : null;
}

function AskInline({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 self-start rounded-xl bg-ai-soft px-3 py-2 text-sm font-extrabold text-ai hover:brightness-95"
    >
      <Sparkles size={16} /> {label}
    </button>
  );
}

/** Первые слова текста — заголовок шага для ИИ, когда у шага нет title. */
const firstWords = (text: string, n = 8) => text.split(" ").slice(0, n).join(" ");

export function LessonPlayer({
  kind,
  lessonId,
  title,
  steps,
  mistakeMap,
  via,
  mode,
  onSessionFinish,
  resultsExtra,
  entryCost = 0,
  resume,
  saveRun = false,
}: PlayerProps) {
  const router = useRouter();
  const { t, l, lang } = useT();
  const recordAnswer = useApp((s) => s.recordAnswer);
  const noteCombo = useApp((s) => s.noteCombo);
  const finishSession = useApp((s) => s.finishSession);
  const dismissMistake = useApp((s) => s.dismissMistake);

  // Продолжение сохранённого прохождения (#41): состояние берём из снимка один раз при монтировании.
  // Очередь не собралась (шаг пропал из урока) — начинаем с нуля.
  const [init] = useState(() => (resume ? restoreRun(resume, steps, Date.now()) : null));
  // Сохраняем только урок в режиме «Учиться»; «Проверить себя» и тренировка собираются заново каждый раз.
  const persist = saveRun && kind === "lesson" && !!lessonId && (via ?? "learn") === "learn";
  // Экстерн начинают с карты курса — туда и выход; остальные тренировки — в «Практику».
  const exitHref = kind === "lesson" || mode === "extern" ? "/learn" : "/practice";

  const total = steps.length;
  const [queue, setQueue] = useState<PlayerQueueItem[]>(() => init?.queue ?? freshQueue(steps));
  const [pos, setPos] = useState(init?.pos ?? 0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [phase, setPhase] = useState<"answering" | "checking" | "feedback">("answering");
  const [result, setResult] = useState<StepResult | null>(null);
  const [records, setRecords] = useState<AnswerRecord[]>(() => init?.records ?? []);
  const [done, setDone] = useState(init?.done ?? 0);
  const [combo, setCombo] = useState(init?.combo ?? 0);
  const [maxCombo, setMaxCombo] = useState(init?.maxCombo ?? 0);
  const [xp, setXp] = useState(init?.xp ?? 0);
  const [gain, setGain] = useState(0);
  const [praise, setPraise] = useState<DictKey>(PRAISE[0]);
  const [checkError, setCheckError] = useState<DictKey | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  // Шторка «Не хватает сердечек» при первом ответе (#40); плата за вход — ensurePaid.
  const [outOpen, setOutOpen] = useState(false);
  // Вход оплачен (сердечки списаны): для подсказки в окне выхода. Сам учёт — paidAtRef.
  const [paid, setPaid] = useState(!!init?.paid);
  const [ai, setAi] = useState<"hint" | "explain" | "ask" | null>(null);
  // Разбор: сколько шагов уже открыто. Песочница: достигнута ли цель. Сбрасываются при переходе к следующему шагу.
  const [revealed, setRevealed] = useState(1);
  const [goalReached, setGoalReached] = useState(false);
  const [session, setSession] = useState<{
    result: SessionResult;
    bonusXp: number;
    achievements: string[];
    chips: number;
    heart: boolean;
  } | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>({ status: "loading" });
  // Множитель XP за повтор урока фиксируем на входе: во время прохождения он не меняется (при продолжении — из сохранения).
  const [xpFactor] = useState(() => init?.xpFactor ?? (kind === "lesson" ? lessonXpFactorNow(lessonId) : 1));
  // Сколько чипов было заработано к началу прохождения: в итогах показываем разницу (при продолжении — за весь урок).
  const [earnedAtStart] = useState(() => {
    const earned = useApp.getState().wallet.earned;
    return init ? Math.max(0, earned - init.chipsEarned) : earned;
  });
  // Время — активное (#68): показание часов вкладки (lib/active-clock.ts) при показе плеера; длительность урока — разница двух показаний.
  const clockAtMount = useRef(0);
  // Когда начато прохождение (первый вход) — для сохранения.
  const runStartedAt = useRef(0);
  // Когда оплачен вход; null — платить при первом ответе. Ref, а не state: ответ проверяется в том же обработчике, что и плата.
  const paidAtRef = useRef<number | null>(init?.paidAt ?? null);
  const skippedRef = useRef(init?.skipped ?? 0);
  // Показание часов в момент показа шага: время ответа — активные миллисекунды с него.
  const stepClockAt = useRef(0);
  // Подсказка или вопрос Биту открыты до ответа на это задание (#66): ответ «с подсказкой». Сбрасывается при переходе к следующему шагу.
  const hintedRef = useRef(false);
  // Событие входа уже отправлено (защита от двойного вызова эффекта в разработке).
  const startTracked = useRef(false);
  // Плеер ещё на экране: долгая проверка фото может закончиться после выхода — тогда сохранение не трогаем.
  const alive = useRef(true);
  // Высота нижней панели меняется (кнопка проверки → разбор с объяснением): отступ контента подстраиваем под неё,
  // чтобы последний вариант ответа можно было прокрутить над панелью даже на 360×640.
  const footerRef = useRef<HTMLElement>(null);
  const [footerH, setFooterH] = useState(0);

  useEffect(() => {
    clockAtMount.current = activeMs();
    runStartedAt.current = init?.startedAt ?? Date.now();
    stepClockAt.current = activeMs();
  }, [init]);

  // Вход (#69): один раз за показ плеера; resume — продолжение сохранённого прохождения. Событие, не state — setState не нужен.
  useEffect(() => {
    if (startTracked.current) return;
    startTracked.current = true;
    const ev = startEvent({ kind, lessonId, via, mode, resumed: !!init });
    if (ev) track(ev);
  }, [kind, lessonId, via, mode, init]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    const el = footerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setFooterH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const item = queue[pos];
  const step = item?.step;
  const question = step && isQuestion(step) ? step : null;
  const noteKey = lessonId ?? "general";

  // Активное время урока, мс: при продолжении — плюс сохранённое (#68).
  const lessonMs = useCallback(() => activeElapsed(init?.activeMs ?? 0, clockAtMount.current, activeMs()), [init]);
  // Активное время на текущее задание, мс.
  const stepMs = useCallback(() => Math.max(0, activeMs() - stepClockAt.current), []);
  // Шаги самого урока: события `task` ставим только по ним (у заданий банка id разные при каждом запуске).
  const stableSteps = useMemo(() => {
    const lesson = kind === "lesson" && lessonId ? getLesson(lessonId) : undefined;
    return lesson ? new Set(lesson.steps.map((x) => x.id)) : null;
  }, [kind, lessonId]);

  const finish = useCallback(
    (finalRecords: AnswerRecord[], finalXp: number, finalMaxCombo: number) => {
      // Точность — одно определение везде (#66): первые попытки, пропуск — со счётом 0.
      const totals = sessionTotals(finalRecords, skippedRef.current);
      const result: SessionResult = {
        kind,
        lessonId,
        via,
        title,
        answers: finalRecords,
        xp: finalXp,
        maxCombo: finalMaxCombo,
        durationSec: Math.round(lessonMs() / 1000),
        ...totals,
        mode,
      };
      const levelBefore = levelInfo(useApp.getState().xp).level;
      const { bonusXp, heart } = finishSession(result);
      onSessionFinish?.(result);
      const doneEvent = finishEvent({ kind, lessonId, via, mode, accuracy: result.accuracy, durationSec: result.durationSec });
      if (doneEvent) track(doneEvent);
      const achievements = useApp.getState().consumeNewAchievements();
      const chips = Math.max(0, useApp.getState().wallet.earned - earnedAtStart);
      giveFeedback(levelInfo(useApp.getState().xp).level > levelBefore ? "levelUp" : "complete");
      setSession({ result, bonusXp, achievements, chips, heart });
      requestLessonFeedback(result, setFeedback);
    },
    [finishSession, kind, lessonId, via, mode, title, onSessionFinish, earnedAtStart, lessonMs],
  );

  // Снимок прохождения в стор (#41). Вызывается из обработчиков с уже посчитанными значениями: setState асинхронный.
  const persistRun = useCallback(
    (s: { queue: PlayerQueueItem[]; pos: number; done: number; records: AnswerRecord[]; xp: number; combo: number; maxCombo: number }) => {
      // После выхода из урока (ответ ИИ пришёл позже) не пишем: иначе вернётся сброшенное «Начать заново» или затрётся новый снимок.
      if (!persist || !lessonId || !alive.current) return;
      const now = Date.now();
      useApp.getState().saveLessonRun(
        buildRun({
          ...s,
          lessonId,
          steps,
          skipped: skippedRef.current,
          activeMs: lessonMs(),
          xpFactor,
          chipsEarned: Math.max(0, useApp.getState().wallet.earned - earnedAtStart),
          cost: entryCost,
          startedAt: runStartedAt.current,
          paidAt: paidAtRef.current,
          now,
        }),
      );
    },
    [persist, lessonId, steps, xpFactor, earnedAtStart, entryCost, lessonMs],
  );

  // Плата за вход (#40) — при первом ответе (или «Пропустить»), один раз. Только из обработчиков: в эффектах двойной вызов спишет дважды.
  // Не хватает сердечек — шторка «Не хватает сердечек», ответ не проверяем (после покупки ученик нажмёт «Проверить» снова).
  const ensurePaid = useCallback((): boolean => {
    if (entryCost <= 0 || paidAtRef.current !== null) return true;
    const res = useApp.getState().payEntry(entryCost);
    if (!res.ok) {
      setOutOpen(true);
      track({ e: "hearts_out", where: playerHeartsWhere({ via, mode }) });
      return false;
    }
    paidAtRef.current = Date.now();
    setPaid(res.paid > 0);
    // Оплату сохраняем сразу, на текущем шаге: если проверка фото не дойдёт до ответа (не читается, сбой ИИ) и ученик выйдет,
    // возврат в течение RUN_GRACE_MS не спишет вход второй раз. Ответ потом перезапишет снимок шагом дальше.
    persistRun({ queue, pos, done, records, xp, combo, maxCombo });
    return true;
  }, [entryCost, persistRun, queue, pos, done, records, xp, combo, maxCombo, via, mode]);

  // Переход к следующему шагу: doneNow — сколько шагов пройдено после него (теория засчитывается здесь, задание — при ответе).
  // recs — ответы с учётом только что записанного пропуска (state обновится позже, чем нужен итог).
  const advance = useCallback(
    (doneNow: number, recs: AnswerRecord[] = records) => {
      if (doneNow !== done) setDone(doneNow);
      if (pos + 1 >= queue.length) {
        finish(recs, xp, maxCombo);
        return;
      }
      persistRun({ queue, pos: pos + 1, done: doneNow, records: recs, xp, combo, maxCombo });
      setPos(pos + 1);
      setAnswer(null);
      setResult(null);
      setCheckError(null);
      setAiNote(null);
      setRevealed(1);
      setGoalReached(false);
      setPhase("answering");
      stepClockAt.current = activeMs();
      hintedRef.current = false;
      window.scrollTo({ top: 0 });
    },
    [done, pos, queue, finish, persistRun, records, xp, combo, maxCombo],
  );

  const next = useCallback(() => {
    advance(step && !isQuestion(step) ? done + 1 : done);
  }, [advance, step, done]);

  // Шторка ИИ. Подсказка или «Спросить Бита» в фазе ответа — задание «с подсказкой» (#66); разбор после ответа и теория — нет.
  const openAi = useCallback(
    (mode: "hint" | "explain" | "ask") => {
      if (question && phase === "answering" && mode !== "explain") hintedRef.current = true;
      setAi(mode);
    },
    [question, phase],
  );

  // Песочница сообщает о достижении цели; достигнутую цель не «отзываем».
  const onGoalChange = useCallback((reached: boolean) => {
    if (reached) setGoalReached(true);
  }, []);
  // «Продолжить» в песочнице с целью закрыто, пока цель не достигнута.
  const infoBlocked = step?.type === "explore" && !!step.goal && !goalReached;
  // Кнопка/Enter на информационном шаге: в разборе открывает следующий подшаг, иначе — дальше.
  const advanceInfo = useCallback(() => {
    if (!step) return;
    if (step.type === "worked" && revealed < step.steps.length) {
      giveFeedback("tap");
      setRevealed(revealed + 1);
      return;
    }
    if (infoBlocked) return;
    next();
  }, [step, revealed, infoBlocked, next]);

  const apply = useCallback(
    (res: StepResult) => {
      if (!question) return;
      const newCombo = res.correct ? combo + 1 : 0;
      const gained = scaleXp(xpForAnswer(res.correct, item.retry, newCombo), xpFactor);
      const rec: AnswerRecord = {
        stepId: question.id,
        skill: question.skill,
        correct: res.correct,
        score: res.score,
        given: res.given,
        expected: res.expected,
        prompt: promptText(question, lang),
        retry: item.retry,
        timeMs: stepMs(),
        // Подсказка или вопрос Биту до ответа (#66): ответ не самостоятельный, оценка освоения сдвигается слабее.
        ...(hintedRef.current ? { hinted: true } : {}),
      };
      const levelBefore = levelInfo(useApp.getState().xp).level;
      recordAnswer(rec, gained, lessonId);
      const taskEv = taskEvent(rec, stableSteps);
      if (taskEv) track(taskEv);
      const leveledUp = levelInfo(useApp.getState().xp).level > levelBefore;
      if (res.correct && mistakeMap?.[question.id]) dismissMistake(mistakeMap[question.id]);
      // Сердечки за ошибки не снимаются (#40): плата — за вход, при первом ответе (ensurePaid).
      noteCombo(newCombo);
      const newMaxCombo = Math.max(maxCombo, newCombo);
      // Развёрнутое решение засчитываем сразу (оно не повторяется), остальное — верный ответ или повтор ошибки.
      const newDone = done + (res.correct || item.retry || question.type === "solution" ? 1 : 0);
      // Ошибку повторяем один раз в конце («работа над ошибками»). Развёрнутые решения не повторяем — это дорого.
      const needRetry = !res.correct && !item.retry && question.type !== "solution";
      const newQueue = needRetry ? [...queue, retryItem(question)] : queue;
      setRecords((r) => [...r, rec]);
      setCombo(newCombo);
      setMaxCombo(newMaxCombo);
      setXp((x) => x + gained);
      setGain(gained);
      setResult(res);
      setPhase("feedback");
      setPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)]);
      setDone(newDone);
      if (needRetry) setQueue(newQueue);
      // Шаг пройден — сохраняем прохождение со следующей позиции (повтор ошибки уже в очереди).
      persistRun({ queue: newQueue, pos: pos + 1, done: newDone, records: [...records, rec], xp: xp + gained, combo: newCombo, maxCombo: newMaxCombo });
      // Отклик: звук + вибрация. Комбо с 3-го ответа, новый уровень — фанфара; «монетка» XP чуть позже.
      if (leveledUp) giveFeedback("levelUp");
      else if (res.correct) giveFeedback(newCombo >= 3 ? "combo" : "correct", { combo: newCombo });
      else giveFeedback("wrong");
      if (gained > 0 && !leveledUp) setTimeout(() => giveFeedback("xp"), 180);
    },
    [question, combo, maxCombo, done, pos, queue, records, xp, item, lang, recordAnswer, lessonId, mistakeMap, dismissMistake, noteCombo, xpFactor, persistRun, stableSteps, stepMs],
  );

  const check = useCallback(
    async (a: Answer | null = answer) => {
      if (!question || !a || !isReady(question, a) || phase !== "answering") return;
      // Первый ответ сессии платный (#40): до проверки и до оплаты ИИ-проверки по фото.
      if (!ensurePaid()) return;
      if (question.type === "solution" && a.type === "solution" && a.image) {
        setPhase("checking");
        setCheckError(null);
        setAiNote(null);
        const app = useApp.getState();
        const receipt = app.spendAi("photo");
        if (!receipt.ok) {
          // Нет чипов или лимит: проверяем хотя бы введённый ответ, иначе просим ввести его.
          if (a.typed.trim()) apply(evaluate(question, a, lang));
          else {
            setPhase("answering");
            setCheckError(receipt.reason === "chips" ? "economy.noChips" : "tutor.limit");
          }
          return;
        }
        try {
          const details = await checkSolution({
            lang,
            context: buildStudentContext(app),
            task: { prompt: tx(question.prompt, lang), reference: tx(question.reference, lang), answer: question.answer },
            typedAnswer: a.typed.trim() || undefined,
            image: a.image,
          });
          useApp.getState().unlock("solver");
          if (details.verdict === "unreadable") {
            // Не засчитываем как ошибку — просим переснять/переписать.
            setPhase("answering");
            setAiNote(details.feedback || t("sol.unreadable"));
            return;
          }
          apply({
            correct: details.verdict === "correct",
            score: details.verdict === "correct" ? 1 : details.verdict === "partial" ? 0.5 : 0,
            given: a.typed.trim() || t("sol.photoGiven"),
            expected: expectedText(question, lang),
            details,
          });
        } catch (e) {
          useApp.getState().refundAi(receipt);
          if (a.typed.trim()) {
            apply(evaluate(question, a, lang));
          } else {
            setPhase("answering");
            setCheckError(aiErrorKey(e));
          }
        }
        return;
      }
      const res = evaluate(question, a, lang);
      apply(question.type === "solution" ? { ...res, offline: false } : res);
    },
    [answer, question, phase, lang, apply, t, ensurePaid],
  );

  const onAnswer = useCallback(
    (a: Answer | null, opts?: { submit?: boolean }) => {
      setAnswer(a);
      if (opts?.submit) void check(a);
    },
    [check],
  );

  const skip = () => {
    if (!question) return;
    // «Пропустить» — тоже первый ответ: вход платный и здесь (иначе урок можно пройти, пропуская всё).
    if (!ensurePaid()) return;
    skippedRef.current += 1;
    // Пропуск — предъявленное задание со счётом 0 (#66): в итог, историю и статистику, но не в ошибки и не в освоение (стор следит сам).
    const rec = skipRecord({
      stepId: question.id,
      skill: question.skill,
      expected: expectedText(question, lang),
      prompt: promptText(question, lang),
      timeMs: stepMs(),
    });
    recordAnswer(rec, 0, lessonId);
    const taskEv = taskEvent(rec, stableSteps);
    if (taskEv) track(taskEv);
    const recs = [...records, rec];
    setRecords(recs);
    advance(done + 1, recs);
  };

  // Подтверждённый выход из окна выхода (#69): сколько шагов пройдено из скольких. Выход из «нет сердечек» — не в счёт.
  const quit = () => {
    const ev = quitEvent({ kind, lessonId, via, mode, done, total });
    if (ev) track(ev);
    router.push(exitHref);
  };

  // Enter — проверить / продолжить.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Все шаги пройдены (экран «Посмотреть итоги»): Enter нажимает кнопку экрана сам.
      if (!step) return;
      const el = e.target as HTMLElement | null;
      // Поля ввода и инструменты (калькулятор, черновик в [data-toolbox]) не запускают быстрые клавиши урока.
      // Исключение — поле ответа самого задания (внутри main): там Enter, как и раньше, проверяет ответ.
      const taskInput = el instanceof HTMLInputElement && !el.closest("[data-toolbox]") && !!el.closest("main");
      if (ignoreKey(e) && !taskInput) return;
      if (e.key !== "Enter" || e.repeat || exitOpen || outOpen || ai || session) return;
      // Любой открытый диалог (шторка «Сообщить об ошибке», калькулятор и т. п.): Enter при фокусе на body не листает шаг под ним.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (el instanceof HTMLTextAreaElement) return;
      if (el instanceof HTMLInputElement && el.closest("[role=dialog]")) return;
      // Кнопки вне области задания (крестик, нижняя панель) обрабатывают Enter сами — без двойного срабатывания.
      // Внутри задания Enter = «Проверить», а вариант выбирается пробелом или кликом.
      if (el && (el.tagName === "BUTTON" || el.tagName === "A") && !el.closest("main")) return;
      // Песочница, пока цель не достигнута: Enter не мешает кнопкам схемы (нативное нажатие).
      if (phase !== "feedback" && infoBlocked) return;
      e.preventDefault();
      if (phase === "feedback") next();
      else if (step && !isQuestion(step)) advanceInfo();
      else void check();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, step, next, advanceInfo, infoBlocked, check, exitOpen, outOpen, ai, session]);

  // Разбор выбранного неверного варианта (choice/multi) — показываем бесплатно, до ИИ.
  const whyWrongText = useMemo(
    () => (phase === "feedback" && question && result && !result.correct ? wrongReason(question, answer, lang) : null),
    [phase, question, result, answer, lang],
  );

  // Контекст для ИИ: задание (с ответом, если ученик уже ответил) или теория текущего шага.
  const taskCtx = useMemo<TaskContext | null>(() => {
    if (!step) return null;
    if (step.type === "theory") return { prompt: tx(step.title, lang), theory: plain(tx(step.body, lang)) };
    if (step.type === "video") return { prompt: tx(step.title, lang), theory: tx(step.title, lang) };
    if (step.type === "story") {
      const body = plain(tx(step.body, lang));
      return { prompt: step.title ? tx(step.title, lang) : firstWords(body), theory: body };
    }
    if (step.type === "worked") {
      const parts = step.steps.map((s, i) => `${i + 1}. ${plain(tx(s.text, lang))}`);
      if (step.result) parts.push(plain(tx(step.result, lang)));
      return { prompt: tx(step.title, lang), theory: parts.join(" ") };
    }
    if (step.type === "explore") {
      const parts = [step.body ? plain(tx(step.body, lang)) : "", step.goal ? plain(tx(step.goal.text, lang)) : ""];
      return { prompt: tx(step.title, lang), theory: parts.filter(Boolean).join(" ") };
    }
    if (!question) return null;
    return {
      prompt: promptText(question, lang),
      options: question.type === "choice" || question.type === "multi" ? question.options.map((o) => tx(o, lang)) : undefined,
      correct: expectedText(question, lang),
      given: result?.given,
      explanation: plain(tx(question.explanation, lang)),
      answered: phase === "feedback",
      // Лестница подсказок: бесплатное (hint автора, разбор неверного варианта) показывается до ИИ.
      hint: question.hint ? plain(tx(question.hint, lang)) : undefined,
      whyWrong: whyWrongText ? plain(whyWrongText) : undefined,
      stepKey: question.id,
    };
  }, [step, question, lang, result, phase, whyWrongText]);
  const askSuggestions: DictKey[] = !question
    ? ["tutor.q.simpler", "tutor.q.example", "tutor.q.why"]
    : phase === "feedback"
      ? ["tutor.q.simpler", "tutor.q.example"]
      : ["tutor.q.start", "tutor.q.simpler", "tutor.q.example"];

  if (session) {
    return (
      <Results
        kind={kind}
        lessonId={lessonId}
        title={title}
        result={session.result}
        bonusXp={session.bonusXp}
        chips={session.chips}
        heart={session.heart}
        achievements={session.achievements}
        feedback={feedback}
        via={via}
        xpFactor={xpFactor}
        extra={resultsExtra}
      />
    );
  }
  if (!item || !step) {
    // Продолжение, когда все шаги уже пройдены (ученик вышел, не нажав «Продолжить» на последнем): сразу к итогам, без платы.
    if (queue.length === 0 || pos < queue.length) return null;
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-8 text-center">
        <m.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springBouncy}>
          <Mascot mood="happy" size={104} />
        </m.div>
        <h1 className="text-2xl font-extrabold leading-tight">{t("hearts.resume.allDone")}</h1>
        <p className="font-semibold text-muted">{t("hearts.resume.allDoneText")}</p>
        <Button size="lg" block variant="success" onClick={() => finish(records, xp, maxCombo)} autoFocus>
          {t("hearts.resume.results")}
        </Button>
      </main>
    );
  }

  const progress = done / total;
  const ready = question ? isReady(question, answer) : true;
  const tone = result ? (result.correct ? "success" : result.score > 0 ? "warning" : "danger") : null;

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      {/* Верхняя панель */}
      <header className="sticky top-0 z-20 bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center gap-2 px-4 sm:gap-3">
          <button
            type="button"
            onClick={() => setExitOpen(true)}
            aria-label={t("lesson.exit")}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2"
          >
            <X size={24} />
          </button>
          <ProgressBar value={progress} className="flex-1" label={title} />
          <ComboFlame combo={combo} />
          {entryCost > 0 && <HeartsBar />}
          <button
            type="button"
            onClick={() => openAi("ask")}
            aria-label={t("tutor.askButton")}
            title={t("tutor.askButton")}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-ai-soft text-ai hover:brightness-95"
          >
            <Sparkles size={20} />
          </button>
          <ToolboxButton variant="icon" />
        </div>
        {(via === "check" || xpFactor < 1) && (
          <div className="mx-auto flex w-full max-w-2xl flex-wrap gap-2 px-4 pb-2">
            {via === "check" && (
              <Pill tone="primary" icon={<ClipboardCheck size={14} />}>
                {t("modes.check.badge")}
              </Pill>
            )}
            {xpFactor < 1 && (
              <Pill tone="warning" icon={<Repeat size={14} />}>
                {t("modes.replay.badge", { f: formatFactor(xpFactor) })}
              </Pill>
            )}
          </div>
        )}
      </header>

      {/* Контент шага */}
      {/* Новый шаг выезжает справа и проявляется (≈250 мс); старый не ждём — ученика не тормозим. */}
      <m.main
        key={item.key}
        className="mx-auto w-full max-w-2xl flex-1 px-4 pb-48 pt-2"
        // 24px запаса сверх панели; пока высота не измерена (или нет ResizeObserver) — запасной pb-48.
        style={footerH > 0 ? { paddingBottom: footerH + 24 } : undefined}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, ease: easeOut }}
      >
        {item.retry && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-warning-soft px-3 py-2 text-sm font-bold text-warning-strong">
            <RotateCcw size={16} className="shrink-0" /> {t("lesson.review")} · {t("lesson.reviewHint")}
          </div>
        )}

        {step.type === "video" && (
          <div className="flex flex-col gap-4">
            <Pill tone="primary" className="self-start" icon={<Clapperboard size={14} />}>
              {t("lesson.video")}
            </Pill>
            <h1 className="text-2xl font-extrabold">{l(step.title)}</h1>
            <LessonVideo videoId={step.videoId} lang={lang} title={l(step.title)} />
          </div>
        )}

        {step.type === "theory" && (
          <div className="flex flex-col gap-4">
            <Pill tone="primary" className="self-start" icon={<BookOpen size={14} />}>
              {t("lesson.theory")}
            </Pill>
            <h1 className="text-2xl font-extrabold">{l(step.title)}</h1>
            {step.scene && <SceneView scene={step.scene} />}
            {step.visual && <Visual id={step.visual} />}
            <Markdown className="text-[17px]">{l(step.body)}</Markdown>
            <AskInline label={t("tutor.askInline")} onClick={() => openAi("ask")} />
          </div>
        )}

        {step.type === "story" && <StoryView step={step} />}

        {step.type === "worked" && (
          <div className="flex flex-col gap-4">
            <WorkedView step={step} revealed={revealed} />
            <AskInline label={t("tutor.askInline")} onClick={() => openAi("ask")} />
          </div>
        )}

        {step.type === "explore" && (
          <div className="flex flex-col gap-4">
            <Pill tone="primary" className="self-start" icon={<Hand size={14} />}>
              {t("lesson.explore")}
            </Pill>
            <h1 className="text-2xl font-extrabold">{l(step.title)}</h1>
            {step.body && <Markdown className="text-[17px]">{l(step.body)}</Markdown>}
            <ExploreView step={step} onGoalChange={onGoalChange} />
            <AskInline label={t("tutor.askInline")} onClick={() => openAi("ask")} />
          </div>
        )}

        {question && (
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {question.type === "cloze" && (
                  <Pill tone="primary" icon={<Handshake size={14} />}>
                    {t("lesson.together")}
                  </Pill>
                )}
                {question.reveal && (
                  <Pill tone="primary" icon={<Eye size={14} />}>
                    {t("lesson.predict")}
                  </Pill>
                )}
                {question.ent && (
                  <Pill tone="gold" icon={<Target size={14} />}>
                    {t("lesson.ent")}
                  </Pill>
                )}
              </div>
              {phase === "answering" && (
                <button
                  type="button"
                  onClick={() => openAi("hint")}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl bg-ai-soft px-3 py-1.5 text-sm font-extrabold text-ai hover:brightness-95"
                >
                  <Lightbulb size={16} /> {t("lesson.hint")}
                  {/* Подсказка автора бесплатна; цена — только если ответит ИИ. */}
                  {!question.hint && <AiCost kind="hint" short />}
                </button>
              )}
            </div>
            <h1 className="text-xl font-extrabold leading-snug sm:text-2xl">
              <InlineMarkdown>{l(question.prompt)}</InlineMarkdown>
            </h1>
            {/* Схема-условие: код программы, таблица, логическая схема. */}
            {question.scene && <SceneView scene={question.scene} />}
            <Shake active={phase === "feedback" && !!result && !result.correct && SHAKE_AREA.has(question.type)} strength={6}>
              <QuestionView
                key={item.key}
                step={question}
                answer={answer}
                onAnswer={onAnswer}
                locked={phase !== "answering"}
                result={result}
              />
            </Shake>
            {phase === "feedback" && result && question.reveal && <RevealCard key={`${item.key}:reveal`} scene={question.reveal} />}
            {checkError === "economy.noChips" ? (
              <NoChipsNotice kind="photo" />
            ) : (
              checkError && <p className="rounded-xl bg-danger-soft px-3 py-2 text-center text-sm font-bold text-danger">{t(checkError)}</p>
            )}
            {aiNote && <p className="rounded-xl bg-warning-soft px-3 py-2 text-center text-sm font-bold text-warning-strong">{aiNote}</p>}
          </div>
        )}
      </m.main>

      {/* Нижняя панель: кнопка проверки или карточка обратной связи.
          Цветной фон выезжает пружиной отдельным слоем (transform), содержимое проявляется следом. */}
      <footer ref={footerRef} className="fixed inset-x-0 bottom-0 z-30 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <div aria-hidden className="absolute inset-x-0 -bottom-6 top-0 border-t-2 border-border bg-bg" />
        <AnimatePresence initial={false}>
          {tone && (
            <m.div
              key={tone}
              aria-hidden
              className={clsx("pointer-events-none absolute inset-x-0 -bottom-6 top-0 border-t-2", TONE_PANEL[tone])}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%", transition: { duration: 0.18, ease: "easeIn" } }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
            />
          )}
        </AnimatePresence>
        <div className="relative mx-auto flex w-full max-w-2xl flex-col gap-3 px-4">
          {phase === "feedback" && result && question && (
            <m.div
              className="flex items-start gap-3"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springSoft, delay: 0.04 }}
            >
              <Mascot mood={result.correct ? "happy" : result.score > 0 ? "thinking" : "sad"} size={52} className="shrink-0" />
              <div className="min-w-0 flex-1">
                {/* Заголовок результата + компактная кнопка «Сообщить об ошибке» справа (−my-1: высота панели не растёт). */}
                <div className="flex items-start gap-1">
                  <p
                    className={clsx(
                      "min-w-0 flex-1 text-xl font-extrabold",
                      tone === "success" && "text-success-strong",
                      tone === "danger" && "text-danger",
                      tone === "warning" && "text-warning-strong",
                    )}
                  >
                    {tone && (
                      <m.span
                        aria-hidden
                        className={clsx("mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full align-middle text-white", TONE_ICON[tone])}
                        initial={{ scale: 0, rotate: -40 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ ...springBouncy, delay: 0.06 }}
                      >
                        {result.correct ? <Check size={18} strokeWidth={3.5} /> : result.score > 0 ? <Minus size={18} strokeWidth={3.5} /> : <X size={18} strokeWidth={3.5} />}
                      </m.span>
                    )}
                    {result.correct ? t(praise) : result.score > 0 ? t("fb.partial") : t("fb.wrong")}
                    {gain > 0 && (
                      <m.span
                        className="ml-2 inline-block text-base text-warning-strong"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ ...springBouncy, delay: 0.14 }}
                      >
                        +{gain} XP
                      </m.span>
                    )}
                  </p>
                  <ReportIssueButton
                    compact
                    className="-my-1 shrink-0 text-text/70 hover:text-text"
                    target={{
                      kind: "task",
                      where: kind === "drill" ? "drill" : "lesson",
                      itemId: question.id,
                      lessonId,
                      snippet: promptText(question, lang),
                    }}
                  />
                </div>
                {!result.correct && (
                  <>
                    {question.type !== "match" && question.type !== "cloze" && (
                      <p className="mt-1 font-bold">
                        {t("fb.correctAnswer")} <span className="font-mono">{result.expected}</span>
                      </p>
                    )}
                    {whyWrongText && (
                      <p className="mt-1 text-[15px] font-extrabold">
                        <InlineMarkdown>{whyWrongText}</InlineMarkdown>
                      </p>
                    )}
                    <p className="mt-1 text-[15px] font-semibold opacity-90">
                      <InlineMarkdown>{l(question.explanation)}</InlineMarkdown>
                    </p>
                  </>
                )}
              </div>
            </m.div>
          )}

          <div className="relative flex items-center gap-3">
            {/* «+N» всплывает над кнопкой при каждом начисленном XP (id = номер ответа). */}
            <XpBurst id={gain > 0 ? records.length : 0} amount={gain} className="-top-3 right-6" />
            {phase === "feedback" && result && !result.correct && (
              <Button variant="ai" onClick={() => setAi("explain")} icon={<Sparkles size={18} />} className="shrink-0">
                <span className="hidden sm:inline">{t("fb.why")}</span>
                <span className="sm:hidden">{t("fb.ai.short")}</span>
                {/* Открыть разбор бесплатно (whyWrong / объяснение задания); цена — на кнопке «Подробнее от Бита» в шторке. */}
              </Button>
            )}
            {phase === "answering" && question?.type === "solution" && (
              <Button variant="ghost" onClick={skip}>
                {t("common.skip")}
              </Button>
            )}
            <div className="flex-1" />
            {phase === "feedback" ? (
              <Button
                size="lg"
                className="w-full sm:w-56"
                variant={tone === "success" ? "success" : tone === "warning" ? "primary" : "danger"}
                onClick={next}
                autoFocus
              >
                {t("common.continue")}
              </Button>
            ) : question ? (
              <Button
                size="lg"
                className="w-full sm:w-auto sm:min-w-56"
                variant={question.type === "solution" && answer?.type === "solution" && answer.image ? "ai" : "success"}
                disabled={!ready || phase === "checking"}
                onClick={() => void check()}
              >
                {phase === "checking"
                  ? t("sol.checking")
                  : question.type === "solution" && answer?.type === "solution" && answer.image
                    ? t("sol.checkAi")
                    : t("common.check")}
                {phase !== "checking" && question.type === "solution" && answer?.type === "solution" && answer.image && (
                  <AiCost kind="photo" variant="solid" short className="hidden sm:inline-flex" />
                )}
              </Button>
            ) : (
              <Button size="lg" className="w-full sm:w-56" disabled={infoBlocked} onClick={advanceInfo}>
                {step.type === "worked" && revealed < step.steps.length ? t("lesson.nextStep") : t("common.continue")}
              </Button>
            )}
          </div>
        </div>
      </footer>

      <Modal open={exitOpen} onClose={() => setExitOpen(false)} label={t("lesson.exitTitle")}>
        <div className="flex flex-col items-center gap-3 text-center">
          <Mascot mood="sad" size={72} />
          <h3 className="text-xl font-extrabold">{t("lesson.exitTitle")}</h3>
          <p className="text-muted">{persist ? t("lesson.exitSaved") : t("lesson.exitText")}</p>
          {/* Вход уже оплачен: с сохранением — вернуться без новой платы можно в пределах окна; без сохранения — сердечко не вернётся. */}
          {paid && (
            <p className="text-sm font-extrabold text-heart-strong">
              {persist ? t("hearts.resume.grace", { time: graceText(lang) }) : t("lesson.exitPaid")}
            </p>
          )}
          <div className="mt-2 flex w-full flex-col gap-3">
            <Button size="lg" block onClick={() => setExitOpen(false)}>
              {t("lesson.stay")}
            </Button>
            <Button variant="ghost" block onClick={quit} className="text-danger">
              {t("lesson.exit")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Не хватило сердечек на вход при первом ответе: купить, вернуть тренировкой или выйти. «Продолжить» закрывает шторку — «Проверить» нажимается снова. */}
      {entryCost > 0 && (
        <OutOfHearts
          open={outOpen}
          need={entryCost}
          onClose={() => setOutOpen(false)}
          onResume={() => setOutOpen(false)}
          onExit={() => router.push(exitHref)}
          theoryHref={kind === "lesson" && lessonId ? `/theory/${lessonId}` : undefined}
        />
      )}

      {ai && taskCtx && (
        <AiPanel
          key={`${item.key}:${ai}`}
          open
          onClose={() => setAi(null)}
          mode={ai}
          task={taskCtx}
          noteKey={noteKey}
          suggestions={ai === "ask" ? askSuggestions : []}
        />
      )}
    </div>
  );
}

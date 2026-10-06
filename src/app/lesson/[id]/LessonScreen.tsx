"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useT } from "@/i18n/useT";
import { track } from "@/lib/analytics";
import { ENTRY_COST, lessonCost } from "@/lib/economy";
import { checkEntryKey, lessonEntryKey } from "@/lib/entry-paid";
import { runPaid, usableRun } from "@/lib/lesson-run";
import { useApp } from "@/lib/store";
import type { Lesson, QuestionStep } from "@/lib/types";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";
import { ResumeLesson } from "@/components/lesson/ResumeLesson";
import { questionsAhead } from "@/components/lesson/run-snapshot";
import { useHeartsOutOnEntry } from "@/components/lesson/useHeartsOutOnEntry";
import { EntryGate } from "@/components/economy/EntryGate";
import { OutOfHearts } from "@/components/economy/OutOfHearts";
import { useEntryAccess, type EntryPayment } from "@/components/economy/useEntryAccess";
import { GuideSpot } from "@/components/guide/GuideSpot";

/**
 * Урок. Режимы: «Учиться» (learn) — прохождение сохраняется, при возврате — «Продолжить / Начать заново» (#41);
 * «Проверить себя» (check) — без сохранения. Вход — 1 сердечко.
 * Сердечко списывается при открытии урока (этап 16Г, #120; useEntryAccess): плеер получает уже оплаченный вход (prepaid, paidAt)
 * и показывает «−1». Повторный вход в течение 20 минут после оплаты бесплатен (ключ входа, lib/entry-paid.ts), после итогов — снова платный.
 * Экран «Урок не закончен»: «Продолжить» — бесплатно, если оплата свежая (или впереди нет заданий), иначе платно по нажатию;
 * «Начать заново» — всегда новый платный вход. Оплаченное, но нетронутое прохождение (шаг 0) продолжается молча.
 * «Пройти урок заново» на итогах незасчитанного урока (#122) — тоже новый платный вход в том же режиме: оплата здесь,
 * плеер монтируется заново (ключ с номером круга); сердечек не хватает — окно покупки поверх итогов.
 *
 * Урок уже с «боссом» (#84) и набор «Проверить себя» собирает сервер (page.tsx): клиент не грузит все уроки,
 * банки навыков и банк ЕНТ (этап 16).
 */
export function LessonScreen({ lesson, mode, check }: { lesson: Lesson; mode: "learn" | "check"; check: QuestionStep[] }) {
  const router = useRouter();
  const { l } = useT();
  const id = lesson.id;
  const asCheck = mode === "check" && check.length > 0;
  // Сохранённое прохождение читаем один раз при входе (только «Учиться»): подходит ли оно, оплачен ли вход, остались ли задания.
  const [entry] = useState(() => {
    const run = asCheck ? null : usableRun(useApp.getState().lessonRuns[id], lesson, Date.now());
    // Сохранение есть, но не подходит (урок изменился): уберём его, чтобы главная не обещала «Шаг X из Y».
    const stale = !asCheck && !run && !!useApp.getState().lessonRuns[id];
    return { run, stale, paid: !!run && runPaid(run, Date.now()), ahead: run ? questionsAhead(run, lesson.steps) : true };
  });
  useEffect(() => {
    if (entry.stale) useApp.getState().clearLessonRun(id);
  }, [entry.stale, id]);
  const saved = entry.run;
  // ask — экран выбора; continue — плеер с сохранения; fresh — плеер с первого шага.
  // Оплаченное, но нетронутое прохождение (вход списан, ни одного шага) — продолжаем молча, без экрана выбора.
  const [choice, setChoice] = useState<"ask" | "continue" | "fresh">(saved ? (saved.pos === 0 && entry.paid ? "continue" : "ask") : "fresh");
  // Оплата на экране выбора («Продолжить» после окна, «Начать заново»): плееру — «−N» и время оплаты для сохранения.
  const [handPaid, setHandPaid] = useState<EntryPayment | null>(null);
  // Не хватает сердечек на выбранное действие — окно покупки; после покупки выполняем это действие.
  const [short, setShort] = useState<null | "continue" | "restart" | "retry">(null);
  // Номер круга: «Пройти урок заново» с итогов увеличивает его — плеер монтируется заново.
  const [round, setRound] = useState(0);

  const cost = asCheck ? ENTRY_COST.check : lessonCost();
  const payKey = asCheck ? checkEntryKey(id) : lessonEntryKey(id);
  const outWhere = asCheck ? "check" : "lesson";
  // Свежий вход (сохранения нет) — платим сразу при открытии; с сохранением решает экран выбора.
  const { access, payment, resume } = useEntryAccess(payKey, cost, !saved, outWhere);
  // Экран выбора: продолжение уже оплаченного входа (или без заданий впереди) бесплатно — на входе сердечки не нужны.
  const askNeed = saved && choice === "ask" && !(entry.paid || !entry.ahead) ? cost : 0;
  // Где закончились сердечки (#69): на экране выбора (полноэкранное окно) и при выборе «Продолжить» / «Начать заново».
  useHeartsOutOnEntry(askNeed, outWhere);

  /** Оплата из обработчика: списано — запоминаем для плеера; не хватает — окно покупки. */
  const payNow = (action: "continue" | "restart" | "retry"): boolean => {
    const app = useApp.getState();
    // «Начать заново» и повтор с итогов — новый вход: платим всегда и обновляем ключ; «Продолжить» — по ключу (свежая оплата дважды не списывается).
    const res = action === "continue" ? app.payEntryOnce(payKey, cost) : app.payEntryFresh(payKey, cost);
    if (!res.ok) {
      track({ e: "hearts_out", where: outWhere });
      setShort(action);
      return false;
    }
    setHandPaid({ paid: res.paid, paidAt: useApp.getState().entryPaid[payKey] ?? null });
    return true;
  };
  const doRestart = () => {
    if (!payNow("restart")) return;
    useApp.getState().clearLessonRun(id);
    setChoice("fresh");
  };
  // «Пройти урок заново» с итогов: новый платный вход в том же режиме, плеер — с первого шага.
  const doRetry = () => {
    if (!payNow("retry")) return;
    useApp.getState().clearLessonRun(id);
    setChoice("fresh");
    setRound((r) => r + 1);
  };
  // «Продолжить»: оплачен ли вход, проверяем в момент нажатия — 20 минут могли истечь, пока открыт экран выбора.
  const doContinue = () => {
    const free = !entry.ahead || (!!saved && runPaid(saved, Date.now()));
    if (free || payNow("continue")) setChoice("continue");
  };

  if (saved && choice === "ask") {
    return (
      <EntryGate need={askNeed} exitHref="/learn">
        <ResumeLesson
          title={l(lesson.title)}
          run={saved}
          total={lesson.steps.length}
          ahead={entry.ahead}
          cost={cost}
          onContinue={() => {
            track({ e: "resume_choice", lesson: lesson.id, choice: "continue" });
            doContinue();
          }}
          onRestart={() => {
            track({ e: "resume_choice", lesson: lesson.id, choice: "restart" });
            doRestart();
          }}
          backHref="/learn"
        />
        <OutOfHearts
          open={short !== null}
          need={cost}
          onClose={() => setShort(null)}
          onResume={() => {
            const action = short;
            setShort(null);
            if (action === "restart") doRestart();
            else if (action === "continue") doContinue();
          }}
          onExit={() => router.push("/learn")}
        />
      </EntryGate>
    );
  }
  // Свежий вход, сердечек не хватило: «Сердечки закончились» вместо урока; после покупки — оплата и урок.
  if (!saved && access === "locked") return <OutOfHearts layout="screen" need={cost} onResume={resume} onExit={() => router.push("/learn")} />;
  // Оплата входа — в следующем кадре: пустой экран на мгновение.
  if (!saved && access !== "open") return <main className="min-h-dvh" aria-busy />;

  // Оплата: свежий вход — хук; экран выбора и повтор с итогов — обработчик; молчаливое продолжение — уже оплачено (время оплаты в сохранении).
  const paidNow = saved || round > 0 ? handPaid : payment;
  // Повтор с итогов: сердечек не хватило — окно покупки поверх итогов; после покупки — снова оплата и новый круг.
  const retryShort = (
    <OutOfHearts
      open={short === "retry"}
      need={cost}
      onClose={() => setShort(null)}
      onResume={() => {
        setShort(null);
        doRetry();
      }}
      onExit={() => router.push("/learn")}
    />
  );
  let player: ReactNode;
  if (asCheck) {
    player = (
      <LessonPlayer
        key={`check:${round}`}
        kind="lesson"
        via="check"
        lessonId={lesson.id}
        lesson={lesson}
        title={l(lesson.title)}
        steps={check}
        entryCost={ENTRY_COST.check}
        prepaid={paidNow?.paid}
        paidAt={paidNow?.paidAt}
        onRetry={doRetry}
      />
    );
  } else {
    player = (
      <>
        <LessonPlayer
          key={`${choice}:${round}`}
          kind="lesson"
          lessonId={lesson.id}
          lesson={lesson}
          title={l(lesson.title)}
          steps={lesson.steps}
          entryCost={cost}
          prepaid={paidNow?.paid}
          paidAt={paidNow?.paidAt}
          saveRun
          resume={choice === "continue" && saved ? saved : undefined}
          onRetry={doRetry}
        />
        {/* Бит-проводник: метка «урок в режиме Учиться» — в самом первом уроке Бит покажет сердечки, варианты и «Проверить».
            paid — сколько списано на этом входе (0 — вход уже был оплачен: «Продолжить», повтор в течение 20 минут). */}
        <GuideSpot kind="lesson" cost={cost} paid={paidNow?.paid ?? 0} />
      </>
    );
  }
  return (
    <>
      {player}
      {retryShort}
    </>
  );
}

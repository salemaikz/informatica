"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useT } from "@/i18n/useT";
import { track } from "@/lib/analytics";
import { ENTRY_COST, canAfford, lessonCost } from "@/lib/economy";
import { runPaid, usableRun } from "@/lib/lesson-run";
import { useApp } from "@/lib/store";
import type { Lesson, QuestionStep } from "@/lib/types";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";
import { ResumeLesson } from "@/components/lesson/ResumeLesson";
import { questionsAhead } from "@/components/lesson/run-snapshot";
import { useHeartsOutOnEntry } from "@/components/lesson/useHeartsOutOnEntry";
import { EntryGate } from "@/components/economy/EntryGate";
import { readHearts } from "@/components/economy/HeartsBar";
import { OutOfHearts } from "@/components/economy/OutOfHearts";
import { LessonFirstTip } from "@/components/tour/LessonFirstTip";

/**
 * Урок. Режимы: «Учиться» (learn) — вход стоит сердечко (у большого урока два), прохождение сохраняется,
 * при возврате — «Продолжить / Начать заново» (#41); «Проверить себя» (check) — вход 1, без сохранения.
 * Сердечки списывает плеер, когда урок начался: первый переход «дальше», первый ответ или «Пропустить» (#40, этап 15);
 * здесь — проверка на входе (EntryGate) и выбор продолжения. Открыть и сразу закрыть — бесплатно.
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
    return { run, paid: !!run && runPaid(run, Date.now()), ahead: run ? questionsAhead(run, lesson.steps) : true };
  });
  const saved = entry.run;
  // ask — экран выбора; continue — плеер с сохранения; fresh — плеер с первого шага.
  const [choice, setChoice] = useState<"ask" | "continue" | "fresh">(saved ? "ask" : "fresh");
  // Не хватает сердечек на выбранное действие — окно покупки; после покупки выполняем это действие.
  const [short, setShort] = useState<null | "continue" | "restart">(null);

  const cost = asCheck ? ENTRY_COST.check : lessonCost(lesson);
  // Продолжение уже оплаченного входа (или без заданий впереди) бесплатно — на входе сердечки не нужны.
  const need = saved && choice !== "fresh" && (entry.paid || !entry.ahead) ? 0 : cost;
  // Где закончились сердечки (#69): на входе (полноэкранное окно) и при выборе «Продолжить» / «Начать заново».
  const outWhere = asCheck ? "check" : "lesson";
  useHeartsOutOnEntry(need, outWhere);

  const restart = () => {
    useApp.getState().clearLessonRun(id);
    setChoice("fresh");
  };
  // «Начать заново» стоит всегда: не хватает сердечек — окно покупки, сохранение не трогаем.
  const askRestart = () => {
    track({ e: "resume_choice", lesson: lesson.id, choice: "restart" });
    if (canAfford(readHearts(), cost)) restart();
    else {
      track({ e: "hearts_out", where: outWhere });
      setShort("restart");
    }
  };
  // «Продолжить»: оплачен ли вход, проверяем в момент нажатия — 20 минут могли истечь, пока открыт экран выбора.
  const askContinue = () => {
    track({ e: "resume_choice", lesson: lesson.id, choice: "continue" });
    const free = !entry.ahead || (!!saved && runPaid(saved, Date.now()));
    if (free || canAfford(readHearts(), cost)) setChoice("continue");
    else {
      track({ e: "hearts_out", where: outWhere });
      setShort("continue");
    }
  };

  let body: ReactNode;
  if (saved && choice === "ask") {
    body = (
      <>
        <ResumeLesson
          title={l(lesson.title)}
          run={saved}
          total={lesson.steps.length}
          ahead={entry.ahead}
          cost={cost}
          onContinue={askContinue}
          onRestart={askRestart}
          backHref="/learn"
        />
        <OutOfHearts
          open={short !== null}
          need={cost}
          onClose={() => setShort(null)}
          onResume={() => {
            const action = short;
            setShort(null);
            if (action === "restart") restart();
            else if (action === "continue") setChoice("continue");
          }}
          onExit={() => router.push("/learn")}
        />
      </>
    );
  } else if (asCheck) {
    body = <LessonPlayer key="check" kind="lesson" via="check" lessonId={lesson.id} lesson={lesson} title={l(lesson.title)} steps={check} entryCost={ENTRY_COST.check} />;
  } else {
    body = (
      <>
        <LessonPlayer
          key={choice}
          kind="lesson"
          lessonId={lesson.id}
          lesson={lesson}
          title={l(lesson.title)}
          steps={lesson.steps}
          entryCost={cost}
          saveRun
          resume={choice === "continue" && saved ? saved : undefined}
        />
        {/* Проводник (#104): в самом первом уроке — одна подсказка у сердечек. */}
        <LessonFirstTip cost={cost} />
      </>
    );
  }

  return (
    <EntryGate need={need} exitHref="/learn">
      {body}
    </EntryGate>
  );
}

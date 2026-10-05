"use client";

import { ClipboardCheck, Timer } from "lucide-react";
import { GoalSummaryCard } from "@/components/goals/GoalSummaryCard";
import { StreakReminder } from "@/components/goals/StreakReminder";
import { useCallback, useState } from "react";
import { useT } from "@/i18n/useT";
import { ButtonLink } from "@/components/ui/Button";
import { QuickActions } from "@/components/learn/QuickActions";
import { ContinueCard } from "@/components/learn/ContinueCard";
import { CourseProgressBadge } from "@/components/progress/CourseProgressCard";
import { PlanCard } from "@/components/plan/PlanCard";
import { ViewSwitch, useMapView } from "@/components/learn/ViewSwitch";
import { PathView } from "@/components/learn/PathView";
import { EntMap } from "@/components/learn/EntMap";
import { LessonSheet } from "@/components/learn/LessonSheet";
import { MasteryLegend } from "@/components/learn/MasteryLegend";
import { TrackSwitch } from "@/components/school/TrackSwitch";
import { SchoolMap } from "@/components/school/SchoolMap";
import { useEntVisible } from "@/components/school/useEntVisible";
import { InstallPrompt } from "@/components/app/InstallPrompt";
import { findLessonRef, useLearnData } from "@/components/learn/useLearn";

// Главная: переключатель трека «ЕНТ | Школа», приветствие, цель, быстрые действия.
// Трек ЕНТ: «продолжить», карта курса («Путь» или «Карта ЕНТ»), мини-ЕНТ. Трек «Школа»: карта по классам 5–11.

function MiniExamCard() {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-3 rounded-3xl border-2 border-primary/30 bg-primary-soft p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_4px_0_var(--primary-strong)]">
          <Timer size={24} />
        </span>
        <div className="min-w-0">
          <p className="font-extrabold">{t("learn2.mini.title")}</p>
          <p className="text-sm font-semibold text-muted">{t("learn2.mini.text")}</p>
        </div>
      </div>
      <ButtonLink href="/exam" icon={<ClipboardCheck size={18} />} className="sm:shrink-0">
        {t("learn2.mini.cta")}
      </ButtonLink>
    </div>
  );
}

export default function LearnPage() {
  // Одна точка решения (lib/school.ts → entVisible): школьный трек — без целей, плана, пробного ЕНТ и карты ЕНТ (#52).
  const ent = useEntVisible();
  const { lessons, now, recommended, due } = useLearnData();
  const [sheet, setSheet] = useState<string | null>(null);
  const [view, setView] = useMapView();
  const openLesson = useCallback((id: string) => setSheet(id), []);

  const firstTime = Object.keys(lessons).length === 0;
  // «Продолжить»: следующий рекомендуемый урок, а если все готовые пройдены — самый «остывший» к повторению.
  const dueTarget = !recommended && due[0] ? findLessonRef(due[0].id) : undefined;
  const hero = recommended ?? dueTarget;
  const heroIndex = hero ? (findLessonRef(hero.ref.id)?.unitIndex ?? 0) : 0;

  return (
    <div className="flex flex-col gap-5">
      <TrackSwitch />

      <StreakReminder />
      {/* Цель (дата ЕНТ, балл) — для трека ЕНТ; у школьной программы своя карточка прогресса класса. */}
      {ent && <GoalSummaryCard />}

      <QuickActions continueId={ent ? recommended?.ref.id : undefined} dueCount={due.length} firstTime={firstTime} />

      {!ent ? (
        <SchoolMap />
      ) : (
        <>
          {/* «Пройдено X% курса» (#71): одна строка, ведёт в «Прогресс». */}
          <CourseProgressBadge />
          <ContinueCard
            target={hero}
            kind={recommended ? "next" : "due"}
            unitIndex={heroIndex}
            firstTime={firstTime}
            onModes={() => hero && setSheet(hero.ref.id)}
          />

          <PlanCard heroLessonId={hero?.ref.id} />

          <ViewSwitch view={view} onChange={setView} />

          {view === "path" ? (
            <>
              <PathView recommendedId={recommended?.ref.id} now={now} onOpen={openLesson} />
              <MasteryLegend />
            </>
          ) : (
            <EntMap recommendedId={recommended?.ref.id} now={now} onLesson={openLesson} />
          )}

          <MiniExamCard />
        </>
      )}

      <InstallPrompt />

      <LessonSheet lessonId={sheet} onClose={() => setSheet(null)} />
    </div>
  );
}

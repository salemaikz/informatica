"use client";

import { Link2, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { UNITS } from "@/content/course-map";
import { schoolPlan } from "@/content/school-program";
import { gradeProgress, hasDirections, nextSchoolLesson, toSchoolGrade } from "@/lib/school";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { MascotSays } from "@/components/mascot/Mascot";
import { PageTip } from "@/components/tour/PageTip";
import { DirectionPicker } from "./DirectionPicker";
import { GradePicker } from "./GradePicker";
import { GradeProgressCard } from "./GradeProgressCard";
import { SchoolSectionCard } from "./SchoolSectionCard";

// Карта школьного трека: выбор класса 5–11, прогресс класса, разделы программы с темами.
// Прогресс общий с картой ЕНТ (те же `lessons` стора, см. lib/school.ts) — под картой об этом одна строка.

export function SchoolMap() {
  const { t } = useT();
  const gradeRaw = useApp((s) => s.profile.grade);
  const direction = useApp((s) => s.profile.direction);
  const lessons = useApp((s) => s.lessons);
  const updateProfile = useApp((s) => s.updateProfile);
  const grade = toSchoolGrade(gradeRaw);
  const plan = useMemo(() => (grade ? schoolPlan(grade, direction) : undefined), [grade, direction]);

  const progress = useMemo(() => (plan ? gradeProgress(plan, lessons) : null), [plan, lessons]);
  const next = useMemo(() => (plan ? nextSchoolLesson(plan, lessons) : null), [plan, lessons]);

  // Раскрытые разделы: пока ученик ничего не трогал — открыт тот, где следующий урок (иначе первый).
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const defaultOpen = next?.sectionId ?? plan?.sections[0]?.id;

  return (
    <div className="flex flex-col gap-4">
      <PageTip id="page-school" />
      <div className="flex flex-col gap-2">
        <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{t("school.grade.label")}</p>
        <GradePicker />
        {hasDirections(grade) && (
          <>
            <p className="mt-1 text-xs font-extrabold uppercase tracking-wide text-muted">{t("school.dir.label")}</p>
            <DirectionPicker />
            <p className="text-sm font-semibold text-muted">{t("school.dir.hint")}</p>
          </>
        )}
      </div>

      {!plan || !grade || !progress ? (
        <MascotSays mood="thinking" size={64}>
          {t("school.grade.pick")}
        </MascotSays>
      ) : (
        <>
          <GradeProgressCard grade={grade} progress={progress} nextLessonId={next?.lessonId ?? null} />
          <div className="flex flex-col gap-3">
            {plan.sections.map((section, i) => (
              <SchoolSectionCard
                key={section.id}
                section={section}
                index={i}
                color={UNITS[i % UNITS.length].color}
                lessons={lessons}
                open={toggled[section.id] ?? section.id === defaultOpen}
                onToggle={() => setToggled((m) => ({ ...m, [section.id]: !(m[section.id] ?? section.id === defaultOpen) }))}
              />
            ))}
          </div>
          <p className="flex items-start justify-center gap-1.5 text-center text-xs font-bold text-muted">
            <Link2 size={14} aria-hidden className="mt-px shrink-0" />
            <span>{t("school.progress.shared")}</span>
          </p>
          <p className="text-center text-xs font-semibold text-muted">{t("school.source")}</p>
        </>
      )}

      <div className="flex flex-col gap-3 rounded-3xl border-2 border-primary/30 bg-primary-soft p-4 sm:flex-row sm:items-center">
        <p className="flex-1 font-bold">{t("school.hint.ent")}</p>
        <Button variant="primary" icon={<Target size={18} />} onClick={() => updateProfile({ track: "ent" })}>
          {t("school.hint.cta")}
        </Button>
      </div>
    </div>
  );
}

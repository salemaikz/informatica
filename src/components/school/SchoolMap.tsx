"use client";

import { Target } from "lucide-react";
import { useMemo, useState } from "react";
import { UNITS } from "@/content/course";
import { schoolPlan } from "@/content/school-program";
import { gradeProgress, nextSchoolLesson, toSchoolGrade } from "@/lib/school";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Button } from "@/components/ui/Button";
import { MascotSays } from "@/components/mascot/Mascot";
import { GradePicker } from "./GradePicker";
import { GradeProgressCard } from "./GradeProgressCard";
import { SchoolSectionCard } from "./SchoolSectionCard";

// Карта школьного трека: выбор класса 5–11, прогресс класса, разделы программы с темами.

export function SchoolMap() {
  const { t } = useT();
  const gradeRaw = useApp((s) => s.profile.grade);
  const lessons = useApp((s) => s.lessons);
  const updateProfile = useApp((s) => s.updateProfile);
  const grade = toSchoolGrade(gradeRaw);
  const plan = grade ? schoolPlan(grade) : undefined;

  const progress = useMemo(() => (plan ? gradeProgress(plan, lessons) : null), [plan, lessons]);
  const next = useMemo(() => (plan ? nextSchoolLesson(plan, lessons) : null), [plan, lessons]);

  // Раскрытые разделы: пока ученик ничего не трогал — открыт тот, где следующий урок (иначе первый).
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const defaultOpen = next?.sectionId ?? plan?.sections[0]?.id;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{t("school.grade.label")}</p>
        <GradePicker />
      </div>

      {!plan || !grade || !progress ? (
        <MascotSays mood="thinking" size={64}>
          {t("school.grade.pick")}
        </MascotSays>
      ) : (
        <>
          <GradeProgressCard grade={grade} progress={progress} nextLessonId={next?.lessonId ?? null} />
          {(grade === "10" || grade === "11") && <p className="text-sm font-semibold text-muted">{t("school.direction")}</p>}
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

"use client";

import { useState } from "react";
import type { QuestionStep } from "@/lib/types";
import { useApp } from "@/lib/store";
import { buildDrill, canGenerate, generateStep } from "@/lib/generators";
import { findStep, unlockedSkills } from "@/content/course";
import { skillById } from "@/content/skills";
import { useT } from "@/i18n/useT";
import { isQuestion } from "@/lib/evaluate";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";

/** Собирает набор заданий для тренировки один раз при открытии экрана. */
function buildSession(mode: "smart" | "mistakes" | "skill", skill?: string) {
  const s = useApp.getState();
  const available = unlockedSkills(Object.keys(s.lessons));
  const seed = Date.now();
  if (mode === "mistakes") {
    const steps: QuestionStep[] = [];
    const map: Record<string, string> = {};
    s.mistakes.slice(0, 8).forEach((m, i) => {
      // Исходное задание урока, если есть; иначе — свежее задание на тот же навык.
      const original = findStep(m.lessonId, m.stepId);
      let step: QuestionStep | undefined = original && isQuestion(original) && original.type !== "solution" ? original : undefined;
      if (!step && m.skill && canGenerate(m.skill)) step = generateStep(m.skill, s.skills[m.skill]?.mastery ?? 0, seed + i);
      if (step && !steps.some((x) => x.id === step!.id)) {
        steps.push(step);
        map[step.id] = m.stepId;
      }
    });
    return { steps, map };
  }
  const focus = mode === "skill" && skill ? [skill] : undefined;
  return { steps: buildDrill(available.length ? available : ["ns.bin2dec"], s.skills, { seed, focus, count: 8 }), map: undefined };
}

export function DrillScreen({ mode, skill }: { mode: "smart" | "mistakes" | "skill"; skill?: string }) {
  const { t, l } = useT();
  const [session] = useState(() => buildSession(mode, skill));
  const title =
    mode === "mistakes" ? t("prac.mistakes") : mode === "skill" && skill && skillById(skill) ? l(skillById(skill)!.title) : t("prac.smart");
  if (!session.steps.length) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-bold">{t("prac.noMistakes")}</p>
        <a href="/practice" className="font-bold text-primary underline">
          {t("common.back")}
        </a>
      </div>
    );
  }
  return <LessonPlayer kind="drill" title={title} steps={session.steps} mistakeMap={session.map} />;
}

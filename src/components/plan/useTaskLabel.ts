"use client";

import { UNITS } from "@/content/course-map";
import { REVIEW_ANSWERS, type PlanTask } from "@/lib/plan";
import { useT } from "@/i18n/useT";

/** Название и подпись дела плана (урок, контрольная, пробный ЕНТ, повторение) — для строки дела и кнопки «Начать». */
export function useTaskLabel() {
  const { t, l } = useT();
  return (task: PlanTask): { title: string; sub: string } => {
    if (task.type === "lesson") {
      const unit = UNITS.find((u) => u.id === task.unit);
      const ref = unit?.lessons.find((r) => r.id === task.id);
      return { title: ref ? l(ref.title) : task.id, sub: unit ? l(unit.title) : "" };
    }
    if (task.type === "checkpoint") {
      const unit = UNITS.find((u) => u.id === task.unit);
      return { title: t("plan.task.checkpoint", { unit: unit ? l(unit.title) : task.unit }), sub: t("plan.task.checkpoint.sub") };
    }
    if (task.type === "exam") {
      return task.exam === "full"
        ? { title: t("exam.mode.full"), sub: t("exam.mode.full.desc") }
        : { title: t("exam.mode.mini"), sub: t("exam.mode.mini.desc") };
    }
    return { title: t("plan.task.review"), sub: t("plan.task.review.sub", { n: REVIEW_ANSWERS }) };
  };
}

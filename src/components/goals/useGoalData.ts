"use client";

import { useMemo } from "react";
import { forecastScore } from "@/lib/forecast";
import { daysUntil, goalStatus, weekProgress } from "@/lib/goals";
import { useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";
import { useMinuteClock } from "./useClock";

/** Всё, что нужно карточке и панели целей: дни до ЕНТ, прогноз, статус против цели, неделя. */
export function useGoalData() {
  const examDate = useApp((s) => s.profile.examDate);
  const targetScore = useApp((s) => s.profile.targetScore);
  const weeklyLessons = useApp((s) => s.profile.weeklyLessons);
  const skills = useApp((s) => s.skills);
  const exams = useApp((s) => s.exams);
  const days = useApp((s) => s.days);
  const clock = useMinuteClock();
  const now = clock || 0;
  const today = todayKey(new Date(now || 0));

  return useMemo(() => {
    const forecast = forecastScore({ skills, exams, now });
    return {
      today,
      examDate,
      targetScore,
      daysLeft: daysUntil(examDate, today),
      forecast,
      goal: goalStatus(forecast, targetScore),
      week: weekProgress(days, weeklyLessons, today),
    };
  }, [skills, exams, days, examDate, targetScore, weeklyLessons, now, today]);
}

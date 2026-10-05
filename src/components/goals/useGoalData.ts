"use client";

import { useMemo } from "react";
import { forecastScore } from "@/lib/forecast";
import { daysUntil, goalStatus, weekProgress } from "@/lib/goals";
import { useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";
import { useSkillStats } from "@/components/progress/useSkillStats";
import { useMinuteClock } from "./useClock";

/**
 * Неделя: уроков за неделю против цели из профиля и точки по дням. Не про ЕНТ — нужна всем трекам,
 * поэтому не тянет за собой прогноз балла.
 */
export function useWeekData() {
  const weeklyLessons = useApp((s) => s.profile.weeklyLessons);
  const days = useApp((s) => s.days);
  const clock = useMinuteClock();
  const today = todayKey(new Date(clock || 0));
  return useMemo(() => weekProgress(days, weeklyLessons, today), [days, weeklyLessons, today]);
}

/**
 * Всё, что нужно карточке и панели целей: дни до ЕНТ, прогноз, статус против цели, неделя.
 * Прогноз учитывает входную диагностику (пока нет пробников и ответов по навыкам); цель «пока не выбрана»
 * (`targetScoreSet` = false) — без статуса и разрыва до цели.
 */
export function useGoalData() {
  const examDate = useApp((s) => s.profile.examDate);
  const targetScore = useApp((s) => s.profile.targetScore);
  const targetScoreSet = useApp((s) => s.profile.targetScoreSet);
  const diagnostic = useApp((s) => s.profile.diagnostic);
  // Прогноз считается по освоению с затуханием: после перерыва он честно снижается (#45, #80).
  const skills = useSkillStats();
  const exams = useApp((s) => s.exams);
  const week = useWeekData();
  const clock = useMinuteClock();
  const now = clock || 0;
  const today = todayKey(new Date(now || 0));

  return useMemo(() => {
    const forecast = forecastScore({ skills, exams, now, diagnostic });
    return {
      today,
      examDate,
      targetScore,
      targetScoreSet,
      /** Итог входной диагностики: нужен кнопке «Пройти диагностику заново». */
      diagnostic,
      daysLeft: daysUntil(examDate, today),
      forecast,
      goal: goalStatus(forecast, targetScore, targetScoreSet),
      week,
    };
  }, [skills, exams, diagnostic, week, examDate, targetScore, targetScoreSet, now, today]);
}

"use client";

import { useMemo } from "react";
import { useMinuteClock } from "@/components/goals/useClock";
import { decaySkills, type SkillStat } from "@/lib/mastery";
import { useApp } from "@/lib/store";

/**
 * Освоение навыков на сейчас, с затуханием без практики (#45, #80). Так его читают карта, прогресс, практика, прогноз,
 * пробник, отчёт родителю, игры — везде, где освоение показывают или по нему выбирают. Запись, достижения и миграции
 * берут сырое `s.skills` из стора. Часы — раз в минуту; на сервере и в первом кадре 0 — без затухания, гидратация не расходится.
 */
export function useSkillStats(): Record<string, SkillStat> {
  const skills = useApp((s) => s.skills);
  const now = useMinuteClock();
  return useMemo(() => decaySkills(skills, now), [skills, now]);
}

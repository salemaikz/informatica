import { decaySkills, decayedMastery, type SkillStat } from "@/lib/mastery";
import { useApp } from "@/lib/store";

// Освоение для выбора заданий в играх — с затуханием без практики (#45, #80).
// Вызывать только из обработчиков и инициализаторов (внутри Date.now()), не из рендера.

/** Освоение навыка на сейчас; навыка в прогрессе нет — undefined (игра подставит своё значение по умолчанию). */
export function liveMastery(skill: string): number | undefined {
  const st = useApp.getState().skills[skill];
  return st ? decayedMastery(st, Date.now()) : undefined;
}

/** Все навыки на сейчас (для игр, которые выбирают слабые навыки по всему прогрессу). */
export function liveSkills(): Record<string, SkillStat> {
  return decaySkills(useApp.getState().skills, Date.now());
}

import { XP } from "@/lib/gamification";
import { scaleXp } from "@/lib/review";
import { chipsForXp } from "@/lib/economy";
import { chipRate } from "./shop-helpers";

/** Доля шагов урока, которые являются заданиями (остальное — объяснения); для оценки награды. */
const QUESTION_SHARE = 0.5;

/** Оценка максимума XP за урок: все задания верно с первой попытки + бонусы (повтор бонусов не даёт). */
export function lessonXpMax(stepCount: number, factor: number): number {
  const questions = Math.max(1, Math.round(stepCount * QUESTION_SHARE));
  const answers = scaleXp(questions * XP.correct, factor);
  const bonus = factor === 1 ? XP.lessonComplete + XP.perfectLesson : 0;
  return answers + bonus;
}

/** Сколько чипов дадут за XP при множителе 1 (для подписи «≈ M чипов»). */
export function chipsEstimate(xp: number): number {
  return chipsForXp(xp, 1);
}

/** Курс для подписи: «5 XP = 2 чипа». */
export const xpChipRate = chipRate;

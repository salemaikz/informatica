import { XP } from "@/lib/gamification";
import { scaleXp } from "@/lib/review";
import { chipsForXp } from "@/lib/economy";
import { pluralForm } from "@/components/learn/map";
import { chipRate, formatMult } from "./shop-helpers";

/** Доля шагов урока, которые являются заданиями (остальное — объяснения); для оценки награды. */
const QUESTION_SHARE = 0.5;

/**
 * Оценка максимума XP за урок: все задания верно с первой попытки + комбо-бонус + бонусы за прохождение.
 * `hasStat` — урок уже проходили: «идеально» не даётся, прохождение — по множителю повтора.
 */
export function lessonXpMax(stepCount: number, factor: number, hasStat = false): number {
  const questions = Math.max(1, Math.round(stepCount * QUESTION_SHARE));
  const answers = scaleXp(questions * XP.correct, factor);
  const combo = scaleXp(Math.max(0, questions - 2) * XP.comboBonus, factor);
  const complete = scaleXp(XP.lessonComplete, factor);
  const perfect = hasStat ? 0 : XP.perfectLesson;
  return answers + combo + complete + perfect;
}

/** Сколько чипов дадут за XP (множитель — тариф × бустер; для подписи «≈ M чипов»). */
export function chipsEstimate(xp: number, multiplier = 1): number {
  return chipsForXp(xp, multiplier);
}

/** Ключ строки со склонением: `xp.chipsPlus.few` и т. п. */
export function chipsKey(base: "xp.chipsPlus" | "xp.rate" | "xp.reward", n: number): `${typeof base}.${"one" | "few" | "many"}` {
  return `${base}.${pluralForm(n)}`;
}

/** Хвост подписи курса при множителе: « · ×2» (пусто при ×1). */
export function multSuffix(multiplier: number): string {
  return multiplier === 1 ? "" : ` · ${formatMult(multiplier)}`;
}

/** Курс для подписи: «5 XP = 2 чипа». */
export const xpChipRate = chipRate;

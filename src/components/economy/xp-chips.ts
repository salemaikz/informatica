import { XP } from "@/lib/gamification";
import { scaleXp } from "@/lib/review";
import { lessonChips } from "@/lib/economy";
import { pluralForm } from "@/components/learn/map";

/** Доля шагов урока, которые являются заданиями (остальное — объяснения); для оценки награды. */
const QUESTION_SHARE = 0.5;

/**
 * Оценка максимума XP за урок: все задания верно с первой попытки + комбо-бонус + бонусы за прохождение.
 * `hasStat` — урок уже проходили: «идеально» не даётся, прохождение — по множителю повтора.
 * `xpMult` — бустер опыта (xpMultiplier, #122): стор умножает на него и ответы, и бонусы.
 */
export function lessonXpMax(stepCount: number, factor: number, hasStat = false, xpMult = 1): number {
  const questions = Math.max(1, Math.round(stepCount * QUESTION_SHARE));
  const answers = scaleXp(questions * XP.correct, factor);
  const combo = scaleXp(Math.max(0, questions - 2) * XP.comboBonus, factor);
  const complete = scaleXp(XP.lessonComplete, factor);
  const perfect = hasStat ? 0 : XP.perfectLesson;
  return Math.round((answers + combo + complete + perfect) * xpMult);
}

/**
 * Сколько чипов дадут за прохождение урока (решение #105): 2 за первое прохождение, 0 за повтор (#122); множитель — только тариф.
 * «Сюрприз за идеальный урок» (шанс, PERFECT_DROP) в оценку не входит: он зависит от результата.
 */
export function chipsEstimate(hasStat: boolean, multiplier = 1): number {
  return lessonChips(!hasStat, multiplier);
}

/** Ключ строки со склонением: `xp.chipsPlus.few` и т. п. */
export function chipsKey(base: "xp.chipsPlus" | "xp.reward" | "econ16c.drop.chips", n: number): `${typeof base}.${"one" | "few" | "many"}` {
  return `${base}.${pluralForm(n)}`;
}

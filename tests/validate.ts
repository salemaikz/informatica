import type { L, Step, Text } from "@/lib/types";
import { checkInput } from "@/lib/check";

const filledL = (l: L) => !!l.ru?.trim() && !!l.kk?.trim();
const filledText = (t: Text) => (typeof t === "string" ? !!t.trim() : filledL(t));

/** Возвращает список проблем шага (пустой — шаг валиден). */
export function validateStep(step: Step): string[] {
  const errors: string[] = [];
  const need = (cond: boolean, msg: string) => !cond && errors.push(`${step.id}: ${msg}`);
  if (step.type === "video") need(filledL(step.title), "title");
  if (step.type === "theory") {
    need(filledL(step.title), "title");
    need(filledL(step.body), "body");
  }
  if (step.type === "video" || step.type === "theory") return errors;

  need(filledL(step.prompt), "prompt ru/kk");
  need(filledL(step.explanation), "explanation ru/kk");
  switch (step.type) {
    case "choice":
      need(step.options.length >= 2, "минимум 2 варианта");
      need(step.options.every(filledText), "пустой вариант");
      need(step.correct >= 0 && step.correct < step.options.length, "correct вне диапазона");
      need(new Set(step.options.map((o) => JSON.stringify(o))).size === step.options.length, "повторяющиеся варианты");
      break;
    case "multi":
      need(step.options.length >= 3, "минимум 3 варианта");
      need(step.correct.length >= 1, "нет верных");
      need(step.correct.every((i) => i >= 0 && i < step.options.length), "correct вне диапазона");
      break;
    case "input":
      need(step.answers.length > 0, "нет ответов");
      need(step.answers.every((a) => checkInput(a, step.answers, step.mode)), "ответ не проходит свою проверку");
      break;
    case "bits":
      need(step.target >= 0 && step.target < 2 ** step.bits, "target не помещается в bits");
      break;
    case "ladder":
      need(step.number > 0 && step.number < 1024, "number вне 1..1023");
      break;
    case "match":
      need(step.pairs.length >= 3 && step.pairs.length <= 6, "3–6 пар");
      need(new Set(step.pairs.map((p) => JSON.stringify(p.right))).size === step.pairs.length, "повторы справа");
      break;
    case "order":
      need(step.items.length >= 3 && step.items.every(filledL), "минимум 3 пункта ru/kk");
      break;
    case "solution":
      need(filledL(step.reference), "reference");
      need(checkInput(step.answer, [step.answer], step.answerMode), "answer");
      break;
  }
  return errors;
}

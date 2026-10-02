import type { L, Scene, Step, Text } from "@/lib/types";
import { checkInput } from "@/lib/check";
import { clozeBlanks } from "@/lib/evaluate";

const filledL = (l: L) => !!l.ru?.trim() && !!l.kk?.trim();
const filledText = (t: Text) => (typeof t === "string" ? !!t.trim() : filledL(t));

/** Проблемы параметров сцены (пустой список — сцену можно нарисовать). */
export function validateScene(scene: Scene): string[] {
  const errors: string[] = [];
  const need = (cond: boolean, msg: string) => !cond && errors.push(`сцена ${scene.kind}: ${msg}`);
  switch (scene.kind) {
    case "binary":
      need(/^[01]+$/.test(scene.bits), "bits — только 0 и 1");
      need((scene.highlight ?? []).every((i) => Number.isInteger(i) && i >= 0 && i < scene.bits.length), "highlight вне диапазона");
      break;
    case "ladder":
      need(Number.isInteger(scene.number) && scene.number > 0, "number — целое > 0");
      need((scene.base ?? 2) >= 2, "base ≥ 2");
      break;
    case "lamps":
      need(/^[01]+$/.test(scene.states), "states — только 0 и 1");
      break;
    case "coins":
      need(scene.values.length > 0 && scene.values.every((v) => v > 0), "values — положительные числа");
      need((scene.picked ?? []).every((v) => scene.values.includes(v)), "picked должны быть среди values");
      break;
    case "decimal":
      need(/^\d+$/.test(scene.number), "number — только цифры");
      break;
    case "quest":
      need(!scene.caption || filledText(scene.caption), "пустая подпись");
      break;
  }
  return errors;
}

/** Возвращает список проблем шага (пустой — шаг валиден). */
export function validateStep(step: Step): string[] {
  const errors: string[] = [];
  const need = (cond: boolean, msg: string) => !cond && errors.push(`${step.id}: ${msg}`);
  // Схемы шага: сцена теории/ситуации/разбора/решаем-вместе и «раскрытие» после ответа.
  const scenes: (Scene | undefined)[] = [step.reveal];
  if (step.type === "theory" || step.type === "story" || step.type === "cloze") scenes.push(step.scene);
  if (step.type === "worked") scenes.push(...step.steps.map((x) => x.scene));
  for (const sc of scenes) if (sc) errors.push(...validateScene(sc).map((e) => `${step.id}: ${e}`));
  if (step.reveal) need(step.type !== "video" && step.type !== "theory" && step.type !== "story" && step.type !== "worked" && step.type !== "explore", "reveal только у заданий");
  if (step.type === "video") need(filledL(step.title), "title");
  if (step.type === "theory") {
    need(filledL(step.title), "title");
    need(filledL(step.body), "body");
  }
  if (step.type === "story") need(filledL(step.body), "body");
  if (step.type === "worked") {
    need(filledL(step.title), "title");
    need(step.steps.length >= 2 && step.steps.every((x) => filledL(x.text)), "минимум 2 шага ru/kk");
    need(!step.result || filledL(step.result), "result ru/kk");
  }
  if (step.type === "explore") {
    need(filledL(step.title), "title");
    need(step.size >= 1 && step.size <= 8, "size 1..8");
    if (step.goal) need(step.goal.target >= 0 && filledL(step.goal.text), "goal");
  }
  if (step.type === "video" || step.type === "theory" || step.type === "story" || step.type === "worked" || step.type === "explore") return errors;

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
    case "cloze": {
      const blanks = clozeBlanks(step);
      need(blanks.length >= 1, "нет пропусков");
      need(blanks.every((b) => b.blank.length > 0 && b.blank.every((v) => checkInput(v, b.blank, b.mode))), "ответ пропуска не проходит свою проверку");
      need(step.lines.flat().every((t) => (typeof t === "object" && !("blank" in t) ? filledL(t) : true)), "текст ru/kk");
      need(blanks.every((b) => b.width === undefined || b.width > 0), "width > 0");
      need(blanks.every((b) => b.mode !== "binary" || b.blank.every((v) => /^[01]+$/.test(v))), "двоичный пропуск: ответ из 0 и 1");
      break;
    }
  }
  return errors;
}

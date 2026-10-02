import type { Lang, QuestionStep, Step } from "./types";
import type { CheckSolutionResponse } from "./ai-types";
import { checkInput, divisionLadder, sameSet, toBinary } from "./check";
import { plain, tx } from "./text";

// Ответы ученика по типам шагов и их проверка. Чистые функции — покрыты тестами.

export type Answer =
  | { type: "choice"; index: number }
  | { type: "multi"; indices: number[] }
  | { type: "input"; value: string }
  | { type: "bits"; value: number }
  | { type: "ladder"; remainders: (number | null)[] }
  | { type: "match"; done: boolean; wrong: number }
  | { type: "order"; order: number[] }
  | { type: "solution"; image?: string; typed: string };

export interface StepResult {
  correct: boolean;
  /** 0..1 — частичный балл для модели освоения. */
  score: number;
  given: string;
  expected: string;
  details?: CheckSolutionResponse;
  /** Проверено без ИИ (ИИ недоступен). */
  offline?: boolean;
}

export function isQuestion(step: Step): step is QuestionStep {
  return step.type !== "video" && step.type !== "theory";
}

/** Готов ли ответ к проверке (активна кнопка «Проверить»). */
export function isReady(step: QuestionStep, a: Answer | null): boolean {
  if (!a) return false;
  switch (a.type) {
    case "choice":
      return a.index >= 0;
    case "multi":
      return a.indices.length > 0;
    case "input":
      return a.value.trim() !== "";
    case "bits":
      return true;
    case "ladder":
      return a.remainders.every((r) => r !== null);
    case "match":
      return a.done;
    case "order":
      return step.type === "order" && a.order.length === step.items.length;
    case "solution":
      return !!a.image || a.typed.trim() !== "";
  }
}

/** Верный ответ в текстовом виде (для обратной связи, ИИ и статистики). */
export function expectedText(step: QuestionStep, lang: Lang): string {
  switch (step.type) {
    case "choice":
      return tx(step.options[step.correct], lang);
    case "multi":
      return step.correct.map((i) => tx(step.options[i], lang)).join(", ");
    case "input":
      return `${step.answers[0]}${step.suffix ?? ""}`;
    case "bits":
      return `${toBinary(step.target, step.bits)}₂ = ${step.target}`;
    case "ladder":
      return `${toBinary(step.number)}₂`;
    case "match":
      return step.pairs.map((p) => `${tx(p.left, lang)} = ${tx(p.right, lang)}`).join("; ");
    case "order":
      return step.items.map((i) => tx(i, lang)).join(" → ");
    case "solution":
      return `${step.answer}${step.answerMode === "binary" ? "₂" : ""}`;
  }
}

export function promptText(step: QuestionStep, lang: Lang): string {
  return plain(tx(step.prompt, lang));
}

/** Синхронная проверка (все типы, кроме решения с ИИ). */
export function evaluate(step: QuestionStep, a: Answer, lang: Lang): StepResult {
  const expected = expectedText(step, lang);
  const fail = (given: string): StepResult => ({ correct: false, score: 0, given, expected });
  const ok = (given: string): StepResult => ({ correct: true, score: 1, given, expected });

  if (step.type === "choice" && a.type === "choice") {
    const given = tx(step.options[a.index] ?? "", lang);
    return a.index === step.correct ? ok(given) : fail(given);
  }
  if (step.type === "multi" && a.type === "multi") {
    const given = a.indices.map((i) => tx(step.options[i], lang)).join(", ");
    return sameSet(a.indices, step.correct) ? ok(given) : fail(given);
  }
  if (step.type === "input" && a.type === "input") {
    return checkInput(a.value, step.answers, step.mode) ? ok(a.value.trim()) : fail(a.value.trim());
  }
  if (step.type === "bits" && a.type === "bits") {
    const given = `${toBinary(a.value, step.bits)}₂ = ${a.value}`;
    return a.value === step.target ? ok(given) : fail(given);
  }
  if (step.type === "ladder" && a.type === "ladder") {
    const right = divisionLadder(step.number).map((r) => r.remainder);
    const given = `${[...a.remainders].reverse().join("")}₂`;
    return right.every((r, i) => r === a.remainders[i]) ? ok(given) : fail(given);
  }
  if (step.type === "match" && a.type === "match") {
    const score = Math.max(0, 1 - 0.25 * a.wrong);
    const given = a.wrong ? (lang === "kk" ? `қате: ${a.wrong}` : `ошибок: ${a.wrong}`) : "";
    return { correct: a.wrong === 0, score, given, expected };
  }
  if (step.type === "order" && a.type === "order") {
    const given = a.order.map((i) => tx(step.items[i], lang)).join(" → ");
    return a.order.every((v, i) => v === i) ? ok(given) : fail(given);
  }
  if (step.type === "solution" && a.type === "solution") {
    // Локальная проверка только итогового ответа — когда ИИ недоступен.
    const given = a.typed.trim();
    const correct = checkInput(given, [step.answer], step.answerMode);
    return { correct, score: correct ? 1 : 0, given, expected, offline: true };
  }
  return fail("");
}

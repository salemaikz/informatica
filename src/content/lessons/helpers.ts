import type { ChoiceStep, InputStep, L, Lesson, MatchStep, MultiStep, QuestionStep, Text, TheoryStep, VisualId } from "@/lib/types";
import { hashString, seeded, shuffle } from "@/lib/text";

export const text = (ru: string, kk: string): L => ({ ru, kk });

export function input(prompt: L, answer: string, explanation: L, mode: InputStep["mode"] = "number"): InputStep {
  return { id: "", type: "input", prompt, answers: [answer], mode, explanation };
}

export function choice(prompt: L, options: Text[], correct: number, explanation: L): ChoiceStep {
  return { id: "", type: "choice", prompt, options, correct, explanation };
}

export function multi(prompt: L, options: Text[], correct: number[], explanation: L): MultiStep {
  return { id: "", type: "multi", prompt, options, correct, explanation };
}

export function match(prompt: L, pairs: MatchStep["pairs"], explanation: L): MatchStep {
  return { id: "", type: "match", prompt, pairs, explanation };
}

export function theory(title: L, body: L, visual?: VisualId): TheoryStep {
  return { id: "", type: "theory", title, body, visual };
}

interface LessonSpec {
  id: string;
  unitId: string;
  title: L;
  description: L;
  skill: string;
  cards: [TheoryStep, TheoryStep, TheoryStep];
  questions: [QuestionStep, QuestionStep, QuestionStep, QuestionStep, QuestionStep, QuestionStep];
  solution: { prompt: L; answer: string; reference: L; mode?: InputStep["mode"] };
  conspect: L;
}

/** Одна идея, разобранный пример и два закрепления на каждой карточке. */
export function lesson(spec: LessonSpec): Lesson {
  const steps: Lesson["steps"] = [];
  spec.cards.forEach((card, i) => {
    steps.push({ ...card, id: `${spec.id}:theory:${i + 1}`, skill: spec.skill });
    for (let j = 0; j < 2; j++) {
      const n = i * 2 + j;
      const question = { ...spec.questions[n], id: `${spec.id}:q:${n + 1}`, skill: spec.skill, level: (i + 1) as 1 | 2 | 3, ent: n >= 4 };
      if (question.type === "choice" || question.type === "multi") {
        const indices = shuffle(question.options.map((_, index) => index), seeded(hashString(question.id)));
        const options = indices.map((index) => question.options[index]);
        if (question.type === "choice") steps.push({ ...question, options, correct: indices.indexOf(question.correct) });
        else steps.push({ ...question, options, correct: question.correct.map((index) => indices.indexOf(index)) });
      } else steps.push(question);
    }
  });
  steps.push({
    id: `${spec.id}:solution`, type: "solution", skill: spec.skill, level: 3,
    prompt: spec.solution.prompt, reference: spec.solution.reference,
    answer: spec.solution.answer, answerMode: spec.solution.mode ?? "number", explanation: spec.solution.reference,
  });
  steps.push({ id: `${spec.id}:summary`, type: "theory", title: text("Шпаргалка и частые ошибки", "Қысқаша конспект және жиі кездесетін қателер"), body: spec.conspect });
  return { id: spec.id, unitId: spec.unitId, title: spec.title, description: spec.description, skills: [spec.skill], durationMin: 8, steps, conspect: spec.conspect };
}

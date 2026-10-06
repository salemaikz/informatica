import { multiPoints, type EntQuestion } from './ent';
import { tx } from './text';
import type { Lang, AnswerRecord } from './types';
export type ExamAnswer = number | number[];

/** Частичный ответ учитываем; полностью снятый выбор не является попыткой. */
export function examAnswerAttempted(question: EntQuestion, answer: ExamAnswer | undefined): boolean {
  if (question.type === 'choice') return typeof answer === 'number' && Number.isInteger(answer) && answer >= 0 && answer < question.options.length;
  return Array.isArray(answer) && answer.some(index => Number.isInteger(index) && index >= 0 && index < question.options.length);
}

export function examAnswerReady(question: EntQuestion, answer: ExamAnswer | undefined): boolean {
  if (question.type === 'choice') return examAnswerAttempted(question, answer);
  if (!Array.isArray(answer)) return false;
  if (question.type === 'ent-match') return answer.length === question.left.length && answer.every(index => index >= 0 && index < question.options.length);
  return answer.length > 0 && answer.every(index => Number.isInteger(index) && index >= 0 && index < question.options.length);
}

export function scoreExamQuestion(question: EntQuestion, answer: ExamAnswer | undefined, lang: Lang): { points: number; max: number; record: AnswerRecord } {
  const ready = examAnswerReady(question, answer);
  const max = question.type === 'choice' ? 1 : 2;
  let points = 0;
  let given = lang === 'kk' ? 'Жауап жоқ' : 'Без ответа';
  let expected = '';
  if (question.type === 'choice') {
    expected = tx(question.options[question.correct], lang);
    if (ready && typeof answer === 'number') {
      given = tx(question.options[answer], lang);
      points = answer === question.correct ? 1 : 0;
    }
  } else if (question.type === 'multi') {
    expected = question.correct.map(index => tx(question.options[index], lang)).join(', ');
    if (ready && Array.isArray(answer)) {
      given = answer.map(index => tx(question.options[index], lang)).join(', ');
      points = multiPoints(question.correct, answer);
    }
  } else {
    expected = question.left.map((left, i) => `${tx(left, lang)} = ${tx(question.options[question.correct[i]], lang)}`).join('; ');
    if (Array.isArray(answer)) {
      const correct = question.correct.reduce((sum, index, i) => sum + (answer[i] === index ? 1 : 0), 0);
      points = correct === 2 ? 2 : correct === 1 ? 1 : 0;
      given = question.left.map((left, i) => `${tx(left, lang)} = ${answer[i] >= 0 && answer[i] < question.options.length ? tx(question.options[answer[i]], lang) : '—'}`).join('; ');
    }
  }
  return { points, max, record: { stepId: question.id, skill: question.skill, prompt: tx(question.prompt, lang), correct: points === max, score: points / max, given, expected, retry: false, timeMs: 0 } };
}

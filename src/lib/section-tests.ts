import { LESSONS, UNITS } from '@/content/course';
import type { EntQuestion } from './ent';
import type { QuestionStep } from './types';
import { hashString, seeded, shuffle } from './text';

/** Числовые задания уроков также пригодны для теста с вариантами ответа. */
function asExamQuestion(step: QuestionStep): EntQuestion | undefined {
  if (step.type === 'choice' || step.type === 'multi') return step;
  if (step.type !== 'input' && step.type !== 'solution') return;
  const answer = step.type === 'input' ? step.answers[0] : step.answer;
  const mode = step.type === 'input' ? step.mode : step.answerMode;
  if (mode !== 'number' && mode !== 'binary') return;
  const numeric = mode === 'binary' ? (/^[01]+$/.test(answer) ? parseInt(answer, 2) : NaN) : Number(answer);
  if (!Number.isFinite(numeric) || !answer.trim()) return;
  const format = (value: number) => mode === 'binary' ? value.toString(2) : String(value);
  const values = new Set([answer]);
  for (let delta = 1; values.size < 4; delta++) {
    if (mode !== 'binary' || numeric - delta >= 0) values.add(format(numeric - delta));
    if (values.size < 4) values.add(format(numeric + delta));
  }
  const options = shuffle([...values], seeded(hashString(step.id)));
  return { id: step.id, type: 'choice', skill: step.skill, level: step.level, prompt: step.prompt, options, correct: options.indexOf(answer), explanation: step.explanation };
}

export function buildSectionTest(unitId: string, variant: number) {
  const unit = UNITS.find(unit => unit.id === unitId);
  if (!unit || !Number.isInteger(variant) || variant < 1 || variant > 6) return undefined;
  const pool = unit.lessons.flatMap(ref => LESSONS[ref.id]?.steps ?? [])
    .filter((step): step is QuestionStep => step.type !== 'theory' && step.type !== 'video')
    .map(asExamQuestion).filter((step): step is EntQuestion => !!step);
  const size = Math.min(15, Math.max(1, pool.length - 1));
  const baseOrder = shuffle(pool, seeded(hashString(unitId)));
  const selected = pool.length <= 16
    ? baseOrder.filter((_, index) => index !== variant - 1).slice(0, size)
    : shuffle(pool, seeded(hashString(unitId) + variant * 103)).slice(0, size);
  const questions = shuffle(selected, seeded(hashString(unitId) + variant));
  if (!questions.length) return undefined;
  // Награда зависит от реального набора, а не его названия или порядка.
  const canonical = questions.map(question => question.id).sort().join('|');
  const id = `section:${unitId}:${hashString(canonical).toString(16)}${hashString(`set:${canonical}`).toString(16)}`;
  return { id, title: unit.title, questions };
}

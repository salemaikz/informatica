import { LESSONS } from '@/content/course';
import { CONTEXTS } from '@/content/contexts';
import { studyGuideFor } from '@/content/guidance';
import { lookupPracticeQuestion } from '@/lib/bank/curriculum';
import { generateLeveled, canGenerate } from '@/lib/generators';
import { GUIDANCE_VERSION, renderStandardGuidance, type StandardIntent } from '@/lib/standard-guidance';
import type { Lang, Level, Step } from '@/lib/types';

/** Принимаем только идентификатор; клиентский текст и ответы других учеников не используются. */
export function canonicalGuidanceStep(id: string): Step | undefined {
  for (const lesson of Object.values(LESSONS)) {
    const step = lesson.steps.find(step => step.id === id);
    if (step) return step;
  }
  for (const context of CONTEXTS) {
    const question = context.questions.find(question => question.id === id);
    if (question) return { ...question, prompt: { ru: `${context.body.ru}\n\n${question.prompt.ru}`, kk: `${context.body.kk}\n\n${question.prompt.kk}` } };
  }
  const question = lookupPracticeQuestion(id);
  if (question) return question;
  if (id.startsWith('g:')) {
    const parts = id.split(':');
    const skill = parts[1];
    const seed = Number(parts.at(-1));
    if (!canGenerate(skill) || !Number.isSafeInteger(seed) || seed < 0) return undefined;
    for (const level of [1, 2, 3] as Level[]) {
      const step = generateLeveled(skill, level, seed);
      if (step.id === id) return step;
    }
  }
}

export function commonGuidance(id: string, lang: Lang, intent: StandardIntent, answered: boolean): string | undefined {
  const step = canonicalGuidanceStep(id);
  if (!step) return undefined;
  // Тело ответа составляется из сохранённой библиотеки; обновления урока видны сразу.
  const lesson = Object.values(LESSONS).find(lesson => lesson.steps.some(item => item.id === id));
  return renderStandardGuidance(step, lang, intent, answered, studyGuideFor(step.skill ?? lesson?.skills[0], lesson?.id));
}

export { GUIDANCE_VERSION };

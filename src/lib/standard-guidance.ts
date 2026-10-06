import type { Lang, L, Step } from './types';
import { isQuestion } from './evaluate';
import { plain, tx } from './text';

export const STANDARD_INTENTS = ['hint', 'explain', 'simpler', 'example', 'why', 'start'] as const;
export type StandardIntent = typeof STANDARD_INTENTS[number];
export const GUIDANCE_VERSION = 1;

export interface StudyGuide { method: L; example: L; pitfall: L }

function exampleMayRevealAnswer(step: Step, example: string, lang: Lang): boolean {
  if (!isQuestion(step)) return false;
  let answers: string[];
  switch (step.type) {
    case 'choice': answers = [tx(step.options[step.correct], lang)]; break;
    case 'multi': answers = step.correct.map(index => tx(step.options[index], lang)); break;
    case 'input': answers = step.answers; break;
    case 'solution': answers = [step.answer]; break;
    case 'bits': answers = [String(step.target), step.target.toString(2)]; break;
    case 'ladder': answers = [String(step.number), step.number.toString(2)]; break;
    case 'match': answers = step.pairs.map(pair => tx(pair.right, lang)); break;
    case 'order': answers = step.items.map(item => tx(item, lang)); break;
  }
  const text = plain(example).toLocaleLowerCase();
  // Консервативная проверка: при совпадении оставляем метод без решённого примера.
  return answers.some(answer => !!plain(answer).trim() && text.includes(plain(answer).toLocaleLowerCase()));
}

/** Готовый общий ответ: не включает имя, историю или ответ другого ученика. */
export function renderStandardGuidance(step: Step, lang: Lang, intent: StandardIntent, answered: boolean, guide: StudyGuide): string {
  if (step.type === 'video') return tx(guide.method, lang);
  if (step.type === 'theory') {
    if (intent === 'example') return tx(guide.example, lang);
    if (intent === 'hint' || intent === 'start') return tx(guide.method, lang);
    return `${tx(guide.method, lang)}\n\n${tx(intent === 'simpler' ? guide.example : guide.pitfall, lang)}`;
  }
  if (!isQuestion(step)) return tx(guide.method, lang);
  const example = !answered && exampleMayRevealAnswer(step, tx(guide.example, lang), lang) ? tx(guide.method, lang) : tx(guide.example, lang);
  if (intent === 'example') return `${example}\n\n${tx(guide.pitfall, lang)}`;
  // До попытки объяснение с правильным ответом не показываем.
  if (answered && (intent === 'explain' || intent === 'why' || intent === 'simpler')) {
    return `${tx(step.explanation, lang)}\n\n${tx(guide.pitfall, lang)}`;
  }
  return `${tx(guide.method, lang)}${intent === 'simpler' ? `\n\n${example}` : ''}`;
}

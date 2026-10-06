import { describe, expect, it } from 'vitest';
import { renderStandardGuidance, STANDARD_INTENTS } from '@/lib/standard-guidance';
import { studyGuideFor } from '@/content/guidance';
import { lessonBinary } from '@/content/lessons/ns-1-binary';
import { isQuestion } from '@/lib/evaluate';
import { lessonSummary } from '@/lib/lesson-summary';
import { problemAnalytics } from '@/lib/problem-analytics';
import { generateLeveled } from '@/lib/generators';

describe('общая библиотека учебных ответов', () => {
  const question = lessonBinary.steps.find(isQuestion)!;
  it('не раскрывает ответ стандартными кнопками до попытки', () => {
    for (const lang of ['ru', 'kk'] as const) for (const intent of STANDARD_INTENTS) {
      const text = renderStandardGuidance(question, lang, intent, false, studyGuideFor(question.skill));
      expect(text).not.toContain(question.explanation[lang]);
      expect(text.trim().length).toBeGreaterThan(30);
    }
  });
  it('после ответа объясняет именно текущий вопрос на обоих языках', () => {
    for (const lang of ['ru', 'kk'] as const) expect(renderStandardGuidance(question, lang, 'explain', true, studyGuideFor(question.skill))).toContain(question.explanation[lang]);
  });
  it('не раскрывает ответ, когда сохранённый пример совпал с процедурной задачей', () => {
    const step = generateLeveled('ns.bin2dec', 1, 35);
    for (const lang of ['ru', 'kk'] as const) for (const intent of ['example', 'simpler'] as const) {
      expect(renderStandardGuidance(step, lang, intent, false, studyGuideFor(step.skill))).not.toContain('101');
    }
    expect(renderStandardGuidance(step, 'ru', 'example', true, studyGuideFor(step.skill))).toContain('101');
  });
  it('итог не требует ИИ и выделяет только ошибки первых попыток', () => {
    const summary = lessonSummary({ accuracy: .7, answers: [{ stepId: '1', skill: 'ns.base', score: 0, retry: false }, { stepId: '2', skill: 'py.loops', score: 0, retry: true }] as never[] }, 'kk', id => id);
    expect(summary.memory).toBe('');
    expect(summary.focus).toEqual(['ns.base']);
    expect(summary.feedback).toContain('70%');
  });
  it('проблемные темы включают частичные баллы и сохраняют число попыток', () => {
    const analysis = problemAnalytics({ q: { stepId: 'q', skill: 'x', prompt: 'Q', attempts: 4, correct: 2, scoreTotal: 2.5, lastAt: 1 } }, [{ id: 'x', title: { ru: 'X', kk: 'X' }, topic: { ru: 'X', kk: 'X' } }]);
    expect(analysis.topics[0]).toMatchObject({ attempts: 4, scoreTotal: 2.5, correct: 2 });
    expect(analysis.questions).toHaveLength(1);
  });
});

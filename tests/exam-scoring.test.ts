import { describe, expect, it } from 'vitest';
import { examAnswerAttempted, examAnswerReady, scoreExamQuestion } from '@/lib/exam-scoring';
import type { EntQuestion } from '@/lib/ent';
const match = { id: 'm', type: 'ent-match', skill: 'pc.devices', left: ['CPU', 'RAM'], options: ['compute', 'temporary', 'storage', 'display'], correct: [0, 1], prompt: { ru: 'P', kk: 'P' }, explanation: { ru: 'E', kk: 'E' } } as EntQuestion;
const multi = { id: 'u', type: 'multi', options: ['a', 'b', 'c', 'd', 'e', 'f'], correct: [0, 2], prompt: { ru: 'P', kk: 'P' }, explanation: { ru: 'E', kk: 'E' } } as EntQuestion;
describe('оценивание завершённого пробника', () => {
  it('полностью снятый выбор не считается попыткой, частичное соответствие считается', () => {
    expect(examAnswerAttempted(multi, [])).toBe(false);
    expect(examAnswerAttempted(match, [-1, -1])).toBe(false);
    expect(examAnswerAttempted(match, [0, -1])).toBe(true);
    expect(examAnswerReady(multi, [99])).toBe(false);
  });
  it('соответствия: два верных2, один1, ноль0; незаполненная пара не засчитывается', () => {
    expect(scoreExamQuestion(match, [0, 1], 'ru').points).toBe(2);
    expect(scoreExamQuestion(match, [0, 3], 'ru').points).toBe(1);
    expect(scoreExamQuestion(match, [2, 3], 'ru').points).toBe(0);
    expect(scoreExamQuestion(match, [0, -1], 'kk').points).toBe(1);
    expect(examAnswerReady(match, [0, -1])).toBe(false);
  });
  it('несколько ответов: лишние варианты снижают балл, два лишних обнуляют', () => {
    expect(scoreExamQuestion(multi, [0, 2], 'ru').points).toBe(2);
    expect(scoreExamQuestion(multi, [0, 2, 3], 'ru').points).toBe(1);
    expect(scoreExamQuestion(multi, [0, 2, 3, 4], 'ru').points).toBe(0);
    expect(scoreExamQuestion(multi, undefined, 'kk').points).toBe(0);
  });
  it('аналитика хранит частичный балл и фактический ответ', () => {
    const score = scoreExamQuestion(match, [0, 3], 'ru');
    expect(score.record).toMatchObject({ correct: false, score: .5, retry: false, stepId: 'm' });
    expect(score.record.given).toContain('display');
    expect(score.record.expected).toContain('temporary');
  });
});

import { describe, expect, it } from 'vitest';
import { buildSectionTest } from '@/lib/section-tests';
import { UNITS } from '@/content/course';
import { scoreExamQuestion } from '@/lib/exam-scoring';

describe('тесты по разделам', () => {
  it('дают существенный набор, воспроизводимы и ключ награды совпадает только для одинаковых вопросов', () => {
    for (const unit of UNITS) {
      const keys = new Map<string, string>();
      for (let variant = 1; variant <= 6; variant++) {
        const test = buildSectionTest(unit.id, variant)!;
        expect(test.id.length).toBeLessThanOrEqual(160);
        expect(test.questions.length).toBeGreaterThanOrEqual(5);
        expect(buildSectionTest(unit.id, variant)).toEqual(test);
        expect(new Set(test.questions.map(question => question.id)).size).toBe(test.questions.length);
        const ids = test.questions.map(question => question.id).sort().join('|');
        if (keys.has(ids)) expect(test.id).toBe(keys.get(ids));
        keys.set(ids, test.id);
        for (const question of test.questions) {
          expect(scoreExamQuestion(question, question.correct, 'ru').record.correct).toBe(true);
          if (question.type === 'choice') expect(new Set(question.options).size).toBe(question.options.length);
        }
      }
      expect(keys.size).toBe(6);
    }
  });
});

import type { Skill } from './types';
import type { QuestionStat } from './store';

/** Первые попытки уже отделены от повторов в store; частичные ответы учитываем как недобранные баллы. */
export function problemAnalytics(questions: Record<string, QuestionStat>, skills: Skill[]) {
  const topics = new Map<string, { skill: Skill; attempts: number; correct: number; scoreTotal: number; questions: number }>();
  const failed = Object.values(questions).filter(q => q.attempts > 0 && q.scoreTotal < q.attempts).sort((a, b) => (1 - b.scoreTotal / b.attempts) - (1 - a.scoreTotal / a.attempts) || b.attempts - a.attempts || b.lastAt - a.lastAt);
  for (const question of Object.values(questions)) {
    const skill = skills.find(skill => skill.id === question.skill);
    if (!skill || question.attempts < 1) continue;
    const topic = topics.get(skill.id) ?? { skill, attempts: 0, correct: 0, scoreTotal: 0, questions: 0 };
    topic.attempts += question.attempts;
    topic.correct += question.correct;
    topic.scoreTotal += question.scoreTotal;
    topic.questions += 1;
    topics.set(skill.id, topic);
  }
  return { questions: failed, topics: [...topics.values()].filter(topic => topic.scoreTotal < topic.attempts).sort((a, b) => a.scoreTotal / a.attempts - b.scoreTotal / b.attempts || b.attempts - a.attempts) };
}

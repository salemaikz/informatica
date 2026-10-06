import type { SessionResult, Lang } from './types';
import type { LessonFeedbackResponse } from './ai-types';

/** Итог по результатам, без API и без расхода токенов. */
export function lessonSummary(result: Pick<SessionResult, 'accuracy' | 'answers'>, lang: Lang, skillTitle: (id: string) => string): LessonFeedbackResponse {
  const focus = [...new Set(result.answers.filter(a => !a.retry && a.score < 1).map(a => a.skill).filter((id): id is string => !!id))].slice(0, 3).map(skillTitle);
  const accuracy = Math.round(result.accuracy * 100);
  const feedback = lang === 'kk'
    ? accuracy >= 90 ? `Дәлдік — ${accuracy}%. Негізгі тәсілдер жақсы меңгерілген. Енді күрделірек тапсырмаларға көш.` : accuracy >= 60 ? `Дәлдік — ${accuracy}%. Негізгі тәсілдер қалыптасып келеді. Қате жауаптардың түсіндірмесін қарап, осы тақырыптарды қайтала.` : `Дәлдік — ${accuracy}%. Теориядағы мысалдарды қадаммен қарап, қысқа жаттығудан баста.`
    : accuracy >= 90 ? `Точность — ${accuracy}%. Основные приёмы освоены хорошо. Попробуй задания сложнее.` : accuracy >= 60 ? `Точность — ${accuracy}%. Основа уже есть. Посмотри объяснения ошибок и повтори эти темы.` : `Точность — ${accuracy}%. Разбери примеры из теории по шагам и начни с короткой тренировки.`;
  return { feedback, memory: '', focus };
}

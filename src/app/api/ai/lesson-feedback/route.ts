import { lessonSummary } from '@/lib/lesson-summary';
import { sanitizeContext } from '@/server/context';
import { jsonError } from '@/server/openai';
import type { AnswerRecord } from '@/lib/types';

/** Совместимый маршрут: итог без модели, токенов и обновления персональной памяти. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') return jsonError(400, 'bad_json');
    const lang = sanitizeContext(body.context).lang;
    const accuracy = Math.max(0, Math.min(1, Number(body.accuracy) || 0));
    return Response.json(lessonSummary({ accuracy, answers: [] as AnswerRecord[] }, lang, id => id));
  } catch { return jsonError(400, 'bad_json'); }
}

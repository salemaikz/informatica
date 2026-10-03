import type { AnswerRecord, EntTopicId, Lang, QuestionStep, SessionResult, SkillId } from "./types";
import type { QuizSummary } from "./chats";
import { quizGrade } from "./chats";
import type { StepResult } from "./evaluate";
import { promptText } from "./evaluate";
import type { LessonStat } from "./review";
import type { SkillStat } from "./mastery";
import { buildFromBank, smartSkills, skillsOfTopic, sortByLevel, stepKey } from "./drill";

// «Дай задачи» в чате: сборка заданий из банка и подсчёт итога. Чистая логика без React (тесты — tests/chat-quiz.test.ts).
// Все правильные ответы вычисляет код (банк навыков + evaluate), ИИ тут не участвует.

/** Сколько заданий можно выбрать. */
export const QUIZ_COUNTS = [5, 10] as const;
export type QuizCount = (typeof QUIZ_COUNTS)[number];
export const DEFAULT_QUIZ_COUNT: QuizCount = 5;

/** Длины полей ошибки в карточке итога (она уходит в чат и в ИИ — держим короткой). */
const MISTAKE_PROMPT_LEN = 300;
const MISTAKE_ANSWER_LEN = 160;

/** Любое число — к ближайшему допустимому (5 или 10). */
export function normalizeQuizCount(n: number | undefined): QuizCount {
  return n === 10 ? 10 : DEFAULT_QUIZ_COUNT;
}

/** Задание подходит для чата: «развёрнутое решение» проверяет ИИ по фото (платно) — в чате его нет. */
export const isQuizStep = (step: QuestionStep): boolean => step.type !== "solution";

export interface QuizBuildOptions {
  /** Тема ЕНТ; нет (или у темы нет заданий) — «умная» подборка по пройденным урокам. */
  topic?: EntTopicId;
  count?: number;
  lessons: Record<string, LessonStat>;
  stats: Record<string, SkillStat>;
  seed: number;
}

/** Набирает count заданий по списку навыков: без решений по фото и без повторов, добирая недостающие. */
function collect(pool: SkillId[], count: number, stats: Record<string, SkillStat>, seed: number, cover: boolean): QuestionStep[] {
  const out: QuestionStep[] = [];
  const seen = new Set<string>();
  for (let round = 0; round < 6 && out.length < count; round++) {
    const batch = buildFromBank(pool, stats, { count: count - out.length, seed: seed + round * 7919, cover: cover && round === 0 });
    if (!batch.length) break;
    for (const step of batch) {
      const key = stepKey(step);
      if (!isQuizStep(step) || seen.has(key) || out.length >= count) continue;
      seen.add(key);
      out.push(step);
    }
  }
  return out;
}

/**
 * Задания для чата: от лёгкого к сложному (A → B → C). Тема — навыки темы (каждый встретится хотя бы раз,
 * пока их не больше числа заданий); без темы — «умная тренировка» по пройденным урокам.
 */
export function buildQuiz(opts: QuizBuildOptions): QuestionStep[] {
  const count = normalizeQuizCount(opts.count);
  let steps: QuestionStep[] = [];
  if (opts.topic) {
    const skills = skillsOfTopic(opts.topic);
    if (skills.length) steps = collect(skills, count, opts.stats, opts.seed, true);
  }
  if (!steps.length) steps = collect(smartSkills(opts.lessons), count, opts.stats, opts.seed, false);
  return sortByLevel(steps);
}

// ---------- Ответы и итог ----------

/** Следующее значение серии верных ответов подряд (комбо для XP). */
export const nextCombo = (combo: number, correct: boolean): number => (correct ? combo + 1 : 0);

/** Запись об ответе для прогресса (`recordAnswer`). */
export function answerRecord(step: QuestionStep, result: StepResult, lang: Lang, timeMs: number): AnswerRecord {
  return {
    stepId: step.id,
    skill: step.skill,
    correct: result.correct,
    score: result.score,
    given: result.given,
    expected: result.expected,
    prompt: promptText(step, lang),
    retry: false,
    timeMs: Math.max(0, Math.round(timeMs)),
  };
}

/** Средний балл (0..1) по ответам; нет ответов — 1, как в уроках. */
export function quizAccuracy(records: AnswerRecord[]): number {
  return records.length ? records.reduce((a, r) => a + r.score, 0) / records.length : 1;
}

const clip = (s: string, max: number): string => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
};

/** Карточка итога: верных, оценка 2–5 и ошибки (неверные и частично верные ответы). */
export function quizSummary(records: AnswerRecord[], topic?: EntTopicId): QuizSummary {
  const correct = records.filter((r) => r.correct).length;
  const total = records.length;
  return {
    topic,
    correct,
    total,
    grade: quizGrade(correct, total),
    mistakes: records
      .filter((r) => !r.correct)
      .map((r) => ({
        prompt: clip(r.prompt, MISTAKE_PROMPT_LEN),
        given: clip(r.given, MISTAKE_ANSWER_LEN) || "—",
        expected: clip(r.expected, MISTAKE_ANSWER_LEN),
      })),
  };
}

/** Итог сессии для `finishSession`: тренировка в режиме «chat» (попадает в историю тестов). */
export function quizSession(records: AnswerRecord[], xp: number, maxCombo: number, durationSec: number, title: string): SessionResult {
  return {
    kind: "drill",
    title,
    answers: records,
    xp,
    maxCombo,
    durationSec: Math.max(0, Math.round(durationSec)),
    accuracy: quizAccuracy(records),
    mode: "chat",
  };
}

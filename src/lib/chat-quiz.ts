import type { ChoiceStep, EntTopicId, InputStep, Lang, Level, MultiStep, QuestionStep, SkillId } from "./types";
import { draw } from "./bank";
import { evaluate, promptText, type Answer, type StepResult } from "./evaluate";
import { hasBank, skillsOfLessons, skillsOfTopic } from "./drill";
import { plainText, tx } from "./text";

// «Дай задачи» в чате: 5 заданий из банка без ИИ. Чистая логика без React (тесты — tests/chat-quiz.test.ts).
// В хранилище чатов лежат только параметры (навыки, уровень, seed) и ответы: задания восстанавливаются
// из банка тем же seed. Если банк поменялся и id не совпали — набор помечается устаревшим.

export const QUIZ_COUNT = 5;
/** Сколько заданий тянем из банка, чтобы отобрать 5 поддерживаемых в чате форм. */
const DRAW_POOL = 40;

/** Задания, которые умеет показывать чат (карточки ChoiceView / MultiView / InputView). */
export type QuizStep = ChoiceStep | MultiStep | InputStep;
export type QuizAnswer = Extract<Answer, { type: "choice" } | { type: "multi" } | { type: "input" }>;

export const isQuizStep = (s: QuestionStep): s is QuizStep => s.type === "choice" || s.type === "multi" || s.type === "input";

/** Источник заданий: тема ЕНТ или пройденные уроки. */
export type QuizSource = { kind: "topic"; topic: EntTopicId } | { kind: "lessons" };

export interface ChatQuiz {
  source: QuizSource;
  level: Level;
  seed: number;
  /** Навыки на момент создания (список пройденных уроков потом меняется). */
  skills: SkillId[];
  /** id заданий — проверка, что банк выдал то же самое. */
  ids: string[];
  /** Ответы по порядку заданий; null — ещё не отвечено. */
  answers: (QuizAnswer | null)[];
}

/** Навыки источника (только с банком). */
export function quizSkills(source: QuizSource, doneLessons: string[]): SkillId[] {
  return source.kind === "topic" ? skillsOfTopic(source.topic) : skillsOfLessons(doneLessons).filter(hasBank);
}

/** Задания набора из банка (детерминированно по seed). */
export function drawQuizSteps(skills: SkillId[], level: Level, seed: number): QuizStep[] {
  if (!skills.length) return [];
  return draw("question", { skills, count: DRAW_POOL, seed, minLevel: level, maxLevel: level, ramp: false })
    .filter(isQuizStep)
    .slice(0, QUIZ_COUNT);
}

/** Новый набор; null — по источнику нет заданий. */
export function createQuiz(source: QuizSource, level: Level, seed: number, doneLessons: string[]): ChatQuiz | null {
  const skills = quizSkills(source, doneLessons);
  const steps = drawQuizSteps(skills, level, seed);
  if (!steps.length) return null;
  return { source, level, seed, skills, ids: steps.map((s) => s.id), answers: steps.map(() => null) };
}

/** Восстановить задания набора; null — банк изменился, набор устарел. */
export function quizSteps(quiz: Pick<ChatQuiz, "skills" | "level" | "seed" | "ids">): QuizStep[] | null {
  const steps = drawQuizSteps(quiz.skills, quiz.level, quiz.seed);
  if (steps.length !== quiz.ids.length || steps.some((s, i) => s.id !== quiz.ids[i])) return null;
  return steps;
}

/** Готов ли ответ к проверке. */
export function quizReady(step: QuizStep, a: QuizAnswer | null): boolean {
  if (!a) return false;
  if (a.type === "choice") return step.type === "choice" && a.index >= 0 && a.index < step.options.length;
  if (a.type === "multi") return step.type === "multi" && a.indices.length > 0;
  return step.type === "input" && a.value.trim() !== "";
}

/** Проверка кодом. */
export const checkQuizAnswer = (step: QuizStep, a: QuizAnswer, lang: Lang): StepResult => evaluate(step, a, lang);

/** Записать ответ (повторно не перезаписывается — ответ засчитан). */
export function answerQuiz(quiz: ChatQuiz, index: number, a: QuizAnswer): ChatQuiz {
  if (index < 0 || index >= quiz.answers.length || quiz.answers[index]) return quiz;
  const answers = quiz.answers.slice();
  answers[index] = a;
  return { ...quiz, answers };
}

export interface QuizMistake {
  index: number;
  step: QuizStep;
  result: StepResult;
  /** Разбор выбранного неверного варианта (если есть в банке). */
  whyWrong: string | null;
  explanation: string;
}

export interface QuizScore {
  answered: number;
  total: number;
  correct: number;
  /** Частично верные (multi: 1 балл из 2). */
  partial: number;
  done: boolean;
  mistakes: QuizMistake[];
}

/** Разбор выбранного неверного варианта (choice / multi) или null. */
export function wrongReason(step: QuizStep, a: QuizAnswer, lang: Lang): string | null {
  let idx = -1;
  if (step.type === "choice" && a.type === "choice") idx = a.index;
  if (step.type === "multi" && a.type === "multi") idx = a.indices.find((i) => !step.correct.includes(i)) ?? -1;
  if (idx < 0 || step.type === "input") return null;
  const why = step.whyWrong?.[idx];
  return why ? tx(why, lang) : null;
}

/** Итог набора: верные, частичные, ошибки с разбором. */
export function scoreQuiz(steps: QuizStep[], answers: (QuizAnswer | null)[], lang: Lang): QuizScore {
  let answered = 0;
  let correct = 0;
  let partial = 0;
  const mistakes: QuizMistake[] = [];
  steps.forEach((step, index) => {
    const a = answers[index];
    if (!a) return;
    answered++;
    const result = checkQuizAnswer(step, a, lang);
    if (result.correct) correct++;
    else {
      if (result.partial) partial++;
      mistakes.push({ index, step, result, whyWrong: wrongReason(step, a, lang), explanation: tx(step.explanation, lang) });
    }
  });
  return { answered, total: steps.length, correct, partial, done: steps.length > 0 && answered === steps.length, mistakes };
}

/** Оценка словом: excellent ≥ 90 %, good ≥ 70 %, ok ≥ 40 %, иначе weak. */
export type QuizGrade = "excellent" | "good" | "ok" | "weak";
export function quizGrade(correct: number, total: number): QuizGrade {
  const r = total > 0 ? correct / total : 0;
  if (r >= 0.9) return "excellent";
  if (r >= 0.7) return "good";
  if (r >= 0.4) return "ok";
  return "weak";
}

export const LEVEL_LETTER: Record<Level, "A" | "B" | "C"> = { 1: "A", 2: "B", 3: "C" };

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * Короткая сводка набора для истории ИИ (задания целиком не уходят).
 * Пример: «[Задания: Системы счисления, уровень B. Итог: 4 из 5. Ошибки: 1) «Переведи 25…» — ответ 11001, верно 11011]».
 */
export function quizSummaryText(quiz: ChatQuiz, steps: QuizStep[] | null, topicTitle: string, lang: Lang): string {
  const ru = lang === "ru";
  const head = ru ? `Задания: ${topicTitle}, уровень ${LEVEL_LETTER[quiz.level]}` : `Тапсырмалар: ${topicTitle}, ${LEVEL_LETTER[quiz.level]} деңгейі`;
  if (!steps) return `[${head}]`;
  const s = scoreQuiz(steps, quiz.answers, lang);
  const res = ru ? `Итог: ${s.correct} из ${s.total}` : `Нәтижесі: ${s.correct}/${s.total}`;
  const progress = s.done ? res : ru ? `Отвечено ${s.answered} из ${s.total}, верно ${s.correct}` : `Жауап берілді: ${s.answered}/${s.total}, дұрысы: ${s.correct}`;
  const errs = s.mistakes
    .slice(0, 3)
    .map((m, i) => {
      const p = clip(plainText(promptText(m.step, lang)), 80);
      return ru
        ? `${i + 1}) «${p}» — ответ ${clip(m.result.given, 30)}, верно ${clip(m.result.expected, 30)}`
        : `${i + 1}) «${p}» — жауап: ${clip(m.result.given, 30)}, дұрысы: ${clip(m.result.expected, 30)}`;
    })
    .join("; ");
  const tail = errs ? (ru ? `. Ошибки: ${errs}` : `. Қателер: ${errs}`) : "";
  return `[${head}. ${progress}${tail}]`;
}

/** Текст сообщения «Объясни ошибку» для ИИ (короткий: условие, варианты, ответ ученика, верный ответ). */
export function explainMistakeText(step: QuizStep, result: StepResult, lang: Lang): string {
  const ru = lang === "ru";
  const prompt = clip(plainText(promptText(step, lang)), 400);
  const options =
    step.type === "input" ? "" : `\n${ru ? "Варианты" : "Нұсқалар"}: ${step.options.map((o) => clip(plainText(tx(o, lang)), 60)).join("; ")}`;
  return ru
    ? `Объясни, пожалуйста, мою ошибку.\nЗадание: ${prompt}${options}\nМой ответ: ${clip(result.given, 80)}\nВерный ответ: ${clip(result.expected, 80)}`
    : `Қатемді түсіндірші.\nТапсырма: ${prompt}${options}\nМенің жауабым: ${clip(result.given, 80)}\nДұрыс жауап: ${clip(result.expected, 80)}`;
}

/** Сколько верных ответов подряд перед заданием index (для комбо-бонуса XP, как в уроке). */
export function streakBefore(steps: QuizStep[], answers: (QuizAnswer | null)[], index: number, lang: Lang): number {
  let n = 0;
  for (let i = index - 1; i >= 0; i--) {
    const a = answers[i];
    if (!a || !steps[i] || !checkQuizAnswer(steps[i], a, lang).correct) break;
    n++;
  }
  return n;
}

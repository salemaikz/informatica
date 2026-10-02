import { describe, expect, it } from "vitest";
import { ENT_TOPICS } from "@/content/ent-topics";
import {
  answerQuiz,
  checkQuizAnswer,
  createQuiz,
  explainMistakeText,
  isQuizStep,
  QUIZ_COUNT,
  quizGrade,
  quizReady,
  quizSteps,
  quizSummaryText,
  scoreQuiz,
  streakBefore,
  type QuizAnswer,
  type QuizStep,
} from "@/lib/chat-quiz";
import { evaluate } from "@/lib/evaluate";

/** Верный ответ на задание — вычисляет тест из данных задания. */
function rightAnswer(s: QuizStep): QuizAnswer {
  if (s.type === "choice") return { type: "choice", index: s.correct };
  if (s.type === "multi") return { type: "multi", indices: [...s.correct] };
  return { type: "input", value: s.answers[0] };
}
function wrongAnswer(s: QuizStep): QuizAnswer {
  if (s.type === "choice") return { type: "choice", index: (s.correct + 1) % s.options.length };
  if (s.type === "multi") return { type: "multi", indices: s.options.map((_, i) => i).filter((i) => !s.correct.includes(i)).slice(0, 1) };
  return { type: "input", value: "заведомо-неверно" };
}

describe("«Дай задачи»: набор из банка", () => {
  it("по каждой из 13 тем и каждому уровню — 5 заданий поддерживаемых форм, детерминированно по seed", () => {
    for (const tp of ENT_TOPICS) {
      for (const level of [1, 2, 3] as const) {
        const q = createQuiz({ kind: "topic", topic: tp.id }, level, 777, []);
        expect(q, `${tp.id}/${level}`).not.toBeNull();
        expect(q!.ids).toHaveLength(QUIZ_COUNT);
        expect(new Set(q!.ids).size).toBe(QUIZ_COUNT);
        const steps = quizSteps(q!);
        expect(steps).not.toBeNull();
        expect(steps!.every(isQuizStep)).toBe(true);
        expect(steps!.every((s) => (s.level ?? level) === level)).toBe(true);
      }
    }
  });

  it("верные ответы, вычисленные из данных задания, проходят проверку кодом", () => {
    for (const tp of ENT_TOPICS) {
      const q = createQuiz({ kind: "topic", topic: tp.id }, 2, 31337, [])!;
      for (const s of quizSteps(q)!) {
        expect(checkQuizAnswer(s, rightAnswer(s), "ru").correct, s.id).toBe(true);
        expect(checkQuizAnswer(s, rightAnswer(s), "kk").correct, s.id).toBe(true);
      }
    }
  });

  it("пройденные уроки: без уроков — нет набора; с уроком — задания по его навыкам", () => {
    expect(createQuiz({ kind: "lessons" }, 1, 1, [])).toBeNull();
    const q = createQuiz({ kind: "lessons" }, 1, 1, ["ns-1-binary"]);
    expect(q).not.toBeNull();
    expect(q!.skills.length).toBeGreaterThan(0);
  });

  it("банк изменился (id не совпали) — набор устарел", () => {
    const q = createQuiz({ kind: "topic", topic: "t04" }, 1, 5, [])!;
    expect(quizSteps({ ...q, ids: ["чужой", ...q.ids.slice(1)] })).toBeNull();
  });

  it("ответ записывается один раз; итог, ошибки и сводка для ИИ", () => {
    let q = createQuiz({ kind: "topic", topic: "t04" }, 1, 42, [])!;
    const steps = quizSteps(q)!;
    q = answerQuiz(q, 0, rightAnswer(steps[0]));
    q = answerQuiz(q, 0, wrongAnswer(steps[0])); // повтор не перезаписывает
    expect(checkQuizAnswer(steps[0], q.answers[0]!, "ru").correct).toBe(true);
    q = answerQuiz(q, 1, wrongAnswer(steps[1]));
    for (let i = 2; i < steps.length; i++) q = answerQuiz(q, i, rightAnswer(steps[i]));
    const s = scoreQuiz(steps, q.answers, "ru");
    expect(s.done).toBe(true);
    expect(s.correct).toBe(4);
    expect(s.mistakes.map((m) => m.index)).toEqual([1]);
    expect(s.mistakes[0].explanation.length).toBeGreaterThan(0);
    expect(quizGrade(s.correct, s.total)).toBe("good");

    const ru = quizSummaryText(q, steps, "Системы счисления", "ru");
    expect(ru).toContain("4 из 5");
    expect(ru).toContain("уровень A");
    expect(ru.length).toBeLessThan(500);
    const kk = quizSummaryText(q, steps, "Санау жүйелері", "kk");
    expect(kk).toContain("4/5");
    expect(quizSummaryText(q, null, "X", "ru")).toBe("[Задания: X, уровень A]");
  });

  it("незаконченный набор: сводка с прогрессом", () => {
    let q = createQuiz({ kind: "topic", topic: "t05" }, 2, 9, [])!;
    const steps = quizSteps(q)!;
    q = answerQuiz(q, 0, rightAnswer(steps[0]));
    expect(scoreQuiz(steps, q.answers, "ru").done).toBe(false);
    expect(quizSummaryText(q, steps, "Логика", "ru")).toContain("Отвечено 1 из 5, верно 1");
  });

  it("готовность ответа и серия верных подряд", () => {
    const q = createQuiz({ kind: "topic", topic: "t04" }, 1, 3, [])!;
    const steps = quizSteps(q)!;
    expect(quizReady(steps[0], null)).toBe(false);
    expect(quizReady(steps[0], rightAnswer(steps[0]))).toBe(true);
    const answers = steps.map(rightAnswer);
    expect(streakBefore(steps, answers, 0, "ru")).toBe(0);
    expect(streakBefore(steps, answers, 3, "ru")).toBe(3);
    answers[1] = wrongAnswer(steps[1]);
    expect(streakBefore(steps, answers, 3, "ru")).toBe(1);
  });

  it("текст «Объясни ошибку» — с условием, ответом ученика и верным ответом, без разметки", () => {
    const q = createQuiz({ kind: "topic", topic: "t06" }, 2, 11, [])!;
    const step = quizSteps(q)![0];
    const res = evaluate(step, wrongAnswer(step), "ru");
    const text = explainMistakeText(step, res, "ru");
    expect(text).toContain("Мой ответ");
    expect(text).toContain(res.expected.slice(0, 20));
    expect(text).not.toMatch(/==|\*\*/);
    expect(explainMistakeText(step, res, "kk")).toContain("Дұрыс жауап");
  });

  it("оценка словом", () => {
    expect(quizGrade(5, 5)).toBe("excellent");
    expect(quizGrade(4, 5)).toBe("good");
    expect(quizGrade(2, 5)).toBe("ok");
    expect(quizGrade(1, 5)).toBe("weak");
    expect(quizGrade(0, 0)).toBe("weak");
  });
});

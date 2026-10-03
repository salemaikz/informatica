import { describe, expect, it } from "vitest";
import { ENT_TOPICS } from "@/content/ent-topics";
import { evaluate, isReady, type Answer } from "@/lib/evaluate";
import { skillsOfTopic, stepKey } from "@/lib/drill";
import {
  answerRecord,
  buildQuiz,
  nextCombo,
  normalizeQuizCount,
  quizAccuracy,
  quizSession,
  quizSummary,
  wrongReasonText,
} from "@/lib/chat-quiz";
import type { AnswerRecord, ChoiceStep } from "@/lib/types";

const base = { lessons: {}, stats: {}, seed: 12345 };

describe("normalizeQuizCount", () => {
  it("допускает только 5 и 10", () => {
    expect(normalizeQuizCount(10)).toBe(10);
    expect(normalizeQuizCount(5)).toBe(5);
    expect(normalizeQuizCount(7)).toBe(5);
    expect(normalizeQuizCount(undefined)).toBe(5);
  });
});

describe("buildQuiz", () => {
  for (const topic of ENT_TOPICS) {
    it(`тема ${topic.id}: задания без повторов и без решений по фото, от лёгкого к сложному`, () => {
      for (const count of [5, 10]) {
        const steps = buildQuiz({ ...base, topic: topic.id, count });
        expect(steps.length).toBeGreaterThan(0);
        expect(steps.length).toBeLessThanOrEqual(count);
        if (skillsOfTopic(topic.id).length) expect(steps.length).toBe(count);
        expect(steps.some((s) => s.type === "solution")).toBe(false);
        expect(new Set(steps.map(stepKey)).size).toBe(steps.length);
        const levels = steps.map((s) => s.level ?? 1);
        expect(levels).toEqual([...levels].sort((a, b) => a - b));
      }
    });
  }

  it("без темы — умная подборка, ровно count заданий", () => {
    expect(buildQuiz({ ...base, count: 5 })).toHaveLength(5);
    expect(buildQuiz({ ...base, count: 10 })).toHaveLength(10);
  });

  it("по умолчанию 5 заданий", () => {
    expect(buildQuiz({ ...base })).toHaveLength(5);
  });

  it("тот же seed — те же задания, другой — другие", () => {
    const ids = (seed: number) => buildQuiz({ ...base, count: 10, seed }).map((s) => s.id);
    expect(ids(1)).toEqual(ids(1));
    expect(ids(1)).not.toEqual(ids(2));
  });
});

describe("проверка и итог", () => {
  const steps = buildQuiz({ ...base, count: 10 });

  it("combo растёт на верных и сбрасывается на неверном", () => {
    expect(nextCombo(0, true)).toBe(1);
    expect(nextCombo(2, true)).toBe(3);
    expect(nextCombo(5, false)).toBe(0);
  });

  it("запись ответа берёт данные из результата evaluate", () => {
    const step = steps.find((s) => s.type === "choice") as ChoiceStep;
    const a: Answer = { type: "choice", index: step.correct };
    expect(isReady(step, a)).toBe(true);
    const res = evaluate(step, a, "ru");
    const rec = answerRecord(step, res, "ru", 1234.6);
    expect(rec).toMatchObject({ stepId: step.id, skill: step.skill, correct: true, score: 1, retry: false, timeMs: 1235 });
    expect(rec.prompt.length).toBeGreaterThan(0);
  });

  const rec = (correct: boolean, score = correct ? 1 : 0, extra: Partial<AnswerRecord> = {}): AnswerRecord => ({
    stepId: Math.random().toString(),
    correct,
    score,
    given: "x",
    expected: "y",
    prompt: "Вопрос",
    retry: false,
    timeMs: 1000,
    ...extra,
  });

  it("оценка: 9 из 10 — пятёрка, 7 — четвёрка, 5 — тройка, 2 — двойка", () => {
    const make = (ok: number, total: number) => quizSummary(Array.from({ length: total }, (_, i) => rec(i < ok)));
    expect(make(9, 10).grade).toBe(5);
    expect(make(7, 10).grade).toBe(4);
    expect(make(5, 10).grade).toBe(3);
    expect(make(2, 10).grade).toBe(2);
    expect(make(4, 5)).toMatchObject({ correct: 4, total: 5, grade: 4 });
  });

  it("в ошибки попадают неверные и частично верные ответы; пустой ответ — «—»", () => {
    const s = quizSummary([rec(true), rec(false, 0, { given: "", prompt: "A" }), rec(false, 0.5, { given: "частично", expected: "полностью" })], "t03");
    expect(s.topic).toBe("t03");
    expect(s.correct).toBe(1);
    expect(s.mistakes).toEqual([
      { prompt: "A", given: "—", expected: "y" },
      { prompt: "Вопрос", given: "частично", expected: "полностью" },
    ]);
  });

  it("длинные поля ошибки обрезаются", () => {
    const s = quizSummary([rec(false, 0, { prompt: "я".repeat(1000), given: "я".repeat(1000), expected: "я".repeat(1000) })]);
    expect(s.mistakes[0].prompt.length).toBeLessThanOrEqual(300);
    expect(s.mistakes[0].given.length).toBeLessThanOrEqual(160);
  });

  it("пустая сессия: 0 из 0 — двойка, точность 1", () => {
    expect(quizSummary([])).toMatchObject({ correct: 0, total: 0, grade: 2, mistakes: [] });
    expect(quizAccuracy([])).toBe(1);
  });

  it("сессия для finishSession — тренировка в режиме chat", () => {
    const records = [rec(true), rec(false), rec(false, 0.5)];
    const session = quizSession(records, 20, 1, 12.4, "Задачи");
    expect(session).toMatchObject({ kind: "drill", mode: "chat", xp: 20, maxCombo: 1, durationSec: 12, title: "Задачи" });
    expect(session.accuracy).toBeCloseTo(0.5, 5);
    expect(session.lessonId).toBeUndefined();
  });

  it("разбор неверного варианта: берётся из whyWrong выбранного ответа", () => {
    const step: ChoiceStep = {
      id: "s",
      type: "choice",
      skill: "binary-basics" as ChoiceStep["skill"],
      prompt: { ru: "?", kk: "?" },
      options: [
        { ru: "a", kk: "a" },
        { ru: "b", kk: "b" },
        { ru: "c", kk: "c" },
      ],
      correct: 0,
      explanation: { ru: "e", kk: "e" },
      whyWrong: [null, { ru: "потому что b", kk: "себебі b" }, null],
    } as unknown as ChoiceStep;
    expect(wrongReasonText(step, { type: "choice", index: 1 }, "ru")).toBe("потому что b");
    expect(wrongReasonText(step, { type: "choice", index: 1 }, "kk")).toBe("себебі b");
    expect(wrongReasonText(step, { type: "choice", index: 2 }, "ru")).toBeNull();
    expect(wrongReasonText(step, null, "ru")).toBeNull();
  });
});

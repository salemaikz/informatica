import { describe, expect, it } from "vitest";
import { LESSONS } from "@/content/course";
import { isQuestion } from "@/lib/evaluate";
import { RUN_GRACE_MS, lessonSig, runPaid, sanitizeLessonRuns, usableRun } from "@/lib/lesson-run";
import type { AnswerRecord } from "@/lib/types";
import { buildRun, freshQueue, graceText, questionsAhead, restoreRun, resumeStep, retryItem, type RunSnapshotInput } from "@/components/lesson/run-snapshot";

// Снимок и восстановление прохождения урока (#41): то, что плеер кладёт в стор и берёт обратно при «Продолжить».

const T0 = Date.UTC(2027, 0, 15, 12);
const lesson = LESSONS["ns-1-bits"];
const steps = lesson.steps;
const firstQuestion = steps.findIndex((s) => isQuestion(s));

const record = (stepId: string, correct: boolean, retry = false): AnswerRecord => ({
  stepId,
  correct,
  score: correct ? 1 : 0,
  given: "1",
  expected: "2",
  prompt: "?",
  retry,
  timeMs: 1200,
});

/** Снимок после первого ответа (ошибка в первом задании): шаг пройден, в очереди появился повтор. */
function afterFirstAnswer(over: Partial<RunSnapshotInput> = {}): RunSnapshotInput {
  const q = steps[firstQuestion];
  return {
    lessonId: lesson.id,
    steps,
    queue: [...freshQueue(steps), retryItem(q)],
    pos: firstQuestion + 1,
    done: firstQuestion,
    records: [record(q.id, false)],
    xp: 0,
    combo: 0,
    maxCombo: 2,
    skipped: 0,
    activeMs: 90_000,
    xpFactor: 1,
    chipsEarned: 3,
    cost: 1,
    startedAt: T0 - 120_000,
    paidAt: T0 - 30_000,
    now: T0,
    ...over,
  };
}

describe("урок для тестов", () => {
  it("начинается с теории и дальше есть задания", () => {
    expect(firstQuestion).toBeGreaterThan(0);
    expect(steps.slice(0, firstQuestion).every((s) => !isQuestion(s))).toBe(true);
  });
});

describe("freshQueue / retryItem", () => {
  it("очередь с нуля — все шаги по порядку, без повторов", () => {
    const q = freshQueue(steps);
    expect(q).toHaveLength(steps.length);
    expect(q.every((x) => !x.retry)).toBe(true);
    expect(q.map((x) => x.key)).toEqual(steps.map((s) => s.id));
  });
  it("повтор ошибки — тот же шаг с пометкой и своим ключом", () => {
    expect(retryItem(steps[firstQuestion])).toEqual({ step: steps[firstQuestion], retry: true, key: `${steps[firstQuestion].id}:retry` });
  });
});

describe("buildRun", () => {
  it("снимок проходит проверку стора без изменений и подходит для продолжения", () => {
    const run = buildRun(afterFirstAnswer());
    expect(sanitizeLessonRuns({ [lesson.id]: run }, T0)).toEqual({ [lesson.id]: run });
    expect(usableRun(run, lesson, T0 + 1000)).toBe(run);
    expect(run.sig).toBe(lessonSig(steps));
    expect(run.updatedAt).toBe(T0);
    expect(run.queue.at(-1)).toEqual({ id: steps[firstQuestion].id, retry: true });
    expect(run.pos).toBe(firstQuestion + 1);
  });

  it("очередь хранит только id и пометку повтора", () => {
    const run = buildRun(afterFirstAnswer());
    expect(run.queue).toHaveLength(steps.length + 1);
    expect(Object.keys(run.queue[0]).sort()).toEqual(["id", "retry"]);
  });

  it("числа приводятся к границам: pos и done не больше очереди, цена 1 или 2, XP целый", () => {
    const run = buildRun(afterFirstAnswer({ pos: 999, done: 999, cost: 5, xp: 12.7, activeMs: -5, chipsEarned: 2.9, xpFactor: 3 }));
    expect(run.pos).toBe(run.queue.length);
    expect(run.done).toBe(run.queue.length);
    expect(run).toMatchObject({ cost: 2, xp: 12, activeMs: 0, chipsEarned: 2, xpFactor: 1 });
    expect(buildRun(afterFirstAnswer({ cost: 0 })).cost).toBe(1);
  });

  it("вход ещё не оплачен — paidAt null (платить при первом ответе)", () => {
    const run = buildRun(afterFirstAnswer({ paidAt: null, records: [], pos: 2, done: 1 }));
    expect(run.paidAt).toBeNull();
    expect(usableRun(run, lesson, T0)).not.toBeNull();
  });

  it("вход оплачен на первом «дальше», до всяких ответов: снимок пригоден, возврат в окне бесплатен (этап 15)", () => {
    // ensurePaid плеера пишет снимок на текущем шаге (pos 0) с paidAt, затем переход сохраняет pos 1 — оба пригодны для продолжения
    for (const pos of [0, 1]) {
      const run = buildRun(afterFirstAnswer({ queue: freshQueue(steps), pos, done: pos, records: [], paidAt: T0 - 10_000 }));
      expect(usableRun(run, lesson, T0)).not.toBeNull();
      expect(runPaid(run, T0 + RUN_GRACE_MS - 10_000)).toBe(true);
      expect(runPaid(run, T0 + RUN_GRACE_MS + 1)).toBe(false);
    }
  });

  it("открыл и закрыл без «дальше» и ответа — сохранять нечего: pos 0 без оплаты непригоден", () => {
    const run = buildRun(afterFirstAnswer({ queue: freshQueue(steps), pos: 0, done: 0, records: [], paidAt: null }));
    expect(usableRun(run, lesson, T0)).toBeNull();
  });

  it("записи ответов копируются: правка исходного массива не меняет снимок", () => {
    const input = afterFirstAnswer();
    const run = buildRun(input);
    (input.records as AnswerRecord[]).push(record("x", true));
    expect(run.records).toHaveLength(1);
  });
});

describe("restoreRun", () => {
  it("возвращает начальное состояние плеера из снимка", () => {
    const run = buildRun(afterFirstAnswer({ xp: 12, combo: 1, skipped: 1 }));
    const r = restoreRun(run, steps, T0 + 60_000)!;
    expect(r.queue).toHaveLength(steps.length + 1);
    expect(r.queue.at(-1)).toMatchObject({ retry: true, key: `${steps[firstQuestion].id}:retry` });
    expect(r).toMatchObject({ pos: firstQuestion + 1, done: firstQuestion, xp: 12, combo: 1, maxCombo: 2, skipped: 1, activeMs: 90_000, chipsEarned: 3, startedAt: T0 - 120_000 });
    expect(r.records).toEqual(run.records);
  });

  it("вернулся в течение окна — вход оплачен, paidAt сохраняется", () => {
    const run = buildRun(afterFirstAnswer());
    const r = restoreRun(run, steps, T0 + RUN_GRACE_MS)!;
    expect(r.paid).toBe(true);
    expect(r.paidAt).toBe(run.paidAt);
  });

  it("вернулся позже окна — снова платить при первом ответе", () => {
    const run = buildRun(afterFirstAnswer());
    const r = restoreRun(run, steps, T0 + RUN_GRACE_MS + 1)!;
    expect(r.paid).toBe(false);
    expect(r.paidAt).toBeNull();
    // и данные урока при этом не теряются
    expect(r.pos).toBe(run.pos);
  });

  it("вход не был оплачен — платить при первом ответе", () => {
    const r = restoreRun(buildRun(afterFirstAnswer({ paidAt: null })), steps, T0)!;
    expect(r.paid).toBe(false);
    expect(r.paidAt).toBeNull();
  });

  it("шаг пропал из урока — null (плеер начнёт с нуля)", () => {
    const run = buildRun(afterFirstAnswer());
    expect(restoreRun(run, steps.slice(1), T0)).toBeNull();
  });

  it("все шаги пройдены (pos = длина очереди) — восстанавливается, плеер покажет итоги", () => {
    const q = freshQueue(steps);
    const run = buildRun(afterFirstAnswer({ queue: q, pos: q.length, done: q.length }));
    expect(usableRun(run, lesson, T0)).not.toBeNull();
    const r = restoreRun(run, steps, T0)!;
    expect(r.pos).toBe(r.queue.length);
  });
});

describe("questionsAhead: платить за вход ещё предстоит", () => {
  const queueOf = (ids: [string, boolean][]) => ids.map(([id, retry]) => ({ id, retry }));
  const theory = steps[0].id;
  const question = steps[firstQuestion].id;

  it("впереди задание — да", () => {
    expect(questionsAhead({ queue: queueOf([[theory, false], [question, false]]), pos: 1 }, steps)).toBe(true);
  });
  it("впереди только теория — нет", () => {
    expect(questionsAhead({ queue: queueOf([[question, false], [theory, false]]), pos: 1 }, steps)).toBe(false);
  });
  it("повтор ошибки — тоже задание", () => {
    expect(questionsAhead({ queue: queueOf([[theory, false], [question, true]]), pos: 1 }, steps)).toBe(true);
  });
  it("всё пройдено — нет", () => {
    expect(questionsAhead({ queue: queueOf([[theory, false], [question, false]]), pos: 2 }, steps)).toBe(false);
  });
});

describe("resumeStep: «Шаг N из M»", () => {
  it("следующий шаг по числу пройденных, не больше общего числа", () => {
    expect(resumeStep({ done: 0 }, 16)).toEqual({ n: 1, m: 16 });
    expect(resumeStep({ done: 5 }, 16)).toEqual({ n: 6, m: 16 });
    expect(resumeStep({ done: 16 }, 16)).toEqual({ n: 16, m: 16 });
    expect(resumeStep({ done: 40 }, 16)).toEqual({ n: 16, m: 16 });
  });
});

describe("graceText: окно без повторной платы — из RUN_GRACE_MS", () => {
  it("число минут берётся из константы", () => {
    const n = Math.round(RUN_GRACE_MS / 60_000);
    expect(graceText("ru")).toMatch(new RegExp(`^${n} минут`));
    expect(graceText("kk")).toBe(`${n} минут`);
  });
});

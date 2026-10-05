import { describe, expect, it } from "vitest";
import {
  RUN_GRACE_MS,
  RUN_MAX,
  RUN_TTL_MS,
  dropRun,
  lessonSig,
  pruneRuns,
  putRun,
  restoreQueue,
  runPaid,
  sanitizeLessonRuns,
  usableRun,
  type LessonRun,
} from "@/lib/lesson-run";
import { LESSONS } from "@/content/course";

const T0 = Date.UTC(2027, 0, 15, 12);
const steps = [
  { id: "a", type: "theory" as const },
  { id: "b", type: "choice" as const },
  { id: "c", type: "input" as const },
];
const lesson = { id: "les", steps };

const run = (over: Partial<LessonRun> = {}): LessonRun => ({
  lessonId: "les",
  sig: lessonSig(steps),
  queue: [
    { id: "a", retry: false },
    { id: "b", retry: false },
    { id: "c", retry: false },
    { id: "b", retry: true },
  ],
  pos: 2,
  done: 2,
  records: [{ stepId: "b", correct: false, score: 0, given: "1", expected: "2", prompt: "?", retry: false, timeMs: 900 }],
  xp: 0,
  combo: 0,
  maxCombo: 0,
  skipped: 0,
  activeMs: 40_000,
  xpFactor: 1,
  chipsEarned: 0,
  cost: 1,
  startedAt: T0 - 60_000,
  updatedAt: T0,
  paidAt: T0 - 30_000,
  ...over,
});

describe("lessonSig", () => {
  it("зависит от id, типа и порядка шагов", () => {
    const s = lessonSig(steps);
    expect(lessonSig([...steps])).toBe(s);
    expect(lessonSig([steps[1], steps[0], steps[2]])).not.toBe(s);
    expect(lessonSig([steps[0], { id: "b", type: "multi" as const }, steps[2]])).not.toBe(s);
    expect(lessonSig(steps.slice(0, 2))).not.toBe(s);
  });
  it("у всех уроков курса отпечатки разные", () => {
    const sigs = Object.values(LESSONS).map((l) => lessonSig(l.steps));
    expect(new Set(sigs).size).toBe(sigs.length);
  });
});

describe("runPaid: повторный вход в течение 20 минут бесплатен", () => {
  it("оплачен и недавно — да; не оплачен или давно — нет", () => {
    expect(runPaid(run(), T0 + RUN_GRACE_MS)).toBe(true);
    expect(runPaid(run(), T0 + RUN_GRACE_MS + 1)).toBe(false);
    expect(runPaid(run({ paidAt: null }), T0 + 1000)).toBe(false);
    // часы переведены назад — не доверяем
    expect(runPaid(run(), T0 - 1)).toBe(false);
  });
});

describe("usableRun", () => {
  it("подходящее сохранение", () => {
    expect(usableRun(run(), lesson, T0 + 1000)).not.toBeNull();
  });
  it("нет, другой урок, другой отпечаток, просрочено", () => {
    expect(usableRun(undefined, lesson, T0)).toBeNull();
    expect(usableRun(run({ lessonId: "other" }), lesson, T0)).toBeNull();
    expect(usableRun(run({ sig: "x" }), lesson, T0)).toBeNull();
    expect(usableRun(run(), lesson, T0 + RUN_TTL_MS + 1)).toBeNull();
  });
  it("ничего не пройдено (pos 0) или pos за очередью — не продолжаем", () => {
    expect(usableRun(run({ pos: 0 }), lesson, T0)).toBeNull();
    expect(usableRun(run({ pos: 5 }), lesson, T0)).toBeNull();
    // всё пройдено, остался только итог — продолжить можно (плеер сразу покажет итоги)
    expect(usableRun(run({ pos: 4 }), lesson, T0)).not.toBeNull();
  });
  it("в очереди шаг, которого нет в уроке, — нет", () => {
    expect(usableRun(run({ queue: [{ id: "a", retry: false }, { id: "zzz", retry: false }] }), lesson, T0)).toBeNull();
  });
});

describe("restoreQueue", () => {
  it("собирает очередь с повторами и ключами", () => {
    const q = restoreQueue(run(), steps)!;
    expect(q.map((x) => x.key)).toEqual(["a", "b", "c", "b:retry"]);
    expect(q[3]).toMatchObject({ retry: true, step: steps[1] });
  });
  it("шага нет — null", () => {
    expect(restoreQueue(run(), steps.slice(0, 2))).toBeNull();
  });
});

describe("pruneRuns / putRun / dropRun", () => {
  it("не больше RUN_MAX самых свежих, без просроченных", () => {
    let runs: Record<string, LessonRun> = {};
    for (let i = 0; i < RUN_MAX + 2; i++) runs = putRun(runs, run({ lessonId: `l${i}`, updatedAt: T0 + i }), T0 + 10);
    expect(Object.keys(runs)).toHaveLength(RUN_MAX);
    expect(runs.l0).toBeUndefined();
    // l4 обновлён ровно TTL назад — ещё живой, l2 и l3 просрочены
    expect(Object.keys(pruneRuns(runs, T0 + RUN_TTL_MS + 4))).toEqual(["l6", "l5", "l4"]);
  });
  it("без изменений возвращает тот же объект", () => {
    const runs = { les: run() };
    expect(pruneRuns(runs, T0)).toBe(runs);
    expect(dropRun(runs, "nope")).toBe(runs);
    expect(dropRun(runs, "les")).toEqual({});
  });
});

describe("sanitizeLessonRuns: данные из localStorage недоверенные", () => {
  it("корректное сохранение проходит без изменений", () => {
    expect(sanitizeLessonRuns({ les: run() }, T0)).toEqual({ les: run() });
  });
  it("мусор отбрасывается", () => {
    expect(sanitizeLessonRuns(null, T0)).toEqual({});
    expect(sanitizeLessonRuns([run()], T0)).toEqual({});
    expect(sanitizeLessonRuns({ les: { ...run(), lessonId: "other" } }, T0)).toEqual({});
    expect(sanitizeLessonRuns({ les: { ...run(), queue: "x" } }, T0)).toEqual({});
    expect(sanitizeLessonRuns({ les: { ...run(), pos: 99 } }, T0)).toEqual({});
    expect(sanitizeLessonRuns({ les: { ...run(), records: [{ stepId: 1 }] } }, T0)).toEqual({});
    expect(sanitizeLessonRuns({ "../x": run({ lessonId: "../x" }) }, T0)).toEqual({});
  });
  it("числа вне диапазона приводятся к безопасным", () => {
    const r = sanitizeLessonRuns({ les: { ...run(), xpFactor: 7, cost: 5, paidAt: "вчера", combo: -3 } }, T0).les;
    expect(r).toMatchObject({ xpFactor: 1, cost: 1, paidAt: null, combo: 0 });
  });
});

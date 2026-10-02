import { describe, expect, it } from "vitest";
import { ENT_POOL } from "@/content/ent";
import { entRef, entStepFromRef, examWrongItems, isEntRef, parseEntRef } from "@/lib/ent-steps";
import { evaluate } from "@/lib/evaluate";
import { type ExamAnswers, type ExamPaper, type ExamQuestion } from "@/lib/exam";
import type { EntContext, EntItem, EntMatch, EntMulti, EntSingle, QuestionStep } from "@/lib/types";

const L = (s: string) => ({ ru: `${s} ru`, kk: `${s} kk` });

const single: EntSingle = {
  id: "demo:single",
  kind: "single",
  topic: "t04",
  skill: "ns.base",
  level: 2,
  prompt: L("Сколько?"),
  options: [L("a"), L("b"), L("c"), L("d")],
  correct: 2,
  explanation: L("e"),
  whyWrong: [L("wa"), L("wb"), null, L("wd")],
};
const multi: EntMulti = {
  id: "demo:multi",
  kind: "multi",
  topic: "t04",
  skill: "ns.base",
  level: 3,
  prompt: L("Выберите"),
  options: ["a", "b", "c", "d", "e", "f"],
  correct: [1, 4],
  explanation: L("e"),
};
const match: EntMatch = {
  id: "demo:match",
  kind: "match",
  topic: "t05",
  skill: "algo.flow",
  level: 1,
  prompt: L("Соответствие"),
  items: [L("Ромб"), L("Овал")],
  choices: [L("c0"), L("c1"), L("c2"), L("c3")],
  answer: [3, 0],
  explanation: L("e"),
};
const context: EntContext = {
  id: "demo:ctx",
  kind: "context",
  topic: "t06",
  skill: "py.trace",
  level: 2,
  text: L("Программа"),
  questions: [0, 1, 2].map((i) => ({ id: `demo:ctx-q${i}`, prompt: L(`Вопрос ${i}`), options: ["a", "b", "c", "d"], correct: i, explanation: L(`e${i}`) })),
};
const POOL: EntItem[] = [single, multi, match, context];

describe("entStepFromRef", () => {
  it("single → choice с id = ref и метаданными задания", () => {
    const step = entStepFromRef("ent:demo:single", POOL);
    expect(step).toMatchObject({ id: "ent:demo:single", type: "choice", skill: "ns.base", level: 2, ent: true, correct: 2 });
    expect((step as { whyWrong?: unknown }).whyWrong).toBe(single.whyWrong);
  });

  it("multi → multi", () => {
    const step = entStepFromRef("ent:demo:multi", POOL);
    expect(step).toMatchObject({ id: "ent:demo:multi", type: "multi", correct: [1, 4], level: 3, ent: true });
  });

  it("match с n → choice: условие + пункт n, верный — answer[n]", () => {
    const a = entStepFromRef("ent:demo:match:0", POOL);
    const b = entStepFromRef("ent:demo:match:1", POOL);
    expect(a).toMatchObject({ id: "ent:demo:match:0", type: "choice", correct: 3, options: match.choices });
    expect(b).toMatchObject({ id: "ent:demo:match:1", type: "choice", correct: 0 });
    const prompt = (a as { prompt: { ru: string; kk: string } }).prompt;
    expect(prompt.ru).toContain("Соответствие ru");
    expect(prompt.ru).toContain("Ромб ru");
    expect(prompt.kk).toContain("Ромб kk");
  });

  it("context с n → choice: общий текст + вопрос n", () => {
    const step = entStepFromRef("ent:demo:ctx:2", POOL) as { id: string; type: string; correct: number; prompt: { ru: string }; explanation: { ru: string } };
    expect(step).toMatchObject({ id: "ent:demo:ctx:2", type: "choice", correct: 2, ent: true, skill: "py.trace" });
    expect(step.prompt.ru).toContain("Программа ru");
    expect(step.prompt.ru).toContain("Вопрос 2 ru");
    expect(step.explanation.ru).toBe("e2 ru");
  });

  it("неизвестная ссылка, чужой префикс, нет n, n вне диапазона → undefined", () => {
    expect(entStepFromRef("ent:nope", POOL)).toBeUndefined();
    expect(entStepFromRef("demo:single", POOL)).toBeUndefined();
    expect(entStepFromRef("ent:demo:match", POOL)).toBeUndefined();
    expect(entStepFromRef("ent:demo:ctx", POOL)).toBeUndefined();
    expect(entStepFromRef("ent:demo:match:2", POOL)).toBeUndefined();
    expect(entStepFromRef("ent:demo:ctx:3", POOL)).toBeUndefined();
    expect(entStepFromRef("ent:demo:single:0", POOL)).toBeUndefined();
  });

  it("шаг оценивается плеером: верный выбор — correct", () => {
    const step = entStepFromRef("ent:demo:match:0", POOL) as QuestionStep;
    expect(evaluate(step, { type: "choice", index: 3 }, "ru").correct).toBe(true);
    expect(evaluate(step, { type: "choice", index: 1 }, "ru").correct).toBe(false);
    const m = entStepFromRef("ent:demo:multi", POOL) as QuestionStep;
    expect(evaluate(m, { type: "multi", indices: [1, 4] }, "ru").correct).toBe(true);
  });
});

describe("entRef / parseEntRef", () => {
  it("собирает и разбирает ссылки (id содержит двоеточие)", () => {
    expect(entRef("a:b")).toBe("ent:a:b");
    expect(entRef("a:b", 3)).toBe("ent:a:b:3");
    expect(isEntRef("ent:a:b")).toBe(true);
    expect(isEntRef("ns-1:q1")).toBe(false);
    expect(parseEntRef("ent:demo:ctx:1", POOL)).toMatchObject({ item: { id: "demo:ctx" }, n: 1 });
    expect(parseEntRef("ent:demo:single", POOL)).toMatchObject({ item: { id: "demo:single" } });
  });
});

describe("реальный банк ЕНТ: каждая ссылка собирается и оценивается", () => {
  it("single/multi/match/context → шаг с верным ответом", () => {
    let checked = 0;
    for (const it of ENT_POOL) {
      const refs: string[] =
        it.kind === "match" ? it.items.map((_, i) => entRef(it.id, i)) : it.kind === "context" ? it.questions.map((_, i) => entRef(it.id, i)) : [entRef(it.id)];
      for (const ref of refs) {
        const step = entStepFromRef(ref);
        expect(step, ref).toBeDefined();
        expect(step!.id).toBe(ref);
        if (step!.type === "choice") expect(evaluate(step!, { type: "choice", index: step!.correct }, "kk").correct, ref).toBe(true);
        if (step!.type === "multi") expect(evaluate(step!, { type: "multi", indices: step!.correct }, "ru").correct, ref).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

// ---------- examWrongItems ----------

const q = (item: EntItem, maxPoints: number, sub?: number): ExamQuestion => ({
  key: item.kind === "context" ? `${item.id}#${sub}` : item.id,
  item,
  sub,
  maxPoints,
});

const paper = (items: ExamQuestion[]): ExamPaper => ({
  kind: "mini",
  seed: 1,
  items,
  maxPoints: items.reduce((s, x) => s + x.maxPoints, 0),
  timeLimitSec: 100,
  notes: [],
});

const t = (ms = 1000) => ({ timeMs: ms });

describe("examWrongItems", () => {
  const P = paper([q(single, 1), q(multi, 2), q(match, 2), q(context, 1, 0), q(context, 1, 1)]);

  it("верные и пропущенные не попадают", () => {
    const answers: ExamAnswers = {
      "demo:single": { choice: 2, ...t() },
      "demo:multi": { multi: [1, 4], ...t() },
      "demo:match": { match: [3, 0], ...t() },
      "demo:ctx#0": { choice: 0, ...t() },
    };
    expect(examWrongItems(P, answers, "ru")).toEqual([]);
    expect(examWrongItems(P, {}, "ru")).toEqual([]);
  });

  it("single: ссылка, тексты на языке ученика", () => {
    const w = examWrongItems(P, { "demo:single": { choice: 0, ...t() } }, "kk");
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ stepId: "ent:demo:single", skill: "ns.base", given: "a kk", expected: "c kk" });
    expect(w[0].prompt).toContain("Сколько? kk");
  });

  it("multi: частично верный тоже ошибка, тексты вариантов через «; »", () => {
    // выбрали верный b и лишний a → 1 балл из 2
    const w = examWrongItems(P, { "demo:multi": { multi: [0, 1, 4], ...t() } }, "ru");
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ stepId: "ent:demo:multi", given: "a; b; e", expected: "b; e" });
  });

  it("match: по неверным пунктам, ссылка с номером пункта", () => {
    const w = examWrongItems(P, { "demo:match": { match: [3, 2], ...t() } }, "ru");
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ stepId: "ent:demo:match:1", given: "c2 ru", expected: "c0 ru" });
    expect(w[0].prompt).toContain("Овал ru");
    const both = examWrongItems(P, { "demo:match": { match: [0, 2], ...t() } }, "ru");
    expect(both.map((x) => x.stepId)).toEqual(["ent:demo:match:0", "ent:demo:match:1"]);
    // один пункт не заполнен — он неверный, given «—»
    const partial = examWrongItems(P, { "demo:match": { match: [3, null], ...t() } }, "ru");
    expect(partial).toHaveLength(1);
    expect(partial[0]).toMatchObject({ stepId: "ent:demo:match:1", given: "—" });
  });

  it("context: по вопросам, номер вопроса в ссылке", () => {
    const w = examWrongItems(P, { "demo:ctx#0": { choice: 3, ...t() }, "demo:ctx#1": { choice: 1, ...t() } }, "ru");
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ stepId: "ent:demo:ctx:0", skill: "py.trace", given: "d", expected: "a" });
    expect(w[0].prompt).toBe("Вопрос 0 ru");
  });

  it("каждая ссылка из ошибок собирается обратно в шаг", () => {
    const answers: ExamAnswers = {
      "demo:single": { choice: 0, ...t() },
      "demo:multi": { multi: [0], ...t() },
      "demo:match": { match: [0, 1], ...t() },
      "demo:ctx#0": { choice: 3, ...t() },
      "demo:ctx#1": { choice: 3, ...t() },
    };
    const w = examWrongItems(P, answers, "ru");
    expect(w.length).toBe(6);
    for (const x of w) expect(entStepFromRef(x.stepId, POOL), x.stepId).toBeDefined();
  });
});

import { describe, expect, it } from "vitest";
import { clozeBlanks, evaluate, expectedText, isBlank, isQuestion, isReady, promptText, type Answer } from "@/lib/evaluate";
import type { ClozeStep, Step } from "@/lib/types";
import { validateStep } from "./validate";

// «Решаем вместе»: 13 ÷ 2 = 6 (ост. 1); 6 ÷ 2 = 3 (ост. 0); ответ — двоичная запись.
const step: ClozeStep = {
  id: "cl-1",
  type: "cloze",
  skill: "dec-to-bin",
  prompt: { ru: "Переведи 13 в двоичную систему", kk: "13-ті екілік жүйеге көшір" },
  lines: [
    ["13 ÷ 2 = ", { blank: ["6"], mode: "number" }, { ru: " ост. ", kk: " қал. " }, { blank: ["1"], mode: "number" }],
    ["6 ÷ 2 = ", { blank: ["3"], mode: "number" }, { ru: " ост. ", kk: " қал. " }, { blank: ["0"], mode: "number" }],
    [{ ru: "Ответ: ", kk: "Жауабы: " }, { blank: ["1101"], mode: "binary", width: 4 }, "₂"],
  ],
  explanation: { ru: "Остатки читаем снизу вверх.", kk: "Қалдықтарды төменнен жоғары оқимыз." },
};

const cloze = (values: string[]): Answer => ({ type: "cloze", values });

describe("cloze: структура", () => {
  it("пропуски идут по порядку строк", () => {
    const blanks = clozeBlanks(step);
    expect(blanks.map((b) => b.blank[0])).toEqual(["6", "1", "3", "0", "1101"]);
    expect(step.lines.flat().filter(isBlank)).toHaveLength(5);
  });
  it("это задание, а не информационный шаг", () => {
    expect(isQuestion(step)).toBe(true);
    const info: Step = { id: "s", type: "story", body: { ru: "а", kk: "а" }, scene: { kind: "quest", art: "door" } };
    expect(isQuestion(info)).toBe(false);
  });
  it("пример валиден", () => {
    expect(validateStep(step)).toEqual([]);
  });
});

describe("cloze: isReady", () => {
  it("нужны все пропуски и ни одного пустого", () => {
    expect(isReady(step, null)).toBe(false);
    expect(isReady(step, cloze([]))).toBe(false);
    expect(isReady(step, cloze(["6", "1", "3", "0"]))).toBe(false);
    expect(isReady(step, cloze(["6", "1", "3", "0", ""]))).toBe(false);
    expect(isReady(step, cloze(["6", "1", " ", "0", "1101"]))).toBe(false);
    expect(isReady(step, cloze(["6", "1", "3", "0", "1101"]))).toBe(true);
  });
});

describe("cloze: evaluate", () => {
  it("все верно — correct, балл 1", () => {
    const r = evaluate(step, cloze(["6", "1", "3", "0", "1101"]), "ru");
    expect(r).toMatchObject({ correct: true, score: 1 });
    expect(r.partial).toBe(false);
  });
  it("нормализует ввод: пробелы, основание, ведущие нули", () => {
    expect(evaluate(step, cloze([" 6 ", "01", "3", "0", "1101₂"]), "ru").correct).toBe(true);
    expect(evaluate(step, cloze(["6", "1", "3", "0", "01 101"]), "ru").correct).toBe(true);
  });
  it("частично: балл — доля верных, partial", () => {
    const r = evaluate(step, cloze(["6", "1", "3", "1", "1011"]), "ru");
    expect(r.correct).toBe(false);
    expect(r.partial).toBe(true);
    expect(r.score).toBeCloseTo(3 / 5);
  });
  it("всё неверно — балл 0, не partial", () => {
    const r = evaluate(step, cloze(["7", "0", "4", "1", "1011"]), "ru");
    expect(r).toMatchObject({ correct: false, score: 0 });
    expect(r.partial).toBe(false);
  });
  it("недвоичный ответ в binary-пропуске — неверно", () => {
    const r = evaluate(step, cloze(["6", "1", "3", "0", "1201"]), "ru");
    expect(r.correct).toBe(false);
    expect(r.score).toBeCloseTo(4 / 5);
  });
  it("ответ другого типа — неверно", () => {
    expect(evaluate(step, { type: "input", value: "1101" }, "ru")).toMatchObject({ correct: false, score: 0 });
  });
  it("несколько допустимых ответов в пропуске", () => {
    const two: ClozeStep = { ...step, lines: [[{ blank: ["0,5", "1/2"], mode: "text" }]] };
    expect(evaluate(two, cloze(["1/2"]), "ru").correct).toBe(true);
    expect(evaluate(two, cloze(["0,5"]), "ru").correct).toBe(true);
    expect(evaluate(two, cloze(["0,6"]), "ru").correct).toBe(false);
  });
  it("given — введённые значения через запятую", () => {
    expect(evaluate(step, cloze(["6", "1", "3", "0", "1101"]), "ru").given).toBe("6, 1, 3, 0, 1101");
  });
});

describe("cloze: expectedText / promptText", () => {
  it("верный ответ — строки с подставленными пропусками, текст на нужном языке", () => {
    expect(expectedText(step, "ru")).toBe("13 ÷ 2 =  6  ост.  1\n6 ÷ 2 =  3  ост.  0\nОтвет:  1101 ₂");
    expect(expectedText(step, "kk").split("\n")[0]).toBe("13 ÷ 2 =  6  қал.  1");
  });
  it("prompt — простой текст", () => {
    expect(promptText(step, "kk")).toBe("13-ті екілік жүйеге көшір");
  });
});

describe("entmatch и code (этап 14)", () => {
  const em = {
    id: "e1",
    type: "entmatch" as const,
    prompt: { ru: "Сопоставь", kk: "Сәйкестендір" },
    items: ["A1", "B1"],
    choices: ["c0", "c1", "c2", "c3"],
    answer: [2, 0],
    explanation: { ru: "x", kk: "x" },
  };
  it("2 пункта — верно, 1 — частично 0,5, 0 — неверно; готовность — оба выбраны", () => {
    expect(isReady(em, { type: "entmatch", picks: [2, null] })).toBe(false);
    expect(isReady(em, { type: "entmatch", picks: [2, 1] })).toBe(true);
    expect(evaluate(em, { type: "entmatch", picks: [2, 0] }, "ru")).toMatchObject({ correct: true, score: 1 });
    expect(evaluate(em, { type: "entmatch", picks: [2, 3] }, "ru")).toMatchObject({ correct: false, score: 0.5, partial: true });
    expect(evaluate(em, { type: "entmatch", picks: [1, 3] }, "ru")).toMatchObject({ correct: false, score: 0 });
    expect(expectedText(em, "ru")).toBe("A — c2; B — c0");
  });
  const code = { id: "c1", type: "code" as const, task: "py-3-parity", prompt: { ru: "Реши", kk: "Шеш" }, explanation: { ru: "x", kk: "x" } };
  it("код: с первой проверки — 1, позже — 0,5, решение не найдено — 0", () => {
    expect(evaluate(code, { type: "code", ok: true, tries: 1, code: "" }, "ru")).toMatchObject({ correct: true, score: 1 });
    expect(evaluate(code, { type: "code", ok: true, tries: 3, code: "" }, "ru")).toMatchObject({ correct: false, score: 0.5, partial: true });
    expect(evaluate(code, { type: "code", ok: false, tries: 2, code: "" }, "kk")).toMatchObject({ correct: false, score: 0 });
  });
});

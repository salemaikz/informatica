import { describe, expect, it } from "vitest";
import type { ChoiceStep, QuestionStep } from "@/lib/types";
import { poolBank, shuffleOptions } from "@/lib/bank/pool";

const q = (id: string, level: 1 | 2 | 3): ChoiceStep => ({
  id,
  type: "choice",
  level,
  skill: "pc.devices",
  prompt: { ru: `Вопрос ${id}`, kk: `Сұрақ ${id}` },
  options: ["a", "b", "c", "d"],
  correct: 2,
  explanation: { ru: "Потому что", kk: "Себебі" },
  whyWrong: [{ ru: "a нет", kk: "a жоқ" }, { ru: "b нет", kk: "b жоқ" }, null, { ru: "d нет", kk: "d жоқ" }],
});

describe("банк из статичных заданий", () => {
  it("перемешивание сохраняет верный вариант и разборы", () => {
    for (let seed = 1; seed < 50; seed++) {
      const s = shuffleOptions(q("x", 1), seed) as ChoiceStep;
      expect(s.options[s.correct]).toBe("c");
      expect(s.whyWrong![s.correct]).toBeNull();
      s.options.forEach((o, i) => {
        if (i !== s.correct) expect(s.whyWrong![i]!.ru).toBe(`${o} нет`);
      });
    }
  });

  it("multi: верные индексы пересчитываются", () => {
    const m: QuestionStep = { ...q("m", 1), type: "multi", correct: [0, 3] } as QuestionStep;
    for (let seed = 1; seed < 30; seed++) {
      const s = shuffleOptions(m, seed);
      if (s.type !== "multi") throw new Error();
      expect(s.correct.map((i) => s.options[i]).sort()).toEqual(["a", "d"]);
    }
  });

  it("берёт задания нужного уровня, иначе ближайшего", () => {
    const bank = poolBank({ skill: "pc.devices", questions: [q("a", 1), q("b", 3)] });
    expect(bank.question(1, 5).id.startsWith("a#")).toBe(true);
    expect(bank.question(3, 5).id.startsWith("b#")).toBe(true);
    expect(["a", "b"]).toContain(bank.question(2, 5).id.split("#")[0]);
  });
});

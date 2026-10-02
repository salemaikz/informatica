import { describe, expect, it } from "vitest";
import { buildDrill, generateStep } from "@/lib/generators";
import { checkInput, divisionLadder, toBinary } from "@/lib/check";
import { validateStep } from "./validate";

const SKILLS = ["ns.base", "ns.bin2dec", "ns.dec2bin", "ns.props"];

describe("генераторы", () => {
  it("создают корректные шаги для всех навыков и уровней", () => {
    for (const skill of SKILLS) {
      for (const mastery of [0, 0.6, 0.9]) {
        for (let seed = 1; seed < 300; seed++) {
          const step = generateStep(skill, mastery, seed);
          expect(validateStep(step), `${step.id}`).toEqual([]);
          if (step.type === "input") {
            // эталонный ответ проходит собственную проверку
            expect(checkInput(step.answers[0], step.answers, step.mode)).toBe(true);
          }
          if (step.type === "ladder") {
            expect(divisionLadder(step.number).map((r) => r.remainder).reverse().join("")).toBe(toBinary(step.number));
          }
        }
      }
    }
  });

  it("детерминированы по seed", () => {
    expect(generateStep("ns.dec2bin", 0.3, 42)).toEqual(generateStep("ns.dec2bin", 0.3, 42));
  });

  it("тренировка чаще берёт слабые навыки", () => {
    const stats = {
      "ns.bin2dec": { attempts: 5, correct: 5, mastery: 0.95, lastSeen: 0 },
      "ns.dec2bin": { attempts: 5, correct: 1, mastery: 0.2, lastSeen: 0 },
    };
    let weak = 0;
    let strong = 0;
    for (let seed = 1; seed < 40; seed++) {
      for (const s of buildDrill(["ns.bin2dec", "ns.dec2bin"], stats, { seed, count: 6 })) {
        if (s.skill === "ns.dec2bin") weak++;
        else strong++;
      }
    }
    expect(weak).toBeGreaterThan(strong);
  });

  it("focus ограничивает навыки", () => {
    const steps = buildDrill(SKILLS, {}, { seed: 7, focus: ["ns.props"] });
    expect(steps.length).toBe(8);
    expect(steps.every((s) => s.skill === "ns.props")).toBe(true);
  });
});

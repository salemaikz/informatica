import { describe, expect, it } from "vitest";
import { draw, hasShape, rampLevel, skillsWithShape } from "@/lib/bank";
import { NS_BANKS, LEVELS } from "@/lib/bank/ns";
import { buildDrill, generateLeveled } from "@/lib/generators";
import { entPoints, levelFromMastery, multiPoints } from "@/lib/ent";
import { evaluate } from "@/lib/evaluate";
import type { MultiStep } from "@/lib/types";
import { kkSuffix, type KkCase } from "@/lib/kk";
import { validateStep } from "./validate";

const SKILLS = NS_BANKS.map((b) => b.skill);
const fromSub = (s: string) => s.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (c) => String("₀₁₂₃₄₅₆₇₈₉".indexOf(c)));

/** Разбор формулы «X₂ = Y₁₀» / «X₁₀ = Y₂» — проверяем, что код правильно вычислил истинность. */
function formulaTruth(text: string): boolean | null {
  const m = text.match(/^([0-9A-F]+)(₂|₁₀) = ([0-9A-F]+)(₂|₁₀)$/);
  if (!m) return null;
  const val = (digits: string, sub: string) => parseInt(digits, fromSub(sub) === "2" ? 2 : 10);
  return val(m[1], m[2]) === val(m[3], m[4]);
}

describe("ЕНТ: баллы за несколько ответов", () => {
  it("совпадают с таблицей п. 18 Правил ЕНТ", () => {
    // [верных всего, выбрано верных, выбрано неверных] → баллы
    const table: [number, number, number, number][] = [
      [1, 1, 0, 2], [1, 1, 1, 1], [1, 1, 2, 0], [1, 0, 1, 0],
      [2, 2, 0, 2], [2, 1, 0, 1], [2, 1, 1, 1], [2, 2, 1, 1], [2, 2, 2, 0], [2, 0, 1, 0],
      [3, 3, 0, 2], [3, 2, 0, 1], [3, 2, 1, 1], [3, 3, 1, 1], [3, 1, 0, 0], [3, 1, 1, 0], [3, 3, 2, 0],
    ];
    for (const [k, c, w, p] of table) expect(entPoints(k, c, w), `${k}/${c}/${w}`).toBe(p);
  });

  it("multiPoints считает по выбранным индексам", () => {
    expect(multiPoints([0, 2], [2, 0])).toBe(2);
    expect(multiPoints([0, 2], [0])).toBe(1);
    expect(multiPoints([0, 2], [0, 1, 3])).toBe(0);
  });

  it("частичный ответ в уроке — score 0.5 и пометка partial", () => {
    const step: MultiStep = {
      id: "m",
      type: "multi",
      prompt: { ru: "?", kk: "?" },
      options: ["a", "b", "c", "d"],
      correct: [0, 2],
      explanation: { ru: "", kk: "" },
    };
    expect(evaluate(step, { type: "multi", indices: [0, 2] }, "ru")).toMatchObject({ correct: true, score: 1 });
    expect(evaluate(step, { type: "multi", indices: [0] }, "ru")).toMatchObject({ correct: false, score: 0.5, partial: true });
    expect(evaluate(step, { type: "multi", indices: [1, 3] }, "ru")).toMatchObject({ correct: false, score: 0 });
  });
});

describe("уровни A/B/C", () => {
  it("уровень по освоению", () => {
    expect(levelFromMastery(0)).toBe(1);
    expect(levelFromMastery(0.6)).toBe(2);
    expect(levelFromMastery(0.9)).toBe(3);
  });

  it("генераторы ставят уровень и дают корректные шаги", () => {
    for (const skill of SKILLS)
      for (const level of LEVELS)
        for (let seed = 1; seed < 120; seed++) {
          const step = generateLeveled(skill, level, seed);
          expect(step.level).toBe(level);
          expect(validateStep(step), step.id).toEqual([]);
        }
  });

  it("тренировка идёт от лёгкого к сложному", () => {
    for (let seed = 1; seed < 30; seed++) {
      const steps = buildDrill(SKILLS, {}, { seed, count: 9 });
      const levels = steps.map((s) => s.level ?? 1);
      expect(levels).toEqual([...levels].sort((a, b) => a - b));
      expect(levels.at(-1)).toBeGreaterThan(levels[0]);
    }
  });

  it("rampLevel растёт равномерно", () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => rampLevel(i, 6, 1, 3))).toEqual([1, 1, 2, 2, 3, 3]);
    expect(rampLevel(0, 1, 2, 3)).toBe(2);
  });
});

describe("банк заданий", () => {
  it("у всех навыков системы счисления есть все формы", () => {
    for (const s of SKILLS) for (const shape of ["question", "statement", "pair", "short"] as const) expect(hasShape(s, shape)).toBe(true);
    expect(skillsWithShape(["ns.bin2dec", "nope"], "pair")).toEqual(["ns.bin2dec"]);
  });

  it("утверждения: оба языка, истинность вычислена верно, есть и верные, и неверные", () => {
    for (const b of NS_BANKS)
      for (const level of LEVELS) {
        let t = 0;
        let f = 0;
        for (let seed = 1; seed < 200; seed++) {
          const s = b.statement!(level, seed);
          expect(s.text.ru && s.text.kk && s.explanation.ru && s.explanation.kk).toBeTruthy();
          expect(s.level).toBe(level);
          const truth = formulaTruth(s.text.ru);
          if (truth !== null) expect(s.value, s.text.ru).toBe(truth);
          if (s.value) t++;
          else f++;
        }
        expect(t, `${b.skill} L${level}`).toBeGreaterThan(20);
        expect(f, `${b.skill} L${level}`).toBeGreaterThan(20);
      }
  });

  it("утверждения и короткие вопросы имеют подсказку на двух языках", () => {
    for (const b of NS_BANKS)
      for (const level of LEVELS)
        for (let seed = 1; seed < 60; seed++) {
          for (const item of [b.statement!(level, seed), b.short!(level, seed)]) {
            expect(item.hint?.ru && item.hint?.kk, `${item.id}`).toBeTruthy();
          }
        }
  });

  it("казахские тексты банка ns: окончания после чисел только как у kkSuffix", () => {
    const CASES: KkCase[] = ["acc", "dat", "loc", "abl", "gen", "ins"];
    for (const b of NS_BANKS)
      for (const level of LEVELS)
        for (let seed = 1; seed < 80; seed++) {
          const st = b.statement!(level, seed);
          const sh = b.short!(level, seed);
          for (const t of [st.text.kk, st.explanation.kk, st.hint?.kk ?? "", sh.prompt.kk, sh.explanation.kk, sh.hint?.kk ?? ""])
            for (const m of t.matchAll(/(\d+)-([а-яәіңғүұқөһ]+)/g)) {
              const ok = CASES.map((c) => kkSuffix(Number(m[1]), c).split("-")[1]);
              expect(ok.includes(m[2]), `${st.id} / ${sh.id}: «${m[0]}»`).toBe(true);
            }
        }
  });

  it("пары и короткие вопросы вычислены верно", () => {
    for (let seed = 1; seed < 200; seed++) {
      const p = NS_BANKS.find((b) => b.skill === "ns.bin2dec")!.pair!(2, seed);
      expect(parseInt(fromSub(String(p.left)).replace(/2$/, ""), 2)).toBe(Number(p.right));
      const q = NS_BANKS.find((b) => b.skill === "ns.dec2bin")!.short!(3, seed);
      expect(parseInt(q.answer, 2)).toBe(parseInt(q.prompt.ru, 10));
    }
  });

  it("draw: нужное количество, без повторов, с ростом сложности", () => {
    for (const shape of ["question", "statement", "pair", "short"] as const) {
      const items = draw(shape, { skills: SKILLS, count: 12, seed: 7 });
      expect(items.length).toBe(12);
      const levels = items.map((i) => (i as { level?: number }).level ?? 1);
      expect(levels).toEqual([...levels].sort((a, b) => a - b));
    }
    const st = draw("statement", { skills: SKILLS, count: 30, seed: 3 });
    expect(new Set(st.map((s) => s.text.ru)).size).toBe(st.length);
    expect(draw("pair", { skills: ["unknown"], count: 5, seed: 1 })).toEqual([]);
  });
});

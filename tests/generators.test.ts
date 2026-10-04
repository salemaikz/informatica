import { describe, expect, it } from "vitest";
import { buildDrill, generateLeveled, generateStep } from "@/lib/generators";
import { checkInput, divisionLadder, toBinary } from "@/lib/check";
import { kkSuffix, type KkCase } from "@/lib/kk";
import { validateStep } from "./validate";

/** Все допустимые окончания числа во всех падежах (для проверки текстов). */
const kkAll = (n: number) =>
  (["acc", "dat", "loc", "abl", "gen", "ins"] as KkCase[]).map((c) => kkSuffix(n, c).split("-").slice(1).join("-"));

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

  it("у каждого задания есть подсказка, а у choice — whyWrong на неверные варианты", () => {
    for (const skill of SKILLS)
      for (const level of [1, 2, 3] as const)
        for (let seed = 1; seed < 150; seed++) {
          const step = generateLeveled(skill, level, seed);
          expect(step.hint?.ru && step.hint?.kk, `${step.id}: hint`).toBeTruthy();
          if (step.type === "choice") {
            expect(step.whyWrong, `${step.id}: whyWrong`).toBeDefined();
            const ww = step.whyWrong!;
            expect(ww.length).toBe(step.options.length);
            ww.forEach((w, i) => {
              if (i === step.correct) expect(w).toBeNull();
              else expect(w?.ru && w?.kk, `${step.id}: вариант ${i}`).toBeTruthy();
            });
          }
        }
  });

  it("подсказка не выдаёт ответ", () => {
    for (let seed = 1; seed < 200; seed++) {
      for (const skill of ["ns.bin2dec", "ns.dec2bin"]) {
        const step = generateLeveled(skill, 3, seed);
        if (step.type !== "input") continue;
        const answer = step.answers[0];
        // ответ из 4+ цифр в тексте подсказки — явная утечка
        if (answer.length >= 4) {
          expect(step.hint!.ru.includes(answer), step.id).toBe(false);
          expect(step.hint!.kk.includes(answer), step.id).toBe(false);
        }
      }
    }
  });

  it("whyWrong по типу ошибки: обратный порядок разрядов и ±1", () => {
    let reversed = 0;
    let off = 0;
    for (let seed = 1; seed < 400; seed++) {
      const step = generateLeveled("ns.dec2bin", 1, seed);
      if (step.type !== "choice") continue;
      step.whyWrong!.forEach((w) => {
        if (w?.ru.includes("снизу вверх")) reversed++;
        if (w?.ru.includes("двоичная запись числа")) off++;
      });
    }
    expect(reversed).toBeGreaterThan(0);
    expect(off).toBeGreaterThan(0);
  });

  it("казахские тексты не содержат неверных окончаний после чисел", () => {
    for (const skill of SKILLS)
      for (const level of [1, 2, 3] as const)
        for (let seed = 1; seed < 150; seed++) {
          const step = generateLeveled(skill, level, seed);
          const texts = [step.prompt.kk, step.hint?.kk ?? "", "explanation" in step ? step.explanation.kk : "", ...(step.type === "choice" ? step.whyWrong!.map((w) => w?.kk ?? "") : [])];
          for (const t of texts) {
            // допустимо только то, что kkSuffix дал бы для этого числа
            for (const m of t.matchAll(/(\d+)-([а-яәіңғүұқөһ]+)/g)) {
              const expected = kkAll(Number(m[1]));
              expect(expected.includes(m[2]), `${step.id}: «${m[0]}»`).toBe(true);
            }
          }
        }
  });

  it("«включи биты» — направление 10 → 2: вид живёт в ns.dec2bin, а не в ns.bin2dec (аудит)", () => {
    const kinds = (skill: string, level: 1 | 2 | 3) => {
      const set = new Set<string>();
      for (let seed = 1; seed < 300; seed++) set.add(generateLeveled(skill, level, seed).type);
      return set;
    };
    for (const level of [1, 2, 3] as const) expect(kinds("ns.bin2dec", level).has("bits"), `bin2dec L${level}`).toBe(false);
    // в A у bin2dec остаются выбор и ввод
    expect([...kinds("ns.bin2dec", 1)].sort()).toEqual(["choice", "input"]);
    expect(kinds("ns.dec2bin", 1).has("bits")).toBe(true);
    expect(kinds("ns.dec2bin", 2).has("bits")).toBe(true);
    for (let seed = 1; seed < 300; seed++) {
      for (const level of [1, 2, 3] as const) {
        const step = generateLeveled("ns.dec2bin", level, seed);
        if (step.type !== "bits") continue;
        const n = Number(step.id.split(":")[3]);
        expect(step.id.startsWith("g:ns.dec2bin:bits:"), step.id).toBe(true);
        expect(step.skill).toBe("ns.dec2bin");
        expect(step.target).toBe(n);
        // число помещается в выбранное число битов; двоичная запись из объяснения совпадает с целью
        expect(step.bits).toBeGreaterThanOrEqual(toBinary(n).length);
        expect(n).toBeLessThan(2 ** step.bits);
        expect(step.explanation.ru.includes(`${toBinary(n)}₂`), step.id).toBe(true);
      }
    }
  });

  it("ns.base спрашивает только про 2 и 10 и общий смысл основания: без 8/16, A–F и восьмеричных записей (аудит C6)", () => {
    const MENTION = /восьмерич|шестнадцатерич|сегіздік|он алтылық|A–F|₈|₁₆/;
    for (const level of [1, 2, 3] as const)
      for (let seed = 1; seed < 300; seed++) {
        const step = generateLeveled("ns.base", level, seed);
        const [, , kind, arg] = step.id.split(":");
        expect(["digits", "invalid", "invalid3"], step.id).toContain(kind);
        if (kind === "digits") expect([2, 3, 5, 10], step.id).toContain(Number(arg));
        const text = JSON.stringify({ ...step, id: "" });
        expect(MENTION.test(text), step.id).toBe(false);
      }
  });

  it("ns.base: верный вариант «не двоичной/не троичной» записи содержит лишнюю цифру, остальные — нет", () => {
    for (let seed = 1; seed < 300; seed++) {
      for (const level of [1, 2, 3] as const) {
        const step = generateLeveled("ns.base", level, seed);
        if (step.type !== "choice" || !step.id.includes(":invalid")) continue;
        const max = step.id.includes(":invalid3:") ? 2 : 1;
        const digitsOf = (t: unknown) => String(t).split("").map(Number);
        step.options.forEach((o, i) => {
          const hasBad = digitsOf(o).some((d) => d > max);
          expect(hasBad, `${step.id}: вариант ${i}`).toBe(i === step.correct);
        });
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

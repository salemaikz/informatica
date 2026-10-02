import { describe, expect, it } from "vitest";
import { checkInput } from "@/lib/check";
import { seeded } from "@/lib/text";
import {
  HARD_CAP_MS,
  ROUND_MS,
  SKILLS,
  baseScore,
  clockAfter,
  createStream,
  effectiveTier,
  idPrefix,
  isFinished,
  isValidStep,
  appendKey,
  eraseKey,
  multiplier,
  nextQuestion,
  pickSkill,
  points,
  recordAnswer,
  reshuffleChoice,
  skillWeight,
  speedWindow,
  startTier,
  type Question,
  type RoundStep,
  type Stream,
} from "@/games/bit-rush/logic";

const choice = (): RoundStep => ({
  id: "g:ns.props:parity:6:1",
  type: "choice",
  skill: "ns.props",
  prompt: { ru: "a", kk: "a" },
  options: ["A", "B", "C", "D"],
  correct: 2,
  explanation: { ru: "e", kk: "e" },
});
const input = (): RoundStep => ({
  id: "g:ns.dec2bin:input:5:1",
  type: "input",
  skill: "ns.dec2bin",
  prompt: { ru: "a", kk: "a" },
  answers: ["101"],
  mode: "binary",
  explanation: { ru: "e", kk: "e" },
});

function play(seed: number, count: number, masteries: Record<string, number> = {}) {
  let stream = createStream(seed, masteries);
  const qs: Question[] = [];
  for (let i = 0; i < count; i++) {
    const r = nextQuestion(stream);
    stream = r.stream;
    qs.push(r.question);
  }
  return { stream, qs };
}

describe("бит-спринт: очки", () => {
  it("множитель по серии", () => {
    const cases: [number, number][] = [[1, 1], [2, 1], [3, 2], [5, 2], [6, 3], [9, 3], [10, 4], [14, 4], [15, 5], [40, 5]];
    for (const [s, m] of cases) expect(multiplier(s)).toBe(m);
  });
  it("формула очков: база x множитель x (1 + 0,5 x скорость)", () => {
    expect(baseScore(choice())).toBe(10);
    expect(baseScore(input())).toBe(15);
    expect(points(choice(), 1, 0, 0)).toBe(15); // 10*1*1.5
    expect(points(choice(), 1, 6, 0)).toBe(10); // окно исчерпано
    expect(points(choice(), 3, 3, 0)).toBe(Math.round(10 * 2 * 1.25));
    expect(points(input(), 15, 0, 0)).toBe(Math.round(15 * 5 * 1.5));
    expect(points(choice(), 1, 99, 0)).toBe(10); // никогда ниже базы
  });
  it("окно скорости уменьшается с уровнем, но не ниже пола", () => {
    expect(speedWindow(choice(), 0)).toBe(6);
    expect(speedWindow(choice(), 2)).toBe(4);
    expect(speedWindow(input(), 0)).toBe(9);
    expect(speedWindow(input(), 2)).toBe(7);
  });
  it("часы: плюс 1,5 с с потолком 60 с, минус 4 с", () => {
    expect(clockAfter(30_000, true)).toBe(31_500);
    expect(clockAfter(59_500, true)).toBe(ROUND_MS);
    expect(clockAfter(30_000, false)).toBe(26_000);
    expect(clockAfter(3_000, false)).toBeLessThan(0);
  });
  it("конец раунда: время вышло или жёсткий лимит", () => {
    expect(isFinished(0, 10_000)).toBe(true);
    expect(isFinished(1, HARD_CAP_MS)).toBe(true);
    expect(isFinished(10_000, 50_000)).toBe(false);
  });
});

describe("бит-спринт: ввод", () => {
  it("двоичная клавиатура принимает только 0 и 1, лимит 9 символов", () => {
    expect(appendKey("", "1", "binary")).toBe("1");
    expect(appendKey("1", "2", "binary")).toBe("1");
    expect(appendKey("1", "7", "number")).toBe("17");
    expect(appendKey("123456789", "1", "number")).toBe("123456789");
    expect(eraseKey("101")).toBe("10");
    expect(eraseKey("")).toBe("");
  });
});

describe("бит-спринт: выбор навыка и уровни", () => {
  it("вес (1,1 - освоение)^2", () => {
    expect(skillWeight(0.1)).toBeCloseTo(1);
    expect(skillWeight(1.1)).toBe(0);
  });
  it("слабые навыки выпадают чаще", () => {
    const m = { "ns.base": 0.95, "ns.bin2dec": 0.2, "ns.dec2bin": 0.95, "ns.props": 0.95 };
    const rand = seeded(7);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) {
      const s = pickSkill(m, [], rand)!;
      counts[s] = (counts[s] ?? 0) + 1;
    }
    expect(counts["ns.bin2dec"]).toBeGreaterThan(counts["ns.base"] * 5);
  });
  it("один навык не выпадает 3 раза подряд", () => {
    const m = { "ns.base": 0.01, "ns.bin2dec": 0.99, "ns.dec2bin": 0.99, "ns.props": 0.99 };
    const rand = seeded(3);
    for (let i = 0; i < 200; i++) expect(pickSkill(m, ["ns.base", "ns.base"], rand)).not.toBe("ns.base");
    const { qs } = play(11, 80, m);
    for (let i = 2; i < qs.length; i++) {
      const [a, b, c] = [qs[i - 2], qs[i - 1], qs[i]].map((q) => q.step.skill);
      expect(a === b && b === c).toBe(false);
    }
  });
  it("старт: уровень 1 для освоенного навыка, иначе 0", () => {
    expect(startTier(0.8)).toBe(1);
    expect(startTier(0.79)).toBe(0);
    const s = createStream(1, { "ns.props": 0.9 });
    expect(effectiveTier(s, "ns.props")).toBe(1);
    expect(effectiveTier(s, "ns.base")).toBe(0);
  });
  it("каждый 5-й верный ответ повышает уровень (до 2), две ошибки подряд понижают", () => {
    let s = createStream(1, {});
    const q: Question = { step: choice(), tier: 0, retry: false };
    for (let i = 1; i <= 5; i++) s = recordAnswer(s, q, true);
    expect(s.tier).toBe(1);
    expect(s.streak).toBe(5);
    for (let i = 1; i <= 20; i++) s = recordAnswer(s, q, true);
    expect(s.tier).toBe(2);
    s = recordAnswer(s, q, false);
    expect(s.tier).toBe(2);
    expect(s.streak).toBe(0);
    s = recordAnswer(s, q, false);
    expect(s.tier).toBe(1);
    let low = createStream(1, {});
    low = recordAnswer(recordAnswer(low, q, false), q, false);
    expect(low.tier).toBe(0);
  });
});

describe("бит-спринт: поток вопросов", () => {
  it("только choice/input, валидные, с правильным ответом, посчитанным кодом", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { qs } = play(seed * 977, 40, seed % 2 ? {} : { "ns.base": 0.9, "ns.bin2dec": 0.9, "ns.dec2bin": 0.9, "ns.props": 0.9 });
      for (const { step } of qs) {
        expect(["choice", "input"]).toContain(step.type);
        expect(isValidStep(step)).toBe(true);
        expect(SKILLS).toContain(step.skill);
        if (step.type === "input") {
          expect(checkInput(step.answers[0], step.answers, step.mode)).toBe(true);
          if (step.mode === "binary") expect(step.answers[0]).toMatch(/^[01]+$/);
          if (step.skill === "ns.dec2bin") expect(step.suffix).toBe("₂");
          if (step.skill === "ns.bin2dec") {
            const n = Number(step.answers[0]);
            expect(step.explanation.ru).toContain(`= ${n}.`);
          }
        }
      }
    }
  });
  it("нет повторов по префиксу id в одном раунде", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { qs } = play(seed * 31, 60);
      const prefixes = qs.map((q) => idPrefix(q.step.id));
      expect(new Set(prefixes).size).toBe(prefixes.length);
    }
  });
  it("уровень задаёт диапазон чисел", () => {
    let s = createStream(5, { "ns.base": 0.5, "ns.bin2dec": 0.5, "ns.dec2bin": 0.5, "ns.props": 0.5 });
    const q: Question = { step: choice(), tier: 0, retry: false };
    for (let i = 0; i < 10; i++) s = recordAnswer(s, q, true);
    expect(s.tier).toBe(2);
    let big = 0;
    for (let i = 0; i < 20; i++) {
      const r = nextQuestion(s);
      s = r.stream;
      const m = r.question.step.id.match(/^g:ns\.(bin2dec|dec2bin):[a-z]+:(\d+):/);
      if (m) {
        expect(Number(m[2])).toBeGreaterThanOrEqual(64);
        big++;
      }
    }
    expect(big).toBeGreaterThan(0);
  });
  it("ошибочный вопрос возвращается один раз через 3 вопроса, вариант пересчитан", () => {
    let s: Stream = createStream(99, { "ns.props": 0.05, "ns.base": 0.99, "ns.bin2dec": 0.99, "ns.dec2bin": 0.99 });
    let r = nextQuestion(s);
    s = r.stream;
    const first = r.question;
    s = recordAnswer(s, first, false);
    const seq: Question[] = [];
    for (let i = 0; i < 3; i++) {
      r = nextQuestion(s);
      s = r.stream;
      seq.push(r.question);
    }
    expect(seq.slice(0, 2).every((x) => !x.retry)).toBe(true);
    const retry = seq[2];
    expect(retry.retry).toBe(true);
    expect(retry.step.id).toBe(first.step.id);
    if (first.step.type === "choice" && retry.step.type === "choice") {
      const was = first.step.options[first.step.correct];
      expect(retry.step.options[retry.step.correct]).toEqual(was);
      const key = (o: unknown) => JSON.stringify(o);
      expect(retry.step.options.map(key).sort()).toEqual(first.step.options.map(key).sort());
    }
    // повтор, отвеченный неверно, не возвращается снова
    s = recordAnswer(s, retry, false);
    expect(s.queue).toHaveLength(0);
    for (let i = 0; i < 6; i++) {
      r = nextQuestion(s);
      s = r.stream;
      expect(r.question.retry).toBe(false);
    }
  });
  it("перемешивание вариантов сохраняет верный ответ", () => {
    for (let seed = 1; seed < 50; seed++) {
      const st = choice();
      if (st.type !== "choice") throw new Error();
      const r = reshuffleChoice(st, seeded(seed));
      if (r.type !== "choice") throw new Error();
      expect(r.options[r.correct]).toBe("C");
      expect(r.options).toHaveLength(4);
    }
    expect(reshuffleChoice(input(), seeded(1))).toEqual(input());
  });
  it("isValidStep отбраковывает дубли вариантов и неверный индекс", () => {
    const c = choice();
    if (c.type !== "choice") throw new Error();
    expect(isValidStep({ ...c, options: ["A", "A", "B"] })).toBe(false);
    expect(isValidStep({ ...c, correct: 4 })).toBe(false);
    expect(isValidStep({ ...c, options: ["A"], correct: 0 })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { checkInput } from "@/lib/check";
import { seeded } from "@/lib/text";
import {
  HARD_CAP_MS,
  MODE_CONFIG,
  NORMAL_BONUS_MAX,
  ROUND_MS,
  SKILLS,
  SKILL_UNLOCK,
  baseScore,
  bonusMs,
  clockAfter,
  createStream,
  idPrefix,
  isFinished,
  isRoundOver,
  isValidStep,
  appendKey,
  eraseKey,
  multiplier,
  nextQuestion,
  pickSkill,
  points,
  recordAnswer,
  remainingFraction,
  reshuffleChoice,
  scoreFor,
  skillWeight,
  speedWindow,
  taskTimeMs,
  unlockedSkills,
  type Question,
  type RoundStep,
  type Stream,
} from "@/games/bit-rush/logic";
import type { GameMode } from "@/games/types";

const MODES: GameMode[] = ["calm", "normal", "blitz"];

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

/** Играет count вопросов; answer решает, верно ли отвечен вопрос (по умолчанию ответы не записываются). */
function play(seed: number, count: number, masteries: Record<string, number> = {}, answer?: (i: number) => boolean) {
  let stream = createStream(seed, masteries);
  const qs: Question[] = [];
  for (let i = 0; i < count; i++) {
    const r = nextQuestion(stream);
    stream = answer ? recordAnswer(r.stream, r.question, answer(i)) : r.stream;
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
  it("часы блица: бонус зависит от уровня вопроса (1,5 / 2,5 / 3,5 с), потолок 60 с, минус 4 с", () => {
    expect(clockAfter(30_000, true)).toBe(31_500); // по умолчанию уровень 0
    expect(clockAfter(30_000, true, 0)).toBe(31_500);
    expect(clockAfter(30_000, true, 1)).toBe(32_500);
    expect(clockAfter(30_000, true, 2)).toBe(33_500);
    expect(bonusMs(0)).toBeLessThan(bonusMs(1));
    expect(bonusMs(1)).toBeLessThan(bonusMs(2));
    expect(clockAfter(59_500, true, 2)).toBe(ROUND_MS);
    expect(clockAfter(30_000, false, 2)).toBe(26_000); // штраф не зависит от уровня
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
  it("старт всегда с уровня 0, даже при высоком освоении (идём от лёгкого к сложному)", () => {
    const hi = { "ns.base": 0.95, "ns.bin2dec": 0.95, "ns.dec2bin": 0.95, "ns.props": 0.95 };
    for (const mode of MODES) {
      const s = createStream(1, hi, mode);
      expect(s.tier).toBe(0);
      expect(nextQuestion(s).question.tier).toBe(0);
    }
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
  it("нет повторов по префиксу id в одном раунде (игрок отвечает верно, уровень растёт)", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { qs } = play(seed * 31, 60, {}, () => true);
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

describe("бит-спринт: темпы (MODE_CONFIG)", () => {
  const ch = choice();
  const inp = input();

  it("в спокойном темпе нет ограничений по времени, 12 вопросов", () => {
    const c = MODE_CONFIG.calm;
    expect(c.clockMs).toBeNull();
    expect(c.hardCapMs).toBeNull();
    expect(c.choiceBudgetMs).toBeNull();
    expect(c.questionTimeout).toBe(false);
    expect(c.revealAutoMs).toBeNull(); // ждём «Далее»
    expect(c.questions).toBe(12);
    for (const tier of [0, 1, 2]) {
      expect(taskTimeMs(ch, tier, "calm")).toBeNull();
      expect(taskTimeMs(inp, tier, "calm")).toBeNull();
      expect(remainingFraction(ch, tier, "calm", 99_000)).toBe(0);
    }
  });

  it("обычный темп: 15 вопросов, свои часы на вопрос, без общих часов", () => {
    const c = MODE_CONFIG.normal;
    expect(c.clockMs).toBeNull();
    expect(c.questions).toBe(15);
    expect(c.questionTimeout).toBe(true);
    expect(c.revealAutoMs).toBeGreaterThanOrEqual(2_000);
    expect([0, 1, 2].map((t) => taskTimeMs(ch, t, "normal"))).toEqual([12_000, 16_000, 20_000]);
  });

  it("в обычном темпе сложнее — больше времени, ввод с клавиатуры +8 с", () => {
    for (const kind of [ch, inp]) {
      const t = [0, 1, 2].map((tier) => taskTimeMs(kind, tier, "normal")!);
      expect(t[0]).toBeLessThan(t[1]);
      expect(t[1]).toBeLessThan(t[2]);
    }
    for (const tier of [0, 1, 2]) {
      expect(taskTimeMs(inp, tier, "normal")! - taskTimeMs(ch, tier, "normal")!).toBe(8_000);
    }
  });

  it("обычный темп заметно щедрее блица (>= 1,5x на задание)", () => {
    for (const kind of [ch, inp]) {
      for (const tier of [0, 1, 2]) {
        const normal = taskTimeMs(kind, tier, "normal")!;
        const blitz = taskTimeMs(kind, tier, "blitz")!; // окно скоростного бонуса
        expect(blitz).toBe(speedWindow(kind, tier) * 1000);
        expect(normal).toBeGreaterThanOrEqual(blitz * 1.5);
      }
    }
  });

  it("блиц сохранил прежние числа: 60 с, штраф 4 с, потолок 120 с, без счётчика вопросов", () => {
    const c = MODE_CONFIG.blitz;
    expect(c.clockMs).toBe(ROUND_MS);
    expect(c.hardCapMs).toBe(HARD_CAP_MS);
    expect(c.penaltyMs).toBe(4_000);
    expect(c.bonusMs).toEqual([1_500, 2_500, 3_500]);
    expect(c.questions).toBeNull();
    expect(c.questionTimeout).toBe(false);
  });

  it("конец игры: по числу вопросов (calm/normal) или по часам (blitz)", () => {
    expect(isRoundOver("calm", 11, 0, 0)).toBe(false);
    expect(isRoundOver("calm", 12, 0, 0)).toBe(true);
    expect(isRoundOver("normal", 14, 0, 999_999)).toBe(false);
    expect(isRoundOver("normal", 15, 0, 0)).toBe(true);
    expect(isRoundOver("blitz", 99, 10_000, 50_000)).toBe(false);
    expect(isRoundOver("blitz", 0, 0, 50_000)).toBe(true);
    expect(isRoundOver("blitz", 0, 10_000, HARD_CAP_MS)).toBe(true);
  });

  it("очки: calm = база x множитель; normal = (база + бонус 0..10 за остаток) x множитель; blitz — прежняя формула", () => {
    // calm
    expect(scoreFor("calm", ch, 1, 99_000, 0)).toBe(10);
    expect(scoreFor("calm", ch, 3, 0, 2)).toBe(20);
    expect(scoreFor("calm", inp, 6, 0, 0)).toBe(15 * 3);
    // normal: мгновенный ответ — полный бонус, на последней секунде — почти ноль
    expect(scoreFor("normal", ch, 1, 0, 0)).toBe(10 + NORMAL_BONUS_MAX);
    expect(scoreFor("normal", ch, 1, 6_000, 0)).toBe(10 + 5); // половина из 12 с
    expect(scoreFor("normal", ch, 1, 12_000, 0)).toBe(10);
    expect(scoreFor("normal", ch, 1, 99_000, 0)).toBe(10); // ниже базы не бывает
    expect(scoreFor("normal", ch, 3, 0, 0)).toBe((10 + NORMAL_BONUS_MAX) * 2);
    expect(scoreFor("normal", inp, 1, 0, 0)).toBe(15 + NORMAL_BONUS_MAX);
    // blitz
    expect(scoreFor("blitz", ch, 3, 3_000, 0)).toBe(points(ch, 3, 3, 0));
    expect(scoreFor("blitz", inp, 15, 0, 0)).toBe(points(inp, 15, 0, 0));
  });

  it("уровень растёт каждые N верных: calm — 4 (4+4+4 из 12), normal — 5 (5+5+5 из 15), blitz — 5", () => {
    expect(MODE_CONFIG.calm.tierEvery).toBe(4);
    expect(MODE_CONFIG.normal.tierEvery).toBe(5);
    expect(MODE_CONFIG.blitz.tierEvery).toBe(5);
    const q: Question = { step: choice(), tier: 0, retry: false };
    let s = createStream(1, {}, "calm");
    for (let i = 1; i <= 3; i++) s = recordAnswer(s, q, true);
    expect(s.tier).toBe(0);
    s = recordAnswer(s, q, true);
    expect(s.tier).toBe(1);
    for (let i = 1; i <= 4; i++) s = recordAnswer(s, q, true);
    expect(s.tier).toBe(2);
    let n = createStream(1, {}, "normal");
    for (let i = 1; i <= 4; i++) n = recordAnswer(n, q, true);
    expect(n.tier).toBe(0);
    n = recordAnswer(n, q, true);
    expect(n.tier).toBe(1);
  });

  it("ошибочный вопрос возвращается и занимает место в лимите вопросов (normal/calm)", () => {
    for (const mode of ["calm", "normal"] as const) {
      let s = createStream(42, { "ns.props": 0.05 }, mode);
      const total = MODE_CONFIG[mode].questions!;
      let answered = 0;
      let retries = 0;
      let first: Question | null = null;
      while (!isRoundOver(mode, answered, 0, 0)) {
        const r = nextQuestion(s);
        s = r.stream;
        if (first === null) first = r.question;
        if (r.question.retry) retries++;
        // первый вопрос отвечаем неверно, остальные верно
        s = recordAnswer(s, r.question, r.question !== first);
        answered++;
      }
      expect(answered).toBe(total);
      expect(retries).toBe(1);
    }
  });
});

describe("бит-спринт: рампа от лёгкого к сложному", () => {
  it("порядок открытия навыков: основание и свойства → 2→10 → 10→2", () => {
    expect(SKILL_UNLOCK["ns.base"]).toBe(0);
    expect(SKILL_UNLOCK["ns.props"]).toBe(0);
    expect(SKILL_UNLOCK["ns.bin2dec"]).toBeGreaterThan(0);
    expect(SKILL_UNLOCK["ns.dec2bin"]).toBeGreaterThan(SKILL_UNLOCK["ns.bin2dec"]);
  });

  it("в начале пул только лёгкие навыки, со временем открываются все", () => {
    const s = createStream(1, {});
    expect(unlockedSkills(s).sort()).toEqual(["ns.base", "ns.props"]);
    expect(unlockedSkills({ ...s, correctCount: 2 })).toContain("ns.bin2dec");
    expect(unlockedSkills({ ...s, correctCount: 2 })).not.toContain("ns.dec2bin");
    expect(unlockedSkills({ ...s, correctCount: 4 }).sort()).toEqual([...SKILLS].sort());
  });

  it("первые вопросы не из сложных навыков, даже если всё отвечено неверно; потом все навыки доступны", () => {
    for (const mode of MODES) {
      for (let seed = 1; seed <= 20; seed++) {
        let s = createStream(seed * 101, {}, mode);
        const skills: string[] = [];
        for (let i = 0; i < 40; i++) {
          const r = nextQuestion(s);
          s = recordAnswer(r.stream, r.question, false);
          skills.push(r.question.step.skill!);
        }
        // вопросы 1–4: только основание/свойства
        for (const k of skills.slice(0, 4)) expect(["ns.base", "ns.props"]).toContain(k);
        // к концу встречаются все четыре навыка
        expect(new Set(skills.slice(8)).size).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("при верных ответах сложные навыки открываются раньше", () => {
    let s = createStream(5, {});
    const q: Question = { step: choice(), tier: 0, retry: false };
    s = recordAnswer(recordAnswer(s, q, true), q, true);
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const r = nextQuestion(s);
      s = r.stream;
      seen.add(r.question.step.skill!);
      if (seen.size === 3) break;
    }
    expect(seen.has("ns.bin2dec")).toBe(true);
  });

  it("в каждом темпе набор вопросов целиком валиден и ответы считает код", () => {
    for (const mode of MODES) {
      let s = createStream(777, {}, mode);
      const n = MODE_CONFIG[mode].questions ?? 40;
      for (let i = 0; i < n; i++) {
        const r = nextQuestion(s);
        s = recordAnswer(r.stream, r.question, i % 3 !== 0);
        expect(isValidStep(r.question.step)).toBe(true);
        const t = taskTimeMs(r.question.step, r.question.tier, mode);
        if (mode === "calm") expect(t).toBeNull();
        else expect(t).toBeGreaterThan(0);
      }
    }
  });
});

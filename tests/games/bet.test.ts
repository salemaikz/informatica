import { describe, expect, it } from "vitest";
import {
  BETS,
  BLITZ_MS,
  CALM_QUESTIONS,
  DEFAULT_SKILLS,
  NORMAL_QUESTIONS,
  applyAnswer,
  betDelta,
  confidenceMap,
  confidenceVerdict,
  drawNext,
  finalScore,
  initialState,
  pickTask,
  questionLimit,
  resolveSkills,
  taskBudgetMs,
  toResult,
  type Bet,
  type BetAnswer,
} from "@/games/bet/logic";
import { S } from "@/games/bet/strings";

const ans = (bet: Bet, correct: boolean): BetAnswer => ({ skill: "ns.base", bet, correct });
const many = (bet: Bet, right: number, wrong: number): BetAnswer[] => [
  ...Array.from({ length: right }, () => ans(bet, true)),
  ...Array.from({ length: wrong }, () => ans(bet, false)),
];

describe("ставка: темпы и очки", () => {
  it("вопросов: calm 10, normal 12, blitz без лимита (150 с)", () => {
    expect(questionLimit("calm")).toBe(CALM_QUESTIONS);
    expect(questionLimit("normal")).toBe(NORMAL_QUESTIONS);
    expect(questionLimit("blitz")).toBeNull();
    expect(BLITZ_MS).toBe(150_000);
    expect(taskBudgetMs("calm", 1)).toBeNull();
    expect(taskBudgetMs("blitz", 2)).toBeNull();
    expect(taskBudgetMs("normal", 1)).toBeGreaterThan(0);
  });
  it("верно +ставка, неверно −ставка", () => {
    for (const b of BETS) {
      expect(betDelta(b, true)).toBe(b);
      expect(betDelta(b, false)).toBe(-b);
    }
  });
  it("итог для рекорда не ниже 0, но ход игры хранит минус", () => {
    let st = initialState();
    st = applyAnswer(st, "ns.base", 3, false);
    st = applyAnswer(st, "ns.base", 2, false);
    expect(st.raw).toBe(-5);
    expect(finalScore(st)).toBe(0);
    expect(toResult(st)).toMatchObject({ score: 0, correct: 0, total: 2 });
    st = applyAnswer(st, "ns.base", 3, true);
    expect(st.raw).toBe(-2);
    st = applyAnswer(st, "ns.base", 3, true);
    expect(toResult(st)).toMatchObject({ score: 1, correct: 2, total: 4 });
  });
  it("attempts — навык и верность по каждому ответу", () => {
    const st = applyAnswer(applyAnswer(initialState(), "a.b", 1, true), "c.d", 2, false);
    expect(toResult(st).attempts).toEqual([
      { skill: "a.b", correct: true },
      { skill: "c.d", correct: false },
    ]);
  });
});

describe("ставка: подбор заданий", () => {
  const skills = resolveSkills(DEFAULT_SKILLS);
  it("только choice-задания и детерминировано по seed", () => {
    const a = pickTask({ skills, idx: 0, total: 10, seed: 7, used: [] });
    const b = pickTask({ skills, idx: 0, total: 10, seed: 7, used: [] });
    expect(a).not.toBeNull();
    expect(a?.type).toBe("choice");
    expect(a?.id).toBe(b?.id);
    expect(a?.skill).toBeTruthy();
  });
  it("раунд из 10: без подряд одинаковых, верный ответ в границах", () => {
    let st = initialState();
    let last = "";
    for (let i = 0; i < CALM_QUESTIONS; i++) {
      const nxt = drawNext(st, skills, 42, CALM_QUESTIONS);
      expect(nxt).not.toBeNull();
      if (!nxt) return;
      expect(nxt.step.id).not.toBe(last);
      expect(nxt.step.correct).toBeGreaterThanOrEqual(0);
      expect(nxt.step.correct).toBeLessThan(nxt.step.options.length);
      last = nxt.step.id;
      st = applyAnswer(nxt.state, nxt.step.skill ?? "", 1, true);
    }
    expect(st.answers).toHaveLength(CALM_QUESTIONS);
  });
  it("нет навыков / нет choice → null (мало заданий в банке)", () => {
    expect(pickTask({ skills: [], idx: 0, total: 10, seed: 1, used: [] })).toBeNull();
    expect(pickTask({ skills: ["no.such.skill"], idx: 0, total: 10, seed: 1, used: [] })).toBeNull();
    expect(drawNext(initialState(), [], 1, 10)).toBeNull();
    expect(resolveSkills(["no.such.skill"])).toEqual([]);
  });
});

describe("ставка: карта уверенности", () => {
  it("считает точность по каждой ставке", () => {
    const map = confidenceMap([...many(3, 4, 1), ...many(1, 1, 1)]);
    expect(map).toEqual([
      { bet: 1, total: 2, right: 1 },
      { bet: 2, total: 0, right: 0 },
      { bet: 3, total: 5, right: 4 },
    ]);
  });
  it("мало ответов → few", () => {
    expect(confidenceVerdict([])).toBe("few");
    expect(confidenceVerdict(many(3, 2, 0))).toBe("few");
  });
  it("высокие ставки верны → good", () => {
    expect(confidenceVerdict([...many(3, 4, 1), ...many(1, 1, 2)])).toBe("good");
  });
  it("высокие ставки часто неверны → over", () => {
    expect(confidenceVerdict([...many(3, 1, 3), ...many(1, 3, 0)])).toBe("over");
    expect(confidenceVerdict(many(2, 0, 3))).toBe("over");
  });
  it("на ставке 1 почти всё верно и высоких мало → under", () => {
    expect(confidenceVerdict([...many(1, 5, 0), ...many(2, 1, 0)])).toBe("under");
  });
  it("таймаут: в очки и attempts идёт, в карту уверенности — нет", () => {
    let st = initialState();
    st = applyAnswer(st, "ns.base", 1, false, true);
    st = applyAnswer(st, "ns.base", 1, false, true);
    st = applyAnswer(st, "ns.base", 3, true);
    expect(st.raw).toBe(1);
    expect(toResult(st)).toMatchObject({ total: 3, correct: 1 });
    expect(toResult(st).attempts).toHaveLength(3);
    expect(confidenceMap(st.answers)).toEqual([
      { bet: 1, total: 0, right: 0 },
      { bet: 2, total: 0, right: 0 },
      { bet: 3, total: 1, right: 1 },
    ]);
    expect(confidenceVerdict(st.answers)).toBe("few");
  });
  it("все тексты двуязычны", () => {
    for (const v of Object.values(S)) {
      expect(v.ru.length).toBeGreaterThan(0);
      expect(v.kk.length).toBeGreaterThan(0);
    }
  });
});

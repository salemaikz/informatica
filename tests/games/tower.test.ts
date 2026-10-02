import { describe, expect, it } from "vitest";
import { draw } from "@/lib/bank";
import { evaluate, expectedText } from "@/lib/evaluate";
import type { ChoiceStep, QuestionStep } from "@/lib/types";
import {
  BLITZ_MS,
  DEFAULT_SKILLS,
  FLOORS,
  LEVEL_MULT,
  NORMAL_SEC,
  STREAK_BONUS,
  STREAK_CAP,
  applyAnswer,
  canFiftyFifty,
  drawNext,
  fiftyFifty,
  floorLevel,
  floorPoints,
  initialState,
  isSupported,
  isTop,
  pickTask,
  resolveSkills,
  stepKey,
  streakBonus,
  taskBudgetMs,
  taskLevel,
  toResult,
} from "@/games/tower/logic";
import { S } from "@/games/tower/strings";

const choice = (n: number, correct = 1): ChoiceStep => ({
  id: "t:x:1:1",
  type: "choice",
  prompt: { ru: "q", kk: "q" },
  options: Array.from({ length: n }, (_, i) => String(i)),
  correct,
  explanation: { ru: "e", kk: "e" },
  whyWrong: Array.from({ length: n }, (_, i) => (i === correct ? null : { ru: `w${i}`, kk: `w${i}` })),
});

describe("башня: этажи и время", () => {
  it("уровни растут от A к C: 4 + 3 + 3 этажа", () => {
    const levels = Array.from({ length: FLOORS }, (_, i) => floorLevel(i));
    expect(levels).toEqual([1, 1, 1, 1, 2, 2, 2, 3, 3, 3]);
  });
  it("время на задание — только в обычном темпе: A 30, B 45, C 60 с", () => {
    expect(NORMAL_SEC).toEqual({ 1: 30, 2: 45, 3: 60 });
    expect(taskBudgetMs("normal", 1)).toBe(30_000);
    expect(taskBudgetMs("normal", 3)).toBe(60_000);
    expect(taskBudgetMs("calm", 1)).toBeNull();
    expect(taskBudgetMs("blitz", 3)).toBeNull();
    expect(BLITZ_MS).toBe(120_000);
  });
  it("уровень задания — свой, иначе по этажу", () => {
    expect(taskLevel({ ...choice(4), level: 3 }, 0)).toBe(3);
    expect(taskLevel(choice(4), 8)).toBe(3);
  });
});

describe("башня: отбор заданий", () => {
  it("поддерживаются choice/multi/input/match/order, остальное пропускаем", () => {
    const steps = draw("question", { skills: DEFAULT_SKILLS, count: 80, seed: 5, ramp: false });
    expect(steps.some((s) => isSupported(s))).toBe(true);
    const unsupported = ["bits", "ladder", "cloze", "solution"];
    for (const s of steps) expect(isSupported(s)).toBe(!unsupported.includes(s.type));
  });

  it("resolveSkills: пусто → навыки по умолчанию; навыки без банка отбрасываются", () => {
    expect(resolveSkills()).toEqual(DEFAULT_SKILLS);
    expect(resolveSkills([])).toEqual(DEFAULT_SKILLS);
    expect(resolveSkills(["ns.bin2dec"])).toEqual(["ns.bin2dec"]);
    expect(resolveSkills(["no.such.skill"])).toEqual([]);
  });

  it("pickTask детерминирован, даёт поддерживаемое задание и учитывает уже показанные", () => {
    for (let floor = 0; floor < FLOORS; floor++) {
      const a = pickTask({ skills: DEFAULT_SKILLS, floor, seed: 42, used: [] });
      const b = pickTask({ skills: DEFAULT_SKILLS, floor, seed: 42, used: [] });
      expect(a).not.toBeNull();
      expect(a?.id).toBe(b?.id);
      expect(isSupported(a as QuestionStep)).toBe(true);
    }
    const first = pickTask({ skills: DEFAULT_SKILLS, floor: 0, seed: 1, used: [] })!;
    const second = pickTask({ skills: DEFAULT_SKILLS, floor: 0, seed: 1, used: [stepKey(first)] })!;
    expect(stepKey(second)).not.toBe(stepKey(first));
  });

  it("pickTask: уровень задания не ниже этажа, пока в банке есть задания этого уровня", () => {
    for (let i = 0; i < 20; i++) {
      const s = pickTask({ skills: DEFAULT_SKILLS, floor: 9, seed: i, used: [] })!;
      expect(taskLevel(s, 9)).toBe(3);
    }
  });

  it("pickTask: один и тот же ключ подряд не выдаётся, пустой пул → null", () => {
    const s = pickTask({ skills: DEFAULT_SKILLS, floor: 2, seed: 3, used: [] })!;
    for (let i = 0; i < 10; i++) {
      const n = pickTask({ skills: DEFAULT_SKILLS, floor: 2, seed: i, used: [stepKey(s)], lastKey: stepKey(s) })!;
      expect(stepKey(n)).not.toBe(stepKey(s));
    }
    expect(pickTask({ skills: [], floor: 0, seed: 1, used: [] })).toBeNull();
    expect(pickTask({ skills: ["no.such.skill"], floor: 0, seed: 1, used: [] })).toBeNull();
  });

  it("pickTask: у задания всегда есть навык из пула, навыки чередуются", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const s = pickTask({ skills: DEFAULT_SKILLS, floor: seed % FLOORS, seed, used: [] })!;
      expect(DEFAULT_SKILLS).toContain(s.skill);
      seen.add(s.skill!);
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(pickTask({ skills: ["ns.base"], floor: 0, seed: 1, used: [] })!.skill).toBe("ns.base");
  });

  it("повторы разрешаются, когда все задания показаны (маленький банк)", () => {
    const first = pickTask({ skills: ["ns.props"], floor: 0, seed: 1, used: [] })!;
    // Делаем вид, что показаны ключи всех заданий из большой выборки.
    const all = draw("question", { skills: ["ns.props"], count: 300, seed: 9, ramp: false }).map(stepKey);
    const again = pickTask({ skills: ["ns.props"], floor: 0, seed: 2, used: all, lastKey: stepKey(first) });
    expect(again).not.toBeNull();
  });
});

describe("башня: подсказка 50 на 50", () => {
  it("убирает два неверных, верный сохраняется, индексы пересчитаны", () => {
    for (let seed = 1; seed <= 30; seed++) {
      let k = seed;
      const rand = () => ((k = (k * 16807) % 2147483647) / 2147483647);
      const step = choice(5, 3);
      const h = fiftyFifty(step, rand)!;
      expect(h.options).toHaveLength(3);
      expect(h.options[h.correct]).toBe(step.options[3]);
      expect(h.whyWrong).toHaveLength(3);
      expect(h.whyWrong?.[h.correct]).toBeNull();
      // исходное задание не изменилось
      expect(step.options).toHaveLength(5);
    }
  });
  it("из 4 вариантов остаётся 2; из 3 и меньше — подсказка недоступна", () => {
    expect(fiftyFifty(choice(4, 0))!.options).toHaveLength(2);
    expect(fiftyFifty(choice(3))).toBeNull();
    expect(fiftyFifty(choice(2))).toBeNull();
    expect(canFiftyFifty(choice(4))).toBe(true);
    expect(canFiftyFifty(choice(3))).toBe(false);
    expect(canFiftyFifty(undefined)).toBe(false);
  });
  it("после подсказки верный вариант проверяется по новому индексу", () => {
    const step = choice(4, 2);
    const h = fiftyFifty(step)!;
    expect(evaluate(h, { type: "choice", index: h.correct }, "ru").correct).toBe(true);
    const wrong = h.options.map((_, i) => i).find((i) => i !== h.correct)!;
    expect(evaluate(h, { type: "choice", index: wrong }, "ru").correct).toBe(false);
  });
});

describe("башня: очки", () => {
  it("этаж × 10 × множитель уровня", () => {
    expect(floorPoints(1, 1, 1)).toBe(10);
    expect(floorPoints(5, 2, 1)).toBe(75);
    expect(floorPoints(10, 3, 1)).toBe(200);
    expect(LEVEL_MULT).toEqual({ 1: 1, 2: 1.5, 3: 2 });
  });
  it("бонус за этажи без ошибок подряд: со второго, с потолком", () => {
    expect(streakBonus(0)).toBe(0);
    expect(streakBonus(1)).toBe(0);
    expect(streakBonus(2)).toBe(STREAK_BONUS);
    expect(streakBonus(3)).toBe(STREAK_BONUS * 2);
    expect(streakBonus(100)).toBe(STREAK_BONUS * STREAK_CAP);
    expect(floorPoints(3, 1, 3)).toBe(30 + 2 * STREAK_BONUS);
  });
});

describe("башня: ход игры", () => {
  const step = choice(4);

  it("верный ответ — этаж выше, очки; ошибка — этаж не падает, серия сбрасывается", () => {
    let s = initialState();
    s = applyAnswer(s, step, true).state;
    s = applyAnswer(s, step, true).state;
    expect(s.floor).toBe(2);
    expect(s.cleanStreak).toBe(2);
    const bad = applyAnswer(s, step, false);
    expect(bad.state.floor).toBe(2);
    expect(bad.state.cleanStreak).toBe(0);
    expect(bad.state.score).toBe(s.score);
    expect(bad.gained).toBe(0);
    expect(bad.climbed).toBe(false);
  });

  it("этаж, пройденный с ошибкой, не даёт бонуса и не начинает серию", () => {
    let s = applyAnswer(initialState(), step, false).state;
    const ok = applyAnswer(s, step, true);
    expect(ok.bonus).toBe(0);
    expect(ok.state.cleanStreak).toBe(0);
    expect(ok.state.floor).toBe(1);
    // следующий этаж — снова «чистый»
    const next = applyAnswer(ok.state, step, true);
    expect(next.state.cleanStreak).toBe(1);
    s = next.state;
    expect(applyAnswer(s, step, true).bonus).toBe(STREAK_BONUS);
  });

  it("идеальная игра: 10 этажей, вершина, считаются попытки по навыкам", () => {
    let s = initialState();
    const withSkill: ChoiceStep = { ...step, skill: "ns.base", level: 1 };
    for (let i = 0; i < FLOORS; i++) s = applyAnswer(s, withSkill, true).state;
    expect(isTop(s)).toBe(true);
    expect(s.correct).toBe(FLOORS);
    expect(s.total).toBe(FLOORS);
    const r = toResult(s);
    expect(r.attempts).toHaveLength(FLOORS);
    expect(r.attempts.every((a) => a.skill === "ns.base" && a.correct)).toBe(true);
    expect(r.score).toBe(s.score);
    // сумма базовых очков: 10 × (1+…+10) + бонусы серии
    const base = 10 * 55;
    const bonus = Array.from({ length: FLOORS }, (_, i) => streakBonus(i + 1)).reduce((a, b) => a + b, 0);
    expect(s.score).toBe(base + bonus);
  });

  it("drawNext отмечает показанное и не повторяет задания подряд; полная партия на банке ns.*", () => {
    let s = initialState();
    const seed = 777;
    const keys: string[] = [];
    let guard = 0;
    while (!isTop(s) && guard++ < 60) {
      const nxt = drawNext(s, DEFAULT_SKILLS, seed);
      expect(nxt).not.toBeNull();
      const { step: st, state } = nxt!;
      expect(isSupported(st)).toBe(true);
      keys.push(stepKey(st));
      // верный ответ вычисляем из самого задания (как «идеальный ученик»)
      s = state;
      const answered = answerOf(st);
      expect(evaluate(st, answered, "ru").correct).toBe(true);
      // каждый третий ответ — ошибка: этаж не падает
      if (guard % 3 === 0) {
        const before = s.floor;
        s = applyAnswer(s, st, false).state;
        expect(s.floor).toBe(before);
      } else {
        s = applyAnswer(s, st, true).state;
      }
    }
    expect(isTop(s)).toBe(true);
    for (let i = 1; i < keys.length; i++) expect(keys[i]).not.toBe(keys[i - 1]);
    expect(s.total).toBe(s.attempts.length);
    expect(s.attempts.every((a) => a.skill !== "")).toBe(true);
  });

  it("пустой пул → drawNext возвращает null", () => {
    expect(drawNext(initialState(), [], 1)).toBeNull();
  });
});

describe("башня: тексты", () => {
  it("все строки двуязычные", () => {
    for (const v of Object.values(S)) {
      expect(v.ru.trim()).not.toBe("");
      expect(v.kk.trim()).not.toBe("");
    }
  });
  it("подстановки {n}/{total}/{a} совпадают в ru и kk", () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const v of Object.values(S)) expect(ph(v.ru)).toBe(ph(v.kk));
  });
});

/** Верный ответ задания (для проверки оценки). */
function answerOf(step: ReturnType<typeof draw<"question">>[number]) {
  switch (step.type) {
    case "choice":
      return { type: "choice" as const, index: step.correct };
    case "multi":
      return { type: "multi" as const, indices: step.correct };
    case "input":
      return { type: "input" as const, value: step.answers[0] };
    case "match":
      return { type: "match" as const, done: true, wrong: 0 };
    case "order":
      return { type: "order" as const, order: step.items.map((_, i) => i) };
    default:
      throw new Error(`unsupported ${step.type}`);
  }
}

describe("башня: проверка ответов использует evaluate", () => {
  it("expectedText для всех отобранных заданий непустой", () => {
    const steps = draw("question", { skills: DEFAULT_SKILLS, count: 60, seed: 11, ramp: false }).filter(isSupported);
    expect(steps.length).toBeGreaterThan(0);
    for (const s of steps) expect(expectedText(s, "ru")).not.toBe("");
  });
});

import { describe, expect, it } from "vitest";
import { hasShape } from "@/lib/bank";
import type { GameMode } from "@/games/types";
import {
  BLITZ_MS,
  DEFAULT_SKILLS,
  MODE_CONFIG,
  STREAK_FOR_DOUBLE,
  SWIPE_DISTANCE,
  TruthEngine,
  blitzLevels,
  cardTimeMs,
  isFormula,
  multiplierFor,
  pointsFor,
  resolveSkills,
  swipeDecision,
} from "@/games/truth/logic";
import { S } from "@/games/truth/strings";

const MODES: GameMode[] = ["calm", "normal", "blitz"];

describe("truth: настройки темпа", () => {
  it("число утверждений: calm 12, normal 15, blitz — по времени 60 с", () => {
    expect(MODE_CONFIG.calm.count).toBe(12);
    expect(MODE_CONFIG.normal.count).toBe(15);
    expect(MODE_CONFIG.blitz.count).toBeNull();
    expect(MODE_CONFIG.blitz.clockMs).toBe(BLITZ_MS);
    expect(BLITZ_MS).toBe(60_000);
  });

  it("таймер: в calm нет, в normal по уровню 30/45/60 с, в blitz нет на карточку", () => {
    for (const lvl of [1, 2, 3] as const) {
      expect(cardTimeMs("calm", lvl)).toBeNull();
      expect(cardTimeMs("blitz", lvl)).toBeNull();
    }
    expect([1, 2, 3].map((l) => cardTimeMs("normal", l as 1 | 2 | 3))).toEqual([30_000, 45_000, 60_000]);
    expect(MODE_CONFIG.calm.clockMs).toBeNull();
    expect(MODE_CONFIG.normal.clockMs).toBeNull();
  });

  it("«почему»: calm до «Дальше», normal 2,5 с", () => {
    expect(MODE_CONFIG.calm.revealMs).toBeNull();
    expect(MODE_CONFIG.normal.revealMs).toBe(2_500);
  });
});

describe("truth: очки", () => {
  it("серия ×2 после 5 верных подряд", () => {
    expect(multiplierFor(0)).toBe(1);
    expect(multiplierFor(STREAK_FOR_DOUBLE - 1)).toBe(1);
    expect(multiplierFor(STREAK_FOR_DOUBLE)).toBe(2);
    expect(multiplierFor(9)).toBe(2);
  });

  it("блиц: +1 за верный, ×2 после серии", () => {
    expect(pointsFor("blitz", 3, 0)).toBe(1);
    expect(pointsFor("blitz", 1, 5)).toBe(2);
  });

  it("calm/normal: больше за сложные", () => {
    expect(pointsFor("calm", 1, 0)).toBeLessThan(pointsFor("calm", 3, 0));
  });
});

describe("truth: свайп", () => {
  it("вправо — верю, влево — не верю", () => {
    expect(swipeDecision(SWIPE_DISTANCE, 0)).toBe("believe");
    expect(swipeDecision(-SWIPE_DISTANCE, 0)).toBe("disbelieve");
  });
  it("короткий медленный жест — не ответ", () => {
    expect(swipeDecision(20, 100)).toBeNull();
    expect(swipeDecision(0, 0)).toBeNull();
  });
  it("быстрый бросок засчитывается, если направление совпадает с путём", () => {
    expect(swipeDecision(50, 900)).toBe("believe");
    expect(swipeDecision(-50, -900)).toBe("disbelieve");
    expect(swipeDecision(50, -900)).toBeNull();
  });
});

describe("truth: вспомогательное", () => {
  it("isFormula", () => {
    expect(isFormula("1011₂ = 11₁₀")).toBe(true);
    expect(isFormula("Число 5 нечётное")).toBe(false);
  });
  it("blitzLevels растут", () => {
    expect(blitzLevels(0).max).toBeLessThanOrEqual(blitzLevels(1).max);
    expect(blitzLevels(1).min).toBeGreaterThanOrEqual(blitzLevels(0).min);
  });
  it("resolveSkills: пусто → по умолчанию; без формы → пусто", () => {
    expect(resolveSkills([])).toEqual(DEFAULT_SKILLS.filter((s) => hasShape(s, "statement")));
    expect(resolveSkills(undefined).length).toBeGreaterThan(0);
    expect(resolveSkills(["no.such.skill"])).toEqual([]);
  });
  it("тексты двуязычные", () => {
    for (const [k, v] of Object.entries(S)) {
      expect(v.ru.trim(), k).not.toBe("");
      expect(v.kk.trim(), k).not.toBe("");
    }
  });
});

describe("truth: движок", () => {
  for (const mode of MODES) {
    it(`${mode}: детерминирован по seed`, () => {
      const a = new TruthEngine({ mode, seed: 7 });
      const b = new TruthEngine({ mode, seed: 7 });
      expect(a.current()?.id).toBe(b.current()?.id);
    });
  }

  it("calm: 12 утверждений, уникальные, уровни не падают", () => {
    const e = new TruthEngine({ mode: "calm", seed: 1 });
    expect(e.total).toBe(12);
    const seen: string[] = [];
    let lvl = 0;
    for (let st = e.current(); st; st = e.next()) {
      seen.push(st.text.ru);
      expect(st.level).toBeGreaterThanOrEqual(lvl);
      lvl = st.level;
      e.answer(st.value);
    }
    expect(seen).toHaveLength(12);
    expect(new Set(seen).size).toBe(12);
    expect(e.deckDone).toBe(true);
  });

  it("normal: 15 утверждений, верные ответы дают очки и attempts", () => {
    const e = new TruthEngine({ mode: "normal", seed: 2 });
    expect(e.total).toBe(15);
    for (let st = e.current(); st; st = e.next()) e.answer(st.value);
    const r = e.result();
    expect(r.total).toBe(15);
    expect(r.correct).toBe(15);
    expect(r.attempts).toHaveLength(15);
    expect(r.attempts.every((a) => a.correct)).toBe(true);
    expect(r.score).toBeGreaterThan(15 * 10);
    expect(e.bestStreak).toBe(15);
  });

  it("ошибка сбрасывает серию, время вышло (null) — ошибка", () => {
    const e = new TruthEngine({ mode: "blitz", seed: 3 });
    for (let i = 0; i < 5; i++) {
      const v = e.answer(e.current()!.value)!;
      expect(v.mult).toBe(1);
      e.next();
    }
    expect(e.streak).toBe(5);
    const v6 = e.answer(e.current()!.value)!;
    expect(v6.mult).toBe(2);
    expect(v6.points).toBe(2);
    e.next();
    const bad = e.answer(null)!;
    expect(bad.correct).toBe(false);
    expect(bad.timedOut).toBe(true);
    expect(bad.points).toBe(0);
    expect(e.streak).toBe(0);
    expect(e.result().score).toBe(5 + 2);
    expect(e.bestStreak).toBe(6);
  });

  it("неверный ответ: правильность считает код, а не клиент", () => {
    const e = new TruthEngine({ mode: "calm", seed: 4 });
    const st = e.current()!;
    const v = e.answer(!st.value)!;
    expect(v.correct).toBe(false);
    expect(v.statement.explanation.ru).not.toBe("");
    expect(e.result().attempts[0]).toEqual({ skill: st.skill, correct: false });
  });

  it("повторный ответ на то же утверждение игнорируется", () => {
    const e = new TruthEngine({ mode: "calm", seed: 5 });
    expect(e.answer(true)).not.toBeNull();
    expect(e.answer(true)).toBeNull();
    expect(e.done).toBe(1);
    expect(e.result().attempts).toHaveLength(1);
  });

  it("blitz: колода пополняется, повторов нет", () => {
    const e = new TruthEngine({ mode: "blitz", seed: 6 });
    const seen = new Set<string>();
    let n = 0;
    for (let st = e.current(); st && n < 40; st = e.next(), n++) {
      expect(seen.has(st.text.ru)).toBe(false);
      seen.add(st.text.ru);
      e.answer(st.value);
    }
    expect(n).toBeGreaterThan(12);
  });

  it("навыки без формы statement → пустая игра, нулевой результат", () => {
    for (const mode of MODES) {
      const e = new TruthEngine({ mode, seed: 8, skills: ["no.such.skill"] });
      expect(e.current()).toBeNull();
      expect(e.deckDone).toBe(true);
      expect(e.result()).toEqual({ score: 0, correct: 0, total: 0, attempts: [] });
    }
  });

  it("берёт только переданные навыки", () => {
    const e = new TruthEngine({ mode: "calm", seed: 9, skills: ["ns.props"] });
    for (let st = e.current(); st; st = e.next()) {
      expect(st.skill).toBe("ns.props");
      e.answer(st.value);
    }
  });

  it("в колоде есть и верные, и неверные утверждения", () => {
    const e = new TruthEngine({ mode: "normal", seed: 10 });
    const values = new Set<boolean>();
    for (let st = e.current(); st; st = e.next()) {
      values.add(st.value);
      e.answer(st.value);
    }
    expect(values.size).toBe(2);
  });

  it("blitz: первая порция — уровни A–B, дальше растут до C", () => {
    const e = new TruthEngine({ mode: "blitz", seed: 11 });
    const levels: number[] = [];
    for (let st = e.current(); st && levels.length < 30; st = e.next()) {
      levels.push(st.level);
      e.answer(st.value);
    }
    expect(levels.slice(0, 12).every((l) => l <= 2)).toBe(true);
    expect(Math.max(...levels.slice(12))).toBe(3);
  });

  it("после конца колоды ответ не принимается, next() остаётся null", () => {
    const e = new TruthEngine({ mode: "calm", seed: 12 });
    for (let st = e.current(); st; st = e.next()) e.answer(st.value);
    expect(e.answer(true)).toBeNull();
    expect(e.next()).toBeNull();
    expect(e.result().total).toBe(12);
  });

  it("серия: ошибка в середине — множитель снова только после 5 верных", () => {
    const e = new TruthEngine({ mode: "normal", seed: 13 });
    const mults: number[] = [];
    let i = 0;
    for (let st = e.current(); st; st = e.next(), i++) {
      const v = e.answer(i === 6 ? !st.value : st.value)!;
      if (v.correct) mults.push(v.mult);
    }
    // ответы 0–5 верные (×2 у шестого), седьмой — ошибка, затем снова 5 по ×1
    expect(mults.slice(0, 6)).toEqual([1, 1, 1, 1, 1, 2]);
    expect(mults.slice(6, 11)).toEqual([1, 1, 1, 1, 1]);
    expect(mults[11]).toBe(2);
  });
});

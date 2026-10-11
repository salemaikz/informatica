import { describe, expect, it } from "vitest";
import {
  BATTLE_HP,
  battleHits,
  battleMatch,
  battleSide,
  comboBonus,
  hpAt,
  speedTier,
  streakBonus,
  type BattleOpts,
} from "@/lib/duel/battle";
import type { Level } from "@/lib/types";
import type { DuelEvent } from "@/lib/duel/types";

const O: BattleOpts = { errorPauseMs: 1500, streakDays: 0 };
const M = { errorPauseMs: 1500, aStreakDays: 0, bStreakDays: 0 };
/** События с шагом step мс. */
const ev = (oks: boolean[], step: number): DuelEvent[] => oks.map((ok, i) => ({ i, ok, t: (i + 1) * step }));
const lv = (n: number, l: Level): Level[] => Array.from({ length: n }, () => l);

describe("скорость", () => {
  it("границы: ровно ½ нормы — молния, ровно норма — быстро", () => {
    expect(speedTier(1, 3000)).toBe("lightning");
    expect(speedTier(1, 3001)).toBe("fast");
    expect(speedTier(1, 6000)).toBe("fast");
    expect(speedTier(1, 6001)).toBe("normal");
    expect(speedTier(2, 4500)).toBe("lightning");
    expect(speedTier(2, 9000)).toBe("fast");
    expect(speedTier(3, 6500)).toBe("lightning");
    expect(speedTier(3, 13000)).toBe("fast");
    expect(speedTier(3, 13001)).toBe("normal");
  });
  it("негодное время — обычная скорость", () => {
    expect(speedTier(1, NaN)).toBe("normal");
    expect(speedTier(1, -5)).toBe("normal");
  });
});

describe("серия дней", () => {
  it("1% за каждые полные 5 дней, максимум 5%", () => {
    const cases: [number, number][] = [[0, 0], [4, 0], [5, 0.01], [9.9, 0.01], [12, 0.02], [24, 0.04], [25, 0.05], [100, 0.05]];
    for (const [d, want] of cases) expect(streakBonus(d)).toBeCloseTo(want, 10);
  });
  it("негодное — 0", () => {
    expect(streakBonus(-1)).toBe(0);
    expect(streakBonus(NaN)).toBe(0);
    expect(streakBonus(Infinity)).toBe(0);
  });
});

describe("комбо", () => {
  it("+10% за каждый следующий, максимум +50%", () => {
    expect(comboBonus(1)).toBe(0);
    expect(comboBonus(2)).toBeCloseTo(0.1, 10);
    expect(comboBonus(6)).toBeCloseTo(0.5, 10);
    expect(comboBonus(7)).toBe(0.5);
    expect(comboBonus(50)).toBe(0.5);
  });
  it("k < 1 и негодное — 0", () => {
    expect(comboBonus(0)).toBe(0);
    expect(comboBonus(-3)).toBe(0);
    expect(comboBonus(NaN)).toBe(0);
  });
});

describe("удары", () => {
  it("урон: база × скорость × (1 + комбо + серия)", () => {
    // A, медленно: 10; второй подряд: 11; третий: 12
    const h = battleHits(ev([true, true, true], 10_000), lv(3, 1), O);
    expect(h.map((x) => x.dmg)).toEqual([10, 11, 12]);
    expect(h.map((x) => x.combo)).toEqual([1, 2, 3]);
    expect(h.every((x) => x.speed === "normal" && !x.crit)).toBe(true);
    // B, быстро (≤ 9 с): round(12 × 1.15) = 14; с серией 25 дней: round(12 × 1.15 × 1.05) = 14
    expect(battleHits(ev([true], 8000), lv(1, 2), O)[0].dmg).toBe(14);
    expect(battleHits(ev([true], 8000), lv(1, 2), { ...O, streakDays: 25 })[0].dmg).toBe(Math.round(12 * 1.15 * 1.05));
  });

  it("пределы удара: минимум 10, максимум 30", () => {
    expect(battleHits(ev([true], 20_000), lv(1, 1), O)[0].dmg).toBe(10);
    // C, молния, комбо +50% (7-й подряд), серия 5%: round(15 × 1.3 × 1.55) = 30
    const h = battleHits(ev(Array(7).fill(true), 5000), lv(7, 3), { ...O, streakDays: 30 });
    expect(h[6].combo).toBe(7);
    expect(h[6].dmg).toBe(30);
    expect(Math.max(...h.map((x) => x.dmg))).toBe(30);
  });

  it("комбо упирается в +50%, крит с 5-го", () => {
    const h = battleHits(ev(Array(9).fill(true), 20_000), lv(9, 1), O);
    expect(h.map((x) => x.dmg)).toEqual([10, 11, 12, 13, 14, 15, 15, 15, 15]);
    expect(h.map((x) => x.crit)).toEqual([false, false, false, false, true, true, true, true, true]);
  });

  it("ошибка: урон 0, комбо 0, скорость null; комбо начинается заново", () => {
    const h = battleHits(ev([true, true, false, true], 20_000), lv(4, 1), O);
    expect(h[2]).toMatchObject({ ok: false, dmg: 0, combo: 0, speed: null, crit: false });
    expect(h[3]).toMatchObject({ combo: 1, dmg: 10 });
  });

  it("пауза после ошибки вычитается из времени следующего задания", () => {
    // ошибка в t=1000, верный в t=4000: 3000 − 1500 = 1500 мс → молния (A: ≤ 3000)
    const events: DuelEvent[] = [{ i: 0, ok: false, t: 1000 }, { i: 1, ok: true, t: 5000 }];
    // 5000 − 1000 − 1500 = 2500 → молния; без паузы было бы 4000 → быстро
    expect(battleHits(events, lv(2, 1), O)[1].speed).toBe("lightning");
    expect(battleHits(events, lv(2, 1), { ...O, errorPauseMs: 0 })[1].speed).toBe("fast");
    // после верного пауза не вычитается
    const ok: DuelEvent[] = [{ i: 0, ok: true, t: 1000 }, { i: 1, ok: true, t: 5000 }];
    expect(battleHits(ok, lv(2, 1), O)[1].speed).toBe("fast");
  });

  it("время не меньше 0; первое задание считается от 0", () => {
    const events: DuelEvent[] = [{ i: 0, ok: false, t: 1000 }, { i: 1, ok: true, t: 1200 }];
    expect(battleHits(events, lv(2, 1), O)[1].speed).toBe("lightning");
    expect(battleHits([{ i: 0, ok: true, t: 3000 }], lv(1, 1), O)[0].speed).toBe("lightning");
    expect(battleHits([{ i: 0, ok: true, t: 3001 }], lv(1, 1), O)[0].speed).toBe("fast");
  });

  it("задание за пределами levels — уровень 1", () => {
    const h = battleHits([{ i: 5, ok: true, t: 20_000 }], [], O);
    expect(h[0].dmg).toBe(10);
    const h2 = battleHits([{ i: 0, ok: true, t: 20_000 }], [3], O);
    expect(h2[0].dmg).toBe(15);
  });

  it("пустые события", () => {
    expect(battleHits([], [], O)).toEqual([]);
    expect(battleSide([], [], O)).toEqual({ hits: [], dealt: 0, koAt: null, correct: 0, answered: 0, timeMs: 0 });
  });
});

describe("сторона и нокаут", () => {
  it("здравый смысл: 8 верных быстрых B подряд нокаутируют, 6 медленных A — нет", () => {
    const fast = battleSide(ev(Array(8).fill(true), 8000), lv(8, 2), O);
    expect(fast.koAt).not.toBeNull();
    expect(fast.dealt).toBe(BATTLE_HP);
    const slow = battleSide(ev(Array(6).fill(true), 20_000), lv(6, 1), O);
    expect(slow.koAt).toBeNull();
    expect(slow.dealt).toBeLessThan(BATTLE_HP);
  });

  it("события после нокаута не входят в удары и итоги", () => {
    const events = ev(Array(12).fill(true), 8000);
    const s = battleSide(events, lv(12, 2), O);
    expect(s.koAt).not.toBeNull();
    expect(s.hits[s.hits.length - 1].t).toBe(s.koAt);
    expect(s.hits.length).toBeLessThan(12);
    expect(s.answered).toBe(s.hits.length);
    expect(s.correct).toBe(s.hits.length);
    expect(s.timeMs).toBe(s.koAt);
    expect(s.dealt).toBe(BATTLE_HP);
  });

  it("итоги без нокаута: верные, отвечено, время", () => {
    const s = battleSide(ev([true, false, true], 10_000), lv(3, 1), O);
    expect(s).toMatchObject({ correct: 2, answered: 3, timeMs: 30_000, koAt: null });
    expect(s.dealt).toBe(s.hits.reduce((x, h) => x + h.dmg, 0));
  });
});

describe("матч", () => {
  const koEvents = ev(Array(10).fill(true), 8000); // нокаут B-уровня ~ на 8-м ударе
  const slowA = ev(Array(10).fill(true), 20_000);

  it("нокаут: побеждает тот, кто сделал его раньше; события соперника после него отброшены", () => {
    const r = battleMatch(koEvents, slowA, lv(10, 2), M);
    expect(r).toMatchObject({ winner: "a", reason: "ko" });
    expect(r.endAt).toBe(r.a.koAt);
    expect(r.b.hits.every((h) => h.t <= r.endAt!)).toBe(true);
    expect(r.b.timeMs).toBeLessThanOrEqual(r.endAt!);
    const r2 = battleMatch(slowA, koEvents, lv(10, 2), M);
    expect(r2).toMatchObject({ winner: "b", reason: "ko" });
  });

  it("обе стороны нокаутируют в один момент — ничья", () => {
    const r = battleMatch(koEvents, koEvents, lv(10, 2), M);
    expect(r).toMatchObject({ winner: "draw", reason: "ko" });
    expect(r.a.koAt).toBe(r.b.koAt);
  });

  it("серия дней помогает нокаутировать раньше", () => {
    // одинаковые ответы, но у B серия 25 дней
    const a = ev(Array(14).fill(true), 20_000);
    const r = battleMatch(a, a, lv(14, 1), { ...M, bStreakDays: 25 });
    if (r.a.koAt !== null && r.b.koAt !== null) expect(r.b.koAt).toBeLessThanOrEqual(r.a.koAt);
    expect(r.endAt).toBe(r.b.koAt);
  });

  it("без нокаута: больше урона побеждает (hp)", () => {
    const r = battleMatch(ev([true, true, true], 10_000), ev([true, true, false], 10_000), lv(3, 1), M);
    expect(r).toMatchObject({ winner: "a", reason: "hp", endAt: null });
    const r2 = battleMatch(ev([true, false], 10_000), ev([true, true], 10_000), lv(2, 1), M);
    expect(r2).toMatchObject({ winner: "b", reason: "hp" });
  });

  it("урон решает раньше числа ответов; равный урон — сравниваются отвечено", () => {
    const levels: Level[] = [3, 1, 1];
    const a = [{ i: 0, ok: true, t: 20_000 }]; // 15
    const b = [{ i: 1, ok: true, t: 20_000 }, { i: 2, ok: false, t: 30_000 }]; // 10
    expect(battleMatch(a, b, levels, M)).toMatchObject({ winner: "a", reason: "hp" });
    // равный dealt и correct: тогда сравнивается отвечено
    const c = [{ i: 1, ok: true, t: 20_000 }];
    const d = [{ i: 2, ok: true, t: 20_000 }, { i: 0, ok: false, t: 30_000 }];
    expect(battleMatch(c, d, levels, M)).toMatchObject({ winner: "b", reason: "time" });
  });

  it("равный урон и верные: больше отвечено, затем меньше время, разница < 1 с — ничья", () => {
    const l = lv(3, 1);
    const a = [{ i: 0, ok: true, t: 20_000 }];
    const b = [{ i: 0, ok: true, t: 20_000 }, { i: 1, ok: false, t: 25_000 }];
    expect(battleMatch(a, b, l, M)).toMatchObject({ winner: "b", reason: "time" });
    const fast = [{ i: 0, ok: true, t: 20_000 }];
    const slow = [{ i: 0, ok: true, t: 22_000 }];
    expect(battleMatch(fast, slow, l, M)).toMatchObject({ winner: "a", reason: "time" });
    expect(battleMatch(slow, fast, l, M)).toMatchObject({ winner: "b", reason: "time" });
    const near = [{ i: 0, ok: true, t: 20_999 }];
    expect(battleMatch(fast, near, l, M)).toMatchObject({ winner: "draw", reason: "time" });
    const edge = [{ i: 0, ok: true, t: 21_000 }];
    expect(battleMatch(fast, edge, l, M)).toMatchObject({ winner: "a", reason: "time" });
  });

  it("пустые события у обеих — ничья", () => {
    expect(battleMatch([], [], [], M)).toMatchObject({ winner: "draw", reason: "time", endAt: null });
  });

  it("пустые события у одной стороны — проигрывает пустая", () => {
    expect(battleMatch(ev([true], 10_000), [], lv(1, 1), M)).toMatchObject({ winner: "a", reason: "hp" });
  });
});

describe("здоровье защитника", () => {
  it("убывает по ударам атакующего и не уходит ниже 0", () => {
    const s = battleSide(ev([true, true, true], 10_000), lv(3, 1), O); // 10, 11, 12
    expect(hpAt(s, 0)).toBe(100);
    expect(hpAt(s, 9999)).toBe(100);
    expect(hpAt(s, 10_000)).toBe(90);
    expect(hpAt(s, 20_000)).toBe(79);
    expect(hpAt(s, 1e9)).toBe(67);
    const ko = battleSide(ev(Array(12).fill(true), 8000), lv(12, 2), O);
    expect(hpAt(ko, 1e9)).toBe(0);
    expect(hpAt({ hits: [] }, 5)).toBe(100);
  });
});

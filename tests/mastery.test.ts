import { describe, expect, it } from "vitest";
import {
  ASSISTED_WEIGHT,
  MASTER_CLEAN,
  MASTER_DAYS,
  SEED_RIGHT,
  WEAK_BELOW,
  answerWeight,
  masteryLevel,
  masteryNeeds,
  migrateSkillStat,
  seedSkill,
  updateSkill,
  type SkillStat,
} from "@/lib/mastery";

const D1 = "2027-01-15";
const D2 = "2027-01-16";
const run = (n: number, day: string, s?: SkillStat, opts = { clean: true }) => {
  let x = s;
  for (let i = 0; i < n; i++) x = updateSkill(x, 1, 0, { ...opts, day });
  return x!;
};

describe("освоение #67", () => {
  it("три верных подряд — уже 0,85, но не «освоено»", () => {
    const s = run(3, D1);
    expect(s.mastery).toBeGreaterThan(0.8);
    expect(s.clean).toBe(3);
    expect(s.okDays).toBe(1);
    expect(masteryLevel(s)).toBe("progress");
  });
  it(`нужно ${MASTER_CLEAN} самостоятельных верных и ${MASTER_DAYS} разных дня`, () => {
    let s = run(4, D1);
    expect(masteryLevel(s)).toBe("progress");
    s = run(1, D2, s);
    expect(masteryLevel(s)).toBe("mastered");
    // два дня, но только три самостоятельных
    expect(masteryLevel(run(1, D2, run(2, D1)))).toBe("progress");
  });
  it("ответ с подсказкой и повтор весят вдвое меньше и не копят clean", () => {
    expect(answerWeight({})).toBe(1);
    expect(answerWeight({ hinted: true })).toBe(ASSISTED_WEIGHT);
    expect(answerWeight({ retry: true })).toBe(ASSISTED_WEIGHT);
    const self = updateSkill(undefined, 1, 0, { clean: true, day: D1 });
    const hinted = updateSkill(undefined, 1, 0, { weight: 0.5, clean: true, day: D1 });
    expect(self.mastery).toBe(0.7);
    expect(hinted.mastery).toBe(0.45);
    expect(hinted.clean).toBe(0);
    expect(hinted.okDays).toBe(0);
    // дальше: шаг вдвое меньше
    const a = updateSkill({ ...self }, 0, 0, { day: D1 });
    const b = updateSkill({ ...self }, 0, 0, { weight: 0.5, day: D1 });
    expect(0.7 - a.mastery).toBeCloseTo(2 * (0.7 - b.mastery), 2);
  });
  it("неверный ответ не копит clean, частичный — тоже", () => {
    const s = updateSkill(updateSkill(undefined, 0.5, 0, { clean: true, day: D1 }), 0, 0, { clean: true, day: D2 });
    expect(s.clean).toBe(0);
    expect(s.okDays).toBe(0);
    expect(s.correct).toBe(0);
  });
  it("без clean (игры) оценка растёт, а «освоено» — нет", () => {
    let s: SkillStat | undefined;
    for (const day of [D1, D2, "2027-01-17"]) for (let i = 0; i < 4; i++) s = updateSkill(s, 1, 0, { day });
    expect(s!.mastery).toBeGreaterThan(0.9);
    expect(masteryLevel(s)).toBe("progress");
  });
  it("masteryNeeds", () => {
    expect(masteryNeeds(undefined)).toEqual({ clean: MASTER_CLEAN, days: MASTER_DAYS });
    expect(masteryNeeds(run(2, D1))).toEqual({ clean: 2, days: 1 });
  });
  it("мусор в полях не ломает уровень", () => {
    expect(masteryLevel({ attempts: NaN, correct: 0, mastery: 0.9, lastSeen: 0 } as SkillStat)).toBe("new");
    expect(masteryLevel({ attempts: 5, correct: 5, mastery: 0.95, lastSeen: 0, clean: -3, okDays: "x" } as unknown as SkillStat)).toBe("progress");
  });
});

describe("seedSkill (диагностика #70)", () => {
  it("засевает только новый навык, ниже «слабого» порога, без clean", () => {
    const s = seedSkill(undefined, true, 5);
    expect(s).toMatchObject({ attempts: 1, correct: 1, mastery: SEED_RIGHT, clean: 0, okDays: 0 });
    expect(s.mastery).toBeLessThan(WEAK_BELOW);
    expect(masteryLevel(s)).toBe("weak");
    const known = run(2, D1);
    expect(seedSkill(known, false)).toBe(known);
  });
});

describe("migrateSkillStat — переход на #67", () => {
  it("высокая оценка и ≥ 6 ответов — остаётся «освоено»", () => {
    const m = migrateSkillStat({ attempts: 8, correct: 7, mastery: 0.9, lastSeen: 1 })!;
    expect(masteryLevel(m)).toBe("mastered");
  });
  it("три верных за раз — «в процессе», дальше копит дни", () => {
    const m = migrateSkillStat({ attempts: 3, correct: 3, mastery: 0.853, lastSeen: new Date(2027, 0, 15, 10).getTime() })!;
    expect(m).toMatchObject({ clean: 3, okDays: 1, okDay: "2027-01-15" });
    expect(masteryLevel(m)).toBe("progress");
    // тот же день — не новый день
    expect(masteryLevel(updateSkill(m, 1, 0, { clean: true, day: "2027-01-15" }))).toBe("progress");
    expect(masteryLevel(updateSkill(m, 1, 0, { clean: true, day: "2027-01-16" }))).toBe("mastered");
  });
  it("новые поля сохраняются, мусор отбрасывается", () => {
    expect(migrateSkillStat({ attempts: 2, correct: 1, mastery: 0.5, lastSeen: 1, clean: 1, okDays: 1, okDay: "2027-01-15" })).toMatchObject({ clean: 1, okDays: 1 });
    expect(migrateSkillStat(null)).toBeNull();
    expect(migrateSkillStat([1])).toBeNull();
    expect(migrateSkillStat({ attempts: -1, mastery: 7 })).toMatchObject({ attempts: 0, mastery: 1 });
  });
});

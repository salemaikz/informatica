import { describe, expect, it } from "vitest";
import { bumpStreak, levelInfo, liveStreak, xpForAnswer } from "@/lib/gamification";
import { masteryLevel, updateSkill, weakSkills } from "@/lib/mastery";

describe("уровни", () => {
  it("пороги 0/100/300/600", () => {
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(99).level).toBe(1);
    expect(levelInfo(100).level).toBe(2);
    expect(levelInfo(300).level).toBe(3);
    expect(levelInfo(650).level).toBe(4);
    expect(levelInfo(150).progress).toBeCloseTo(0.25);
  });
});

describe("XP", () => {
  it("бонус за комбо и половина за повтор", () => {
    expect(xpForAnswer(true, false, 0)).toBe(10);
    expect(xpForAnswer(true, false, 3)).toBe(15);
    expect(xpForAnswer(true, true, 5)).toBe(5);
    expect(xpForAnswer(false, false, 5)).toBe(0);
  });
});

describe("серия дней", () => {
  it("растёт день за днём и сбрасывается после пропуска", () => {
    let s = { current: 0, best: 0, lastDay: null as string | null };
    s = bumpStreak(s, "2026-10-01");
    s = bumpStreak(s, "2026-10-02");
    s = bumpStreak(s, "2026-10-02");
    expect(s.current).toBe(2);
    s = bumpStreak(s, "2026-10-05");
    expect(s.current).toBe(1);
    expect(s.best).toBe(2);
  });
  it("liveStreak обнуляется при пропуске", () => {
    const s = { current: 4, best: 4, lastDay: "2026-10-01" };
    expect(liveStreak(s, "2026-10-02")).toBe(4);
    expect(liveStreak(s, "2026-10-03")).toBe(0);
  });
});

describe("освоение навыка", () => {
  it("первый верный ответ — «в процессе», ошибка — «слабо»", () => {
    expect(masteryLevel(updateSkill(undefined, 1))).toBe("progress");
    expect(masteryLevel(updateSkill(undefined, 0))).toBe("weak");
  });
  it("«освоено» — самостоятельные верные ответы в разные дни, а не серия за раз (#67)", () => {
    let s = updateSkill(undefined, 0);
    // шесть верных подряд в один день: оценка высокая, но это ещё «в процессе»
    for (let i = 0; i < 6; i++) s = updateSkill(s, 1, 0, { clean: true, day: "2027-01-15" });
    expect(s.mastery).toBeGreaterThan(0.8);
    expect(masteryLevel(s)).toBe("progress");
    // успех на следующий день — «освоено»
    s = updateSkill(s, 1, 0, { clean: true, day: "2027-01-16" });
    expect(masteryLevel(s)).toBe("mastered");
  });
  it("weakSkills сортирует от слабого", () => {
    const stats = { a: updateSkill(undefined, 0), b: updateSkill(updateSkill(undefined, 0), 1), c: updateSkill(undefined, 1) };
    expect(weakSkills(stats)).toEqual(["a", "b"]);
  });
});

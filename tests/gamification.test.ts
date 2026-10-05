import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  achievementById,
  achievementsOfRarity,
  bumpStreak,
  levelInfo,
  levelTier,
  liveStreak,
  newTierOnLevelUp,
  tallyAchievements,
  xpForAnswer,
} from "@/lib/gamification";
import { ACHIEVEMENT_CHIPS } from "@/lib/economy";
import { RARITIES, isRarity } from "@/lib/rarity";
import { ACHIEVEMENT_RULES } from "@/lib/achievement-rules";
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

describe("ступени уровня (этап 16В, J)", () => {
  it("1–4 обычная, 5–9 редкая, 10–19 эпическая, 20–29 легендарная, 30+ мифическая", () => {
    expect([1, 2, 4].map(levelTier)).toEqual(["common", "common", "common"]);
    expect([5, 7, 9].map(levelTier)).toEqual(["rare", "rare", "rare"]);
    expect([10, 15, 19].map(levelTier)).toEqual(["epic", "epic", "epic"]);
    expect([20, 25, 29].map(levelTier)).toEqual(["legendary", "legendary", "legendary"]);
    expect([30, 31, 99, 150].map(levelTier)).toEqual(["mythic", "mythic", "mythic", "mythic"]);
  });

  it("мусор на входе — обычная ступень", () => {
    expect(levelTier(0)).toBe("common");
    expect(levelTier(-3)).toBe("common");
    expect(levelTier(Number.NaN)).toBe("common");
  });

  it("новая ступень — только на границах 5, 10, 20, 30", () => {
    expect(newTierOnLevelUp(4, 5)).toBe("rare");
    expect(newTierOnLevelUp(9, 10)).toBe("epic");
    expect(newTierOnLevelUp(19, 20)).toBe("legendary");
    expect(newTierOnLevelUp(29, 30)).toBe("mythic");
    expect(newTierOnLevelUp(5, 6)).toBeNull();
    expect(newTierOnLevelUp(1, 4)).toBeNull();
    expect(newTierOnLevelUp(30, 31)).toBeNull();
  });

  it("если за раз перешагнули несколько ступеней — выше всех", () => {
    expect(newTierOnLevelUp(3, 11)).toBe("epic");
    expect(newTierOnLevelUp(1, 30)).toBe("mythic");
  });

  it("уровень не растёт — ступени нет", () => {
    expect(newTierOnLevelUp(5, 5)).toBeNull();
    expect(newTierOnLevelUp(10, 3)).toBeNull();
  });
});

describe("достижения по редкости (этап 16В, K)", () => {
  it("id уникальны, у каждого есть редкость, название и описание на двух языках", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ACHIEVEMENTS) {
      expect(isRarity(a.rarity), a.id).toBe(true);
      for (const text of [a.title, a.description]) {
        expect(text.ru.trim().length, a.id).toBeGreaterThan(0);
        expect(text.kk.trim().length, a.id).toBeGreaterThan(0);
      }
    }
  });

  it("достижений около 35, во всех четырёх редкостях; легендарных меньше, чем обычных", () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(34);
    for (const r of RARITIES) expect(achievementsOfRarity(r).length, r).toBeGreaterThan(0);
    expect(achievementsOfRarity("legendary").length).toBeLessThan(achievementsOfRarity("common").length);
    expect(RARITIES.reduce((n, r) => n + achievementsOfRarity(r).length, 0)).toBe(ACHIEVEMENTS.length);
  });

  it("у каждой редкости есть цена в чипах, и она растёт с редкостью", () => {
    const prices = RARITIES.map((r) => ACHIEVEMENT_CHIPS[r]);
    expect(prices).toEqual([5, 10, 20, 40]);
  });

  it("условие из таблицы правил есть только у существующего достижения, а у новых оно обязательно", () => {
    for (const id of Object.keys(ACHIEVEMENT_RULES)) expect(achievementById(id), id).toBeDefined();
    // Достижения, которые стор выдаёт сам (по месту события), — в таблице правил не нужны.
    const own = new Set(["first_lesson", "perfect", "combo_7", "streak_3", "streak_7", "xp_500", "ai_friend", "solver", "drill", "gamer", "binary_master", "exam_first", "perfect_5", "explorer"]);
    for (const a of ACHIEVEMENTS) expect(own.has(a.id) || a.id in ACHIEVEMENT_RULES, a.id).toBe(true);
  });

  it("сводка: сколько получено из скольких, в целом и по редкости", () => {
    expect(tallyAchievements({})).toMatchObject({ got: 0, total: ACHIEVEMENTS.length, ratio: 0 });
    const earned = { first_lesson: 1, solver: 1, level_20: 1 };
    expect(tallyAchievements(earned).got).toBe(3);
    expect(tallyAchievements(earned, "legendary")).toMatchObject({ got: 1, total: achievementsOfRarity("legendary").length });
    expect(tallyAchievements(earned, "common").got).toBe(1);
    // чужие id не считаются
    expect(tallyAchievements({ nope: 1 }).got).toBe(0);
  });
});

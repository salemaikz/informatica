import { describe, expect, it } from "vitest";
import { UNITS } from "@/content/course";
import { COURSE_GROUPS, GROUPS_BY_UNIT, groupOfPracticeNode, practiceNodeId, unitGroups } from "@/content/groups";

describe("группы уроков курса 3.0 (#46)", () => {
  it("каждый урок карты — ровно в одной группе своего раздела, в порядке карты, группы по 1–5 уроков", () => {
    for (const unit of UNITS) {
      const groups = GROUPS_BY_UNIT[unit.id];
      expect(groups, unit.id).toBeTruthy();
      expect(groups.flatMap((g) => g.lessons)).toEqual(unit.lessons.map((l) => l.id));
      for (const g of groups.map((x) => x.lessons)) expect(g.length, `${unit.id}: ${g[0]}`).toBeGreaterThanOrEqual(1);
      for (const g of groups.map((x) => x.lessons)) expect(g.length, `${unit.id}: ${g[0]}`).toBeLessThanOrEqual(5);
    }
  });

  it("id групп и узлов уникальны, последняя группа раздела помечена", () => {
    expect(new Set(COURSE_GROUPS.map((g) => g.id)).size).toBe(COURSE_GROUPS.length);
    for (const unit of UNITS) {
      const gs = unitGroups(unit);
      expect(gs.filter((g) => g.last).length).toBe(1);
      expect(gs[gs.length - 1].last).toBe(true);
    }
    const practice = COURSE_GROUPS.filter((g) => !g.last);
    for (const g of practice) expect(groupOfPracticeNode(practiceNodeId(g))).toBe(g);
    expect(groupOfPracticeNode("practice:нет-такого")).toBeUndefined();
  });
});

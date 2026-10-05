import { describe, expect, it } from "vitest";
import { SCHOOL_PROGRAM } from "@/content/school-program";
import { LESSONS } from "@/content/course";
import { isCourseNodeId } from "@/lib/course-nodes";
import { buildPractice, buildRecap } from "@/lib/course-mix";
import { recapGroups, schoolPath, schoolPracticeNodeId, schoolRecapNodeId, sectionOfPracticeNode } from "@/lib/school-path";

// Школьная дорожка (этап 16Б, волна 2): разделы класса → уроки → «Упражнения» → «Повторение» четверти.

describe("школьная дорожка: группы класса", () => {
  for (const plan of SCHOOL_PROGRAM) {
    const path = schoolPath(plan);
    const name = path.planKey;

    it(`${name}: уроки готовы, без повторов внутри класса, разделы по порядку плана`, () => {
      expect(path.sections.map((s) => s.sectionId)).toEqual(plan.sections.map((s) => s.id));
      const all = path.sections.flatMap((s) => s.lessons);
      expect(new Set(all).size).toBe(all.length);
      for (const id of all) expect(LESSONS[id], id).toBeDefined();
      // Все готовые уроки плана есть на дорожке.
      const planReady = new Set(plan.sections.flatMap((s) => s.topics.flatMap((t) => t.lessonIds)).filter((id) => LESSONS[id]));
      expect(new Set(all)).toEqual(planReady);
    });

    it(`${name}: у раздела с уроками — группа и узел упражнений, id узлов проходят проверку стора`, () => {
      for (const s of path.sections) {
        expect(!!s.group, s.sectionId).toBe(s.lessons.length > 0);
        if (!s.group) continue;
        expect(s.group.lessons).toEqual(s.lessons);
        expect(isCourseNodeId(schoolPracticeNodeId(s.sectionId)), s.sectionId).toBe(true);
        expect(sectionOfPracticeNode(path, schoolPracticeNodeId(s.sectionId))?.sectionId).toBe(s.sectionId);
      }
      expect(path.groups.length).toBe(path.sections.filter((s) => s.lessons.length).length);
    });

    it(`${name}: «Повторение» — после последнего раздела каждой четверти с уроками`, () => {
      const quarters = [...new Set(path.sections.filter((s) => s.lessons.length).map((s) => s.quarter))];
      const recaps = path.sections.filter((s) => s.recapAfter);
      expect(recaps.length).toBe(quarters.length);
      for (const s of recaps) {
        const id = schoolRecapNodeId(path.planKey, s.quarter);
        expect(isCourseNodeId(id), id).toBe(true);
        const groups = recapGroups(path, id);
        expect(groups.length).toBeGreaterThan(0);
        expect(groups.every((g) => g.unitId === groups[0].unitId)).toBe(true);
      }
    });
  }
});

describe("школьная дорожка: упражнения и повторение из банков", () => {
  const plan = SCHOOL_PROGRAM.find((p) => p.grade === "8")!;
  const path = schoolPath(plan);
  const skillsOf = (ids: string[]) => new Set(ids.flatMap((id) => LESSONS[id]?.skills ?? []));

  it("упражнения раздела без пройденного — только навыки этого раздела", () => {
    for (const s of path.sections) {
      if (!s.group) continue;
      const steps = buildPractice(s.group, {}, {}, 7, path.groups);
      const own = skillsOf(s.lessons);
      expect(steps.every((q) => own.has(q.skill!)), s.sectionId).toBe(true);
    }
  });

  it("повторение четверти — навыки разделов этой четверти (и пройденного раньше)", () => {
    const last = path.sections.filter((s) => s.recapAfter)[0];
    const groups = recapGroups(path, schoolRecapNodeId(path.planKey, last.quarter));
    const steps = buildRecap(groups[0].unitId, {}, {}, 3, path.groups);
    const own = skillsOf(groups.flatMap((g) => g.lessons));
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((q) => own.has(q.skill!))).toBe(true);
  });
});

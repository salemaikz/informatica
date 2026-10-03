import { describe, expect, it } from "vitest";
import { firstOpenGroup, groupBySkill, shouldGroupBySkill, SKILL_GROUP_MIN_TASKS } from "@/components/ide/shell-helpers";
import { skillById } from "@/content/skills";
import { TASKS as PY_TASKS } from "@/lib/ide/python/tasks";
import type { CodeTaskStat, IdeTask } from "@/lib/ide/types";
import type { Level, SkillId } from "@/lib/types";

const mk = (id: string, level: Level, skill?: string): IdeTask => ({
  id,
  lang: "python",
  level,
  skill: skill as SkillId | undefined,
  title: { ru: id, kk: id },
  prompt: { ru: "p", kk: "p" },
  starter: "",
  solution: "",
  check: { kind: "js", stdout: "" },
});
const stat = (solved: boolean): CodeTaskStat => ({ solved, attempts: 1, at: 1 });

describe("группировка списка задач по навыку", () => {
  it("группы только при > 12 задач", () => {
    const n = (k: number) => Array.from({ length: k }, (_, i) => mk(`t${i}`, 1, "py.vars"));
    expect(SKILL_GROUP_MIN_TASKS).toBe(12);
    expect(shouldGroupBySkill(n(12))).toBe(false);
    expect(shouldGroupBySkill(n(13))).toBe(true);
    expect(shouldGroupBySkill([])).toBe(false);
  });

  it("внутри группы от A к C, группы — от простых к сложным, порядок авторов сохраняется", () => {
    const tasks = [mk("c1", 3, "s.b"), mk("b1", 2, "s.a"), mk("a1", 1, "s.a"), mk("a2", 1, "s.c"), mk("b2", 2, "s.b"), mk("a3", 1, "s.a")];
    const g = groupBySkill(tasks, {});
    expect(g.map((x) => [x.skill, x.tasks.map((t) => t.id)])).toEqual([
      ["s.a", ["a1", "a3", "b1"]],
      ["s.c", ["a2"]],
      ["s.b", ["b2", "c1"]],
    ]);
    expect(tasks[0].id).toBe("c1"); // вход не меняется
  });

  it("счётчик решённых по группе", () => {
    const tasks = [mk("a", 1, "s.a"), mk("b", 2, "s.a"), mk("c", 1, "s.b")];
    const g = groupBySkill(tasks, { a: stat(true), b: stat(false), c: stat(true) });
    expect(g.map((x) => [x.skill, x.solved, x.tasks.length])).toEqual([
      ["s.a", 1, 2],
      ["s.b", 1, 1],
    ]);
  });

  it("задачи без навыка — отдельная группа skill = null", () => {
    const g = groupBySkill([mk("a", 1), mk("b", 1, "s.a")], {});
    expect(g.map((x) => x.skill)).toEqual([null, "s.a"]);
  });

  it("раскрыта первая группа с нерешёнными; все решены — ни одной", () => {
    const tasks = [mk("a", 1, "s.a"), mk("b", 1, "s.b"), mk("c", 1, "s.c")];
    expect(firstOpenGroup(groupBySkill(tasks, {}))).toBe(0);
    expect(firstOpenGroup(groupBySkill(tasks, { a: stat(true) }))).toBe(1);
    expect(firstOpenGroup(groupBySkill(tasks, { a: stat(true), b: stat(true), c: stat(true) }))).toBe(-1);
    expect(firstOpenGroup([])).toBe(-1);
  });

  it("задачи Python: все группы с известными навыками, внутри A→C", () => {
    expect(shouldGroupBySkill(PY_TASKS)).toBe(true);
    const groups = groupBySkill(PY_TASKS, {});
    expect(groups.reduce((s, g) => s + g.tasks.length, 0)).toBe(PY_TASKS.length);
    for (const g of groups) {
      expect(g.skill && skillById(g.skill), String(g.skill)).toBeTruthy();
      const lv = g.tasks.map((t) => t.level);
      expect(lv).toEqual([...lv].sort());
    }
  });
});

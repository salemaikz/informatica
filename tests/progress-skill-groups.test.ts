import { describe, expect, it } from "vitest";
import { UNITS } from "@/content/course-map";
import { schoolPlan } from "@/content/school-program";
import { SKILLS } from "@/content/skills";
import { skillSectionsOf } from "@/lib/course-view";
import type { SkillStat } from "@/lib/mastery";
import {
  defaultOpenGroup,
  schoolSectionRows,
  schoolSkillSections,
  skillGroups,
  skillTotals,
  unitRows,
  unitSkillSections,
  type SkillSection,
} from "@/lib/progress";

// Этап 16В, N: навыки на «Прогрессе» сгруппированы по разделам трека, в группе — все навыки раздела (и не начатые).

const mastered: SkillStat = { attempts: 8, correct: 8, mastery: 0.92, lastSeen: 1, clean: 5, okDays: 3 };
const progress: SkillStat = { attempts: 4, correct: 3, mastery: 0.7, lastSeen: 1, clean: 1, okDays: 1 };
const almost: SkillStat = { attempts: 6, correct: 6, mastery: 0.9, lastSeen: 1, clean: 2, okDays: 1 };
const weak: SkillStat = { attempts: 3, correct: 1, mastery: 0.3, lastSeen: 1, clean: 0, okDays: 0 };

const ENT_SKILLS = SKILLS.filter((s) => !s.id.startsWith("school."));

describe("unitSkillSections: разделы курса ЕНТ → навыки", () => {
  const sections = unitSkillSections();

  it("все разделы курса с навыками, в порядке карты; у раздела — цвет и название", () => {
    expect(sections.map((s) => s.id)).toEqual(UNITS.map((u) => u.id));
    for (const s of sections) {
      expect(s.skillIds.length, s.id).toBeGreaterThan(0);
      expect(s.title.ru.trim() && s.title.kk.trim(), s.id).toBeTruthy();
      expect(s.color, s.id).toMatch(/^#/);
    }
  });

  it("навык числится ровно в одном разделе; вместе — все навыки курса ЕНТ", () => {
    const all = sections.flatMap((s) => s.skillIds);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual(ENT_SKILLS.map((s) => s.id).sort());
  });

  it("skipBasics убирает раздел «Старт», его навыки в остальные не переезжают", () => {
    const skipped = unitSkillSections({ skipBasics: true });
    expect(skipped.some((s) => s.id === "u0")).toBe(false);
    const basics = sections.find((s) => s.id === "u0")!.skillIds;
    const rest = new Set(skipped.flatMap((s) => s.skillIds));
    for (const id of basics) expect(rest.has(id), id).toBe(false);
  });
});

describe("schoolSkillSections: разделы программы класса → навыки", () => {
  it("навык — только в первом разделе класса; разделов без готовых уроков в списке нет", () => {
    for (const grade of ["5", "7", "9"] as const) {
      const plan = schoolPlan(grade)!;
      const sections = schoolSkillSections(plan);
      const all = sections.flatMap((s) => s.skillIds);
      expect(all.length, grade).toBeGreaterThan(0);
      expect(new Set(all).size, grade).toBe(all.length);
      for (const s of sections) {
        expect(s.skillIds.length, `${grade}/${s.id}`).toBeGreaterThan(0);
        expect(plan.sections.some((p) => p.id === s.id)).toBe(true);
      }
    }
  });

  it("skillSectionsOf: школьник — разделы класса, ЕНТ и «класс не выбран» — разделы курса", () => {
    const school = skillSectionsOf({ track: "school", grade: "8", direction: undefined, skipBasics: false });
    expect(school.map((s) => s.id)).toEqual(schoolSkillSections(schoolPlan("8")!).map((s) => s.id));
    const ent = skillSectionsOf({ track: "ent", grade: "8", direction: undefined, skipBasics: false });
    expect(ent.map((s) => s.id)).toEqual(UNITS.map((u) => u.id));
    const noGrade = skillSectionsOf({ track: "school", grade: "other", direction: undefined, skipBasics: false });
    expect(noGrade.map((s) => s.id)).toEqual(UNITS.map((u) => u.id));
  });
});

describe("skillGroups: группы, сводка, порядок строк", () => {
  const sections: SkillSection[] = [
    { id: "a", title: { ru: "А", kk: "А" }, color: "#111111", skillIds: ["ns.base", "ns.bin2dec", "ns.dec2bin", "ns.props", "ns.octhex"] },
    { id: "b", title: { ru: "Б", kk: "Б" }, color: "#222222", skillIds: ["logic.ops", "logic.tables"] },
  ];

  it("в группе все навыки раздела, включая не начатые; сводка совпадает с числом строк", () => {
    const groups = skillGroups(sections, { "ns.base": mastered, "ns.bin2dec": progress, "ns.dec2bin": weak });
    expect(groups.map((g) => g.id)).toEqual(["a", "b"]);
    const a = groups[0];
    expect(a.rows).toHaveLength(5);
    expect(a.counts).toEqual({ mastered: 1, progress: 1, weak: 1, new: 2 });
    const b = groups[1];
    expect(b.counts).toEqual({ mastered: 0, progress: 0, weak: 0, new: 2 });
    expect(b.rows.every((r) => r.level === "new" && r.mastery === 0)).toBe(true);
  });

  it("порядок строк: слабые, в процессе, освоенные, не начатые; внутри уровня — порядок курса", () => {
    const groups = skillGroups(sections, { "ns.base": mastered, "ns.bin2dec": progress, "ns.dec2bin": weak, "ns.props": weak });
    expect(groups[0].rows.map((r) => `${r.level}:${r.id}`)).toEqual([
      "weak:ns.dec2bin",
      "weak:ns.props",
      "progress:ns.bin2dec",
      "mastered:ns.base",
      "new:ns.octhex",
    ]);
  });

  it("«почти освоено»: оценка от 80%, но не хватает ответов — в процессе, с подсказкой «чего не хватает»", () => {
    const [g] = skillGroups(sections.slice(0, 1), { "ns.base": almost, "ns.bin2dec": progress, "ns.dec2bin": mastered });
    const row = (id: string) => g.rows.find((r) => r.id === id)!;
    expect(row("ns.base")).toMatchObject({ level: "progress", needs: { clean: 2, days: 1 } });
    expect(row("ns.bin2dec").needs).toBeNull(); // оценка ниже 80% — подсказки «до освоено» нет
    expect(row("ns.dec2bin")).toMatchObject({ level: "mastered", needs: null });
  });

  it("навык вне разделов трека: отдельная группа «Другие», только если по нему были ответы", () => {
    const none = skillGroups(sections, {});
    expect(none.map((g) => g.id)).toEqual(["a", "b"]);
    const withOther = skillGroups(sections, { "school.robots": progress, "ns.base": mastered, "info.units": weak });
    const other = withOther.at(-1)!;
    expect(other.id).toBe("other");
    expect(other.title).toBeNull();
    expect(other.rows.map((r) => r.id).sort()).toEqual(["info.units", "school.robots"]);
    expect(other.counts).toEqual({ mastered: 0, progress: 1, weak: 1, new: 0 });
  });

  it("мусор в данных не ломает: нет записи, attempts 0, оценка не число", () => {
    const junk = { "ns.base": { attempts: 0, correct: 0, mastery: 0.9, lastSeen: 0 }, "ns.bin2dec": { attempts: 2, mastery: Number.NaN } as unknown as SkillStat };
    const [g] = skillGroups(sections.slice(0, 1), junk);
    expect(g.rows.find((r) => r.id === "ns.base")!.level).toBe("new");
    const bin = g.rows.find((r) => r.id === "ns.bin2dec")!;
    expect(bin.mastery).toBe(0);
    expect(g.rows).toHaveLength(5);
  });

  it("skillTotals — сумма по группам; defaultOpenGroup — первая со слабыми навыками, иначе первая", () => {
    const groups = skillGroups(sections, { "ns.base": mastered, "logic.ops": weak, "logic.tables": progress });
    expect(skillTotals(groups)).toEqual({ mastered: 1, progress: 1, weak: 1, new: 4 });
    expect(defaultOpenGroup(groups)).toBe("b");
    expect(defaultOpenGroup(skillGroups(sections, { "ns.base": mastered }))).toBe("a");
    expect(defaultOpenGroup([])).toBeNull();
  });

  it("реальный курс: у свежего ученика все группы «не начато», раскрыта первая", () => {
    const groups = skillGroups(unitSkillSections(), {});
    expect(groups).toHaveLength(UNITS.length);
    expect(skillTotals(groups).new).toBe(ENT_SKILLS.length);
    expect(defaultOpenGroup(groups)).toBe(UNITS[0].id);
  });
});

describe("строки разделов: освоено навыков из всех", () => {
  it("unitRows: skillsTotal — навыки готовых уроков раздела, skillsMastered — освоенные", () => {
    const [first] = unitSkillSections();
    const stats = Object.fromEntries(first.skillIds.slice(0, 2).map((id) => [id, mastered]));
    const row = unitRows({}, stats).find((r) => r.id === first.id)!;
    expect(row.skillsTotal).toBe(first.skillIds.length);
    expect(row.skillsMastered).toBe(2);
    const other = unitRows({}, stats).find((r) => r.id !== first.id)!;
    expect(other.skillsMastered).toBe(0);
  });

  it("schoolSectionRows: навыки считаются по плану класса; без данных — 0 освоено", () => {
    const plan = schoolPlan("6")!;
    const sections = schoolSkillSections(plan);
    const stats = Object.fromEntries(sections[0].skillIds.map((id) => [id, mastered]));
    const rows = schoolSectionRows(plan, {}, stats);
    const r0 = rows.find((r) => r.id === sections[0].id)!;
    expect(r0.skillsTotal).toBe(sections[0].skillIds.length);
    expect(r0.skillsMastered).toBe(r0.skillsTotal);
    expect(schoolSectionRows(plan, {}).every((r) => r.skillsMastered === 0)).toBe(true);
    // сумма по разделам = число навыков класса (навык считается один раз)
    expect(rows.reduce((a, r) => a + r.skillsTotal, 0)).toBe(sections.reduce((a, s) => a + s.skillIds.length, 0));
  });
});

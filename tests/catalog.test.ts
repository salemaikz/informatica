import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATALOG_FILE, CONSPECTS_FILE, buildCatalog, renderCatalog, renderConspects } from "../scripts/catalog";
import { LESSONS, UNITS as COURSE_UNITS } from "@/content/course";
import { UNITS } from "@/content/course-map";
import { ENT_TOPIC_COUNTS, LESSON_META, entPlainCount, entUnitPaperSize, hasBank, hasShape, lessonMeta, skillsWithWorked } from "@/content/catalog";
import { COURSE_GROUPS } from "@/content/groups";
import { ENT_POOL } from "@/content/ent";
import { ENT_TOPICS } from "@/content/ent-topics";
import { checkpointSkillIds } from "@/components/learn/map";
import { miniTestPool, miniTestSize, MINITEST_COUNT } from "@/lib/course-mix";
import { unitPaperSize } from "@/lib/exam";
import { readingStats } from "@/lib/theory";
import { bankFor, hasShape as bankHasShape } from "@/lib/bank";
import { lessonStepCount } from "@/lib/lesson-size";
import { SKILLS } from "@/content/skills";
import { collectWorked } from "@/games/build/logic";

// Лёгкий каталог (этап 16) должен совпадать с содержимым уроков и банков: иначе карта покажет устаревшие названия,
// число шагов или «скоро» у готового урока.

describe("каталог курса", () => {
  it("сгенерирован из текущих уроков и банков (иначе: npm run catalog)", () => {
    expect(readFileSync(CATALOG_FILE, "utf8"), "каталог устарел — запусти npm run catalog").toBe(renderCatalog(buildCatalog()));
    expect(readFileSync(CONSPECTS_FILE, "utf8"), "шпаргалки устарели — запусти npm run catalog").toBe(renderConspects());
  });

  it("есть каждый урок, без шагов и конспекта, с числом шагов как в lesson-size", () => {
    expect(Object.keys(LESSON_META).sort()).toEqual(Object.keys(LESSONS).sort());
    for (const lesson of Object.values(LESSONS)) {
      const meta = lessonMeta(lesson.id)!;
      expect(meta.title).toEqual(lesson.title);
      expect(meta.skills).toEqual(lesson.skills);
      expect(meta.stepCount).toBe(lessonStepCount(lesson));
      expect(meta.reading).toEqual({ ru: readingStats(lesson, "ru"), kk: readingStats(lesson, "kk") });
      expect("steps" in meta || "conspect" in meta).toBe(false);
    }
  });

  it("банки и формы заданий — как в lib/bank", () => {
    for (const s of SKILLS) {
      expect(hasBank(s.id), s.id).toBe(!!bankFor(s.id));
      for (const shape of ["question", "statement", "pair", "short"] as const) expect(hasShape(s.id, shape), `${s.id}:${shape}`).toBe(bankHasShape(s.id, shape));
    }
  });

  it("навыки с пошаговыми разборами — как в игре «Собери решение»", () => {
    const ids = SKILLS.map((s) => s.id);
    expect(skillsWithWorked(ids)).toEqual(ids.filter((s) => collectWorked([s]).length > 0));
  });
});

describe("задания ЕНТ по каталогу — как по банку ЕНТ", () => {
  it("размер контрольной каждого раздела", () => {
    for (const unit of UNITS) {
      const skillIds = checkpointSkillIds(unit, LESSONS, SKILLS);
      expect(entUnitPaperSize(skillIds), unit.id).toBe(unitPaperSize(ENT_POOL, skillIds));
    }
  });

  it("размер мини-теста каждой группы", () => {
    for (const group of COURSE_GROUPS) {
      expect(miniTestSize(group), group.lessons.join(",")).toBe(Math.min(MINITEST_COUNT, miniTestPool(group).length));
    }
    expect(entPlainCount(["ns.base", "ns.base"])).toBe(entPlainCount(["ns.base"]));
  });

  it("задания по темам", () => {
    for (const tp of ENT_TOPICS) {
      const n = ENT_POOL.filter((i) => i.topic === tp.id).reduce((a, i) => a + (i.kind === "context" ? i.questions.length : 1), 0);
      expect(ENT_TOPIC_COUNTS[tp.id], tp.id).toBe(n);
    }
  });
});

describe("лёгкая карта курса", () => {
  it("content/course реэкспортирует ту же карту", () => {
    expect(COURSE_UNITS).toBe(UNITS);
  });

  it("урок на карте «готов» ровно тогда, когда он написан; название — из урока", () => {
    for (const unit of UNITS) {
      for (const ref of unit.lessons) {
        const lesson = LESSONS[ref.id];
        expect(ref.status, ref.id).toBe(lesson ? "available" : "soon");
        if (lesson) expect(ref.title, ref.id).toEqual(lesson.title);
        expect(ref.title.ru, ref.id).not.toBe("");
      }
    }
  });
});

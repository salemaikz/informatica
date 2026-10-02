import { describe, expect, it } from "vitest";
import { LESSONS, UNITS } from "@/content/course";
import { SKILLS } from "@/content/skills";
import { validateStep } from "./validate";

describe("контент курса", () => {
  it("у каждого доступного урока есть содержимое", () => {
    for (const u of UNITS) {
      expect(u.title.ru && u.title.kk).toBeTruthy();
      for (const ref of u.lessons) {
        expect(ref.title.ru && ref.title.kk, ref.id).toBeTruthy();
        if (ref.status === "available") expect(LESSONS[ref.id], ref.id).toBeDefined();
      }
    }
  });

  for (const lesson of Object.values(LESSONS)) {
    describe(lesson.id, () => {
      it("шаги валидны и двуязычны", () => {
        const errors = lesson.steps.flatMap(validateStep);
        expect(errors).toEqual([]);
      });
      it("id шагов уникальны", () => {
        const ids = lesson.steps.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
      });
      it("навыки зарегистрированы", () => {
        const known = new Set(SKILLS.map((s) => s.id));
        for (const s of lesson.steps) if (s.skill) expect(known.has(s.skill), s.id).toBe(true);
        for (const s of lesson.skills) expect(known.has(s), s).toBe(true);
      });
      it("есть конспект на обоих языках", () => {
        expect(lesson.conspect.ru.length).toBeGreaterThan(200);
        expect(lesson.conspect.kk.length).toBeGreaterThan(200);
      });
    });
  }
});

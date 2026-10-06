import { describe, expect, it } from "vitest";
import { LESSONS, UNITS } from "@/content/course";
import { SKILLS } from "@/content/skills";
import { CURRICULUM_LESSONS } from "@/content/lessons";
import { CONTEXTS, buildContextPractice } from "@/content/contexts";
import { CURRICULUM_BANKS, generateCurriculumQuestion, lookupPracticeQuestion } from "@/lib/bank/curriculum";
import { buildCodePractice, canGenerate } from "@/lib/generators";
import { buildEntMock } from "@/lib/ent";
import { validateStep } from "./validate";

describe("расширение программы2026", () => {
  it("все9 разделов доступны и имеют разные цвета", () => {
    expect(UNITS).toHaveLength(9);
    expect(new Set(UNITS.map((unit) => unit.color)).size).toBe(9);
    expect(Object.keys(LESSONS)).toHaveLength(36);
    expect(UNITS.flatMap((unit) => unit.lessons).every((ref) => ref.status === "available")).toBe(true);
  });

  it("новые уроки содержат примеры, закрепления, ЕНТ и разбор", () => {
    for (const lesson of CURRICULUM_LESSONS) {
      expect(lesson.steps.filter((s) => s.type === "theory")).toHaveLength(4);
      expect(lesson.steps.filter((s) => s.ent)).toHaveLength(2);
      expect(lesson.steps.some((s) => s.type === "solution")).toBe(true);
      for (const card of lesson.steps.filter((s) => s.type === "theory")) {
        expect(card.body.ru.length, card.id).toBeGreaterThan(200);
        expect(card.body.kk.length, card.id).toBeGreaterThan(200);
      }
    }
    expect(SKILLS.every((skill) => canGenerate(skill.id))).toBe(true);
  });

  it("новые генераторы валидны и сервер восстанавливает каноническое задание", () => {
    for (const bank of CURRICULUM_BANKS) for (const level of [1, 2, 3] as const) for (let seed = 1; seed <= 50; seed++) {
      const q = generateCurriculumQuestion(bank.skill, level, seed);
      expect(validateStep(q), q.id).toEqual([]);
      expect(lookupPracticeQuestion(q.id)?.explanation).toEqual(q.explanation);
      if (bank.short) expect(bank.short(level, seed).answer.length).toBeGreaterThan(0);
    }
    expect(lookupPracticeQuestion("g2:madeup:1:5:2")).toBeUndefined();
    expect(lookupPracticeQuestion("g2:info.units:1:99999:0")).toBeUndefined();
  });

  it("практикум возвращает разные задания с исполнимым кодом", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const q = buildCodePractice(seed, 10);
      expect(q).toHaveLength(10);
      expect(new Set(q.map((step) => step.id)).size).toBe(10);
      expect(q.every((step) => step.prompt.ru.includes("```python"))).toBe(true);
      expect(q.flatMap(validateStep)).toEqual([]);
    }
  });

  it("каждый контекст имеет5 вопросов с общей исходной программой или таблицей", () => {
    expect(CONTEXTS).toHaveLength(8);
    for (const group of CONTEXTS) {
      const questions = buildContextPractice(group.id);
      expect(questions).toHaveLength(5);
      expect(questions.flatMap(validateStep)).toEqual([]);
      expect(questions.every((q) => q.prompt.ru.includes(group.body.ru))).toBe(true);
      for (const q of questions) expect(lookupPracticeQuestion(q.id)).toEqual(q);
    }
  });

  it("12 пробных вариантов соблюдают форматы, сложность и максимальные баллы", () => {
    const contexts = new Set<string>();
    const signatures = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const mock = buildEntMock(seed);
      contexts.add(mock.contextId); signatures.add(mock.questions.map((q) => q.id).join("|"));
      expect(mock.maxPoints).toBe(50);
      expect(mock.questions).toHaveLength(40);
      expect(new Set(mock.questions.map((q) => q.id)).size).toBe(40);
      expect(mock.questions.filter((q) => q.type === "choice" && !q.id.startsWith("ctx:"))).toHaveLength(25);
      expect(mock.questions.filter((q) => q.id.startsWith("ctx:"))).toHaveLength(5);
      expect(mock.questions.filter((q) => q.type === "multi")).toHaveLength(5);
      expect(mock.questions.filter((q) => q.type === "ent-match")).toHaveLength(5);
      expect([1, 2, 3].map((n) => mock.questions.filter((q) => q.level === n).length)).toEqual([20, 12, 8]);
      for (const q of mock.questions) {
        if (q.type === "ent-match") {
          expect(q.left).toHaveLength(2); expect(q.options).toHaveLength(4); expect(q.correct).toHaveLength(2);
          expect(new Set(q.correct).size).toBe(2); expect(q.correct.every((n) => n >= 0 && n < 4)).toBe(true);
        } else expect(validateStep(q), q.id).toEqual([]);
      }
    }
    expect(signatures.size).toBe(12);
    expect(contexts.size).toBeGreaterThan(3);
    expect(buildEntMock(42)).toEqual(buildEntMock(42));
  });
});

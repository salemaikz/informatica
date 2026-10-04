import { describe, expect, it } from "vitest";
import { LESSONS, UNITS } from "@/content/course";
import { SKILLS } from "@/content/skills";
import type { MultiStep } from "@/lib/types";
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

describe("multi с пометкой ЕНТ — ровно 6 вариантов (аудит C4)", () => {
  const multi = (options: string[], ent?: boolean): MultiStep => ({
    id: "m",
    type: "multi",
    prompt: { ru: "?", kk: "?" },
    options,
    correct: [0, 1],
    explanation: { ru: "e", kk: "e" },
    ent,
  });

  it("валидатор: 4 варианта с пометкой ЕНТ — ошибка, 6 — нет, без пометки — любое число ≥ 3", () => {
    expect(validateStep(multi(["a", "b", "c", "d"], true)).join()).toContain("ровно 6 вариантов");
    expect(validateStep(multi(["a", "b", "c", "d", "e", "f"], true))).toEqual([]);
    expect(validateStep(multi(["a", "b", "c", "d"]))).toEqual([]);
  });

  it("во всех уроках (в том числе скрытых) такие шаги — с 6 вариантами", () => {
    for (const lesson of Object.values(LESSONS))
      for (const step of lesson.steps)
        if (step.type === "multi" && step.ent) expect(step.options.length, `${lesson.id}: ${step.id}`).toBe(6);
  });

  it("ns-1-binary: «выбери все числа больше 10» — 6 вариантов, верные те же (1100₂ и 10001₂)", () => {
    const step = LESSONS["ns-1-binary"].steps.find((s) => s.id === "q-ent-multi");
    expect(step?.type).toBe("multi");
    if (step?.type !== "multi") return;
    expect(step.options).toHaveLength(6);
    // верные — ровно те варианты, где число строго больше 10
    const value = (o: unknown) => parseInt(String(o).replace("₂", ""), 2);
    expect(step.correct).toEqual(step.options.map((o, i) => (value(o) > 10 ? i : -1)).filter((i) => i >= 0));
    expect(step.whyWrong).toHaveLength(6);
  });
});

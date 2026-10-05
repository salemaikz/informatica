import { describe, expect, it } from "vitest";
import { LESSONS } from "@/content/course";
import { TASKS } from "@/lib/ide/python/tasks";
import type { CodeStep } from "@/lib/types";

// Этап 14, C9a: в 12 Python-уроках есть шаг `code` — задача практикума прямо в уроке (после «сам», до заданий ЕНТ).
const CODE_LESSONS: Record<string, { stepId: string; task: string }> = {
  "py-0-start": { stepId: "st-code", task: "py-11-io-sep" },
  "py-1-vars": { stepId: "vars-code", task: "py-2-sum" },
  "py-1c-ops": { stepId: "ops-code", task: "py-14-ops-digit" },
  "py-2-if": { stepId: "if-code", task: "py-41-if-weekday" },
  "py-2b-logic": { stepId: "cond-code", task: "py-16-cond-triangle" },
  "py-3b-for": { stepId: "for-code", task: "py-45-for-evens" },
  "py-3c-while": { stepId: "wh-code", task: "py-48-while-trips" },
  "py-3e-patterns": { stepId: "pat-code", task: "py-59-pat-above-avg" },
  "py-4b-methods": { stepId: "m4-code", task: "py-52-str-fence" },
  "py-5b-listops": { stepId: "lo-code", task: "py-54-list-basket" },
  "py-6b-params": { stepId: "pm-code", task: "py-58-params-taxi" },
  "py-7a-sort": { stepId: "srt-code", task: "py-61-sort-median" },
};

describe("шаг code в Python-уроках (C9a)", () => {
  for (const [lessonId, want] of Object.entries(CODE_LESSONS)) {
    describe(lessonId, () => {
      const lesson = LESSONS[lessonId];
      const codeSteps = lesson.steps.filter((s): s is CodeStep => s.type === "code");

      it("ровно один шаг code с нужным id и задачей", () => {
        expect(codeSteps).toHaveLength(1);
        expect(codeSteps[0].id).toBe(want.stepId);
        expect(codeSteps[0].task).toBe(want.task);
      });

      it("задача существует, уровня A/B, с навыком урока; шаг — с тем же навыком", () => {
        const step = codeSteps[0];
        const task = TASKS.find((t) => t.id === step.task);
        expect(task, step.task).toBeTruthy();
        expect(task!.level).toBeLessThanOrEqual(2);
        expect(task!.skill).toBe(lesson.skills[0]);
        expect(step.skill).toBe(lesson.skills[0]);
        expect([1, 2]).toContain(step.level);
        expect(step.level).toBe(task!.level);
      });

      it("шаг стоит после блока «сам» и до заданий ЕНТ", () => {
        const idx = lesson.steps.findIndex((s) => s.type === "code");
        const firstEnt = lesson.steps.findIndex((s) => s.ent);
        expect(idx).toBeGreaterThan(0);
        expect(firstEnt).toBe(idx + 1); // сразу перед первым заданием ЕНТ
        // до него в уроке уже были задания (разбор — не «сам»)
        expect(lesson.steps.slice(0, idx).filter((s) => s.type === "cloze" || s.type === "choice" || s.type === "input" || s.type === "match").length).toBeGreaterThanOrEqual(2);
      });

      it("вводная, подсказка и разбор — на двух языках, без эмодзи и без «сам»", () => {
        const step = codeSteps[0];
        for (const f of [step.prompt, step.hint!, step.explanation]) {
          expect(f?.ru?.trim()).toBeTruthy();
          expect(f?.kk?.trim()).toBeTruthy();
          expect(f.ru + f.kk).not.toMatch(/\p{Extended_Pictographic}/u);
          expect(f.ru).not.toMatch(/(^|[^а-яё])сам(а|и)?([^а-яё]|$)/i); // пол ученика неизвестен
          expect(f.kk).not.toMatch(/ЕНТ|бинар/);
        }
      });

      it("подсказка шага не содержит эталонного решения", () => {
        const step = codeSteps[0];
        const task = TASKS.find((t) => t.id === step.task)!;
        expect(step.hint!.ru).not.toContain(task.solution.trim());
        expect(step.hint!.ru.length).toBeLessThan(300);
      });
    });
  }

  it("id шагов code — «<префикс>-code», уникальны среди 12 уроков", () => {
    const ids = Object.values(CODE_LESSONS).map((x) => x.stepId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/-code$/);
  });
});

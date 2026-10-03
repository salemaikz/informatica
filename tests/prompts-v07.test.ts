import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { tutorSystemPrompt } from "@/server/prompts";
import type { StudentContext } from "@/lib/ai-types";

// v0.7: режимы ИИ-чата 2.0 и практикум кода в системном промпте (решения #35, #37).

const ctx: StudentContext = {
  name: "Т",
  lang: "ru",
  grade: "9",
  goal: "ent",
  style: "short",
  level: 1,
  xp: 0,
  streak: 0,
  weak: [],
  strong: [],
  mistakes: [],
  memory: "",
  notes: "",
  lessons: [],
};

describe("промпт практикума кода", () => {
  const task = { prompt: "Сумма", ide: "Python", theory: "Выведи сумму", code: "print(a+b)", error: "NameError: name 'a' is not defined" };

  it("нерешённая задача: объяснить ошибку и первый шаг, без готовой программы", () => {
    const p = tutorSystemPrompt(ctx, "explain", { ...task, answered: false });
    expect(p).toContain("ПРАКТИКУМ КОДА (Python)");
    expect(p).toContain("print(a+b)");
    expect(p).toContain("NameError");
    expect(p).toContain("НЕ пиши готовую программу");
    expect(p).not.toContain("ТЕОРИЯ ТЕКУЩЕГО ШАГА УРОКА");
  });

  it("решённая задача: можно разобрать решение", () => {
    const p = tutorSystemPrompt(ctx, "ask", { ...task, answered: true });
    expect(p).toContain("Задача уже решена");
    expect(p).not.toContain("НЕ пиши готовую программу");
  });
});

describe("режимы ИИ-чата 2.0", () => {
  it("режим и тема добавляют свою строку только в чате", () => {
    expect(tutorSystemPrompt(ctx, "chat", undefined, { chatMode: "explain", topic: "Системы счисления" })).toContain("ЧАТ «ОБЪЯСНИ ТЕМУ»: «Системы счисления»");
    expect(tutorSystemPrompt(ctx, "chat", undefined, { chatMode: "ent" })).toContain("ГОТОВИМСЯ К ЕНТ");
    expect(tutorSystemPrompt(ctx, "chat", undefined, { chatMode: "check" })).toContain("ПРОВЕРЬ РЕШЕНИЕ");
    expect(tutorSystemPrompt(ctx, "hint", { prompt: "x" }, { chatMode: "explain" })).not.toContain("ОБЪЯСНИ ТЕМУ");
    expect(tutorSystemPrompt(ctx, "chat", undefined, { chatMode: "free" })).not.toContain("ЧАТ «");
  });
});

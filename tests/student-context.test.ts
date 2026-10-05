import { describe, expect, it } from "vitest";
import { SKILLS } from "@/content/skills";
import { buildStudentContext } from "@/lib/student-context";
import { useApp } from "@/lib/store";

describe("контекст наставника: слабые навыки (C21)", () => {
  it("слабый навык с малым числом ответов (после диагностики) попадает в weak", () => {
    const base = useApp.getState();
    const [a, b] = SKILLS;
    const now = Date.now();
    const state = {
      ...base,
      skills: {
        [a.id]: { attempts: 5, correct: 5, mastery: 0.9, lastSeen: now },
        [b.id]: { attempts: 1, correct: 0, mastery: 0.15, lastSeen: now },
      },
    };
    const ctx = buildStudentContext(state);
    expect(ctx.weak.some((w) => w.includes("15%"))).toBe(true);
    expect(ctx.weak.length).toBeLessThanOrEqual(5);
  });
});

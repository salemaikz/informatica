import { describe, expect, it } from "vitest";
import { LESSONS, UNITS } from "@/content/course";
import { bankFor } from "@/lib/bank";
import { isQuestion } from "@/lib/evaluate";
import { GROUPS_BY_UNIT } from "@/content/groups";

// Микроуроки (этап 14, #82): нормы проверяются и в npm test, не только в scripts/check-content.ts.
const micro = Object.values(LESSONS).filter((l) => l.micro);

describe("микроуроки курса 3.0", () => {
  it("на карте 12 микроуроков, все готовы", () => {
    const onMap = UNITS.flatMap((u) => u.lessons).filter((r) => LESSONS[r.id]?.micro);
    expect(onMap).toHaveLength(12);
    expect(micro).toHaveLength(12);
  });

  for (const l of micro) {
    describe(l.id, () => {
      const questions = l.steps.filter(isQuestion);
      it("9–12 шагов, 4–6 заданий, 3–5 минут", () => {
        expect(l.steps.length).toBeGreaterThanOrEqual(9);
        expect(l.steps.length).toBeLessThanOrEqual(12);
        expect(questions.length).toBeGreaterThanOrEqual(4);
        expect(questions.length).toBeLessThanOrEqual(6);
        expect(l.durationMin).toBeGreaterThanOrEqual(3);
        expect(l.durationMin).toBeLessThanOrEqual(5);
      });
      it("есть задание в формате ЕНТ, у навыка есть банк (общий с родительским уроком)", () => {
        expect(questions.some((q) => q.ent)).toBe(true);
        for (const s of l.skills) expect(bankFor(s), s).toBeTruthy();
      });
      it("стоит в одной группе с уроком того же навыка", () => {
        const group = Object.values(GROUPS_BY_UNIT)
          .flat()
          .find((g) => g.lessons.includes(l.id));
        expect(group).toBeTruthy();
        const parent = group!.lessons.find((id) => id !== l.id && !LESSONS[id]?.micro && LESSONS[id]?.skills.some((s) => l.skills.includes(s)));
        expect(parent, "родительский урок цепочки").toBeTruthy();
      });
    });
  }
});

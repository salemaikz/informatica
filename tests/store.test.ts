import { beforeEach, describe, expect, it } from "vitest";
import { useApp } from "@/lib/store";
import type { AnswerRecord, SessionResult } from "@/lib/types";

const rec = (over: Partial<AnswerRecord> = {}): AnswerRecord => ({
  stepId: "q1",
  skill: "ns.dec2bin",
  correct: false,
  score: 0,
  given: "1",
  expected: "2",
  prompt: "?",
  retry: false,
  timeMs: 1000,
  ...over,
});

describe("стор: работа над ошибками", () => {
  beforeEach(() => useApp.getState().resetProgress());

  it("повторная ошибка в том же задании не дублируется и сохраняет урок", () => {
    const s = useApp.getState();
    s.recordAnswer(rec(), 0, "ns-1-binary");
    s.recordAnswer(rec({ given: "3" }), 0, undefined); // повтор в тренировке — без lessonId
    const m = useApp.getState().mistakes;
    expect(m).toHaveLength(1);
    expect(m[0].lessonId).toBe("ns-1-binary");
    expect(m[0].given).toBe("3");
  });

  it("верный ответ закрывает ошибку; dismissMistake — по id задания", () => {
    const s = useApp.getState();
    s.recordAnswer(rec(), 0, "ns-1-binary");
    s.recordAnswer(rec({ stepId: "q2" }), 0, "ns-1-binary");
    s.recordAnswer(rec({ correct: true, score: 1 }), 10);
    expect(useApp.getState().mistakes.map((m) => m.stepId)).toEqual(["q2"]);
    useApp.getState().dismissMistake("q2");
    expect(useApp.getState().mistakes).toHaveLength(0);
  });

  it("пропущенное задание лишает бонуса «без ошибок»", () => {
    const base: SessionResult = {
      kind: "lesson",
      lessonId: "ns-1-binary",
      title: "t",
      answers: [rec({ correct: true, score: 1 })],
      xp: 10,
      maxCombo: 1,
      durationSec: 60,
      accuracy: 1,
    };
    expect(useApp.getState().finishSession(base).bonusXp).toBe(40);
    // Другой урок: повтор того же урока дал бы меньше XP (lib/review.ts).
    expect(useApp.getState().finishSession({ ...base, lessonId: "ns-2-read", skipped: 1 }).bonusXp).toBe(20);
  });

  it("refundAi возвращает обращение по квитанции", () => {
    const s = useApp.getState();
    s.spendAi("hint");
    const r = s.spendAi("hint");
    expect(r.ok).toBe(true);
    useApp.getState().refundAi(r);
    expect(useApp.getState().aiUsage.count).toBe(1);
    expect(useApp.getState().aiUsage.free).toBe(1);
  });
});

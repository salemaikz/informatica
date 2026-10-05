import { describe, expect, it } from "vitest";
import { isCourseNodeId, nextNodeStat, nodeDone, sanitizeCourseNodes } from "@/lib/course-nodes";

describe("узлы курса 3.0", () => {
  it("практика копит прохождения и лучшую точность, мини-тест — отдельно", () => {
    let s = nextNodeStat(undefined, "practice", 0.6, 100);
    s = nextNodeStat(s, "practice", 0.5, 200);
    expect(s).toMatchObject({ runs: 2, best: 0.6, at: 200 });
    s = nextNodeStat(s, "minitest", 0.75, 300);
    expect(s).toMatchObject({ runs: 2, best: 0.6, testRuns: 1, testBest: 0.75, testAt: 300 });
    expect(nodeDone(s)).toBe(true);
    expect(nodeDone(nextNodeStat(undefined, "minitest", 1, 1))).toBe(false);
  });

  it("id узлов и проверка сохранённого", () => {
    expect(isCourseNodeId("practice:py-2a-if")).toBe(true);
    expect(isCourseNodeId("recap:u3")).toBe(true);
    expect(isCourseNodeId("lesson:u3")).toBe(false);
    const clean = sanitizeCourseNodes({ "recap:u1": { runs: 2.7, best: 3, at: 5 }, "bad id": { runs: 1 }, "practice:x": null, "practice:y": { runs: -1, best: "a", at: 1, testRuns: 1, testBest: 0.5, testAt: 9 } });
    expect(clean).toEqual({ "recap:u1": { runs: 2, best: 1, at: 5 }, "practice:y": { runs: 0, best: 0, at: 1, testRuns: 1, testBest: 0.5, testAt: 9 } });
    expect(sanitizeCourseNodes([1, 2])).toEqual({});
  });
});

import { describe, expect, it } from "vitest";
import { MAX_PENDING_CASES, sanitizePendingCases, sanitizePerfectRun } from "@/lib/rewards-state";

describe("санитайзеры наград волны 1Б", () => {
  it("perfectRun: мусор → нули, best не меньше current", () => {
    expect(sanitizePerfectRun(undefined)).toEqual({ current: 0, best: 0 });
    expect(sanitizePerfectRun({ current: 3.7, best: 2 })).toEqual({ current: 3, best: 3 });
    expect(sanitizePerfectRun({ current: -1, best: "5" })).toEqual({ current: 0, best: 0 });
    expect(sanitizePerfectRun({ current: 2, best: 9 })).toEqual({ current: 2, best: 9 });
  });

  it("pendingCases: целые уровни ≥ 2 по возрастанию, без повторов, не больше лимита", () => {
    expect(sanitizePendingCases(null)).toEqual([]);
    expect(sanitizePendingCases([4, 2, 4, 1, 3.5, "7", 9])).toEqual([2, 4, 9]);
    expect(sanitizePendingCases(Array.from({ length: 12 }, (_, i) => i + 2))).toHaveLength(MAX_PENDING_CASES);
  });
});

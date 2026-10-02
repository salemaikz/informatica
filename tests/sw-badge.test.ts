import { describe, expect, it } from "vitest";
import { badgeCount } from "@/components/app/badge";

const DAY = 86_400_000;
const now = new Date(2026, 9, 2, 12).getTime();
const stat = (dueAt: number) => ({ completions: 1, lastAt: now - 3 * DAY, dueAt }) as never;

describe("badgeCount", () => {
  const safe = { current: 0, best: 0, lastDay: null, freezes: 0 } as never;
  it("ничего не пора повторять и серии нет — 0", () => {
    expect(badgeCount({}, safe, "2026-10-02", now)).toBe(0);
  });
  it("считает уроки «пора повторить»", () => {
    expect(badgeCount({ a: stat(now - 1), b: stat(now - DAY), c: stat(now + DAY) }, safe, "2026-10-02", now)).toBe(2);
  });
  it("непройденные уроки не считаются", () => {
    expect(badgeCount({ a: { completions: 0, lastAt: now - 3 * DAY, dueAt: now - DAY } as never }, safe, "2026-10-02", now)).toBe(0);
  });
  it("серия под угрозой — плюс один", () => {
    const risk = { current: 5, best: 5, lastDay: "2026-10-01", freezes: 0 } as never;
    expect(badgeCount({ a: stat(now - 1) }, risk, "2026-10-02", now)).toBe(2);
    const done = { current: 5, best: 5, lastDay: "2026-10-02", freezes: 0 } as never;
    expect(badgeCount({}, done, "2026-10-02", now)).toBe(0);
  });
});

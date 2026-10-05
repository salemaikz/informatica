import { describe, expect, it } from "vitest";
import { buildReviewDrill, parseReviewArea, REVIEW_AREAS, REVIEW_DRILL_COUNT, REVIEW_MIN_ITEMS, reviewCounts, reviewItems } from "@/lib/code-review-drill";
import { isReadItem, readKindOf } from "@/lib/code-read";
import { parseEntRef } from "@/lib/ent-steps";
import { parseDrillMode } from "@/lib/drill";
import type { EntItem, EntSingle, Level, ReadKind } from "@/lib/types";

// Тренировка «Чтение кода» (#87).

const w = (ru: string) => ({ ru, kk: ru });
const item = (id: string, level: Level, read: ReadKind): EntSingle => ({
  id,
  kind: "single",
  topic: "t06",
  skill: "py.vars",
  level,
  prompt: w("Вопрос"),
  scene: { kind: "code", lang: "python", lines: ["x = 1"] },
  options: ["1", "2", "3", "4"],
  correct: 0,
  explanation: w("Разбор"),
  read,
});

describe("области и режим", () => {
  it("режим codeview распознаётся, область — только из списка", () => {
    expect(parseDrillMode("codeview")).toBe("codeview");
    expect(parseReviewArea("py")).toBe("py");
    expect(parseReviewArea("t06")).toBeNull();
    expect(parseReviewArea(undefined)).toBeNull();
  });
  it("в каждой области банка есть задания «на чтение», и все они — «на чтение»", () => {
    for (const a of REVIEW_AREAS) {
      const items = reviewItems(a.id);
      expect(items.length, a.id).toBeGreaterThanOrEqual(REVIEW_MIN_ITEMS);
      expect(items.every((i) => isReadItem(i) && a.topics.includes(i.topic))).toBe(true);
      expect(reviewCounts(a.id).total).toBe(items.length);
    }
  });
});

describe("buildReviewDrill", () => {
  it("10 заданий, уровни не убывают, без повторов, детерминированно по seed", () => {
    const a = buildReviewDrill("py", 42);
    const b = buildReviewDrill("py", 42);
    expect(a.length).toBe(REVIEW_DRILL_COUNT);
    expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id));
    expect(new Set(a.map((s) => s.id)).size).toBe(a.length);
    const levels = a.map((s) => s.level ?? 1);
    expect([...levels].sort()).toEqual(levels);
    for (const s of a) expect(parseEntRef(s.id)?.item).toBeTruthy();
  });

  it("виды «чтения» чередуются: «что выведет» не вытесняет ошибки и правки", () => {
    const pool: EntItem[] = [];
    for (const lv of [1, 2, 3] as Level[]) {
      for (let i = 0; i < 10; i++) pool.push(item(`p:out-${lv}-${i}`, lv, "output"));
      for (const k of ["bug", "fix", "fill"] as ReadKind[]) for (let i = 0; i < 2; i++) pool.push(item(`p:${k}-${lv}-${i}`, lv, k));
    }
    const steps = buildReviewDrill("py", 7, pool);
    const kinds = steps.map((s) => readKindOf(parseEntRef(s.id, pool)!.item));
    expect(steps.length).toBe(10);
    expect(kinds.filter((k) => k === "output").length).toBeLessThanOrEqual(3);
    for (const k of ["bug", "fix", "fill"]) expect(kinds.filter((x) => x === k).length, k).toBeGreaterThanOrEqual(2);
  });

  it("мало заданий — пустая тренировка", () => {
    expect(buildReviewDrill("py", 1, [item("p:a", 1, "bug")])).toEqual([]);
  });
});

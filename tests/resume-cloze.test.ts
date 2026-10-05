import { describe, expect, it } from "vitest";
import { clozeBank } from "@/lib/cloze-bank";
import { resumeTarget, RUN_TTL_MS, type LessonRun } from "@/lib/lesson-run";
import type { ClozeStep } from "@/lib/types";

const NOW = 1_800_000_000_000;
const run = (lessonId: string, o: Partial<LessonRun> = {}): LessonRun => ({
  lessonId,
  sig: "s",
  queue: [
    { id: "a", retry: false },
    { id: "b", retry: false },
    { id: "c", retry: false },
  ],
  pos: 1,
  done: 1,
  records: [],
  xp: 0,
  combo: 0,
  maxCombo: 0,
  skipped: 0,
  activeMs: 0,
  xpFactor: 1,
  chipsEarned: 0,
  cost: 1,
  startedAt: NOW - 1000,
  updatedAt: NOW - 500,
  paidAt: NOW - 900,
  ...o,
});

describe("resumeTarget", () => {
  it("берёт самый свежий", () => {
    const r = resumeTarget({ x: run("x", { updatedAt: NOW - 5000 }), y: run("y", { updatedAt: NOW - 100, pos: 2 }) }, NOW);
    expect(r).toEqual({ lessonId: "y", step: 3, total: 3 });
  });
  it("пропускает просроченные, пустые и законченные", () => {
    expect(resumeTarget({ x: run("x", { updatedAt: NOW - RUN_TTL_MS - 1 }) }, NOW)).toBeNull();
    expect(resumeTarget({ x: run("x", { pos: 0, paidAt: null }) }, NOW)).toBeNull();
    expect(resumeTarget({ x: run("x", { pos: 3 }) }, NOW)).toBeNull();
    expect(resumeTarget({}, NOW)).toBeNull();
  });
  it("фильтр трека", () => {
    const runs = { x: run("x", { updatedAt: NOW - 10 }), y: run("y", { updatedAt: NOW - 900 }) };
    expect(resumeTarget(runs, NOW, (id) => id === "y")?.lessonId).toBe("y");
    expect(resumeTarget(runs, NOW, () => false)).toBeNull();
  });
  it("урок, засчитанный после сохранения, не предлагается", () => {
    const runs = { x: run("x", { updatedAt: NOW - 500 }) };
    expect(resumeTarget(runs, NOW, undefined, { x: { firstAt: NOW - 100 } })).toBeNull();
    expect(resumeTarget(runs, NOW, undefined, { x: { firstAt: NOW - 9000 } })?.lessonId).toBe("x");
  });
});

describe("clozeBank", () => {
  const step = {
    id: "c1",
    type: "cloze",
    skill: "x",
    level: "A",
    prompt: { ru: "p", kk: "p" },
    explanation: { ru: "e", kk: "e" },
    lines: [
      ["Клавиатура — ", { blank: ["ввода"], mode: "text", label: { ru: "ввода", kk: "енгізу" } }],
      ["Монитор — ", { blank: ["вывода"], mode: "text", label: { ru: "вывода", kk: "шығару" } }],
      ["Мышь — ", { blank: ["ввода"], mode: "text", label: { ru: "Ввода", kk: "енгізу" } }],
      ["2 + 2 = ", { blank: ["4"], mode: "number" }],
    ],
    bank: [
      { ru: "памяти", kk: "жады" },
      { ru: "вывода", kk: "шығару" },
    ],
  } as unknown as ClozeStep;

  it("без повторов: верные слова и отвлекатели", () => {
    expect([...clozeBank(step, "ru")].sort()).toEqual(["ввода", "вывода", "памяти"]);
    expect([...clozeBank(step, "kk")].sort()).toEqual(["енгізу", "жады", "шығару"]);
  });
  it("повторы с лишними пробелами и точкой — одна плашка", () => {
    const dup = { ...step, bank: [{ ru: "ввода.", kk: "енгізу" }, { ru: "в вода", kk: "жады" }] } as unknown as ClozeStep;
    expect(clozeBank(dup, "ru").filter((w) => w.replace(/[\s.]/g, "") === "ввода")).toHaveLength(1);
  });
  it("детерминирован", () => {
    expect(clozeBank(step, "kk")).toEqual(clozeBank(step, "kk"));
  });
  it("без текстовых label — пусто", () => {
    const num = { ...step, lines: [["2 = ", { blank: ["2"], mode: "number" }]] } as unknown as ClozeStep;
    expect(clozeBank(num, "ru")).toEqual([]);
  });
});

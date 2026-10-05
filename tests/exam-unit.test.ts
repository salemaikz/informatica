import { describe, expect, it } from "vitest";
import { LESSONS, UNITS } from "@/content/course";
import { ENT_POOL } from "@/content/ent";
import { SKILLS } from "@/content/skills";
import { checkpointById, checkpointOf, examTitle } from "@/components/exam/checkpoint";
import { EXAM_FORMAT, examLink, historyPoints, parseRunParams } from "@/components/exam/logic";
import { checkpointSkillIds, readyLessonCount } from "@/components/learn/map";
import {
  bestUnitResult,
  buildExam,
  hasUnitExam,
  scoreExam,
  starsFor,
  unitPaperSize,
  EXAM_TIME_LIMIT_SEC,
  type ExamPaper,
} from "@/lib/exam";
import { buildSummary, sanitizePaper, sanitizeState, type ExamAttempt } from "@/lib/exam-store";
import type { EntContext, EntItem, EntMatch, EntMulti, EntSingle, Level, Unit } from "@/lib/types";

const L = (s: string) => ({ ru: s, kk: s });
const SKILL_A = "ns.base";
const SKILL_B = "ns.convert";
const SKILL_C = "ns.hex";
const OWN = [SKILL_A, SKILL_B, SKILL_C];

function single(id: string, skill: string, level: Level): EntSingle {
  return { id, kind: "single", topic: "t04", skill, level, prompt: L(id), explanation: L("e"), options: ["a", "b", "c", "d"], correct: 2 };
}
function multi(id: string, skill: string, level: Level): EntMulti {
  return { id, kind: "multi", topic: "t04", skill, level, prompt: L(id), explanation: L("e"), options: ["a", "b", "c", "d", "e", "f"], correct: [1, 4] };
}
function match(id: string, skill: string, level: Level): EntMatch {
  return { id, kind: "match", topic: "t04", skill, level, prompt: L(id), explanation: L("e"), items: ["A", "B"], choices: ["w", "x", "y", "z"], answer: [3, 0] };
}
function context(id: string, skill: string): EntContext {
  return {
    id, kind: "context", topic: "t06", skill, level: 2, text: L("prog"),
    questions: [0, 1, 2, 3, 4].map((i) => ({ id: `${id}.${i}`, prompt: L("q"), options: ["a", "b", "c", "d"], correct: i % 4, explanation: L("e") })),
  };
}

/** По 3 навыка раздела: на каждый 6 single (уровни 1,2,3,1,2,3), 2 multi, 2 match, плюс чужой навык и контекстное. */
function pool(opts: { ctx?: boolean; multi?: boolean; match?: boolean } = {}): EntItem[] {
  const { ctx = true, multi: withMulti = true, match: withMatch = true } = opts;
  const out: EntItem[] = [];
  for (const sk of OWN) {
    for (let i = 0; i < 6; i++) out.push(single(`${sk}:s${i}`, sk, ((i % 3) + 1) as Level));
    if (withMulti) for (let i = 0; i < 2; i++) out.push(multi(`${sk}:m${i}`, sk, ((i % 3) + 1) as Level));
    if (withMatch) for (let i = 0; i < 2; i++) out.push(match(`${sk}:x${i}`, sk, ((i % 3) + 1) as Level));
  }
  for (let i = 0; i < 20; i++) out.push(single(`other:s${i}`, "other.skill", 1), multi(`other:m${i}`, "other.skill", 1));
  if (ctx) out.push(context("ctx-own", SKILL_A), context("ctx-other", "other.skill"));
  return out;
}

const unitPaper = (seed: number, p: EntItem[] = pool()): ExamPaper => buildExam({ kind: "unit", seed, pool: p, skillIds: OWN });
const kinds = (p: ExamPaper) => {
  const c = { single: 0, multi: 0, match: 0, context: 0 };
  for (const q of p.items) c[q.item.kind]++;
  return c;
};

describe("buildExam: контрольная по разделу", () => {
  it("15 заданий: 10 single, 1 вопрос контекста, 2 multi, 2 match; 25 минут", () => {
    const p = unitPaper(1);
    expect(p.kind).toBe("unit");
    expect(p.items).toHaveLength(15);
    expect(kinds(p)).toEqual({ single: 10, multi: 2, match: 2, context: 1 });
    expect(p.maxPoints).toBe(10 + 4 + 4 + 1);
    expect(p.timeLimitSec).toBe(25 * 60);
    expect(p.timeLimitSec).toBe(EXAM_TIME_LIMIT_SEC.unit);
    expect(p.notes).toEqual([]);
    expect(EXAM_FORMAT.unit).toEqual({ questions: 15, minutes: 25, points: 19 });
  });

  it("порядок как в ЕНТ: single → контекст → multi → match", () => {
    const order = unitPaper(3).items.map((q) => q.item.kind);
    const firstNonSingle = order.findIndex((k) => k !== "single");
    expect(order.slice(0, firstNonSingle).every((k) => k === "single")).toBe(true);
    expect(order[10]).toBe("context");
    expect(order.slice(11, 13)).toEqual(["multi", "multi"]);
    expect(order.slice(13)).toEqual(["match", "match"]);
  });

  it("только навыки раздела; контекстное — со своим навыком; sub указывает на существующий вопрос", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const p = unitPaper(seed);
      expect(p.items.every((q) => OWN.includes(q.item.skill))).toBe(true);
      const ctx = p.items.find((q) => q.item.kind === "context")!;
      expect(ctx.item.id).toBe("ctx-own");
      expect(ctx.key).toBe(`ctx-own#${ctx.sub}`);
      expect(ctx.sub).toBeGreaterThanOrEqual(0);
      expect(ctx.sub!).toBeLessThan(5);
      expect(ctx.item.kind === "context" && ctx.item.questions).toHaveLength(5);
    }
  });

  it("без повторов", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const p = unitPaper(seed);
      expect(new Set(p.items.map((q) => q.key)).size).toBe(p.items.length);
      expect(new Set(p.items.map((q) => q.item.id)).size).toBe(p.items.length);
    }
  });

  it("детерминированно по seed и не зависит от порядка заданий в банке", () => {
    const a = unitPaper(42);
    const b = unitPaper(42);
    const rev = unitPaper(42, [...pool()].reverse());
    expect(b).toEqual(a);
    expect(rev.items.map((q) => q.key)).toEqual(a.items.map((q) => q.key));
    const keys = new Set(Array.from({ length: 10 }, (_, i) => unitPaper(i + 1).items.map((q) => q.key).join()));
    expect(keys.size).toBeGreaterThan(5);
  });

  it("уровни single ≈ 50/30/20", () => {
    const total = { 1: 0, 2: 0, 3: 0 };
    for (let seed = 1; seed <= 30; seed++) {
      for (const q of unitPaper(seed).items) if (q.item.kind === "single") total[q.item.level]++;
    }
    const sum = total[1] + total[2] + total[3];
    expect(sum).toBe(300);
    // 5/3/2 из 10: средние доли близки (в пуле всех уровней достаточно).
    expect(total[1] / sum).toBeGreaterThan(0.4);
    expect(total[1] / sum).toBeLessThan(0.6);
    expect(total[3] / sum).toBeGreaterThan(0.1);
    expect(total[3] / sum).toBeLessThan(0.3);
  });

  it("навыки раздела представлены равномерно", () => {
    const p = unitPaper(5);
    const count = (sk: string) => p.items.filter((q) => q.item.skill === sk && q.item.kind === "single").length;
    // 10 single на 3 навыка: 3–4 на каждый.
    for (const sk of OWN) expect(count(sk)).toBeGreaterThanOrEqual(3);
  });

  it("нет контекстных — вместо него ещё один single", () => {
    const p = unitPaper(1, pool({ ctx: false }));
    expect(p.items).toHaveLength(15);
    expect(kinds(p)).toEqual({ single: 11, multi: 2, match: 2, context: 0 });
    expect(p.notes).toEqual([]);
  });

  it("контекстное только чужого навыка — не берётся", () => {
    const p = unitPaper(1, [...pool({ ctx: false }), context("ctx-other", "other.skill")]);
    expect(kinds(p).context).toBe(0);
  });

  it("не хватило вида — заменили другим, вариант той же длины, запись в notes", () => {
    const p = unitPaper(1, pool({ match: false }));
    expect(p.items).toHaveLength(15);
    expect(kinds(p).match).toBe(0);
    expect(kinds(p).single).toBe(12);
    expect(p.notes).toEqual([{ topic: null, kind: "match", missing: 2, filledFrom: [], unfilled: 0 }]);
  });

  it("мало заданий — вариант короче, запись о недоборе", () => {
    const few: EntItem[] = Array.from({ length: 8 }, (_, i) => single(`f:${i}`, SKILL_A, 1));
    const p = unitPaper(1, few);
    expect(p.items).toHaveLength(8);
    expect(p.notes.reduce((s, n) => s + n.unfilled, 0)).toBe(15 - 8);
  });

  it("пустой раздел — пустой вариант без падения", () => {
    expect(buildExam({ kind: "unit", seed: 1, pool: pool(), skillIds: [] }).items).toEqual([]);
    expect(buildExam({ kind: "unit", seed: 1, pool: pool() }).items).toEqual([]);
  });

  it("баллы считаются как у обычного ЕНТ", () => {
    const p = unitPaper(9);
    const answers: Record<string, { choice?: number; multi?: number[]; match?: number[]; timeMs: number }> = {};
    for (const q of p.items) {
      const it = q.item;
      if (it.kind === "single") answers[q.key] = { choice: it.correct, timeMs: 1000 };
      else if (it.kind === "multi") answers[q.key] = { multi: it.correct, timeMs: 1000 };
      else if (it.kind === "match") answers[q.key] = { match: it.answer, timeMs: 1000 };
      else answers[q.key] = { choice: it.questions[q.sub!].correct, timeMs: 1000 };
    }
    const r = scoreExam(p, answers);
    expect(r.points).toBe(19);
    expect(r.percent).toBe(100);
  });
});

describe("контрольная: есть ли она у раздела", () => {
  const some = (n: number): EntItem[] => Array.from({ length: n }, (_, i) => single(`n:${i}`, SKILL_A, 1));

  it("меньше 10 заданий — нет, 10 — есть", () => {
    expect(unitPaperSize(some(9), OWN)).toBe(9);
    expect(hasUnitExam(some(9), OWN)).toBe(false);
    expect(hasUnitExam(some(10), OWN)).toBe(true);
  });

  it("контекстное задание даёт один вопрос, не пять", () => {
    expect(unitPaperSize([...some(9), context("c", SKILL_A)], OWN)).toBe(10);
    expect(hasUnitExam([...some(8), context("c", SKILL_A)], OWN)).toBe(false);
  });

  it("не больше 15; чужие навыки не считаются", () => {
    expect(unitPaperSize(some(40), OWN)).toBe(15);
    expect(unitPaperSize(some(40), ["other.skill"])).toBe(0);
    expect(unitPaperSize(some(40), undefined)).toBe(0);
  });
});

describe("звёзды", () => {
  it("≥ 50% — 1, ≥ 70% — 2, ≥ 90% — 3", () => {
    expect(starsFor(0, 19)).toBe(0);
    expect(starsFor(9, 19)).toBe(0); // 47%
    expect(starsFor(10, 20)).toBe(1); // ровно 50%
    expect(starsFor(13, 20)).toBe(1);
    expect(starsFor(14, 20)).toBe(2); // ровно 70%
    expect(starsFor(17, 19)).toBe(2); // 89%
    expect(starsFor(18, 20)).toBe(3); // ровно 90%
    expect(starsFor(19, 19)).toBe(3);
  });

  it("мусор — ноль звёзд", () => {
    expect(starsFor(NaN, 10)).toBe(0);
    expect(starsFor(5, 0)).toBe(0);
    expect(starsFor(5, Infinity)).toBe(0);
  });

  const ex = (unit: unknown, points: unknown, maxPoints: unknown, kind = "unit") => ({ kind, unit, points, maxPoints });

  it("bestUnitResult: лучший по доле среди контрольных этого раздела", () => {
    const exams = [ex("u1", 10, 19), ex("u1", 17, 19), ex("u1", 12, 19), ex("u2", 19, 19), ex(undefined, 19, 19), ex("u1", 50, 50, "full")];
    expect(bestUnitResult(exams, "u1")).toEqual({ points: 17, max: 19, stars: 2 });
    expect(bestUnitResult(exams, "u2")).toEqual({ points: 19, max: 19, stars: 3 });
    expect(bestUnitResult(exams, "u3")).toBeNull();
    expect(bestUnitResult([], "u1")).toBeNull();
  });

  it("bestUnitResult: недоверенные данные не ломают", () => {
    const exams = [ex("u1", "x", 10), ex("u1", 5, 0), ex("u1", NaN, 10), ex("u1", 5, -3), null as never, ex("u1", 99, 20), ex("u1", -4, 20)];
    expect(bestUnitResult(exams, "u1")).toEqual({ points: 20, max: 20, stars: 3 }); // 99 → не больше максимума
  });

  it("bestUnitResult: при равной доле — где заданий больше", () => {
    expect(bestUnitResult([ex("u1", 10, 20), ex("u1", 5, 10)], "u1")?.max).toBe(20);
  });
});

describe("ссылка и адрес", () => {
  it("examLink для unit содержит раздел", () => {
    expect(examLink("unit", 7, [], "u3")).toBe("/exam/run?kind=unit&seed=7&unit=u3");
    expect(examLink("mini", 7, [], "u3")).toBe("/exam/run?kind=mini&seed=7");
  });

  it("parseRunParams: unit нужен раздел", () => {
    expect(parseRunParams({ kind: "unit", seed: "5", unit: "u3" })).toEqual({ kind: "unit", seed: 5, topics: [], unit: "u3" });
    expect(parseRunParams({ kind: "unit", seed: "5" })).toBeNull();
    expect(parseRunParams({ kind: "unit", seed: "5", unit: "../x" })).toBeNull();
    expect(parseRunParams({ kind: "mini", seed: "5", unit: "u3" })?.unit).toBeUndefined();
  });

  it("контрольные не попадают в график пробников", () => {
    const base = { id: "a", seed: 1, at: 1, points: 5, maxPoints: 10, durationSec: 1, byTopic: {} };
    const pts = historyPoints([{ ...base, kind: "unit", unit: "u1" }, { ...base, id: "b", kind: "mini" }]);
    expect(pts.map((p) => p.id)).toEqual(["b"]);
  });
});

describe("хранение попытки-контрольной", () => {
  const paper = unitPaper(11);
  const attempt: ExamAttempt = {
    id: "ex-abc", kind: "unit", seed: 11, unit: "u3", paper, answers: {}, current: 0, startedAt: 1, elapsedMs: 61_000, finishedAt: 2,
  };

  it("итог несёт раздел и название для истории", () => {
    const s = buildSummary(attempt, 99, "Контрольная: Раздел");
    expect(s).toMatchObject({ kind: "unit", unit: "u3", title: "Контрольная: Раздел", at: 99, maxPoints: 19 });
    // у других видов раздела и названия нет
    const other = buildSummary({ ...attempt, kind: "mini", unit: undefined }, 99, "x");
    expect(other.unit).toBeUndefined();
    expect(other.title).toBeUndefined();
  });

  it("бумага проходит проверку целиком (контекстный вопрос — с исходным номером)", () => {
    const back = sanitizePaper(JSON.parse(JSON.stringify(paper)));
    expect(back?.kind).toBe("unit");
    expect(back?.items).toHaveLength(15);
    expect(back?.timeLimitSec).toBe(25 * 60);
  });

  it("состояние: раздел сохраняется только у контрольной и только корректный", () => {
    const { paper: _p, ...state } = attempt;
    void _p;
    expect(sanitizeState(state, paper)?.unit).toBe("u3");
    expect(sanitizeState({ ...state, unit: "<script>" }, paper)?.unit).toBeUndefined();
    expect(sanitizeState({ ...state, unit: 5 }, paper)?.unit).toBeUndefined();
  });
});

describe("карта курса: контрольные реальных разделов", () => {
  const fakeUnit = (ids: string[], status: "available" | "soon"): Unit => ({
    id: "ux", title: L("x"), description: L("x"), color: "#000", entTopics: ["t04"],
    lessons: ids.map((id) => ({ id, title: L(id), status })),
  });

  it("раздел без готовых уроков — навыков и контрольной нет, даже если у темы есть навыки", () => {
    const unit = fakeUnit(["nope-1", "nope-2"], "soon");
    expect(readyLessonCount(unit, LESSONS)).toBe(0);
    expect(checkpointSkillIds(unit, LESSONS, SKILLS)).toEqual([]);
    expect(checkpointOf(unit, LESSONS, SKILLS)).toBeNull();
  });

  it("статус «доступен» без урока в курсе не считается готовым", () => {
    expect(readyLessonCount(fakeUnit(["nope-1"], "available"), LESSONS)).toBe(0);
  });

  it("у каждого раздела с контрольной: размер 10–15, вариант собирается из навыков раздела", () => {
    for (const unit of UNITS) {
      const cp = checkpointOf(unit, LESSONS, SKILLS);
      if (!cp) continue;
      expect(cp.size).toBeGreaterThanOrEqual(10);
      expect(cp.size).toBeLessThanOrEqual(15);
      const p = buildExam({ kind: "unit", seed: 3, pool: ENT_POOL, skillIds: cp.skillIds });
      expect(p.items).toHaveLength(cp.size);
      expect(p.items.every((q) => cp.skillIds.includes(q.item.skill))).toBe(true);
      expect(new Set(p.items.map((q) => q.key)).size).toBe(p.items.length);
      expect(buildExam({ kind: "unit", seed: 3, pool: ENT_POOL, skillIds: cp.skillIds })).toEqual(p);
    }
  });

  it("checkpointById: запуск по ссылке — только раздел с контрольной", () => {
    expect(checkpointById(undefined)).toBeNull();
    expect(checkpointById("nope")).toBeNull();
    for (const unit of UNITS) expect(checkpointById(unit.id)).toEqual(checkpointOf(unit, LESSONS, SKILLS));
  });

  it("examTitle: у контрольной — название раздела, у остальных и неизвестного раздела — вид теста", () => {
    const t = (key: string, p?: Record<string, string | number>) => (p ? `${key}:${p.unit}` : key);
    const l = (x: unknown) => (typeof x === "string" ? x : (x as { ru: string }).ru);
    const u = UNITS[1];
    expect(examTitle("unit", u.id, t, l)).toBe(`exam.unit.title:${u.title.ru}`);
    expect(examTitle("unit", "nope", t, l)).toBe("exam.mode.unit");
    expect(examTitle("mini", u.id, t, l)).toBe("exam.mode.mini");
  });
});

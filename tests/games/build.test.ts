import { describe, expect, it } from "vitest";
import { LESSONS } from "@/content/course";
import { evaluate } from "@/lib/evaluate";
import {
  BLITZ_MS,
  DEFAULT_SKILLS,
  MAX_STEPS,
  MIN_STEPS,
  POINTS_PER_STEP,
  ROUNDS,
  STREAK_BONUS,
  STREAK_CAP,
  applyResult,
  buildRound,
  collectWorked,
  initialState,
  resolveSkills,
  roundCount,
  taskBudgetMs,
  toResult,
  toTask,
} from "@/games/build/logic";
import { S } from "@/games/build/strings";
import { gameById } from "@/games/registry";
import { gameSkillsFor, resolveGameContext } from "@/lib/drill";

const allSkills = [...new Set(Object.values(LESSONS).flatMap((l) => l.skills))];

describe("build: разборы", () => {
  it("по умолчанию есть разборы", () => {
    expect(collectWorked(DEFAULT_SKILLS).length).toBeGreaterThan(0);
  });
  it("только 3–7 шагов, навык определён, ключи уникальны", () => {
    const refs = collectWorked(allSkills);
    expect(refs.length).toBeGreaterThan(5);
    for (const r of refs) {
      expect(r.steps.length).toBeGreaterThanOrEqual(MIN_STEPS);
      expect(r.steps.length).toBeLessThanOrEqual(MAX_STEPS);
      expect(r.skill).toBeTruthy();
    }
    expect(new Set(refs.map((r) => r.key)).size).toBe(refs.length);
  });
  it("нет навыков без разборов — пусто", () => {
    expect(collectWorked(["no.such.skill"])).toEqual([]);
    expect(buildRound(["no.such.skill"], "calm", 1)).toEqual([]);
  });
  it("resolveSkills: пусто → по умолчанию", () => {
    expect(resolveSkills()).toEqual(DEFAULT_SKILLS);
    expect(resolveSkills([])).toEqual(DEFAULT_SKILLS);
    expect(resolveSkills(["a"])).toEqual(["a"]);
  });
});

describe("build: подключение к оболочке", () => {
  it("тема из адреса или урока доходит до игры, и по ней есть разборы", () => {
    const meta = gameById("build")!;
    for (const q of [{ skills: "py.loops,py.trace" }, { skills: "db.select" }, { skills: "logic.ops" }, { lesson: Object.keys(LESSONS)[0] }]) {
      const play = gameSkillsFor(meta, resolveGameContext(q).skills);
      expect(play.length).toBeGreaterThan(0);
      expect(buildRound(play, "calm", 1).length).toBeGreaterThan(0);
    }
  });
});

describe("build: раунд", () => {
  it("детерминирован по seed, без повторов, нужной длины", () => {
    const a = buildRound(allSkills, "calm", 7).map((t) => t.step.id);
    expect(buildRound(allSkills, "calm", 7).map((t) => t.step.id)).toEqual(a);
    expect(a).toHaveLength(ROUNDS.calm);
    expect(new Set(a).size).toBe(a.length);
    expect(buildRound(allSkills, "normal", 7)).toHaveLength(ROUNDS.normal);
    expect(buildRound(allSkills, "calm", 8).map((t) => t.step.id)).not.toEqual(a);
  });
  it("мало разборов — сколько есть; блиц — все", () => {
    const few = buildRound(DEFAULT_SKILLS, "calm", 3);
    expect(few.length).toBeLessThanOrEqual(ROUNDS.calm);
    expect(buildRound(allSkills, "blitz", 3)).toHaveLength(collectWorked(allSkills).length);
    expect(roundCount("blitz")).toBeNull();
  });
  it("задание: порядок верный, проверка evaluate на обоих языках", () => {
    for (const t of buildRound(allSkills, "blitz", 1)) {
      const n = t.step.items.length;
      const right = { type: "order" as const, order: Array.from({ length: n }, (_, i) => i) };
      const bad = { type: "order" as const, order: [...right.order].reverse() };
      for (const lang of ["ru", "kk"] as const) {
        expect(evaluate(t.step, right, lang).correct).toBe(true);
        expect(evaluate(t.step, bad, lang).correct).toBe(false);
      }
      expect(t.step.skill).toBeTruthy();
      for (const it of t.step.items) expect(it.ru && it.kk).toBeTruthy();
    }
  });
  it("шаги разбора различимы (проверка — по индексам, одинаковые карточки дали бы ложную ошибку)", () => {
    for (const t of buildRound(allSkills, "blitz", 2))
      for (const lang of ["ru", "kk"] as const) expect(new Set(t.step.items.map((i) => i[lang].trim())).size).toBe(t.step.items.length);
  });
  it("перемешивание карточек своё в каждой игре: seed входит в id шага", () => {
    const a = buildRound(allSkills, "blitz", 5).map((t) => t.step.id).sort();
    const b = buildRound(allSkills, "blitz", 6).map((t) => t.step.id).sort();
    expect(a).not.toEqual(b);
  });
  it("toTask убирает разметку из шагов", () => {
    const ref = { key: "x:y", lessonId: "x", title: { ru: "**А**", kk: "**Ә**" }, steps: [{ ru: "`1`", kk: "`1`" }, { ru: "==2==", kk: "==2==" }, { ru: "3", kk: "3" }], skill: "s" };
    const t = toTask(ref);
    expect(t.title.ru).toBe("А");
    expect(t.step.items.map((i) => i.ru)).toEqual(["1", "2", "3"]);
  });
});

describe("build: очки и время", () => {
  const task = toTask({ key: "k", lessonId: "l", title: { ru: "т", kk: "т" }, steps: [{ ru: "1", kk: "1" }, { ru: "2", kk: "2" }, { ru: "3", kk: "3" }, { ru: "4", kk: "4" }], skill: "sk" });
  it("верно: шаги × 10, серия растёт и ограничена", () => {
    let s = initialState();
    const gains: number[] = [];
    for (let i = 0; i < 7; i++) {
      const o = applyResult(s, task, true);
      gains.push(o.gained);
      s = o.state;
    }
    expect(gains[0]).toBe(4 * POINTS_PER_STEP);
    expect(gains[1]).toBe(4 * POINTS_PER_STEP + STREAK_BONUS);
    expect(gains[6]).toBe(4 * POINTS_PER_STEP + STREAK_CAP * STREAK_BONUS);
    expect(s.streak).toBe(7);
  });
  it("ошибка: 0 очков, серия сбрасывается, попытка записана", () => {
    const s1 = applyResult(initialState(), task, true).state;
    const o = applyResult(s1, task, false);
    expect(o.gained).toBe(0);
    expect(o.state.streak).toBe(0);
    expect(o.state.score).toBe(s1.score);
    expect(toResult(o.state)).toEqual({ score: s1.score, correct: 1, total: 2, attempts: [{ skill: "sk", correct: true }, { skill: "sk", correct: false }] });
  });
  it("время: 20 с на шаг только в normal", () => {
    expect(taskBudgetMs("normal", 5)).toBe(100_000);
    expect(taskBudgetMs("calm", 5)).toBeNull();
    expect(taskBudgetMs("blitz", 5)).toBeNull();
    expect(BLITZ_MS).toBe(180_000);
  });
});

describe("build: строки", () => {
  it("все двуязычные", () => {
    for (const v of Object.values(S)) expect(v.ru && v.kk).toBeTruthy();
  });
});

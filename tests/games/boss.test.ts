import { describe, expect, it } from "vitest";
import { ENT_TOPICS } from "@/content/ent-topics";
import { evaluate, expectedText } from "@/lib/evaluate";
import type { QuestionStep } from "@/lib/types";
import { BIG_HP, BOSS_HP, DAMAGE, HEAL, MAX_TURNS, applyAnswer, damageFor, drawNext, initialState, isDefeated, outOfTurns, pickTurnTask, pickWeakSkills, resolveSkills, taskBudgetMs, toResult, turnLevel, weekNumber, weekOfYear, whyWrongOf, winBonus } from "@/games/boss/logic";
import { BIG_BOSS_NAME, BOSS_NAMES, S } from "@/games/boss/strings";

const stat = (mastery: number, attempts = 5) => ({ attempts, correct: 0, mastery, lastSeen: 0 });
const step = (level: 1 | 2 | 3): QuestionStep => ({ id: "x", type: "choice", level, skill: "ns.base", prompt: { ru: "", kk: "" }, options: [], correct: 0, explanation: { ru: "", kk: "" } }) as unknown as QuestionStep;

describe("босс: сборка", () => {
  it("берёт слабейшие навыки по освоению", () => {
    const skills = ["a", "b", "c", "d"];
    const picked = pickWeakSkills(skills, { a: stat(0.9), b: stat(0.2), c: stat(0.5), d: stat(0.7) }, 1);
    expect(picked).toEqual(["b", "c", "d"]);
  });
  it("без данных — случайные, детерминированно по seed, без повторов", () => {
    const skills = ["a", "b", "c", "d", "e"];
    const p1 = pickWeakSkills(skills, {}, 7);
    expect(p1).toEqual(pickWeakSkills(skills, {}, 7));
    expect(new Set(p1).size).toBe(3);
  });
  it("дополняет навыками без данных; мало навыков — сколько есть", () => {
    expect(pickWeakSkills(["a", "b", "c"], { b: stat(0.1) }, 3)[0]).toBe("b");
    expect(pickWeakSkills(["a"], {}, 1)).toEqual(["a"]);
  });
  it("имена босса есть для всех 13 тем, ru и kk", () => {
    for (const t of ENT_TOPICS) {
      expect(BOSS_NAMES[t.id].ru.length).toBeGreaterThan(2);
      expect(BOSS_NAMES[t.id].kk.length).toBeGreaterThan(2);
    }
    expect(BIG_BOSS_NAME.kk).toBeTruthy();
  });
  it("неделя одна у всех в пределах недели (пн 00:00 по времени Казахстана, UTC+5)", () => {
    // пн 05.10.2026 00:00 (UTC+5) = вс 04.10 19:00 UTC
    expect(weekNumber(new Date("2026-10-04T19:00:00Z"))).toBe(weekNumber(new Date("2026-10-11T18:59:00Z")));
    expect(weekNumber(new Date("2026-10-11T19:00:00Z"))).toBe(weekNumber(new Date("2026-10-04T19:00:00Z")) + 1);
    expect(weekNumber(new Date("2026-10-04T18:59:00Z"))).toBe(weekNumber(new Date("2026-10-04T19:00:00Z")) - 1);
  });
  it("номер недели в году для показа — ISO 8601", () => {
    expect(weekOfYear(new Date("2026-10-05T12:00:00Z"))).toBe(41);
    expect(weekOfYear(new Date("2026-01-01T12:00:00Z"))).toBe(1);
    expect(weekOfYear(new Date("2027-01-01T12:00:00Z"))).toBe(53);
    expect(weekOfYear(new Date("2026-12-31T20:00:00Z"))).toBe(53); // уже 1 января 2027 по UTC+5
  });
  it("недоверенные данные: битое освоение — как «нет данных», повторы навыков убираются", () => {
    const picked = pickWeakSkills(["a", "b", "c"], { a: { attempts: 3, correct: 0, mastery: Number.NaN, lastSeen: 0 }, b: stat(0.4), c: { attempts: "x", mastery: 0.1 } as never }, 2);
    expect(picked[0]).toBe("b");
    expect(new Set(picked).size).toBe(3);
    expect(resolveSkills(["ns.base", "ns.base", "ns.dec2bin"])).toEqual(["ns.base", "ns.dec2bin"]);
  });
});

describe("босс: бой", () => {
  it("урон по уровню A/B/C", () => {
    expect([damageFor(1), damageFor(2), damageFor(3)]).toEqual([20, 30, 40]);
    expect(DAMAGE[3]).toBe(40);
  });
  it("верный ответ бьёт, ошибка лечит, но не выше максимума", () => {
    let s = initialState("weak");
    expect(s.hp).toBe(BOSS_HP);
    let o = applyAnswer(s, step(2), true);
    expect(o.state.hp).toBe(70);
    expect(o.damage).toBe(30);
    o = applyAnswer(o.state, step(1), false);
    expect(o.state.hp).toBe(70 + HEAL);
    expect(o.state.turn).toBe(2);
    s = applyAnswer(initialState("weak"), step(1), false).state;
    expect(s.hp).toBe(BOSS_HP);
    expect(s.healed).toBe(0);
  });
  it("победа при нуле здоровья, урон не больше остатка", () => {
    let s = initialState("weak");
    for (let i = 0; i < 2; i++) s = applyAnswer(s, step(3), true).state;
    expect(isDefeated(s)).toBe(false);
    const o = applyAnswer(s, step(3), true);
    s = o.state;
    expect(o.damage).toBe(20);
    expect(s.hp).toBe(0);
    expect(isDefeated(s)).toBe(true);
    expect(s.dealt).toBeLessThanOrEqual(BOSS_HP);
  });
  it("большой босс — 150 здоровья и уровни B–C", () => {
    expect(initialState("big").maxHp).toBe(BIG_HP);
    for (let i = 0; i < MAX_TURNS; i++) expect(turnLevel(i, "big")).toBeGreaterThanOrEqual(2);
    expect(turnLevel(0, "weak")).toBe(1);
    expect(turnLevel(MAX_TURNS - 1, "weak")).toBe(3);
  });
  it("ходы: лимит в calm/normal, в блиц нет", () => {
    let s = initialState("weak");
    for (let i = 0; i < MAX_TURNS; i++) s = applyAnswer(s, step(1), false).state;
    expect(outOfTurns(s, "calm")).toBe(true);
    expect(outOfTurns(s, "normal")).toBe(true);
    expect(outOfTurns(s, "blitz")).toBe(false);
  });
  it("бонус за победу и результат", () => {
    let s = initialState("weak");
    expect(winBonus(s, "calm")).toBe(0);
    for (let i = 0; i < 3; i++) s = applyAnswer(s, step(3), true).state;
    expect(isDefeated(s)).toBe(true);
    expect(winBonus(s, "calm")).toBe(50 + (MAX_TURNS - 3) * 5);
    expect(winBonus(s, "blitz", 30_000)).toBe(80);
    const r = toResult(s, winBonus(s, "calm"));
    expect(r.score).toBe(s.score + winBonus(s, "calm"));
    expect(r.attempts).toHaveLength(r.total);
  });
  it("время на ход только в обычном темпе", () => {
    expect(taskBudgetMs("normal", 2)).toBe(45_000);
    expect(taskBudgetMs("calm", 2)).toBeNull();
    expect(taskBudgetMs("blitz", 2)).toBeNull();
  });
});

describe("босс: задания", () => {
  const skills = resolveSkills(["ns.bin2dec", "ns.dec2bin", "ns.base"]);
  it("детерминированы по seed, у задания есть навык, ответ проверяется кодом", () => {
    const a = pickTurnTask({ skills, turn: 3, kind: "weak", seed: 5, used: [] });
    const b = pickTurnTask({ skills, turn: 3, kind: "weak", seed: 5, used: [] });
    expect(a?.id).toBe(b?.id);
    expect(a?.skill).toBeTruthy();
    const ok = evaluate(a!, { type: "choice", index: 0 } as never, "ru");
    expect(typeof ok.correct).toBe("boolean");
    expect(expectedText(a!, "ru")).toBeTruthy();
  });
  it("большой босс отдаёт B–C, если они есть", () => {
    for (let t = 0; t < MAX_TURNS; t++) {
      const s = pickTurnTask({ skills, turn: t, kind: "big", seed: 11, used: [] });
      expect(s).not.toBeNull();
      expect(s!.level ?? 2).toBeGreaterThanOrEqual(2);
    }
  });
  it("повторы подряд не выдаются, drawNext копит used", () => {
    let st = initialState("weak");
    let last = "";
    for (let i = 0; i < 8; i++) {
      const n = drawNext(st, skills, 42)!;
      expect(n.step.id).not.toBe(last);
      last = n.step.id;
      st = n.state;
    }
    expect(st.used).toHaveLength(8);
  });
  it("разбор неверного варианта: choice и multi, без ответа — null", () => {
    const q = { ...step(1), options: ["a", "b", "c"], correct: 0, whyWrong: [null, { ru: "Б", kk: "Б" }, null] } as QuestionStep;
    expect(whyWrongOf(q, { type: "choice", index: 1 })).toEqual({ ru: "Б", kk: "Б" });
    expect(whyWrongOf(q, { type: "choice", index: 2 })).toBeNull();
    expect(whyWrongOf(q, null)).toBeNull();
    const mq = { ...q, type: "multi", correct: [0, 2] } as unknown as QuestionStep;
    expect(whyWrongOf(mq, { type: "multi", indices: [0, 1] })).toEqual({ ru: "Б", kk: "Б" });
  });
  it("пустой банк — null", () => {
    expect(pickTurnTask({ skills: ["no.such"], turn: 0, kind: "weak", seed: 1, used: [] })).toBeNull();
    expect(drawNext(initialState("weak"), [], 1)).toBeNull();
  });
  it("строки двуязычны", () => {
    for (const v of Object.values(S)) {
      const l = v as { ru: string; kk: string };
      expect(l.ru).toBeTruthy();
      expect(l.kk).toBeTruthy();
    }
  });
});

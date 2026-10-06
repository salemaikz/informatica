import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildDeck } from "@/lib/duel/deck";
import { checkAnswer, correctAnswer, isCorrect, optionCount } from "@/lib/duel/check";
import { DUEL_MODES } from "@/lib/duel/modes";
import { clockLeftMs, clockNow, clockPause, clockResume, clockStart, itemLeftMs, runAnswer, runTick, sideStat, startRun } from "@/lib/duel/run";
import { bandSkills, duelTopics, topicSkills } from "@/lib/duel/topics";
import { botMatchId, duelDeckUrl, duelPlayHref, isDeckResponse } from "@/lib/duel/api";
import type { DuelAnswer, DuelItem } from "@/lib/duel/types";

// Этап 16Д, Ф1: лёгкая проверка ответа (check.ts — без банка, её берёт экран матча), темы без банка (topics.ts),
// автомат хода ученика (run.ts) и клиент набора (api.ts).

const wrongOf = (it: DuelItem): DuelAnswer => (it.shape === "statement" ? !it.statement.value : (it.step.correct + 1) % it.step.options.length);

describe("check.ts — лёгкий и тот же, что у набора", () => {
  it("модуль не тянет банк", () => {
    const src = readFileSync(join(import.meta.dirname, "../src/lib/duel/check.ts"), "utf8");
    expect(src).not.toMatch(/from "[^"]*bank/);
    const topics = readFileSync(join(import.meta.dirname, "../src/lib/duel/topics.ts"), "utf8");
    expect(topics).not.toMatch(/from "[^"]*(bank|content\/course")/);
  });

  it("верный ответ верен, неверный — нет; очки режима", () => {
    for (const mode of ["blitz", "truth", "ten"] as const) {
      const deck = buildDeck(mode, 77, 2);
      expect(deck).toHaveLength(DUEL_MODES[mode].n);
      for (const it of deck) {
        expect(isCorrect(it, correctAnswer(it))).toBe(true);
        expect(isCorrect(it, wrongOf(it))).toBe(false);
        expect(checkAnswer(it, correctAnswer(it))).toEqual({ ok: true, pts: DUEL_MODES[mode].pts.ok });
        expect(checkAnswer(it, wrongOf(it))).toEqual({ ok: false, pts: DUEL_MODES[mode].pts.bad });
        expect(optionCount(it)).toBe(it.shape === "statement" ? 2 : it.step.options.length);
      }
    }
  });

  it("мусорный ответ — неверно", () => {
    const [choice] = buildDeck("ten", 1, 1);
    const [st] = buildDeck("truth", 1, 1);
    for (const a of [-1, 1.5, 99, true] as DuelAnswer[]) expect(isCorrect(choice, a)).toBe(false);
    expect(isCorrect(st, 1 as DuelAnswer)).toBe(false);
  });

  it("темы: лёгкий список совпадает с тем, по чему собирается набор", () => {
    const topics = duelTopics();
    expect(topics).toContain("t01");
    expect(topics).toContain("u1");
    for (const t of topics) expect(buildDeck("topic", 3, 2, t), t).toHaveLength(DUEL_MODES.topic.n);
    expect(topicSkills("nope")).toEqual([]);
    for (const b of [1, 2, 3, 4] as const) expect(bandSkills(b).length).toBeGreaterThan(0);
  });
});

describe("run.ts — ход ученика", () => {
  it("блиц: верно +2, неверно −1 и пауза 1,5 с; во время паузы ответ не принимается; конец часов", () => {
    const items = buildDeck("blitz", 5, 2);
    let s = startRun();
    s = runAnswer(s, items, correctAnswer(items[0]), 3_000);
    expect(s.events).toEqual([{ i: 0, ok: true, t: 3_000 }]);
    s = runAnswer(s, items, wrongOf(items[1]), 6_000);
    expect(s.pauseUntil).toBe(7_500);
    const paused = runAnswer(s, items, correctAnswer(items[2]), 7_000);
    expect(paused).toBe(s);
    s = runAnswer(s, items, correctAnswer(items[2]), 8_000);
    expect(sideStat("blitz", s.events)).toEqual({ score: 3, correct: 2, answered: 3, timeMs: 8_000 });
    expect(clockLeftMs("blitz", 8_000)).toBe(52_000);
    expect(itemLeftMs(s, items, 8_000)).toBeNull();
    s = runTick(s, items, 60_000);
    expect(s.done).toBe(true);
    expect(runAnswer(s, items, correctAnswer(items[3]), 60_100)).toBe(s);
  });

  it("10 вопросов: тайм-аут — неверно в момент лимита; несколько тайм-аутов подряд; конец набора", () => {
    const items = buildDeck("ten", 9, 2);
    const lim = items[0].limitMs!;
    expect(lim).toBe(20_000);
    let s = startRun();
    expect(itemLeftMs(s, items, 5_000)).toBe(lim - 5_000);
    s = runTick(s, items, lim - 1);
    expect(s.events).toHaveLength(0);
    s = runTick(s, items, 2 * lim + 10);
    expect(s.events).toEqual([
      { i: 0, ok: false, t: lim },
      { i: 1, ok: false, t: 2 * lim },
    ]);
    expect(s.answers).toEqual([null, null]);
    let t = 2 * lim;
    for (let k = 2; k < items.length; k++) s = runAnswer(s, items, correctAnswer(items[k]), (t += 1_000));
    expect(s.done).toBe(true);
    expect(sideStat("ten", s.events)).toMatchObject({ correct: 8, answered: 10, score: 8 });
    expect(clockLeftMs("ten", 0)).toBeNull();
  });

  it("часы матча стоят на паузе и идут после неё", () => {
    let c = clockStart(1_000);
    expect(clockNow(c, 3_000)).toBe(2_000);
    c = clockPause(c, 3_000);
    expect(clockNow(c, 9_000)).toBe(2_000);
    c = clockResume(c, 9_000);
    expect(clockNow(c, 10_000)).toBe(3_000);
    expect(clockResume(c, 11_000)).toBe(c);
  });
});

describe("api.ts", () => {
  it("адреса и id матча", () => {
    expect(duelDeckUrl({ mode: "blitz", band: 2, seed: 42, topic: "t03" })).toBe("/api/duel/deck?mode=blitz&band=2&seed=42");
    expect(duelDeckUrl({ mode: "topic", band: 1, seed: 7, topic: "t03" })).toBe("/api/duel/deck?mode=topic&band=1&seed=7&topic=t03");
    expect(duelPlayHref("topic", 7, "u1")).toBe("/duel/play?mode=topic&topic=u1&seed=7");
    expect(duelPlayHref("truth", 7, "u1")).toBe("/duel/play?mode=truth&seed=7");
    expect(botMatchId("ten", 7, 3)).toBe("bot.ten.-.3.7");
    expect(botMatchId("topic", 7, 3, "t01")).toBe("bot.topic.t01.3.7");
  });

  it("isDeckResponse: форма набора", () => {
    const items = buildDeck("ten", 4, 1);
    const ok = { mode: "ten", band: 1, seed: 4, deckTag: "dev", items };
    expect(isDeckResponse(ok, "ten")).toBe(true);
    expect(isDeckResponse(ok, "blitz")).toBe(false);
    expect(isDeckResponse({ ...ok, items: items.slice(1) }, "ten")).toBe(false);
    expect(isDeckResponse({ ...ok, band: 9 }, "ten")).toBe(false);
    expect(isDeckResponse(null, "ten")).toBe(false);
  });
});

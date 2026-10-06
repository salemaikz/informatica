import { describe, expect, it } from "vitest";
import { botProfile, botTimeline } from "@/lib/duel/bot";
import { buildDeck } from "@/lib/duel/deck";
import { decodeTimeline, encodeTimeline, isValidTimeline, mergeEvents, nextEventIn, opponentAt, type OpponentTimeline } from "@/lib/duel/timeline";
import type { DuelEvent } from "@/lib/duel/types";

const events: DuelEvent[] = [
  { i: 0, ok: true, t: 4000 },
  { i: 1, ok: false, t: 9000 },
  { i: 2, ok: true, t: 15_000 },
];

describe("opponentAt", () => {
  it("показывает только случившееся к nowMs; complete — «доиграл» после последнего события", () => {
    const tl: OpponentTimeline = { kind: "ghost", events, complete: true };
    expect(opponentAt(tl, 0)).toMatchObject({ answered: 0, correct: 0, last: null, done: false });
    expect(opponentAt(tl, 9000)).toMatchObject({ answered: 2, correct: 1, last: events[1], done: false });
    expect(opponentAt(tl, 60_000)).toMatchObject({ answered: 3, correct: 2, done: true });
    // Живой соперник: неизвестно, будут ли ещё события.
    expect(opponentAt({ kind: "human", events, complete: false }, 60_000).done).toBe(false);
    expect(nextEventIn(tl, 5000)).toBe(4000);
    expect(nextEventIn(tl, 15_000)).toBeNull();
  });

  it("бот рисуется тем же экраном: прогресс монотонен", () => {
    const deck = buildDeck("blitz", 3, 2);
    const tl: OpponentTimeline = { kind: "bot", events: botTimeline(deck, botProfile(2), 3), complete: true };
    let prev = -1;
    for (let now = 0; now <= 60_000; now += 500) {
      const s = opponentAt(tl, now);
      expect(s.answered).toBeGreaterThanOrEqual(prev);
      prev = s.answered;
    }
    expect(opponentAt(tl, 60_000).done).toBe(true);
  });
});

describe("проверка, слияние и запись", () => {
  it("isValidTimeline: по порядку i, t не убывает, не больше n, не позже maxMs", () => {
    expect(isValidTimeline(events, 10)).toBe(true);
    expect(isValidTimeline(events, 2)).toBe(false);
    expect(isValidTimeline(events, 10, 10_000)).toBe(false);
    expect(isValidTimeline([events[1]], 10)).toBe(false);
    expect(isValidTimeline([events[0], { i: 1, ok: true, t: 100 }], 10)).toBe(false);
    expect(isValidTimeline([{ i: 0, ok: true, t: 1.5 }], 10)).toBe(false);
  });

  it("mergeEvents: новые с сервера без повторов и дыр", () => {
    expect(mergeEvents(events.slice(0, 1), [events[2], events[1], events[0]])).toEqual(events);
    expect(mergeEvents(events.slice(0, 1), [events[2]])).toEqual(events.slice(0, 1));
  });

  it("encode/decode туда и обратно; повреждённое — null", () => {
    const s = encodeTimeline(events);
    expect(s).toBe("1.4000,0.9000,1.15000");
    expect(decodeTimeline(s, 10)).toEqual(events);
    expect(decodeTimeline("", 10)).toEqual([]);
    expect(decodeTimeline("1.4000,0.3000", 10)).toBeNull(); // t убывает
    expect(decodeTimeline("2.4000", 10)).toBeNull();
    expect(decodeTimeline("1.4000,x", 10)).toBeNull();
    expect(decodeTimeline(s, 2)).toBeNull();
    // Блиц из 40 ответов укладывается в ~300 байт.
    const long = Array.from({ length: 40 }, (_, i) => ({ i, ok: i % 3 > 0, t: 1500 * (i + 1) }));
    expect(encodeTimeline(long).length).toBeLessThan(320);
    expect(decodeTimeline(encodeTimeline(long), 40)).toEqual(long);
  });
});

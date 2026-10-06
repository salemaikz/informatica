import { describe, expect, it } from "vitest";
import { answerIn, backoffMs, clockSample, isMatchJoin, isQueueReply, itemMs, liveHref, nextClock, normalizeRoomCode, resumeRun } from "@/lib/duel/live";
import { pendingLinkOf } from "@/lib/pending-link";
import type { DuelEvent } from "@/lib/duel/types";

// Живые дуэли на клиенте (этап 16Д, Ф4): чистые помощники lib/duel/live.ts и ссылка на комнату через онбординг.

describe("часы и опрос", () => {
  it("сдвиг: середина круга запроса", () => {
    expect(clockSample(10_500, 1_000, 1_200)).toEqual({ offset: 9_400, rtt: 200 });
  });
  it("большой скачок берём сразу, шум сглаживаем, медленный ответ не уводит часы", () => {
    const a = nextClock(null, { offset: 1_000, rtt: 100 });
    expect(a.offset).toBe(1_000);
    expect(nextClock(a, { offset: 62_000, rtt: 100 }).offset).toBe(62_000);
    expect(nextClock(a, { offset: 1_100, rtt: 100 }).offset).toBe(1_030);
    expect(nextClock(a, { offset: 1_500, rtt: 3_000 })).toEqual(a);
  });
  it("пауза после сбоев 2 → 4 → 8 с", () => {
    expect([0, 1, 2, 3, 6].map(backoffMs)).toEqual([0, 2_000, 4_000, 8_000, 8_000]);
  });
});

describe("время на задание — как считает сервер", () => {
  const ev: DuelEvent[] = [
    { i: 0, ok: true, t: 2_000 },
    { i: 1, ok: false, t: 3_500 },
    { i: 2, ok: true, t: 7_000 },
  ];
  it("после ошибки отсчёт — с конца паузы режима", () => {
    expect(itemMs(ev, 0, 1_500)).toBe(2_000);
    expect(itemMs(ev, 1, 1_500)).toBe(1_500);
    expect(itemMs(ev, 2, 1_500)).toBe(2_000);
    expect(answerIn("blitz", ev, 2, 1)).toEqual({ i: 2, a: 1, ms: 2_000 });
    expect(answerIn("ten", ev, 1, null)).toEqual({ i: 1, a: -1, ms: 1_500 });
  });
  it("продолжение после перезагрузки: следующее задание, после ошибки — с паузой", () => {
    const r = resumeRun("blitz", ev.slice(0, 2), 40);
    expect(r).toMatchObject({ i: 2, itemAt: 5_000, pauseUntil: 5_000, done: false });
    expect(resumeRun("ten", [], 10)).toMatchObject({ i: 0, itemAt: 0, done: false });
  });
});

describe("код комнаты, ссылки, имя", () => {
  it("код: регистр, дефис, похожие буквы; мусор — null", () => {
    expect(normalizeRoomCode("ab-c 12z")).toBe("ABC12Z");
    expect(normalizeRoomCode("oil0u7")).toBe("0110V7");
    expect(normalizeRoomCode("OIL0U7")).toBe("0110V7");
    expect(normalizeRoomCode("ABC")).toBeNull();
    expect(normalizeRoomCode("ABCDEF1")).toBeNull();
    expect(normalizeRoomCode(42)).toBeNull();
  });
  it("онбординг запоминает только комнату с кодом (и вызов на пробник)", () => {
    expect(pendingLinkOf("/duel/r/abc12z")).toBe("/duel/r/ABC12Z");
    expect(pendingLinkOf("/duel/r/ABC12Z?x=1")).toBeNull();
    expect(pendingLinkOf("/duel/r/ABC")).toBeNull();
    expect(pendingLinkOf("/duel/r/ABC12Z/../../evil")).toBeNull();
    expect(pendingLinkOf("/duel/play?mode=blitz")).toBeNull();
  });
  it("адреса экрана живого матча", () => {
    expect(liveHref({ find: true })).toBe("/duel/live?find=blitz");
    expect(liveHref({ match: "abcdefabcdef" })).toBe("/duel/live?m=abcdefabcdef");
    expect(liveHref({ room: "ten" })).toBe("/duel/live?room=ten");
    expect(liveHref({ room: "topic", topic: "t01" })).toBe("/duel/live?room=topic&topic=t01");
  });
});

describe("ответы сервера — недоверенные", () => {
  const join = { matchId: "abcdefabcdef", seat: "x.y", seed: 1, mode: "blitz", band: 2, n: 40, deckTag: "dev", startAt: 1, endsAt: 2 };
  it("место и ответ очереди проверяются по форме", () => {
    expect(isMatchJoin(join)).toBe(true);
    expect(isMatchJoin({ ...join, mode: "chess" })).toBe(false);
    expect(isMatchJoin({ ...join, band: 7 })).toBe(false);
    expect(isQueueReply({ state: "waiting", ticket: "t" })).toBe(true);
    expect(isQueueReply({ state: "matched", join })).toBe(true);
    expect(isQueueReply({ state: "matched", join: {} })).toBe(false);
    expect(isQueueReply({ state: "cancelled" })).toBe(true);
    expect(isQueueReply(null)).toBe(false);
  });
});

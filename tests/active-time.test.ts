import { describe, expect, it } from "vitest";
import { IDLE_MS, IDLE_MS_LONG, TICK_CAP_MS, idleFor, input, startClock, studyKindOf, takeSeconds, tick } from "@/lib/active-time";

describe("активное время #68", () => {
  it("учебные экраны по адресу", () => {
    expect(studyKindOf("/lesson/ns-1-bits")).toBe("lesson");
    expect(studyKindOf("/drill")).toBe("drill");
    expect(studyKindOf("/game/bit-rush")).toBe("game");
    expect(studyKindOf("/exam/run")).toBe("exam");
    expect(studyKindOf("/exam")).toBeNull();
    expect(studyKindOf("/code/py-1")).toBe("code");
    expect(studyKindOf("/theory/ns-1-bits")).toBe("theory");
    expect(studyKindOf("/tutor/abc")).toBe("tutor");
    expect(studyKindOf("/diagnostic")).toBe("diagnostic");
    // Дуэли (16Д): матч с ботом, запись вызова и карточка/игра вызова — как игра; хаб и друзья — не учёба.
    expect(studyKindOf("/duel/play")).toBe("game");
    expect(studyKindOf("/duel/rec")).toBe("game");
    expect(studyKindOf("/duel/c/Ab_-12cdEF")).toBe("game");
    expect(studyKindOf("/duel/live")).toBe("game");
    expect(studyKindOf("/duel/r/ABC12Z")).toBe("game");
    expect(studyKindOf("/duel")).toBeNull();
    expect(studyKindOf("/duel/friends")).toBeNull();
    expect(studyKindOf("/duel")).toBeNull();
    expect(studyKindOf("/duel/friends")).toBeNull();
    expect(studyKindOf("/f/AbCdEfGhIjKlMnOpQrSt_-")).toBeNull();
    expect(studyKindOf("/learn")).toBeNull();
    expect(studyKindOf("/shop")).toBeNull();
    expect(studyKindOf(null)).toBeNull();
    expect(idleFor("exam")).toBe(IDLE_MS_LONG);
    expect(idleFor("lesson")).toBe(IDLE_MS);
  });
  it("считает, пока видно, экран учебный и ученик не простаивает", () => {
    let c = startClock(0);
    c = tick(c, 1000, true, "lesson");
    expect(c.totalMs).toBe(1000);
    c = tick(c, 2000, false, "lesson"); // вкладка скрыта
    c = tick(c, 3000, true, null); // не учебный экран
    expect(c.totalMs).toBe(1000);
    c = tick(c, IDLE_MS + 500, true, "lesson"); // простой больше минуты
    expect(c.totalMs).toBe(1000);
    c = input(c, IDLE_MS + 600);
    c = tick(c, IDLE_MS + 1600, true, "lesson");
    expect(c.totalMs).toBe(2100); // интервал от прошлого тика (+500) до этого — 1,1 с

  });
  it("на пробнике порог простоя длиннее", () => {
    let c = startClock(0);
    c = tick(c, 120_000, true, "exam");
    c = tick(c, 121_000, true, "exam");
    expect(c.totalMs).toBe(TICK_CAP_MS + 1000);
  });
  it("один интервал не больше 5 с (сон, притормаживание)", () => {
    // 30 с между тиками (вкладка спала), ученик действовал в пределах минуты — засчитываем не больше 5 с
    const c = tick(startClock(0), 30_000, true, "lesson");
    expect(c.totalMs).toBe(TICK_CAP_MS);
  });
  it("takeSeconds — целые секунды, остаток копится", () => {
    let c = { ...startClock(0), pendingMs: 2500 };
    const r = takeSeconds(c);
    expect(r.sec).toBe(2);
    c = r.clock;
    expect(c.pendingMs).toBe(500);
  });
});

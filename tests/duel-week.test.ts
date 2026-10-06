import { describe, expect, it } from "vitest";
import { kzDay, kzWeek, kzWeekResetsAt, pairKey } from "@/lib/duel/week";

const utc = (iso: string) => Date.parse(iso);

describe("неделя по Казахстану (UTC+5)", () => {
  it("стык в полночь по Астане: воскресенье 23:59 — ещё старая неделя, понедельник 00:00 — новая", () => {
    // Пн 12.10.2026 00:00 по Астане = Вс 11.10.2026 19:00 UTC.
    expect(kzWeek(utc("2026-10-11T18:59:59Z"))).toBe("2026-W41");
    expect(kzWeek(utc("2026-10-11T19:00:00Z"))).toBe("2026-W42");
    expect(kzDay(utc("2026-10-11T18:59:59Z"))).toBe("2026-10-11");
    expect(kzDay(utc("2026-10-11T19:00:00Z"))).toBe("2026-10-12");
  });

  it("53-я неделя: 2026 год начинается в четверг", () => {
    expect(kzWeek(utc("2026-12-31T12:00:00Z"))).toBe("2026-W53");
    expect(kzWeek(utc("2027-01-03T18:59:00Z"))).toBe("2026-W53"); // вс 23:59 по Астане
    expect(kzWeek(utc("2027-01-03T19:00:00Z"))).toBe("2027-W01"); // пн 00:00 по Астане
    // 1 января 2026 — четверг, первая неделя 2026 года; 29.12.2025 — тоже W01.
    expect(kzWeek(utc("2026-01-01T00:00:00Z"))).toBe("2026-W01");
    expect(kzWeek(utc("2025-12-29T00:00:00Z"))).toBe("2026-W01");
    // UTC ещё 31 декабря, а в Астане уже 1 января 2027 (пятница, всё ещё W53).
    expect(kzWeek(utc("2026-12-31T20:00:00Z"))).toBe("2026-W53");
    expect(kzDay(utc("2026-12-31T20:00:00Z"))).toBe("2027-01-01");
  });

  it("сегодняшняя неделя и сброс в понедельник 00:00 по Астане", () => {
    const now = utc("2026-10-06T07:00:00Z"); // вторник
    expect(kzWeek(now)).toBe("2026-W41");
    expect(kzWeekResetsAt(now)).toBe(utc("2026-10-11T19:00:00Z"));
    expect(kzWeekResetsAt(utc("2026-10-11T19:00:00Z"))).toBe(utc("2026-10-18T19:00:00Z"));
    expect(kzWeekResetsAt(utc("2026-10-11T18:59:59Z"))).toBe(utc("2026-10-11T19:00:00Z"));
  });

  it("ключ пары не зависит от порядка", () => {
    expect(pairKey("b", "a")).toBe("a|b");
    expect(pairKey("a", "b")).toBe("a|b");
  });
});

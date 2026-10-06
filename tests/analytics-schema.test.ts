import { describe, expect, it } from "vitest";
import type { AnalyticsEvent, AnalyticsName } from "@/lib/analytics";
import { EVENT_SCHEMA, EVENTS_FIELDS_DAY_MAX, ID_RE, isSafeId, MAX_BATCH, parseEvent, parseEvents } from "@/lib/analytics-schema";

// Образец каждого события, типизированный по контракту lib/analytics.ts: если контракт поменяется, тест не соберётся.
const SAMPLES: Record<AnalyticsName, AnalyticsEvent> = {
  lesson_start: { e: "lesson_start", lesson: "ns-1-binary", via: "learn", resume: 1 },
  lesson_quit: { e: "lesson_quit", lesson: "ns-1-binary", via: "check", step: 7, of: 16 },
  lesson_finish: { e: "lesson_finish", lesson: "ns-1-binary", via: "learn", acc: 88, sec: 420 },
  resume_choice: { e: "resume_choice", lesson: "ns-1-binary", choice: "restart" },
  task: { e: "task", step: "ns-1-binary:oct-q-triads-1", ok: 0, skip: 1, hint: 1 },
  drill_start: { e: "drill_start", mode: "weak" },
  drill_finish: { e: "drill_finish", mode: "skill", acc: 70 },
  game_start: { e: "game_start", game: "binary-race", lesson: 0 },
  game_finish: { e: "game_finish", game: "binary-race", acc: 100 },
  game_quit: { e: "game_quit", game: "binary-race" },
  exam_start: { e: "exam_start", kind: "full" },
  exam_finish: { e: "exam_finish", kind: "unit", pct: 64 },
  paywall_view: { e: "paywall_view", from: "hearts" },
  plan_click: { e: "plan_click", tier: "unlimited", period: "year" },
  trial_start: { e: "trial_start", from: "other" },
  shop_click: { e: "shop_click", item: "chips-750" },
  hearts_out: { e: "hearts_out", where: "checkpoint" },
  chips_out: { e: "chips_out", where: "cosmetic" },
  short_pick: { e: "short_pick", need: "hearts", pick: "refill" },
  onb_step: { e: "onb_step", step: "goal" },
  onb_done: { e: "onb_done", track: "school" },
  diag: { e: "diag", done: 1, pct: 40 },
  active: { e: "active", d: 7 },
  break_reason: { e: "break_reason", code: "other_prep" },
  feedback: { e: "feedback", kind: "content" },
  share: { e: "share", what: "challenge", how: "wa" },
  share_open: { e: "share_open", what: "report" },
  challenge: { e: "challenge", step: "accept" },
};

describe("белый список событий статистики", () => {
  it("в схеме ровно те события, что в контракте lib/analytics.ts", () => {
    expect(Object.keys(EVENT_SCHEMA).sort()).toEqual(Object.keys(SAMPLES).sort());
    expect(Object.keys(SAMPLES)).toHaveLength(28);
  });

  it("каждое верное событие проходит без изменений", () => {
    for (const ev of Object.values(SAMPLES)) expect(parseEvent(ev), ev.e).toEqual(ev);
  });

  it("лишние поля отбрасываются: имя, id устройства, IP и время не проходят", () => {
    const dirty = { ...SAMPLES.lesson_start, deviceId: "abc", name: "Айгерим", ip: "1.2.3.4", at: 1_700_000_000 };
    const got = parseEvent(dirty);
    expect(got).toEqual(SAMPLES.lesson_start);
    expect(JSON.stringify(got)).not.toMatch(/abc|Айгерим|1\.2\.3\.4|1700000000/);
  });

  it("неизвестное событие и мусор вместо события — null", () => {
    for (const junk of [null, undefined, 0, "lesson_start", true, [], [SAMPLES.task], {}, { e: 5 }, { e: "unknown" }, { e: "__proto__" }, { e: "constructor" }, { e: "toString" }]) {
      expect(parseEvent(junk), String(JSON.stringify(junk))).toBeNull();
    }
  });

  it("не хватает поля или значение не того вида — событие отбрасывается целиком", () => {
    const base = SAMPLES.lesson_quit as Extract<AnalyticsEvent, { e: "lesson_quit" }>;
    expect(parseEvent({ ...base, lesson: undefined })).toBeNull();
    expect(parseEvent({ ...base, via: "other" })).toBeNull();
    expect(parseEvent({ ...base, step: "7" })).toBeNull();
    expect(parseEvent({ ...base, step: 7.5 })).toBeNull();
    expect(parseEvent({ ...base, step: -1 })).toBeNull();
    expect(parseEvent({ ...base, of: 201 })).toBeNull();
    expect(parseEvent({ ...base, step: NaN })).toBeNull();
    expect(parseEvent({ ...base, step: Infinity })).toBeNull();
    expect(parseEvent({ ...base, step: 200, of: 200 })).not.toBeNull();
  });

  it("флаги — только 0 и 1 (числом)", () => {
    const t = SAMPLES.task as Extract<AnalyticsEvent, { e: "task" }>;
    for (const bad of [2, -1, true, false, "1", null]) expect(parseEvent({ ...t, ok: bad }), String(bad)).toBeNull();
    expect(parseEvent({ ...t, ok: 1, skip: 0, hint: 0 })).not.toBeNull();
  });

  it("проценты 0–100, секунды 0–7200", () => {
    const f = SAMPLES.lesson_finish as Extract<AnalyticsEvent, { e: "lesson_finish" }>;
    expect(parseEvent({ ...f, acc: 101 })).toBeNull();
    expect(parseEvent({ ...f, acc: -1 })).toBeNull();
    expect(parseEvent({ ...f, acc: 0, sec: 0 })).not.toBeNull();
    expect(parseEvent({ ...f, acc: 100, sec: 7200 })).not.toBeNull();
    expect(parseEvent({ ...f, sec: 7201 })).toBeNull();
    const x = SAMPLES.exam_finish as Extract<AnalyticsEvent, { e: "exam_finish" }>;
    expect(parseEvent({ ...x, pct: 100 })).not.toBeNull();
    expect(parseEvent({ ...x, pct: 101 })).toBeNull();
  });

  it("строки-идентификаторы: латиница, цифры и _ . : -, 1–80 знаков", () => {
    expect(ID_RE.test("ns-1-binary")).toBe(true);
    expect(ID_RE.test("bank:ns:12")).toBe(true);
    expect(ID_RE.test("a".repeat(80))).toBe(true);
    for (const bad of ["", "a".repeat(81), "a b", "урок", "a/b", "a<b>", "a\nb", "a;b", "a'b", "a|b"]) expect(ID_RE.test(bad), bad).toBe(false);
    const t = SAMPLES.drill_start as Extract<AnalyticsEvent, { e: "drill_start" }>;
    expect(parseEvent({ ...t, mode: "<script>" })).toBeNull();
    expect(parseEvent({ ...t, mode: "x".repeat(81) })).toBeNull();
    expect(parseEvent({ ...t, mode: 5 })).toBeNull();
    expect(parseEvent({ ...t, mode: ["weak"] })).toBeNull();
  });

  it("«отравленные» id: имена из Object.prototype (constructor, __proto__, toString…) не принимаются ни в одном поле-идентификаторе", () => {
    const bad = ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf", "isPrototypeOf", "prototype", "constructor:x", "lesson:__proto__:q", "__proto__:x"];
    for (const v of bad) expect(isSafeId(v), v).toBe(false);
    // Похожие, но безопасные id остаются.
    for (const v of ["constructor-q-1", "my-prototype", "ns-1-bits:bits-story-start", "to-string"]) expect(isSafeId(v), v).toBe(true);
    for (const v of bad) {
      expect(parseEvent({ e: "lesson_start", lesson: v, via: "learn", resume: 0 }), `lesson ${v}`).toBeNull();
      expect(parseEvent({ e: "lesson_quit", lesson: v, via: "learn", step: 1, of: 2 }), `quit ${v}`).toBeNull();
      expect(parseEvent({ e: "resume_choice", lesson: v, choice: "continue" }), `resume ${v}`).toBeNull();
      expect(parseEvent({ e: "task", step: v, ok: 1, skip: 0, hint: 0 }), `task ${v}`).toBeNull();
      expect(parseEvent({ e: "drill_start", mode: v }), `drill ${v}`).toBeNull();
      expect(parseEvent({ e: "game_start", game: v, lesson: 0 }), `game ${v}`).toBeNull();
      expect(parseEvent({ e: "shop_click", item: v }), `shop ${v}`).toBeNull();
      expect(parseEvent({ e: "onb_step", step: v }), `onb ${v}`).toBeNull();
    }
    // Само имя события из прототипа — тоже отказ (проверялось и раньше).
    expect(parseEvent({ e: "constructor" })).toBeNull();
  });

  it("бюджет новых полей за сутки — несколько тысяч, не десятки тысяч", () => {
    expect(EVENTS_FIELDS_DAY_MAX).toBe(5000);
  });

  it("перечисления: значение не из списка — отказ (откуда открыли окно тарифов, место, причина перерыва)", () => {
    expect(parseEvent({ e: "paywall_view", from: "evil" })).toBeNull();
    expect(parseEvent({ e: "hearts_out", where: "moon" })).toBeNull();
    expect(parseEvent({ e: "hearts_out", where: "theory" })).toEqual({ e: "hearts_out", where: "theory" });
    expect(parseEvent({ e: "chips_out", where: "moon" })).toBeNull();
    expect(parseEvent({ e: "short_pick", need: "xp", pick: "heart" })).toBeNull();
    expect(parseEvent({ e: "short_pick", need: "chips", pick: "pass" })).toBeNull();
    expect(parseEvent({ e: "trial_start", from: "chips" })).toEqual({ e: "trial_start", from: "chips" });
    expect(parseEvent({ e: "break_reason", code: "lazy" })).toBeNull();
    expect(parseEvent({ e: "active", d: 2 })).toBeNull();
    expect(parseEvent({ e: "active", d: 30 })).toEqual({ e: "active", d: 30 });
    expect(parseEvent({ e: "plan_click", tier: "free", period: "year" })).toBeNull();
    expect(parseEvent({ e: "plan_click", tier: "lite", period: "week" })).toBeNull();
  });

  it("parseEvents: массив или { events }, мусор пропускается, верное остаётся", () => {
    const a = SAMPLES.task;
    const b = SAMPLES.active;
    expect(parseEvents([a, "мусор", null, { e: "nope" }, b])).toEqual([a, b]);
    expect(parseEvents({ events: [a, b] })).toEqual([a, b]);
    for (const junk of [null, undefined, 5, "x", true, {}, { events: "x" }, { events: {} }]) expect(parseEvents(junk)).toEqual([]);
  });

  it("в пачке не больше 30 событий: остальное отбрасывается", () => {
    const many = Array.from({ length: 100 }, () => SAMPLES.active);
    expect(parseEvents(many)).toHaveLength(MAX_BATCH);
    expect(MAX_BATCH).toBe(30);
    // Мусор в начале пачки не освобождает место: сначала обрезка, потом проверка.
    const junkFirst = [...Array.from({ length: 30 }, () => "мусор"), SAMPLES.active];
    expect(parseEvents(junkFirst)).toEqual([]);
  });
});

describe("поделиться и вызов (#72, #73)", () => {
  it("значения только из белых списков", () => {
    expect(parseEvent({ e: "share", what: "exam", how: "native" })).toEqual({ e: "share", what: "exam", how: "native" });
    expect(parseEvent({ e: "share", what: "exam", how: "instagram" })).toBeNull();
    expect(parseEvent({ e: "share", what: "name", how: "copy" })).toBeNull();
    expect(parseEvent({ e: "share_open", what: "challenge" })).toBeNull();
    // «Поделиться» уроком (этап 16В): вид «lesson» принимается и при отправке, и при открытии ссылки
    expect(parseEvent({ e: "share", what: "lesson", how: "copy" })).toEqual({ e: "share", what: "lesson", how: "copy" });
    expect(parseEvent({ e: "share_open", what: "lesson" })).toEqual({ e: "share_open", what: "lesson" });
    expect(parseEvent({ e: "challenge", step: "win" })).toBeNull();
    expect(parseEvent({ e: "challenge", step: "more", code: "x1-m-14-19-k-1-a9zq" })).toEqual({ e: "challenge", step: "more" });
  });
});

import { describe, expect, it } from "vitest";
import type { AnalyticsEvent } from "@/lib/analytics";
import { batchFields, EVENTS_TTL_SEC, eventsKey, fieldsOf, totalsOnly } from "@/lib/analytics-fields";

describe("поля суточного хеша: что пишет каждое событие", () => {
  it("урок: старт, продолжение, выход по шагам, конец с суммой точности", () => {
    expect(fieldsOf({ e: "lesson_start", lesson: "a-1", via: "learn", resume: 0 })).toEqual({ lesson_start: 1, "ls:a-1:learn": 1 });
    expect(fieldsOf({ e: "lesson_start", lesson: "a-1", via: "check", resume: 1 })).toEqual({ lesson_start: 1, "ls:a-1:check": 1, "lr:a-1": 1 });
    expect(fieldsOf({ e: "lesson_quit", lesson: "a-1", via: "learn", step: 5, of: 16 })).toEqual({ lesson_quit: 1, "lq:a-1:5/16": 1 });
    expect(fieldsOf({ e: "lesson_finish", lesson: "a-1", via: "learn", acc: 80, sec: 300 })).toEqual({ lesson_finish: 1, "lf:a-1": 1, "la:a-1": 80 });
    expect(fieldsOf({ e: "resume_choice", lesson: "a-1", choice: "continue" })).toEqual({ resume_choice: 1, "rc:continue": 1 });
  });

  it("задание: n всегда, w — неверно или пропуск, h — подсказка", () => {
    expect(fieldsOf({ e: "task", step: "s1", ok: 1, skip: 0, hint: 0 })).toEqual({ task: 1, "tk:s1:n": 1 });
    expect(fieldsOf({ e: "task", step: "s1", ok: 0, skip: 0, hint: 1 })).toEqual({ task: 1, "tk:s1:n": 1, "tk:s1:w": 1, "tk:s1:h": 1 });
    expect(fieldsOf({ e: "task", step: "s1", ok: 0, skip: 1, hint: 0 })).toEqual({ task: 1, "tk:s1:n": 1, "tk:s1:w": 1 });
  });

  it("тренировка, игры, пробники", () => {
    expect(fieldsOf({ e: "drill_start", mode: "weak" })).toEqual({ drill_start: 1, "ds:weak": 1 });
    expect(fieldsOf({ e: "drill_finish", mode: "weak", acc: 50 })).toEqual({ drill_finish: 1, "df:weak": 1 });
    expect(fieldsOf({ e: "game_start", game: "g", lesson: 1 })).toEqual({ game_start: 1, "gs:g": 1 });
    expect(fieldsOf({ e: "game_finish", game: "g", acc: 9 })).toEqual({ game_finish: 1, "gf:g": 1 });
    expect(fieldsOf({ e: "game_quit", game: "g" })).toEqual({ game_quit: 1, "gq:g": 1 });
    expect(fieldsOf({ e: "exam_start", kind: "mini" })).toEqual({ exam_start: 1, "xs:mini": 1 });
    expect(fieldsOf({ e: "exam_finish", kind: "mini", pct: 70 })).toEqual({ exam_finish: 1, "xf:mini": 1 });
  });

  it("деньги и спрос, сердечки, онбординг, диагностика, удержание, перерыв, отзыв", () => {
    expect(fieldsOf({ e: "paywall_view", from: "auto" })).toEqual({ paywall_view: 1, "pv:auto": 1 });
    expect(fieldsOf({ e: "plan_click", tier: "lite", period: "month" })).toEqual({ plan_click: 1, "pc:lite:month": 1 });
    expect(fieldsOf({ e: "trial_start", from: "shop" })).toEqual({ trial_start: 1, "ts:shop": 1 });
    expect(fieldsOf({ e: "shop_click", item: "chips-100" })).toEqual({ shop_click: 1, "sc:chips-100": 1 });
    expect(fieldsOf({ e: "hearts_out", where: "game" })).toEqual({ hearts_out: 1, "ho:game": 1 });
    expect(fieldsOf({ e: "onb_step", step: "name" })).toEqual({ onb_step: 1, "ob:name": 1 });
    expect(fieldsOf({ e: "onb_done", track: "ent" })).toEqual({ onb_done: 1, "od:ent": 1 });
    expect(fieldsOf({ e: "diag", done: 0, pct: 0 })).toEqual({ diag: 1, "dg:0": 1 });
    expect(fieldsOf({ e: "active", d: 30 })).toEqual({ active: 1, "act:30": 1 });
    expect(fieldsOf({ e: "break_reason", code: "hard" })).toEqual({ break_reason: 1, "br:hard": 1 });
    expect(fieldsOf({ e: "feedback", kind: "idea" })).toEqual({ feedback: 1, "fb:idea": 1 });
    expect(fieldsOf({ e: "share", what: "course", how: "tg" })).toEqual({ share: 1, "sh:course:tg": 1 });
    expect(fieldsOf({ e: "share_open", what: "exam" })).toEqual({ share_open: 1, "so:exam": 1 });
    expect(fieldsOf({ e: "challenge", step: "less" })).toEqual({ challenge: 1, "chl:less": 1 });
  });

  it("в полях нет ничего, кроме значений из события: ни id, ни IP, ни времени", () => {
    const ev: AnalyticsEvent = { e: "lesson_finish", lesson: "a-1", via: "learn", acc: 80, sec: 300 };
    const text = Object.keys(fieldsOf(ev)).join("|");
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}|\d{10}/);
    // Секунды урока в хранилище не пишутся вовсе.
    expect(Object.values(fieldsOf(ev)).includes(300)).toBe(false);
  });

  it("пачка: одинаковые поля складываются", () => {
    const sum = batchFields([
      { e: "task", step: "s1", ok: 0, skip: 0, hint: 0 },
      { e: "task", step: "s1", ok: 1, skip: 0, hint: 0 },
      { e: "lesson_finish", lesson: "a", via: "learn", acc: 60, sec: 1 },
      { e: "lesson_finish", lesson: "a", via: "learn", acc: 90, sec: 1 },
    ]);
    expect(sum).toEqual({ task: 2, "tk:s1:n": 2, "tk:s1:w": 1, lesson_finish: 2, "lf:a": 2, "la:a": 150 });
    expect(batchFields([])).toEqual({});
  });

  it("totalsOnly: остаются только счётчики событий, измерения (с «:») отбрасываются", () => {
    const sum = batchFields([
      { e: "task", step: "bank:ns:1", ok: 0, skip: 0, hint: 1 },
      { e: "lesson_start", lesson: "a", via: "learn", resume: 1 },
      { e: "active", d: 7 },
    ]);
    expect(totalsOnly(sum)).toEqual({ task: 1, lesson_start: 1, active: 1 });
    expect(totalsOnly({})).toEqual({});
  });

  it("ключ суток и срок жизни", () => {
    expect(eventsKey("2026-10-05")).toBe("ev:2026-10-05");
    expect(EVENTS_TTL_SEC).toBe(400 * 86_400);
  });
});

import { describe, expect, it, vi } from "vitest";
import { LESSONS } from "@/content/course";
import { GAMES } from "@/games/registry";
import type { AnalyticsEvent } from "@/lib/analytics";
import { parseDrillMode } from "@/lib/drill";
import { SHOP_ITEMS } from "@/lib/economy";
import { batchFields } from "@/lib/analytics-fields";
import { label } from "@/app/owner/labels";

vi.mock("server-only", () => ({}));

const { canonicalEvent, DRILL_MODES, ONBOARDING_STEPS, OTHER_ID, lessonId, taskKey } = await import("@/server/analytics-ids");

// Сервер сводит неизвестные идентификаторы к `other`: число полей суточного хеша ограничено контентом, а не клиентом (C2).

const lesson = Object.values(LESSONS)[0];
const step = lesson.steps[0];
const game = GAMES[0];

describe("канонические id событий", () => {
  it("известные урок, шаг, игра, режим, товар и шаг онбординга проходят без изменений", () => {
    const events: AnalyticsEvent[] = [
      { e: "lesson_start", lesson: lesson.id, via: "learn", resume: 0 },
      { e: "lesson_quit", lesson: lesson.id, via: "check", step: 3, of: 10 },
      { e: "lesson_finish", lesson: lesson.id, via: "learn", acc: 80, sec: 100 },
      { e: "resume_choice", lesson: lesson.id, choice: "continue" },
      { e: "task", step: `${lesson.id}:${step.id}`, ok: 1, skip: 0, hint: 0 },
      { e: "drill_start", mode: "mistakes" },
      { e: "drill_finish", mode: "smart", acc: 50 },
      { e: "game_start", game: game.id, lesson: 0 },
      { e: "game_finish", game: game.id, acc: 100 },
      { e: "game_quit", game: game.id },
      { e: "shop_click", item: "chips-750" },
      { e: "shop_click", item: SHOP_ITEMS[0].id },
      { e: "onb_step", step: "name" },
    ];
    for (const ev of events) expect(canonicalEvent(ev), ev.e).toEqual(ev);
  });

  it("неизвестное сводится к other: урок, шаг, игра, режим, товар, шаг онбординга", () => {
    expect(canonicalEvent({ e: "lesson_start", lesson: "fake-lesson-1", via: "learn", resume: 1 })).toEqual({ e: "lesson_start", lesson: OTHER_ID, via: "learn", resume: 1 });
    expect(canonicalEvent({ e: "lesson_quit", lesson: "x", via: "learn", step: 1, of: 2 })).toMatchObject({ lesson: OTHER_ID, step: 1, of: 2 });
    expect(canonicalEvent({ e: "lesson_finish", lesson: "x", via: "learn", acc: 70, sec: 5 })).toMatchObject({ lesson: OTHER_ID, acc: 70 });
    expect(canonicalEvent({ e: "resume_choice", lesson: "x", choice: "restart" })).toMatchObject({ lesson: OTHER_ID, choice: "restart" });
    expect(canonicalEvent({ e: "task", step: "nope:nope", ok: 0, skip: 0, hint: 1 })).toEqual({ e: "task", step: OTHER_ID, ok: 0, skip: 0, hint: 1 });
    expect(canonicalEvent({ e: "task", step: `${lesson.id}:выдуманный-шаг`, ok: 1, skip: 0, hint: 0 })).toMatchObject({ step: OTHER_ID });
    expect(canonicalEvent({ e: "drill_start", mode: "weak" })).toEqual({ e: "drill_start", mode: OTHER_ID });
    expect(canonicalEvent({ e: "drill_finish", mode: "weak", acc: 1 })).toMatchObject({ mode: OTHER_ID });
    expect(canonicalEvent({ e: "game_start", game: "binary-race", lesson: 1 })).toEqual({ e: "game_start", game: OTHER_ID, lesson: 1 });
    expect(canonicalEvent({ e: "game_finish", game: "x", acc: 1 })).toMatchObject({ game: OTHER_ID });
    expect(canonicalEvent({ e: "game_quit", game: "x" })).toMatchObject({ game: OTHER_ID });
    expect(canonicalEvent({ e: "shop_click", item: "gold-bar" })).toEqual({ e: "shop_click", item: OTHER_ID });
    expect(canonicalEvent({ e: "onb_step", step: "goal" })).toEqual({ e: "onb_step", step: OTHER_ID });
  });

  it("имена из Object.prototype (в том числе в `<урок>:<шаг>`) — тоже other: поиск идёт по собственным ключам", () => {
    for (const bad of ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf", "prototype"]) {
      expect(lessonId(bad), bad).toBe(OTHER_ID);
      expect(taskKey(bad), bad).toBe(OTHER_ID);
      expect(taskKey(`${bad}:x`), bad).toBe(OTHER_ID);
      expect(canonicalEvent({ e: "game_quit", game: bad }), bad).toMatchObject({ game: OTHER_ID });
    }
  });

  it("задание: `<урок>:<шаг>` и голый id шага (старые клиенты) принимаются, шаг из чужого урока — нет", () => {
    expect(taskKey(`${lesson.id}:${step.id}`)).toBe(`${lesson.id}:${step.id}`);
    expect(taskKey(step.id)).toBe(step.id);
    const other = Object.values(LESSONS).find((l) => !l.steps.some((s) => s.id === step.id))!;
    expect(taskKey(`${other.id}:${step.id}`)).toBe(OTHER_ID);
  });

  it("число полей за сутки ограничено контентом: тысяча выдуманных id даёт одни и те же поля", () => {
    const fake = Array.from({ length: 1000 }, (_, i): AnalyticsEvent[] => [
      { e: "lesson_start", lesson: `fake-${i}`, via: "learn", resume: 0 },
      { e: "task", step: `fake-${i}:q-${i}`, ok: 0, skip: 0, hint: 0 },
      { e: "drill_start", mode: `m${i}` },
      { e: "game_start", game: `g${i}`, lesson: 0 },
      { e: "shop_click", item: `i${i}` },
      { e: "onb_step", step: `s${i}` },
    ]).flat();
    const fields = Object.keys(batchFields(fake.map(canonicalEvent)));
    // 6 видов событий + 6 измерений: ls:other:learn, tk:other:n, tk:other:w, ds:other, gs:other, sc:other, ob:other
    expect(fields.length).toBeLessThanOrEqual(14);
    expect(fields).toContain("ls:other:learn");
    expect(fields).toContain("tk:other:n");
  });

  it("остальные события не меняются", () => {
    const evs: AnalyticsEvent[] = [
      { e: "paywall_view", from: "hearts" },
      { e: "active", d: 7 },
      { e: "diag", done: 0, pct: 0 },
      { e: "exam_finish", kind: "unit", pct: 5 },
    ];
    for (const ev of evs) expect(canonicalEvent(ev)).toBe(ev);
  });
});

describe("списки сверены с приложением", () => {
  it("режимы тренировки — настоящие режимы lib/drill.ts и все подписаны на странице владельца", () => {
    expect(DRILL_MODES).toHaveLength(7);
    for (const m of DRILL_MODES) {
      expect(parseDrillMode(m), m).toBe(m);
      expect(label.drillMode(m), m).not.toBe(m);
    }
  });

  it("шаги онбординга: шесть, без повторов", () => {
    expect([...ONBOARDING_STEPS].sort()).toEqual(["date", "grade", "lang", "name", "target", "track"]);
  });
});

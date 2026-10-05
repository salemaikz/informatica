import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LESSONS } from "@/content/course";
import { eventsKey } from "@/lib/analytics-fields";
import { buildOwnerReport, retention, type DayFields } from "@/lib/owner-report";
import { label } from "@/app/owner/labels";
import { OwnerView } from "@/app/owner/OwnerView";
import { createMemoryKv, type Kv } from "@/server/kv";
import type { OwnerData } from "@/server/owner-data";

vi.mock("server-only", () => ({}));

// Общее хранилище подменяется в каждом тесте: настоящая память или память с поломкой чтения.
const kvRef = vi.hoisted(() => ({ current: null as unknown as Kv }));
vi.mock("@/server/kv", async () => ({ ...(await vi.importActual<typeof import("@/server/kv")>("@/server/kv")), getKv: () => kvRef.current }));

const { HISTORY_DAYS, loadOwnerData, ownerNames } = await import("@/server/owner-data");

const DAY = 86_400_000;
const kz = (now: number) => new Date(now + 5 * 3_600_000).toISOString().slice(0, 10);
const POISON = ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("названия из контента: только собственные ключи (C1)", () => {
  it("урок и задание с именем из Object.prototype названия не получают — и не падают", () => {
    for (const bad of POISON) {
      expect(ownerNames.lesson(bad), bad).toBeUndefined();
      expect(ownerNames.task(bad), bad).toBeUndefined();
      expect(ownerNames.task(`${bad}:q-1`), bad).toBeUndefined();
      expect(ownerNames.task(`${LESSONS[Object.keys(LESSONS)[0]].id}:${bad}`), bad).toBeUndefined();
    }
  });

  it("настоящие урок и задание называются по-прежнему", () => {
    const lesson = Object.values(LESSONS)[0];
    expect(ownerNames.lesson(lesson.id)).toBe(lesson.title.ru);
    const named = ownerNames.task(`${lesson.id}:${lesson.steps[0].id}`);
    expect(named?.lesson).toBe(lesson.title.ru);
    expect(named?.title.length).toBeGreaterThan(0);
  });

  it("подписи кодов: имя из прототипа возвращается как есть, а не Object.prototype", () => {
    for (const bad of POISON) {
      for (const fn of [label.from, label.heartsWhere, label.drillMode, label.examKind, label.breakReason, label.feedback, label.track, label.issueType, label.issueWhere, label.issueReason]) {
        expect(fn(bad), bad).toBe(bad);
      }
      expect(label.planClick(`${bad}:${bad}`)).toBe(`${bad}, ${bad}`);
    }
  });

  it("страница владельца отрисовывается с «отравленными» полями (урок, шаг, режим тренировки…) без ошибок", () => {
    const fields: Record<string, number> = {};
    for (const bad of POISON) {
      Object.assign(fields, {
        [`ls:${bad}:learn`]: 5,
        [`lf:${bad}`]: 1,
        [`lq:${bad}:3/10`]: 2,
        [`tk:${bad}:x:n`]: 10,
        [`tk:${bad}:x:w`]: 6,
        [`tk:${bad}:n`]: 10,
        [`ds:${bad}`]: 2,
        [`df:${bad}`]: 1,
        [`gs:${bad}`]: 1,
        [`xs:${bad}`]: 1,
        [`pv:${bad}`]: 1,
        [`pc:${bad}:${bad}`]: 1,
        [`ts:${bad}`]: 1,
        [`sc:${bad}`]: 1,
        [`ho:${bad}`]: 1,
        [`ob:${bad}`]: 1,
        [`od:${bad}`]: 1,
        [`br:${bad}`]: 1,
        [`fb:${bad}`]: 1,
      });
    }
    const day: DayFields[] = [{ day: "2026-10-05", fields }];
    const data: OwnerData = {
      period: 7,
      storage: "memory",
      collecting: true,
      unavailable: false,
      report: buildOwnerReport(day, ownerNames),
      retention: retention(day),
      issues: [],
      errors: [],
    };
    expect(data.report.funnel.length).toBeGreaterThan(0);
    expect(data.report.hardTasks.length).toBeGreaterThan(0);
    let html = "";
    expect(() => (html = renderToString(createElement(OwnerView, { data })))).not.toThrow();
    expect(html).toContain("constructor");
    expect(html).not.toContain("[object Object]");
    expect(html).not.toContain("function Object");
  });
});

describe("loadOwnerData: период и удержание", () => {
  const seed = async (mem: Kv, now: number) => {
    // Позавчера — 10 первых запусков; вчера — 4 вернулись; 20 суток назад — старые события (вне окна 7 дней, внутри 30).
    await mem.hincrMany(eventsKey(kz(now - 2 * DAY)), { "act:0": 10, active: 10, lesson_start: 2 }, 100);
    await mem.hincrMany(eventsKey(kz(now - DAY)), { "act:1": 4, active: 4, lesson_start: 3, "ls:ns-1-bits:learn": 3 }, 100);
    await mem.hincrMany(eventsKey(kz(now - 20 * DAY)), { lesson_start: 50, "ls:ns-1-bits:learn": 50 }, 100);
  };

  it("HGETALL — только за сутки выбранного периода; удержание — HMGET четырёх полей за все 60 суток", async () => {
    const now = Date.now();
    const mem = createMemoryKv();
    await seed(mem, now);
    const hgetAllMany = vi.fn(mem.hgetAllMany);
    const hmgetMany = vi.fn(mem.hmgetMany);
    kvRef.current = { ...mem, hgetAllMany, hmgetMany };

    const week = await loadOwnerData(7);
    expect(week.unavailable).toBe(false);
    expect(hgetAllMany).toHaveBeenCalledTimes(1);
    expect(hgetAllMany.mock.calls[0][0]).toHaveLength(7);
    expect(hmgetMany).toHaveBeenCalledTimes(1);
    expect(hmgetMany.mock.calls[0][0]).toHaveLength(HISTORY_DAYS);
    expect(hmgetMany.mock.calls[0][1]).toEqual(["act:0", "act:1", "act:7", "act:30"]);
    // Старые сутки (20 дней назад) в сводку 7 дней не попали; удержание считается по всем 60 суткам.
    expect(week.report.totals.lessonStarts).toBe(5);
    expect(week.report.days).toBe(7);
    expect(week.retention.starts).toBe(10);
    expect(week.retention.rows.find((r) => r.d === 1)).toEqual({ d: 1, returned: 4, cohort: 10, pct: 40 });

    hgetAllMany.mockClear();
    const month = await loadOwnerData(30);
    expect(hgetAllMany.mock.calls[0][0]).toHaveLength(30);
    expect(month.report.totals.lessonStarts).toBe(55);
    expect(month.report.funnel[0]).toMatchObject({ lesson: "ns-1-bits", starts: 53 });
  });

  it("C3: хранилище не ответило — unavailable: true и пустые таблицы, а не тихие нули; в журнале ошибка", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const mem = createMemoryKv();
    const broken: Kv = {
      ...mem,
      kind: "upstash",
      hgetAllMany: async () => {
        throw new Error("upstash http 500");
      },
    };
    kvRef.current = broken;
    const data = await loadOwnerData(7);
    expect(data.unavailable).toBe(true);
    expect(data.storage).toBe("upstash");
    expect(data.report.totals).toEqual({ events: 0, lessonStarts: 0, lessonFinishes: 0 });
    expect(data.issues).toEqual([]);
    expect(data.errors).toEqual([]);
    expect(data.retention.starts).toBe(0);
    expect(err).toHaveBeenCalled();
    expect(String(err.mock.calls[0])).toContain("upstash http 500");
  });

  it("сбой чтения списка жалоб — тоже unavailable (не показываем «жалоб нет»)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const mem = createMemoryKv();
    kvRef.current = {
      ...mem,
      lrange: async () => {
        throw new Error("timeout");
      },
    };
    expect((await loadOwnerData(30)).unavailable).toBe(true);
  });
});

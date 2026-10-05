import { describe, expect, it, vi } from "vitest";
import type { AnalyticsEvent } from "@/lib/analytics";
import { EVENTS_BODY_MAX, parseEvents } from "@/lib/analytics-schema";
import {
  ACTIVE_MARK_KEY,
  activeEventFor,
  ANALYTICS_URL,
  BREAK_DAYS,
  batchBody,
  createAnalyticsClient,
  FLUSH_MS,
  lastStudyDay,
  MAX_PER_HOUR,
  sendBatch,
  shouldAskBreak,
  splitBatches,
  WINDOW_MS,
  type Timers,
} from "@/lib/analytics-client";

const ev = (n = 1): AnalyticsEvent => ({ e: "task", step: `s${n}`, ok: 1, skip: 0, hint: 0 });

/** Ручные часы: таймеры срабатывают только по tick(). */
function fakeTimers() {
  let next = 1;
  const pending = new Map<number, { at: number; fn: () => void }>();
  let now = 0;
  const timers: Timers = {
    set(fn, ms) {
      const id = next++;
      pending.set(id, { at: now + ms, fn });
      return id;
    },
    clear(h) {
      pending.delete(h as number);
    },
  };
  return {
    timers,
    get active() {
      return pending.size;
    },
    tick(ms: number) {
      now += ms;
      for (const [id, t] of [...pending]) {
        if (t.at <= now) {
          pending.delete(id);
          t.fn();
        }
      }
    },
  };
}

const bodyOf = async (blob: Blob): Promise<{ events: AnalyticsEvent[] }> => JSON.parse(await blob.text());

describe("пачки", () => {
  it("не больше 30 событий в пачке, порядок сохраняется", () => {
    const events = Array.from({ length: 75 }, (_, i) => ev(i));
    const batches = splitBatches(events);
    expect(batches.map((b) => b.length)).toEqual([30, 30, 15]);
    expect(batches.flat()).toEqual(events);
    expect(splitBatches([])).toEqual([]);
  });

  it("30 самых длинных верных событий укладываются в тело 4000 байт и проходят серверную проверку", () => {
    // Самое длинное верное событие: id в 80 знаков и все признаки.
    const big = (n: number): AnalyticsEvent => ({ e: "task", step: ("x".repeat(70) + n).slice(0, 80), ok: 0, skip: 1, hint: 1 });
    const events = Array.from({ length: 30 }, (_, i) => big(i));
    const batches = splitBatches(events);
    for (const b of batches) {
      expect(batchBody(b).length).toBeLessThanOrEqual(EVENTS_BODY_MAX);
      expect(parseEvents(JSON.parse(batchBody(b)))).toHaveLength(b.length);
    }
    expect(batches.flat()).toEqual(events);
  });

  it("пачка делится и по размеру: сверх бюджета знаков начинается новая", () => {
    const events = Array.from({ length: 10 }, (_, i) => ev(i));
    const one = JSON.stringify(events[0]).length + 1;
    const batches = splitBatches(events, one * 3);
    expect(batches.map((b) => b.length)).toEqual([3, 3, 3, 1]);
    expect(batches.flat()).toEqual(events);
  });

  it("событие больше бюджета не теряется — идёт отдельной пачкой", () => {
    expect(splitBatches([ev(1), ev(2)], 5).map((b) => b.length)).toEqual([1, 1]);
  });
});

describe("отправка: sendBeacon, иначе fetch с keepalive", () => {
  it("sendBeacon: text/plain, тело { events }", async () => {
    const beacon = vi.fn<(url: string, data: Blob) => boolean>(() => true);
    const fetchMock = vi.fn();
    sendBatch([ev(1), ev(2)], { sendBeacon: beacon, fetch: fetchMock as unknown as typeof fetch });
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    const [url, blob] = beacon.mock.calls[0];
    expect(url).toBe(ANALYTICS_URL);
    expect(blob.type.toLowerCase()).toBe("text/plain;charset=utf-8");
    expect((await bodyOf(blob)).events).toEqual([ev(1), ev(2)]);
  });

  it("sendBeacon отказал или бросил — fetch с keepalive", () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    sendBatch([ev(1)], { sendBeacon: () => false, fetch: fetchMock as unknown as typeof fetch });
    sendBatch([ev(2)], {
      sendBeacon: () => {
        throw new Error("no");
      },
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ANALYTICS_URL);
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
    expect(new Headers(init.headers).get("content-type")).toBe("text/plain;charset=UTF-8");
  });

  it("ничего не бросает: нет ни beacon, ни fetch, fetch упал; пустая пачка не шлётся", async () => {
    expect(() => sendBatch([ev(1)], {})).not.toThrow();
    const rejecting = vi.fn(() => Promise.reject(new Error("offline")));
    expect(() => sendBatch([ev(1)], { fetch: rejecting as unknown as typeof fetch })).not.toThrow();
    const throwing = vi.fn(() => {
      throw new Error("sync");
    });
    expect(() => sendBatch([ev(1)], { fetch: throwing as unknown as typeof fetch })).not.toThrow();
    await Promise.resolve();
    const beacon = vi.fn(() => true);
    sendBatch([], { sendBeacon: beacon });
    expect(beacon).not.toHaveBeenCalled();
  });
});

describe("клиент: буфер и таймер", () => {
  it("первое событие запускает таймер 20 с; всё накопленное уходит одной пачкой, не чаще", async () => {
    const clock = fakeTimers();
    const beacon = vi.fn<(url: string, data: Blob) => boolean>(() => true);
    const c = createAnalyticsClient({ sendBeacon: beacon, timers: clock.timers });
    expect(FLUSH_MS).toBe(20_000);
    expect(c.add(ev(1))).toBe(true);
    clock.tick(10_000);
    c.add(ev(2));
    c.add(ev(3));
    expect(beacon).not.toHaveBeenCalled();
    expect(c.pending).toBe(3);
    clock.tick(10_000);
    expect(beacon).toHaveBeenCalledTimes(1);
    expect((await bodyOf(beacon.mock.calls[0][1])).events).toEqual([ev(1), ev(2), ev(3)]);
    expect(c.pending).toBe(0);
    // Новое событие после отправки — новое окно в 20 с.
    c.add(ev(4));
    clock.tick(19_999);
    expect(beacon).toHaveBeenCalledTimes(1);
    clock.tick(1);
    expect(beacon).toHaveBeenCalledTimes(2);
  });

  it("flush (уход со страницы) отправляет сразу и снимает таймер", () => {
    const clock = fakeTimers();
    const beacon = vi.fn<(url: string, data: Blob) => boolean>(() => true);
    const c = createAnalyticsClient({ sendBeacon: beacon, timers: clock.timers });
    c.add(ev(1));
    expect(clock.active).toBe(1);
    c.flush();
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(clock.active).toBe(0);
    c.flush();
    expect(beacon).toHaveBeenCalledTimes(1);
  });

  it("больше 30 событий в буфере уходят несколькими пачками", () => {
    const clock = fakeTimers();
    const beacon = vi.fn<(url: string, data: Blob) => boolean>(() => true);
    const c = createAnalyticsClient({ sendBeacon: beacon, timers: clock.timers });
    for (let i = 0; i < 70; i++) c.add(ev(i));
    c.flush();
    expect(beacon).toHaveBeenCalledTimes(3);
  });

  it("не больше 300 событий в час: сверх — отброшено, отправка буфера потолок не сбрасывает", () => {
    const clock = fakeTimers();
    let t = 1_000_000;
    const c = createAnalyticsClient({ sendBeacon: () => true, timers: clock.timers, now: () => t });
    expect(MAX_PER_HOUR).toBe(300);
    let ok = 0;
    for (let i = 0; i < MAX_PER_HOUR + 50; i++) if (c.add(ev(i))) ok++;
    expect(ok).toBe(300);
    expect(c.accepted).toBe(300);
    c.flush();
    expect(c.add(ev(1))).toBe(false);
    t += WINDOW_MS - 1;
    expect(c.add(ev(1))).toBe(false);
  });

  it("окно — скользящий час: через час после начала счёт обнуляется, долгая вкладка не глохнет навсегда (C11)", () => {
    const clock = fakeTimers();
    let t = 5_000_000;
    const beacon = vi.fn<(url: string, data: Blob) => boolean>(() => true);
    const c = createAnalyticsClient({ sendBeacon: beacon, timers: clock.timers, now: () => t });
    for (let i = 0; i < MAX_PER_HOUR; i++) expect(c.add(ev(i))).toBe(true);
    expect(c.add(ev(1))).toBe(false); // 301-е
    // Час прошёл — следующее событие принимается, счёт идёт заново.
    t += WINDOW_MS;
    expect(c.accepted).toBe(0);
    expect(c.add({ e: "lesson_finish", lesson: "ns-1-bits", via: "learn", acc: 90, sec: 60 })).toBe(true);
    expect(c.accepted).toBe(1);
    // …и потолок в новом окне — снова 300.
    for (let i = 1; i < MAX_PER_HOUR; i++) expect(c.add(ev(i))).toBe(true);
    expect(c.add(ev(1))).toBe(false);
    c.flush();
    expect(beacon).toHaveBeenCalled();
  });

  it("мусор не копится и не отправляется (та же проверка, что на сервере)", () => {
    const clock = fakeTimers();
    const beacon = vi.fn(() => true);
    const c = createAnalyticsClient({ sendBeacon: beacon, timers: clock.timers });
    expect(c.add({ e: "task", step: "плохой id с пробелом", ok: 1, skip: 0, hint: 0 })).toBe(false);
    expect(c.add({ e: "nope" } as unknown as AnalyticsEvent)).toBe(false);
    expect(c.add({ ...ev(1), name: "Айгерим" } as unknown as AnalyticsEvent)).toBe(true);
    expect(c.pending).toBe(1);
    c.flush();
    expect(JSON.stringify(beacon.mock.calls)).not.toContain("Айгерим");
  });

  it("stop (ученик выключил статистику): накопленное не отправляется, новое не принимается", () => {
    const clock = fakeTimers();
    const beacon = vi.fn(() => true);
    const c = createAnalyticsClient({ sendBeacon: beacon, timers: clock.timers });
    c.add(ev(1));
    c.stop();
    expect(clock.active).toBe(0);
    expect(c.pending).toBe(0);
    expect(c.add(ev(2))).toBe(false);
    c.flush();
    clock.tick(60_000);
    expect(beacon).not.toHaveBeenCalled();
  });
});

describe("удержание: событие active", () => {
  const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0).getTime();
  const memory = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
  };

  it("d = 0, 1, 7, 30 календарных дней с первого запуска", () => {
    const created = at(2026, 9, 1, 23);
    const cases: [number, 0 | 1 | 7 | 30][] = [
      [at(2026, 9, 1, 23), 0],
      [at(2026, 9, 2, 0), 1], // через час после полуночи — уже «день 1», хотя прошёл всего час
      [at(2026, 9, 8, 8), 7],
      [at(2026, 10, 1, 20), 30],
    ];
    for (const [now, d] of cases) expect(activeEventFor(created, now, memory()), String(d)).toEqual({ e: "active", d });
  });

  it("остальные дни — ничего", () => {
    const created = at(2026, 9, 1);
    for (const day of [2, 3, 6, 8, 29, 31, 60]) {
      const now = created + day * 86_400_000;
      expect(activeEventFor(created, now, memory()), String(day)).toBeNull();
    }
  });

  it("нет первого запуска (createdAt ≤ 0) или время испорчено — ничего", () => {
    expect(activeEventFor(0, at(2026, 9, 1), memory())).toBeNull();
    expect(activeEventFor(-5, at(2026, 9, 1), memory())).toBeNull();
    expect(activeEventFor(NaN, at(2026, 9, 1), memory())).toBeNull();
    expect(activeEventFor(at(2026, 9, 1), NaN, memory())).toBeNull();
  });

  it("раз в календарный день: повторный вход в тот же день — ничего; через день отметка новая", () => {
    const created = at(2026, 9, 1);
    const store = memory();
    expect(activeEventFor(created, at(2026, 9, 2, 9), store)).toEqual({ e: "active", d: 1 });
    expect(store.data.get(ACTIVE_MARK_KEY)).toBe("2026-09-02");
    expect(activeEventFor(created, at(2026, 9, 2, 21), store)).toBeNull();
    // День 7 — другой календарный день, отметка не мешает.
    expect(activeEventFor(created, at(2026, 9, 8, 9), store)).toEqual({ e: "active", d: 7 });
  });

  it("хранилище недоступно (бросает) — не падает и событие отправляется", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(activeEventFor(at(2026, 9, 1), at(2026, 9, 1), broken)).toEqual({ e: "active", d: 0 });
    expect(activeEventFor(at(2026, 9, 1), at(2026, 9, 1), null)).toEqual({ e: "active", d: 0 });
  });
});

describe("«Что помешало?»: когда спрашивать", () => {
  it("последний день занятий: позднее из серии и дней; мусор не считается", () => {
    expect(lastStudyDay(null, [])).toBeNull();
    expect(lastStudyDay("2026-10-01", [])).toBe("2026-10-01");
    expect(lastStudyDay("2026-10-01", ["2026-09-20", "2026-10-03", "2026-10-02"])).toBe("2026-10-03");
    expect(lastStudyDay(undefined, ["2026-09-20"])).toBe("2026-09-20");
    expect(lastStudyDay("мусор", ["тоже", "2026-9-1", "2026-09-05"])).toBe("2026-09-05");
  });

  it("перерыв меньше 3 дней — не спрашиваем, 3 и больше — спрашиваем", () => {
    expect(BREAK_DAYS).toBe(3);
    expect(shouldAskBreak("2026-10-05", "2026-10-05", null)).toBe(false);
    expect(shouldAskBreak("2026-10-04", "2026-10-05", null)).toBe(false);
    expect(shouldAskBreak("2026-10-03", "2026-10-05", null)).toBe(false);
    expect(shouldAskBreak("2026-10-02", "2026-10-05", null)).toBe(true);
    expect(shouldAskBreak("2026-08-01", "2026-10-05", null)).toBe(true);
  });

  it("один раз за перерыв: после ответа тот же последний день не спрашиваем; новый перерыв — снова", () => {
    expect(shouldAskBreak("2026-10-01", "2026-10-06", "2026-10-01")).toBe(false);
    expect(shouldAskBreak("2026-10-01", "2026-11-20", "2026-10-01")).toBe(false);
    // Позанимался 10 ноября, снова ушёл — новый перерыв.
    expect(shouldAskBreak("2026-11-10", "2026-11-20", "2026-10-01")).toBe(true);
  });

  it("занятий не было вовсе — не спрашиваем", () => {
    expect(shouldAskBreak(null, "2026-10-05", null)).toBe(false);
  });
});

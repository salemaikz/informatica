import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DAY, ENTRY_COST, HOUR, MINUTE, heartsView } from "@/lib/economy";
import {
  THEORY_PAID_MAX,
  THEORY_REPEAT_MS,
  putTheoryPaid,
  sanitizeTheoryPaid,
  shouldPayTheory,
  theoryCost,
  theoryOpenStep,
  theoryPaidRecently,
} from "@/lib/theory-pay";
import { mergeState, useApp } from "@/lib/store";
import { todayKey } from "@/lib/text";

const NOW = 1_800_000_000_000;
const base = { unlimited: false, paidAt: undefined as number | undefined, now: NOW };

describe("плата за теорию: правила (этап 15, F2.3; этап 16В — ½ сердечка при открытии темы, решение #113)", () => {
  it("цена — ENTRY_COST.theory = 0,5; повтор — сутки", () => {
    expect(theoryCost()).toBe(0.5);
    expect(ENTRY_COST.theory).toBe(0.5);
    expect(THEORY_REPEAT_MS).toBe(DAY);
  });

  it("P1: обычная тема без оплаты — платим", () => {
    expect(shouldPayTheory(base)).toBe(true);
  });

  it("пройденный урок платный, как и любой другой: прохождение на оплату не влияет (владелец: «теория тоже платная»)", () => {
    // Пройденность в правилах не участвует вовсе: лишнее поле не меняет ответа.
    const input = { ...base, done: true } as typeof base;
    expect(shouldPayTheory(input)).toBe(true);
  });

  it("P2: «Безлимит» (и пробный) — бесплатно, и важнее записи об оплате", () => {
    expect(shouldPayTheory({ ...base, unlimited: true })).toBe(false);
    expect(shouldPayTheory({ ...base, unlimited: true, paidAt: NOW - HOUR })).toBe(false);
  });

  it("P2: оплачено за последние 24 часа — бесплатно; ровно через сутки и позже — снова платно", () => {
    expect(shouldPayTheory({ ...base, paidAt: NOW - 1 })).toBe(false);
    expect(shouldPayTheory({ ...base, paidAt: NOW - 23 * HOUR })).toBe(false);
    expect(shouldPayTheory({ ...base, paidAt: NOW - DAY + 1 })).toBe(false);
    expect(shouldPayTheory({ ...base, paidAt: NOW - DAY })).toBe(true);
    expect(shouldPayTheory({ ...base, paidAt: NOW - 3 * DAY })).toBe(true);
  });

  it("оплата «из ближайшего будущего» (часы интерфейса отстают на тик) — считается оплаченной, из далёкого — мусор", () => {
    expect(shouldPayTheory({ ...base, paidAt: NOW + 5_000 })).toBe(false);
    expect(shouldPayTheory({ ...base, paidAt: NOW + 10 * MINUTE })).toBe(true);
  });

  it("мусор вместо времени — платим", () => {
    for (const paidAt of [NaN, Infinity, "x" as unknown as number, null as unknown as number]) {
      expect(shouldPayTheory({ ...base, paidAt })).toBe(true);
    }
  });

  it("theoryPaidRecently — то же правило без «Безлимита»", () => {
    expect(theoryPaidRecently(NOW - HOUR, NOW)).toBe(true);
    expect(theoryPaidRecently(NOW - DAY, NOW)).toBe(false);
    expect(theoryPaidRecently(undefined, NOW)).toBe(false);
  });
});

describe("открытие темы: что показывает страница (theoryOpenStep)", () => {
  const step = (over: Partial<Parameters<typeof theoryOpenStep>[0]> = {}) =>
    theoryOpenStep({ admitted: false, refused: false, unlimited: false, paidAt: undefined, now: NOW, ...over });

  it("P1: тема не оплачена — pay: оплату делает колбэк страницы, текста пока нет", () => {
    expect(step()).toBe("pay");
  });

  it("время ещё неизвестно (первый кадр) — wait, ничего не списываем", () => {
    expect(step({ now: 0 })).toBe("wait");
  });

  it("P2: оплачено за сутки или «Безлимит» — сразу open, без оплаты", () => {
    expect(step({ paidAt: NOW - HOUR })).toBe("open");
    expect(step({ unlimited: true })).toBe("open");
  });

  it("P3: сердечек не хватило — locked: текст темы не показывается; пока не отказали — снова pay", () => {
    expect(step({ refused: true })).toBe("locked");
    expect(step({ refused: false })).toBe("pay");
  });

  it("после покупки сердечек (resume списал и записал оплату) locked сменяется open", () => {
    expect(step({ refused: true, paidAt: NOW })).toBe("open");
  });

  it("открытая тема не закрывается, даже если запись об оплате устарела или вытеснена", () => {
    expect(step({ admitted: true, paidAt: undefined })).toBe("open");
    expect(step({ admitted: true, refused: true })).toBe("open");
  });
});

describe("theoryPaid: очистка недоверенных данных и обрезка", () => {
  it("не объект — пусто", () => {
    for (const g of [null, undefined, 0, 5, "x", true, [], [1, 2], NaN]) expect(sanitizeTheoryPaid(g, NOW)).toEqual({});
  });

  it("остаются только «строка → время за последние сутки»", () => {
    const raw = {
      ok: NOW - HOUR,
      old: NOW - DAY,
      older: NOW - 5 * DAY,
      future: NOW + DAY,
      skew: NOW + 10_000,
      text: "вчера",
      nan: NaN,
      inf: Infinity,
      obj: { at: NOW },
      "": NOW,
    };
    expect(sanitizeTheoryPaid(raw, NOW)).toEqual({ ok: NOW - HOUR, skew: NOW + 10_000 });
  });

  it("слишком длинный id отбрасывается", () => {
    expect(sanitizeTheoryPaid({ ["x".repeat(81)]: NOW }, NOW)).toEqual({});
  });

  it(`записей не больше ${THEORY_PAID_MAX}: остаются самые свежие`, () => {
    const raw: Record<string, number> = {};
    for (let i = 0; i < THEORY_PAID_MAX + 20; i++) raw[`l${i}`] = NOW - i * 1000;
    const out = sanitizeTheoryPaid(raw, NOW);
    expect(Object.keys(out)).toHaveLength(THEORY_PAID_MAX);
    expect(out.l0).toBe(NOW);
    expect(out[`l${THEORY_PAID_MAX}`]).toBeUndefined();
  });

  it("putTheoryPaid: добавляет, обновляет и выбрасывает просроченное; исходный объект не меняет", () => {
    const before = { a: NOW - 2 * DAY, b: NOW - HOUR };
    const out = putTheoryPaid(before, "c", NOW);
    expect(out).toEqual({ b: NOW - HOUR, c: NOW });
    expect(before).toEqual({ a: NOW - 2 * DAY, b: NOW - HOUR });
    expect(putTheoryPaid(out, "b", NOW).b).toBe(NOW);
  });
});

const st = () => useApp.getState();
const LESSON = "ns-2-read";
const heart = () => heartsView(st().hearts, "free", Date.now(), todayKey()).count;

describe("стор: payTheory", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2027, 0, 15, 12, 0, 0));
    st().resetProgress();
    useApp.setState({ plan: { tier: "free" } });
  });
  afterEach(() => vi.useRealTimers());

  it("первое чтение — 0,5 сердечка и запись об оплате", () => {
    expect(heart()).toBe(5);
    const r = st().payTheory(LESSON);
    expect(r).toMatchObject({ ok: true, paid: 0.5 });
    expect(r.view.count).toBe(4.5);
    expect(heart()).toBe(4.5);
    expect(st().theoryPaid[LESSON]).toBe(Date.now());
  });

  it("повтор в течение суток — бесплатно, не списывает и запись не двигает", () => {
    st().payTheory(LESSON);
    const at = st().theoryPaid[LESSON];
    vi.setSystemTime(Date.now() + 20 * HOUR);
    const hearts = heart();
    const r = st().payTheory(LESSON);
    expect(r).toMatchObject({ ok: true, paid: 0 });
    expect(heart()).toBe(hearts);
    expect(st().theoryPaid[LESSON]).toBe(at);
  });

  it("через сутки — снова 0,5", () => {
    st().payTheory(LESSON);
    vi.setSystemTime(Date.now() + DAY + MINUTE);
    const before = heart(); // за сутки восстановились целые сердечки
    expect(before).toBe(5);
    expect(st().payTheory(LESSON)).toMatchObject({ ok: true, paid: 0.5 });
    expect(heart()).toBe(4.5);
  });

  it("другой конспект платится отдельно", () => {
    st().payTheory(LESSON);
    expect(st().payTheory("ns-1-intro")).toMatchObject({ ok: true, paid: 0.5 });
    expect(heart()).toBe(4);
  });

  it("пройденный урок — тоже платно (этап 16В): 0,5 и запись об оплате", () => {
    useApp.setState((s) => ({
      lessons: { ...s.lessons, [LESSON]: { completions: 1, bestAccuracy: 1, lastAt: Date.now(), totalXp: 10 } },
    }));
    expect(st().payTheory(LESSON)).toMatchObject({ ok: true, paid: 0.5 });
    expect(heart()).toBe(4.5);
    expect(st().theoryPaid[LESSON]).toBe(Date.now());
    // и повтор за сутки — бесплатно
    expect(st().payTheory(LESSON)).toMatchObject({ ok: true, paid: 0 });
    expect(heart()).toBe(4.5);
  });

  it("«Безлимит» (в том числе пробный) — бесплатно", () => {
    expect(st().startTrial()).toBe(true);
    expect(st().payTheory(LESSON)).toMatchObject({ ok: true, paid: 0 });
    expect(st().theoryPaid).toEqual({});
  });

  it("не хватает сердечек — отказ, ничего не списано и не записано", () => {
    useApp.setState({ hearts: { count: 0, updatedAt: Date.now(), day: todayKey() } });
    const r = st().payTheory(LESSON);
    expect(r).toMatchObject({ ok: false, paid: 0 });
    expect(heart()).toBe(0);
    expect(st().theoryPaid).toEqual({});
  });

  it("ровно 0,5 хватает: остаётся 0", () => {
    useApp.setState({ hearts: { count: 0.5, updatedAt: Date.now(), day: todayKey() } });
    expect(st().payTheory(LESSON)).toMatchObject({ ok: true, paid: 0.5 });
    expect(heart()).toBe(0);
  });

  it("после теории целый вход в урок: 4,5 хватает на 1, остаётся 3,5", () => {
    st().payTheory(LESSON);
    expect(st().payEntry(1)).toMatchObject({ ok: true, paid: 1 });
    expect(heart()).toBe(3.5);
  });
});

describe("стор: загрузка сохранений с сердечками и теорией", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2027, 0, 15, 12, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("старые сохранения с целыми сердечками читаются как есть; theoryPaid по умолчанию пустой", () => {
    const m = mergeState({ hearts: { count: 3, updatedAt: 5, day: "2027-01-14" } }, st());
    expect(m.hearts).toEqual({ count: 3, updatedAt: 5, day: "2027-01-14" });
    expect(m.theoryPaid).toEqual({});
  });

  it("половинки сохраняются, мусор и просроченное в theoryPaid отбрасывается", () => {
    const now = Date.now();
    const m = mergeState(
      { hearts: { count: 4.5, updatedAt: 5, day: "2027-01-15" }, theoryPaid: { a: now - HOUR, b: now - 3 * DAY, c: "x", d: NaN } },
      st(),
    );
    expect(m.hearts.count).toBe(4.5);
    expect(m.theoryPaid).toEqual({ a: now - HOUR });
    expect(mergeState({ theoryPaid: "мусор" }, st()).theoryPaid).toEqual({});
    expect(mergeState({ theoryPaid: [1, 2] }, st()).theoryPaid).toEqual({});
  });
});

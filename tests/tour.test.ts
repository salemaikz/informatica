import { describe, expect, it } from "vitest";
import { TIP_IDS, sanitizeTips, type TipsState } from "@/lib/tips";
import { NAV_STEPS, completedLessonsCount, learnScene, padRect, placeBubble, sameRect, showAfterFirst, showLessonFirst, showPageTip, tourBlocking, unionRect, unseenTips } from "@/lib/tour";

// Проводник первого входа (этап 16Б, P6): что показывать, когда ждут другие окна, геометрия выреза и пузыря.

const ctx = { onboarded: true, pathname: "/learn" };
const seen = (...ids: (typeof TIP_IDS)[number][]): TipsState => Object.fromEntries(ids.map((id) => [id, 1]));

describe("learnScene: что показать на «Учиться»", () => {
  it("новый ученик без уроков — приветствие", () => {
    expect(learnScene({}, { ...ctx, completedLessons: 0 })).toBe("welcome");
    expect(learnScene(undefined, { ...ctx, completedLessons: 0 })).toBe("welcome");
  });
  it("приветствие закрыто, урока ещё нет — ничего (ждём первый урок)", () => {
    expect(learnScene(seen("welcome"), { ...ctx, completedLessons: 0 })).toBeNull();
  });
  it("первый урок пройден — обзор панели (приветствие показывать уже не нужно)", () => {
    expect(learnScene(seen("welcome", "lesson-first", "after-first"), { ...ctx, completedLessons: 1 })).toBe("nav");
    expect(learnScene({}, { ...ctx, completedLessons: 1 })).toBe("nav");
  });
  it("обзор показан — больше ничего", () => {
    expect(learnScene(seen("nav"), { ...ctx, completedLessons: 5 })).toBeNull();
    expect(learnScene(seen("nav"), { ...ctx, completedLessons: 0 })).toBeNull();
  });
  it("не на «Учиться» и до онбординга — ничего", () => {
    expect(learnScene({}, { completedLessons: 0, onboarded: true, pathname: "/practice" })).toBeNull();
    expect(learnScene({}, { completedLessons: 2, onboarded: true, pathname: "/lesson/x" })).toBeNull();
    expect(learnScene({}, { completedLessons: 0, onboarded: false, pathname: "/learn" })).toBeNull();
  });
  it("«Пропустить» отмечает всё — после него ничего не показывается", () => {
    const all: TipsState = Object.fromEntries(TIP_IDS.map((id) => [id, 1]));
    expect(learnScene(all, { ...ctx, completedLessons: 0 })).toBeNull();
    expect(learnScene(all, { ...ctx, completedLessons: 3 })).toBeNull();
    expect(unseenTips(all)).toEqual([]);
  });
});

describe("tourBlocking: ожидание других окон", () => {
  it("пока не пройден обзор панели — тарифы и напоминания ждут", () => {
    expect(tourBlocking({})).toBe(true);
    expect(tourBlocking(seen("welcome", "lesson-first", "after-first"))).toBe(true);
  });
  it("после обзора (или «Пропустить») — не ждут", () => {
    expect(tourBlocking(seen("nav"))).toBe(false);
  });
});

describe("карточки и подсказки", () => {
  it("итоги первого урока: один раз и только на первом пройденном уроке", () => {
    expect(showAfterFirst({}, 0)).toBe(true);
    expect(showAfterFirst({}, 1)).toBe(true);
    expect(showAfterFirst({}, 2)).toBe(false);
    expect(showAfterFirst(seen("after-first"), 1)).toBe(false);
  });
  it("подсказка первого урока: до первого пройденного урока и один раз", () => {
    expect(showLessonFirst({}, 0)).toBe(true);
    expect(showLessonFirst({}, 1)).toBe(false);
    expect(showLessonFirst(seen("lesson-first"), 0)).toBe(false);
  });
  it("карточка страницы: не во время проводника, один раз, у каждой страницы своя", () => {
    expect(showPageTip({}, "page-practice")).toBe(false);
    expect(showPageTip(seen("nav"), "page-practice")).toBe(true);
    expect(showPageTip(seen("nav", "page-practice"), "page-practice")).toBe(false);
    expect(showPageTip(seen("nav", "page-practice"), "page-tutor")).toBe(true);
  });
  it("«Показать подсказки снова»: пустое состояние запускает проводник заново", () => {
    expect(learnScene(sanitizeTips({}), { ...ctx, completedLessons: 0 })).toBe("welcome");
    expect(tourBlocking(sanitizeTips({}))).toBe(true);
  });
  it("число пройденных уроков: только с completions > 0", () => {
    expect(completedLessonsCount(undefined)).toBe(0);
    expect(completedLessonsCount({ a: { completions: 1 }, b: { completions: 0 }, c: undefined, d: {} })).toBe(1);
  });
  it("обзор панели — не больше трёх шагов", () => {
    expect(NAV_STEPS.length).toBeLessThanOrEqual(3);
    expect(NAV_STEPS.at(-1)?.id).toBe("done");
  });
});

describe("геометрия выреза", () => {
  it("объединение прямоугольников — рамка вокруг группы; пусто — null", () => {
    expect(unionRect([])).toBeNull();
    expect(
      unionRect([
        { x: 10, y: 10, w: 20, h: 20 },
        { x: 100, y: 5, w: 30, h: 10 },
      ]),
    ).toEqual({ x: 10, y: 5, w: 120, h: 25 });
  });
  it("padRect раздувает и не выходит за окно", () => {
    expect(padRect({ x: 2, y: 2, w: 10, h: 10 }, 6, 400, 800)).toEqual({ x: 0, y: 0, w: 18, h: 18 });
    expect(padRect({ x: 390, y: 790, w: 10, h: 10 }, 6, 400, 800)).toEqual({ x: 384, y: 784, w: 16, h: 16 });
  });
  it("sameRect: округление и null", () => {
    expect(sameRect(null, null)).toBe(true);
    expect(sameRect(null, { x: 0, y: 0, w: 1, h: 1 })).toBe(false);
    expect(sameRect({ x: 1.2, y: 2, w: 3, h: 4 }, { x: 1.4, y: 2, w: 3, h: 4 })).toBe(true);
  });
});

describe("placeBubble: где стоит пузырь", () => {
  const o = { w: 360, h: 200, vw: 390, vh: 800 };
  it("без выреза — по центру окна", () => {
    const p = placeBubble(null, o);
    expect(p.top).toBe(300);
    expect(p.width).toBe(360);
    expect(p.left).toBeCloseTo((390 - p.width) / 2);
  });
  it("вырез вверху — пузырь под ним", () => {
    const p = placeBubble({ x: 100, y: 10, w: 150, h: 40 }, o);
    expect(p.top).toBe(10 + 40 + 12);
  });
  it("вырез внизу (нижняя панель) — пузырь над ним", () => {
    const p = placeBubble({ x: 0, y: 730, w: 390, h: 70 }, o);
    expect(p.top).toBe(730 - 12 - 200);
  });
  it("не выходит за края окна по горизонтали", () => {
    const p = placeBubble({ x: 340, y: 10, w: 40, h: 40 }, { ...o, w: 300 });
    expect(p.left + p.width).toBeLessThanOrEqual(390 - 12);
    const q = placeBubble({ x: 0, y: 10, w: 20, h: 40 }, { ...o, w: 300 });
    expect(q.left).toBeGreaterThanOrEqual(12);
  });
  it("узкое окно сжимает пузырь, но поля остаются", () => {
    const p = placeBubble(null, { w: 360, h: 100, vw: 320, vh: 600 });
    expect(p.width).toBe(320 - 24);
    expect(p.left).toBe(12);
  });
  it("нет места ни сверху, ни снизу — пузырь остаётся внутри окна", () => {
    const p = placeBubble({ x: 20, y: 40, w: 300, h: 500 }, { w: 360, h: 300, vw: 390, vh: 600 });
    expect(p.top).toBeGreaterThanOrEqual(12);
    expect(p.top + 300).toBeLessThanOrEqual(600 - 12);
  });
});

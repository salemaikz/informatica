import { describe, expect, it } from "vitest";
import { TIP_IDS, sanitizeTips, type TipsState } from "@/lib/tips";
import {
  BIT_SIZE,
  FINGER_ROOM,
  GUIDE_SCENES,
  completedLessonsCount,
  aimFinger,
  estimateBubbleH,
  fingerPose,
  fingerRect,
  guideScroll,
  keepDash,
  overlaps,
  padRect,
  placeBit,
  placeFromDock,
  placementRects,
  roomBelow,
  sameRect,
  tailLeft,
  sceneFor,
  sceneSteps,
  stepText,
  tourBlocking,
  unionRect,
  unseenTips,
  type Rect,
  type SceneCtx,
} from "@/lib/guide";
import { dict } from "@/i18n/dict";

// Всплывающий Бит-проводник (этап 16В, P2a): какая сцена играет, тексты шагов, геометрия Бита, пузыря и пальца.

const seen = (...ids: (typeof TIP_IDS)[number][]): TipsState => Object.fromEntries(ids.map((id) => [id, 1]));
const all: TipsState = Object.fromEntries(TIP_IDS.map((id) => [id, 1]));
const ctx = (over: Partial<SceneCtx> = {}): SceneCtx => ({ pathname: "/learn", onboarded: true, completedLessons: 0, inLesson: false, onResults: false, ...over });

describe("sceneFor: путь первого входа", () => {
  it("новый ученик на «Учиться» — приветствие", () => {
    expect(sceneFor({}, ctx())).toBe("welcome");
    expect(sceneFor(undefined, ctx())).toBe("welcome");
  });
  it("приветствие закрыто, урока ещё нет — молчит до первого урока", () => {
    expect(sceneFor(seen("welcome"), ctx())).toBeNull();
  });
  it("в первом уроке (режим «Учиться») — lesson-first; уже не первый урок — ничего", () => {
    expect(sceneFor(seen("welcome"), ctx({ pathname: "/lesson/a", inLesson: true }))).toBe("lesson-first");
    expect(sceneFor(seen("welcome", "lesson-first"), ctx({ pathname: "/lesson/a", inLesson: true }))).toBeNull();
    expect(sceneFor({}, ctx({ pathname: "/lesson/a", inLesson: true, completedLessons: 1 }))).toBeNull();
  });
  it("урок без метки «Учиться» («Проверить себя», тренировка) — ничего", () => {
    expect(sceneFor({}, ctx({ pathname: "/lesson/a" }))).toBeNull();
    expect(sceneFor({}, ctx({ pathname: "/drill" }))).toBeNull();
  });
  it("итоги первого урока — after-first, метка итогов важнее метки урока", () => {
    expect(sceneFor(seen("welcome", "lesson-first"), ctx({ pathname: "/lesson/a", inLesson: true, onResults: true, completedLessons: 1 }))).toBe("after-first");
    expect(sceneFor(seen("after-first"), ctx({ pathname: "/lesson/a", inLesson: true, onResults: true, completedLessons: 1 }))).toBeNull();
    // Не первый пройденный урок — итоги без сцены (и без lesson-first).
    expect(sceneFor({}, ctx({ pathname: "/lesson/b", inLesson: true, onResults: true, completedLessons: 2 }))).toBeNull();
  });
  it("после первого урока на «Учиться» — nav, приветствие уже не нужно", () => {
    expect(sceneFor(seen("welcome", "lesson-first", "after-first"), ctx({ completedLessons: 1 }))).toBe("nav");
    expect(sceneFor({}, ctx({ completedLessons: 3 }))).toBe("nav");
  });
  it("страницы — только после nav и один раз", () => {
    expect(sceneFor({}, ctx({ pathname: "/practice", completedLessons: 1 }))).toBeNull();
    expect(sceneFor(seen("nav"), ctx({ pathname: "/practice" }))).toBe("page-practice");
    expect(sceneFor(seen("nav", "page-practice"), ctx({ pathname: "/practice" }))).toBeNull();
    expect(sceneFor(seen("nav"), ctx({ pathname: "/materials" }))).toBe("page-materials");
    expect(sceneFor(seen("nav"), ctx({ pathname: "/stats" }))).toBe("page-progress");
    expect(sceneFor(seen("nav"), ctx({ pathname: "/shop" }))).toBe("page-shop");
    expect(sceneFor(seen("nav"), ctx({ pathname: "/profile" }))).toBe("page-profile");
    expect(sceneFor(seen("nav"), ctx({ pathname: "/tutor" }))).toBe("page-tutor");
  });
  it("подстраницы и экраны без сцен (чат, пробный ЕНТ, игра, онбординг) — ничего", () => {
    for (const pathname of ["/tutor/abc", "/exam/run", "/game/bit-rush", "/onboarding", "/practice/x"]) expect(sceneFor(seen("nav"), ctx({ pathname }))).toBeNull();
  });
  it("школьный трек: после nav на «Учиться» — сцена про выбор класса", () => {
    expect(sceneFor(seen("nav"), ctx({ school: true }))).toBe("page-school");
    expect(sceneFor(seen("nav"), ctx())).toBeNull();
    expect(sceneFor({}, ctx({ school: true }))).toBe("welcome");
  });
  it("до онбординга — ничего; «Пропустить» (всё отмечено) — больше ничего", () => {
    expect(sceneFor({}, ctx({ onboarded: false }))).toBeNull();
    for (const over of [{}, { completedLessons: 2 }, { pathname: "/shop" }, { pathname: "/lesson/a", inLesson: true }, { onResults: true, completedLessons: 1 }])
      expect(sceneFor(all, ctx(over))).toBeNull();
    expect(unseenTips(all)).toEqual([]);
    expect(unseenTips({})).toEqual([...TIP_IDS]);
  });
});

describe("tourBlocking и служебное", () => {
  it("пока nav не показан — тарифы, напоминания и кейс ждут", () => {
    expect(tourBlocking({})).toBe(true);
    expect(tourBlocking(seen("welcome", "lesson-first", "after-first"))).toBe(true);
    expect(tourBlocking(seen("nav"))).toBe(false);
    expect(tourBlocking(sanitizeTips({ nav: 5, junk: 1 }))).toBe(false);
  });
  it("новые сцены сохраняются, чужие id — нет", () => {
    expect(sanitizeTips({ "page-shop": 3, "page-profile": 4, "page-x": 1 })).toEqual({ "page-shop": 3, "page-profile": 4 });
  });
  it("completedLessonsCount считает уроки, пройденные хотя бы раз", () => {
    expect(completedLessonsCount(undefined)).toBe(0);
    expect(completedLessonsCount({ a: { completions: 1 }, b: { completions: 0 }, c: undefined, d: {} })).toBe(1);
  });
});

describe("сцены", () => {
  it("у каждой сцены из TIP_IDS есть шаги; тексты — ключи словаря guide.* на двух языках", () => {
    for (const id of TIP_IDS) {
      const scene = GUIDE_SCENES[id];
      expect(scene.id).toBe(id);
      expect(scene.steps.length).toBeGreaterThan(0);
      for (const st of scene.steps) {
        for (const key of [st.text, st.textSchool, st.textNoName, st.textMany, st.orElse?.text]) {
          if (!key) continue;
          expect(key.startsWith("guide."), key).toBe(true);
          expect(dict[key].ru.length).toBeGreaterThan(0);
          expect(dict[key].kk.length).toBeGreaterThan(0);
        }
      }
    }
  });
  it("сцены короткие: 1–5 реплик, страницы — 1–2", () => {
    for (const id of TIP_IDS) {
      const n = GUIDE_SCENES[id].steps.length;
      expect(n).toBeLessThanOrEqual(id.startsWith("page-") ? 2 : 5);
    }
  });
  it("ключевые шаги «нажми»: начать урок, вариант, «Проверить», «Продолжить» на итогах, чипы", () => {
    const tap = (id: keyof typeof GUIDE_SCENES) => GUIDE_SCENES[id].steps.filter((s) => s.action === "tap").map((s) => s.targets?.[0]);
    expect(tap("welcome")).toEqual(["continue"]);
    expect(tap("lesson-first")).toEqual(["lesson-options", "lesson-check"]);
    expect(tap("after-first")).toEqual(["res-continue"]);
    expect(tap("nav")).toEqual(["hdr-chips"]);
    // У каждого шага «нажми» есть цель — иначе нажимать некуда.
    for (const id of TIP_IDS) for (const s of GUIDE_SCENES[id].steps) if (s.action === "tap") expect(s.targets?.length, `${id}/${s.id}`).toBeGreaterThan(0);
  });
  it("в уроке вариант ждут долго (сначала шаги-рассказы), «Проверить» и подсказка — только после показанного варианта", () => {
    const steps = GUIDE_SCENES["lesson-first"].steps;
    expect(steps[2].waitMs).toBeGreaterThanOrEqual(60_000);
    expect(steps[3].chain).toBe(true);
    expect(steps[4].chain).toBe(true);
  });
  it("sceneSteps убирает шаги «только ЕНТ» для школьного трека", () => {
    const scene = { id: "nav" as const, steps: [{ id: "a", text: "guide.ok" as const, action: "next" as const }, { id: "b", text: "guide.ok" as const, action: "next" as const, ent: true }] };
    expect(sceneSteps(scene, true).map((s) => s.id)).toEqual(["a", "b"]);
    expect(sceneSteps(scene, false).map((s) => s.id)).toEqual(["a"]);
  });
});

describe("stepText", () => {
  const welcome = GUIDE_SCENES.welcome.steps;
  it("приветствие с именем и без", () => {
    expect(stepText(welcome[0], { name: "Аня" })).toBe("guide.welcome.hi");
    expect(stepText(welcome[0], { name: "  " })).toBe("guide.welcome.hi0");
    expect(dict["guide.welcome.hi"].ru).toContain("{name}");
  });
  it("школьный трек: про урок — без «по порядку» и без названия кнопки", () => {
    expect(stepText(welcome[1], { school: true })).toBe("guide.welcome.continue.school");
    expect(stepText(welcome[3], { school: true })).toBe("guide.welcome.start.school");
    expect(stepText(welcome[3], { school: true, fallback: true })).toBe("guide.welcome.noLesson");
  });
  it("нет урока — запасная реплика", () => {
    expect(stepText(welcome[3], { fallback: true })).toBe("guide.welcome.noLesson");
    expect(stepText(welcome[3], {})).toBe("guide.welcome.start");
  });
  it("школьный трек — без пробного ЕНТ", () => {
    const bar = GUIDE_SCENES.nav.steps[1];
    expect(stepText(bar, { school: false })).toBe("guide.nav.bar");
    expect(stepText(bar, { school: true })).toBe("guide.nav.bar.school");
    expect(dict["guide.nav.bar.school"].ru).not.toContain("ЕНТ");
    expect(dict["guide.nav.bar.school"].kk).not.toContain("ҰБТ");
  });
  it("одно сердечко — «сердечко», два — «сердечка»", () => {
    const hearts = GUIDE_SCENES["lesson-first"].steps[0];
    expect(stepText(hearts, { n: 1 })).toBe("guide.lesson.hearts");
    expect(stepText(hearts, { n: 2 })).toBe("guide.lesson.heartsMany");
    expect(stepText(hearts, {})).toBe("guide.lesson.hearts");
  });
  it("«Безлимит» и пробный: сердечки не списывались — своя реплика, без «списал»", () => {
    const hearts = GUIDE_SCENES["lesson-first"].steps[0];
    expect(stepText(hearts, { n: 1, free: true })).toBe("guide.lesson.heartsFree");
    expect(stepText(hearts, { n: 2, free: true })).toBe("guide.lesson.heartsFree");
    expect(dict["guide.lesson.heartsFree"].ru).not.toContain("списал");
    expect(dict["guide.lesson.heartsFree"].ru).toContain("Безлимит");
    expect(dict["guide.lesson.heartsFree"].kk).toContain("Шексіз");
    // Остальные шаги на безлимит не реагируют.
    expect(stepText(GUIDE_SCENES.welcome.steps[2], { free: true })).toBe("guide.welcome.hearts");
  });
});

describe("геометрия: рамка", () => {
  it("unionRect объединяет, пустой список — null", () => {
    expect(unionRect([])).toBeNull();
    expect(unionRect([{ x: 10, y: 10, w: 20, h: 20 }, { x: 50, y: 5, w: 10, h: 10 }])).toEqual({ x: 10, y: 5, w: 50, h: 25 });
  });
  it("padRect раздувает и не вылезает за окно", () => {
    expect(padRect({ x: 2, y: 2, w: 10, h: 10 }, 6, 100, 100)).toEqual({ x: 0, y: 0, w: 18, h: 18 });
    expect(padRect({ x: 90, y: 90, w: 10, h: 10 }, 6, 100, 100)).toEqual({ x: 84, y: 84, w: 16, h: 16 });
  });
  it("sameRect сравнивает с округлением", () => {
    expect(sameRect({ x: 1.2, y: 2, w: 3, h: 4 }, { x: 1.4, y: 2, w: 3, h: 4 })).toBe(true);
    expect(sameRect({ x: 1, y: 2, w: 3, h: 4 }, null)).toBe(false);
    expect(sameRect(null, null)).toBe(true);
  });
  it("overlaps учитывает запас", () => {
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 12, y: 0, w: 10, h: 10 })).toBe(false);
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 12, y: 0, w: 10, h: 10 }, 4)).toBe(true);
  });
});

describe("placeBit: Бит снизу, пузырь не закрывает цель и не вылезает за экран", () => {
  const phone = { vw: 360, vh: 740, bottomInset: 64 };
  const lessonPhone = { vw: 360, vh: 740, bottomInset: 0 };
  const desk = { vw: 1280, vh: 800, bottomInset: 0 };
  /** Бит и пузырь в окне и не задевают цель. */
  const ok = (target: Rect | null, vp: typeof phone, len = 90) => {
    const p = placeBit(target, vp, len);
    const r = placementRects(p, vp.vh, len);
    for (const box of [r.bit, r.bubble]) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w).toBeLessThanOrEqual(vp.vw);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.h).toBeLessThanOrEqual(vp.vh - vp.bottomInset);
      if (target) expect(overlaps(box, target)).toBe(false);
    }
    return p;
  };

  it("без цели — правый нижний угол над нижней панелью, пузырь над Битом", () => {
    const p = ok(null, phone);
    expect(p).toMatchObject({ corner: "br", bubble: "above", bitX: 360 - 12 - BIT_SIZE, bitBottom: 64 + 12, bubbleW: 336, bubbleX: 12 });
  });
  it("цель вверху (чипы в шапке) — правый угол, пузырь над Битом", () => {
    const p = ok({ x: 250, y: 10, w: 64, h: 36 }, phone);
    expect(p).toMatchObject({ corner: "br", bubble: "above" });
  });
  it("цель в правой нижней четверти (плавающая кнопка Бита) — левый угол", () => {
    const dock = { x: 292, y: 740 - 64 - 12 - 56, w: 56, h: 56 };
    const p = ok(dock, phone);
    expect(p.corner).toBe("bl");
  });
  it("цель в нижней половине по центру (варианты ответа) — пузырь сбоку от Бита", () => {
    const p = ok({ x: 16, y: 330, w: 328, h: 200 }, lessonPhone);
    expect(p.bubble).toBe("side");
    expect(p.bubbleW).toBeLessThan(360 - 2 * 12 - BIT_SIZE + 1);
  });
  it("кнопка во всю ширину у низа («Проверить», «Продолжить») — Бит встаёт над ней", () => {
    const target = { x: 16, y: 668, w: 328, h: 56 };
    const p = ok(target, lessonPhone);
    expect(p.bitBottom).toBeGreaterThan(740 - target.y);
  });
  it("нижняя панель (три вкладки) — Бит над панелью её не закрывает", () => {
    ok({ x: 72, y: 740 - 64, w: 216, h: 64 }, { ...phone, bottomInset: 0 });
  });
  it("компьютер: поля 24 px, пузырь не шире 340 px", () => {
    const p = ok({ x: 300, y: 100, w: 200, h: 50 }, desk);
    expect(p).toMatchObject({ corner: "br", bubble: "above", bitX: 1280 - 24 - BIT_SIZE, bitBottom: 24, bubbleW: 340 });
  });
  it("узкий экран 320 px: пузырь помещается целиком", () => {
    ok(null, { vw: 320, vh: 568, bottomInset: 64 });
    ok({ x: 10, y: 80, w: 300, h: 120 }, { vw: 320, vh: 568, bottomInset: 64 }, 110);
  });
  it("360×640, цель во всю ширину (y 94…406): пузырь не выше верха окна, кнопки пузыря над нижней панелью, Бит внизу", () => {
    const vp = { vw: 360, vh: 640, bottomInset: 64 };
    const target = { x: 0, y: 94, w: 360, h: 312 };
    for (const len of [40, 75, 110, 140]) {
      const p = placeBit(target, vp, len);
      const r = placementRects(p, vp.vh, len);
      expect(r.bubble.y, `len ${len}`).toBeGreaterThanOrEqual(0);
      expect(r.bubble.y + r.bubble.h, `len ${len}`).toBeLessThanOrEqual(vp.vh - vp.bottomInset);
      expect(r.bit.y + r.bit.h, `len ${len}`).toBeLessThanOrEqual(vp.vh - vp.bottomInset);
      // Под целью есть место для Бита — он не поднимается над ней (сел бы на верх экрана).
      expect(p.bitBottom, `len ${len}`).toBe(64 + 12);
      expect(r.bit.y, `len ${len}`).toBeGreaterThanOrEqual(target.y + target.h);
    }
  });
  it("360×640 в уроке (без нижней панели): высокие варианты ответа — Бит и пузырь под ними, в окне", () => {
    ok({ x: 16, y: 94, w: 328, h: 312 }, { vw: 360, vh: 640, bottomInset: 0 }, 32);
  });
  it("360×760, кнопка «Начать» карточки урока (≈ y 460…510): Бит внизу в углу, пузырь ниже цели, не на карточке", () => {
    const vp = { vw: 360, vh: 760, bottomInset: 64 };
    // Цель с зазором рамки (6 px) — как её отдаёт проводник.
    for (const target of [
      { x: 10, y: 454, w: 340, h: 62 },
      { x: 10, y: 460, w: 340, h: 62 },
    ]) {
      for (const len of [47, 75]) {
        const p = placeBit(target, vp, len);
        const r = placementRects(p, vp.vh, len);
        expect(p.bitBottom, `y ${target.y}, len ${len}`).toBe(64 + 12);
        expect(r.bit.y, `y ${target.y}, len ${len}`).toBeGreaterThanOrEqual(target.y + target.h);
        // Пузырь в окне; цель он не закрывает (или задевает самый край — меньше четверти её высоты).
        expect(r.bubble.y).toBeGreaterThanOrEqual(0);
        expect(r.bubble.y + r.bubble.h).toBeLessThanOrEqual(vp.vh - vp.bottomInset);
        expect(r.bubble.y, `y ${target.y}, len ${len}`).toBeGreaterThan(target.y + (target.h * 3) / 4);
      }
    }
  });
  it("360×760: под целью хватает места для Бита и пузыря над ним — так и ставим, ниже цели", () => {
    const vp = { vw: 360, vh: 760, bottomInset: 64 };
    const target = { x: 10, y: 300, w: 340, h: 62 };
    const p = ok(target, vp, 75);
    const r = placementRects(p, vp.vh, 75);
    expect(p.bitBottom).toBe(76);
    expect(r.bubble.y).toBeGreaterThan(target.y + target.h);
  });
  it("кнопка у самого низа: Бит поднимается, только если под целью ему нет места", () => {
    const lesson = { vw: 360, vh: 640, bottomInset: 0 };
    const check = { x: 10, y: 566, w: 340, h: 68 };
    const p = ok(check, lesson, 25);
    expect(p.bitBottom).toBeGreaterThan(640 - check.y);
  });
  it("варианты, где пузырь вылез бы за верх окна, отбрасываются (низкий экран, кнопка внизу)", () => {
    const vp = { vw: 360, vh: 420, bottomInset: 0 };
    const target = { x: 10, y: 250, w: 340, h: 160 };
    const p = placeBit(target, vp, 140);
    const r = placementRects(p, vp.vh, 140);
    expect(r.bubble.y).toBeGreaterThanOrEqual(0);
    expect(r.bubble.y + r.bubble.h).toBeLessThanOrEqual(vp.vh);
  });
  it("оценка высоты пузыря: длиннее текст и уже пузырь — выше", () => {
    expect(estimateBubbleH(120, 256)).toBeGreaterThan(estimateBubbleH(120, 336));
    expect(estimateBubbleH(200, 336)).toBeGreaterThan(estimateBubbleH(40, 336));
  });
});

describe("fingerPose: палец смотрит на цель со стороны Бита", () => {
  const target = { x: 100, y: 100, w: 100, h: 40 };
  it("Бит ниже — палец снизу, вверх", () => {
    const f = fingerPose(target, { x: 150, y: 600 }, 0);
    expect(f.angle).toBeCloseTo(0);
    expect(f.x).toBeCloseTo(150);
    expect(f.y).toBeCloseTo(140);
  });
  it("Бит справа — палец справа, влево", () => {
    const f = fingerPose(target, { x: 600, y: 120 }, 0);
    expect(f.angle).toBeCloseTo(-90);
    expect(f.x).toBeCloseTo(200);
  });
  it("Бит слева снизу — палец смотрит вверх-вправо", () => {
    const f = fingerPose(target, { x: 0, y: 500 }, 0);
    expect(f.angle).toBeGreaterThan(0);
    expect(f.angle).toBeLessThan(90);
  });
  it("кончик пальца — глубже в цели, ближе к середине кнопки (по умолчанию 40 % меньшей стороны, не больше 22 px)", () => {
    expect(fingerPose(target, { x: 150, y: 600 }, 10).y).toBeCloseTo(130);
    expect(fingerPose(target, { x: 150, y: 600 }).y).toBeCloseTo(140 - 40 * 0.4);
    expect(fingerPose({ x: 0, y: 0, w: 300, h: 300 }, { x: 150, y: 900 }).y).toBeCloseTo(278);
    // Кнопка «Начать» (62 px с зазором рамки): кончик на 22 px внутри — не на её краю и не на границе с соседней кнопкой.
    expect(fingerPose({ x: 10, y: 449, w: 340, h: 62 }, { x: 180, y: 900 }).y).toBeCloseTo(511 - 22);
  });
  it("палец сверху не переворачивается «вверх ногами»: смотрит вниз и отражён (flip)", () => {
    const f = fingerPose(target, { x: 150, y: -500 });
    expect(f.flip).toBe(true);
    expect(Math.abs(f.angle)).toBeCloseTo(180);
    expect(fingerPose(target, { x: 150, y: 600 }).flip).toBeUndefined();
    expect(fingerPose(target, { x: 900, y: 120 }).flip).toBeUndefined();
    // Отражённый палец лежит над кончиком, кисть — с другой стороны.
    const r = fingerRect({ x: 100, y: 100, angle: 180, flip: true });
    expect(r.y + r.h).toBeCloseTo(102);
    expect(r.x).toBeCloseTo(86);
  });
});

describe("aimFinger: палец не ложится на Бита и пузырь", () => {
  it("fingerRect: «пальцем вверх» — палец ниже кончика, кисть справа", () => {
    expect(fingerRect({ x: 100, y: 100, angle: 0 })).toEqual({ x: 86, y: 98, w: 42, h: 58 });
    // Повёрнут на 180° (палец сверху цели, смотрит вниз) — тянется вверх от кончика.
    const down = fingerRect({ x: 100, y: 100, angle: 180 });
    expect(down.y + down.h).toBeCloseTo(102);
    expect(down.y).toBeCloseTo(44);
  });
  it("цель вверху (чипы в шапке), Бит внизу — палец со стороны Бита, как раньше", () => {
    const target = { x: 250, y: 10, w: 64, h: 36 };
    const vp = { vw: 360, vh: 740, bottomInset: 64 };
    const p = placeBit(target, vp, 34);
    const r = placementRects(p, vp.vh, 34);
    const from = { x: r.bit.x + BIT_SIZE / 2, y: r.bit.y + BIT_SIZE / 2 };
    expect(aimFinger(target, from, [r.bit, r.bubble], vp.vw, vp.vh)).toEqual(fingerPose(target, from));
  });
  it("360×760, «Нажми «Начать»»: Бит и пузырь сразу под кнопкой — палец заходит с другой стороны и их не закрывает", () => {
    const vp = { vw: 360, vh: 760, bottomInset: 64 };
    const target = { x: 10, y: 454, w: 340, h: 62 };
    const len = 47;
    const p = placeBit(target, vp, len);
    const r = placementRects(p, vp.vh, len);
    const from = { x: r.bit.x + BIT_SIZE / 2, y: r.bit.y + BIT_SIZE / 2 };
    const f = aimFinger(target, from, [r.bit, r.bubble], vp.vw, vp.vh);
    const box = fingerRect(f);
    expect(overlaps(box, r.bit)).toBe(false);
    expect(overlaps(box, r.bubble)).toBe(false);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.w).toBeLessThanOrEqual(vp.vw);
    // Кончик — у самой цели.
    expect(f.y).toBeGreaterThanOrEqual(target.y);
    expect(f.y).toBeLessThanOrEqual(target.y + target.h);
  });
  it("«Проверить» у низа урока: Бит поднят над кнопкой — палец его не закрывает", () => {
    const vp = { vw: 360, vh: 640, bottomInset: 0 };
    const target = { x: 10, y: 566, w: 340, h: 68 };
    const p = placeBit(target, vp, 25);
    const r = placementRects(p, vp.vh, 25);
    const f = aimFinger(target, { x: r.bit.x + BIT_SIZE / 2, y: r.bit.y + BIT_SIZE / 2 }, [r.bit, r.bubble], vp.vw, vp.vh);
    expect(overlaps(fingerRect(f), r.bit)).toBe(false);
    expect(overlaps(fingerRect(f), r.bubble)).toBe(false);
  });
  it("свободного места нет нигде — палец со стороны Бита", () => {
    const target = { x: 0, y: 0, w: 360, h: 640 };
    const from = { x: 300, y: 600 };
    expect(aimFinger(target, from, [{ x: 0, y: 0, w: 360, h: 640 }], 360, 640)).toEqual(fingerPose(target, from));
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Визуальное ревью v0.18 (360×640): Бит не садится на соседние кнопки, компактные цели, пузырь из кнопки Бита,
// палец не «вверх ногами», Бит не прыгает из угла в угол.

describe("сцены после ревью: цели и порядок", () => {
  const targetsOf = (scene: keyof typeof GUIDE_SCENES) => GUIDE_SCENES[scene].steps.map((s) => s.targets ?? []);
  it("реплики про следующий урок подсвечивают всю карточку; кнопку «Начать» — только шаг «нажми»", () => {
    const welcome = GUIDE_SCENES.welcome.steps;
    expect(welcome.find((s) => s.id === "continue")?.targets).toEqual(["next-lesson"]);
    expect(welcome.find((s) => s.id === "start")).toMatchObject({ targets: ["continue"], action: "tap" });
    expect(GUIDE_SCENES.nav.steps[0].targets).toEqual(["next-lesson"]);
  });
  it("магазин — в порядке страницы: украшения (заголовок с переключателем), потом сердечки (заголовок и первый товар)", () => {
    expect(targetsOf("page-shop")).toEqual([["shop-cosmetics"], ["shop-hearts", "shop-hearts-first"]]);
  });
  it("мини-игры — заголовок с первым рядом; слабые места — заголовок с первой темой, тем нет — своя реплика", () => {
    expect(targetsOf("page-practice")[1]).toEqual(["practice-games", "practice-games-first"]);
    const weak = GUIDE_SCENES["page-progress"].steps[1];
    expect(weak.targets).toEqual(["stats-weak", "stats-weak-first"]);
    expect(stepText(weak, { partial: true })).toBe("guide.stats.weakEmpty");
    expect(stepText(weak, {})).toBe("guide.stats.weak");
  });
  it("у сцены чата есть цель (свободный чат), а без неё — та же реплика", () => {
    const hi = GUIDE_SCENES["page-tutor"].steps[0];
    expect(hi.targets).toEqual(["tutor-free"]);
    expect(stepText(hi, { fallback: true })).toBe("guide.tutor.hi");
  });
  it("тире не уезжает в начало строки: пробел перед ним неразрывный, длина та же", () => {
    const s = "Привет! Я Бит. Покажу, что тут где, — это быстро.";
    expect(keepDash(s)).toBe("Привет! Я Бит. Покажу, что тут где, — это быстро.");
    expect(keepDash(s)).toHaveLength(s.length);
  });
});

describe("V1: под целью — место для Бита с пузырём (360×640)", () => {
  const vp = { vw: 360, vh: 640, bottomInset: 64, safeBottom: 0 };
  const header = 58;
  const moved = (r: Rect, dy: number): Rect => ({ ...r, y: r.y - dy });
  /** Бит и пузырь в окне и не задевают цель. */
  const clean = (target: Rect, len: number) => {
    const p = placeBit(target, vp, len);
    const r = placementRects(p, vp.vh, len);
    for (const box of [r.bit, r.bubble]) {
      expect(overlaps(box, target)).toBe(false);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.h).toBeLessThanOrEqual(vp.vh);
    }
    return { p, r };
  };

  it("карточка следующего урока (y 226…531): прокрутка ставит её под шапку, Бит с пузырём — под ней, над панелью", () => {
    const card = { x: 10, y: 226, w: 340, h: 305 };
    const len = 75;
    const dy = guideScroll(card, vp, header, len);
    expect(dy).toBeGreaterThan(0);
    const after = moved(card, dy);
    expect(after.y).toBeGreaterThanOrEqual(header);
    const { p, r } = clean(after, len);
    expect(p.bitBottom).toBe(64 + 12);
    expect(r.bit.y).toBeGreaterThanOrEqual(after.y + after.h);
  });

  it("кнопка «Начать» (шаг «нажми»): под ней место и Биту с пузырём, и пальцу — палец снизу, не отражён, никого не закрывает", () => {
    const button = { x: 10, y: 449, w: 340, h: 62 };
    const len = 47;
    const spot = { ...button, h: button.h + FINGER_ROOM };
    const dy = guideScroll(spot, vp, header, len);
    const hole = moved(button, dy);
    const { p, r } = clean(moved(spot, dy), len);
    expect(p.bitBottom).toBe(64 + 12);
    const f = aimFinger(hole, { x: r.bit.x + BIT_SIZE / 2, y: r.bit.y + BIT_SIZE / 2 }, [r.bit, r.bubble], vp.vw, vp.vh);
    expect(f.flip).toBeUndefined();
    expect(overlaps(fingerRect(f), r.bit)).toBe(false);
    expect(overlaps(fingerRect(f), r.bubble)).toBe(false);
    expect(f.y).toBeGreaterThan(hole.y + 10);
    expect(f.y).toBeLessThan(hole.y + hole.h - 10);
  });

  it("без нижней панели (урок) — только чтобы цель была видна: текст задания над вариантами не уезжает", () => {
    const lesson = { vw: 360, vh: 640, bottomInset: 0 };
    expect(guideScroll({ x: 16, y: 300, w: 328, h: 300 }, lesson, 64, 30)).toBe(0);
    expect(guideScroll({ x: 16, y: 400, w: 328, h: 300 }, lesson, 64, 30)).toBe(400 + 300 - (640 - 8));
  });
  it("цель уже на месте — не прокручиваем; под шапкой — прокручиваем вверх", () => {
    expect(guideScroll({ x: 10, y: 100, w: 340, h: 60 }, vp, header, 60)).toBe(0);
    expect(guideScroll({ x: 10, y: 20, w: 340, h: 60 }, vp, header, 60)).toBe(20 - header - 8);
  });

  it("страницу дальше не прокрутить: Бит садится на затемнённую нижнюю панель, а не поднимается на соседние кнопки", () => {
    const target = { x: 10, y: 300, w: 340, h: 195 };
    const p = placeBit(target, vp, 30);
    const r = placementRects(p, vp.vh, 30);
    expect(p.bitBottom).toBe(12);
    expect(overlaps(r.bit, target)).toBe(false);
    expect(overlaps(r.bubble, target)).toBe(false);
    // Без нижней панели (safe-area не передана) Бит поднялся бы над целью.
    expect(placeBit(target, { vw: 360, vh: 640, bottomInset: 64 }, 30).bitBottom).toBeGreaterThan(640 - target.y);
  });

  it("цель в самой нижней панели — Бит на неё не садится", () => {
    const tabs = { x: 72, y: 640 - 64, w: 216, h: 64 };
    expect(roomBelow(tabs, vp)).toBe(false);
    const p = placeBit(tabs, vp, 90);
    const r = placementRects(p, vp.vh, 90);
    expect(overlaps(r.bit, tabs)).toBe(false);
    expect(overlaps(r.bubble, tabs)).toBe(false);
  });

  it("подъём над целью — крайний случай: Бит и пузырь не садятся на кнопки вокруг (avoid)", () => {
    const lesson = { vw: 360, vh: 640, bottomInset: 0 };
    const check = { x: 10, y: 566, w: 340, h: 68 };
    const option = { x: 200, y: 480, w: 150, h: 40 };
    const plain = placementRects(placeBit(check, lesson, 25), lesson.vh, 25);
    expect(overlaps(plain.bit, option)).toBe(true);
    const p = placeBit(check, lesson, 25, { avoid: [option] });
    const r = placementRects(p, lesson.vh, 25);
    expect(p.bitBottom).toBeGreaterThan(640 - check.y);
    expect(overlaps(r.bit, check)).toBe(false);
    expect(overlaps(r.bit, option)).toBe(false);
    expect(overlaps(r.bubble, option)).toBe(false);
  });
});

describe("V2: шаг без цели — пузырь не режет кнопки", () => {
  it("кнопка «Начать» под пузырём над Битом — выбирается место, где пузырь её не режет", () => {
    const vp = { vw: 360, vh: 760, bottomInset: 64, safeBottom: 0 };
    const start = { x: 16, y: 460, w: 328, h: 56 };
    const plain = placementRects(placeBit(null, vp, 57), vp.vh, 57);
    expect(overlaps(plain.bubble, start)).toBe(true);
    const p = placeBit(null, vp, 57, { avoid: [start] });
    const r = placementRects(p, vp.vh, 57);
    expect(overlaps(r.bubble, start)).toBe(false);
    expect(overlaps(r.bit, start)).toBe(false);
    expect(p.corner).toBe("br");
  });
});

describe("V4: компактные цели и рамка", () => {
  const vp = { vw: 360, vh: 640, bottomInset: 64, safeBottom: 0 };
  it("заголовок с первым рядом (≈ 260 px) после прокрутки — целиком на экране, под шапкой, Бит с пузырём под ним", () => {
    const head = { x: 10, y: 380, w: 340, h: 262 };
    const dy = guideScroll(head, vp, 58, 50);
    const after = { ...head, y: head.y - dy };
    expect(after.y).toBeGreaterThanOrEqual(58);
    expect(after.y + after.h).toBeLessThanOrEqual(640 - 64);
    const r = placementRects(placeBit(after, vp, 50), vp.vh, 50);
    expect(overlaps(r.bit, after)).toBe(false);
    expect(overlaps(r.bubble, after)).toBe(false);
  });
  it("цель выше экрана: верх — под шапку; рамка не ложится на края экрана", () => {
    const tall = { x: 4, y: 300, w: 352, h: 900 };
    const dy = guideScroll(tall, vp, 58, 60);
    expect(tall.y - dy).toBe(58 + 8);
    const hole = padRect({ ...tall, y: tall.y - dy }, 6, 360, 640, 3);
    expect(hole.x).toBe(3);
    expect(hole.x + hole.w).toBe(357);
    expect(hole.y + hole.h).toBe(637);
    expect(hole.y).toBeGreaterThan(3);
  });
});

describe("V5: шаг про кнопку Бита — пузырь выходит из самой кнопки", () => {
  const vp = { vw: 360, vh: 740, bottomInset: 64, safeBottom: 0 };
  // Обёртка кнопки (кнопка 56 + стрелка «›») с зазором рамки.
  const anchor = { x: 278, y: 740 - 64 - 12 - 56 - 6, w: 79, h: 68 };
  const aimX = 284 + 28;
  it("пузырь над рамкой кнопки, в окне, хвостик смотрит на кнопку; говорящего Бита нет", () => {
    const p = placeFromDock(anchor, vp, aimX);
    expect(p.dock).toBe(true);
    const r = placementRects(p, vp.vh, 76);
    expect(r.bubble.x).toBeGreaterThanOrEqual(12);
    expect(r.bubble.x + r.bubble.w).toBeLessThanOrEqual(360 - 12);
    expect(r.bubble.y).toBeGreaterThanOrEqual(0);
    expect(r.bubble.y + r.bubble.h).toBeLessThanOrEqual(anchor.y - 9);
    expect(overlaps(r.bubble, anchor)).toBe(false);
    // Хвостик (квадратик 16 px, центр — left + 8) — напротив кнопки.
    expect(p.bubbleX + tailLeft(p) + 8).toBeCloseTo(aimX);
  });
});

describe("V8: Бит не прыгает из угла в угол", () => {
  const vp = { vw: 360, vh: 760, bottomInset: 64, safeBottom: 0 };
  it("прошлый угол сохраняется, если Бит и пузырь не закрывают цель", () => {
    const chips = { x: 250, y: 10, w: 64, h: 36 };
    expect(placeBit(chips, vp, 34).corner).toBe("br");
    expect(placeBit(chips, vp, 34, { prev: "bl" }).corner).toBe("bl");
  });
  it("в прошлом углу Бит закрыл бы цель — переходит в другой", () => {
    const dock = { x: 278, y: 760 - 64 - 12 - 62, w: 79, h: 68 };
    expect(placeBit(dock, vp, 76, { prev: "br" }).corner).toBe("bl");
  });
  it("приветствие 360×760: без цели → карточка урока → сердечки → «Начать» — Бит всё время в одном углу", () => {
    const steps: [Rect | null, number][] = [
      [null, 57],
      [{ x: 10, y: 66, w: 340, h: 305 }, 75],
      [{ x: 200, y: 6, w: 60, h: 52 }, 73],
      [{ x: 10, y: 305, w: 340, h: 62 + FINGER_ROOM }, 47],
    ];
    let prev: "br" | "bl" | undefined;
    const corners: string[] = [];
    for (const [target, len] of steps) {
      const p = placeBit(target, vp, len, { prev });
      if (target) {
        const r = placementRects(p, vp.vh, len);
        expect(overlaps(r.bit, target)).toBe(false);
        expect(overlaps(r.bubble, target)).toBe(false);
      }
      corners.push(p.corner);
      prev = p.corner;
    }
    expect(new Set(corners).size).toBe(1);
  });
});

describe("V6: палец", () => {
  it("снизу и сбоку места нет — палец сверху, но отражён, а не перевёрнут", () => {
    const target = { x: 10, y: 449, w: 340, h: 62 };
    // Бит и пузырь вплотную под кнопкой, по бокам — край экрана.
    const below = { x: 0, y: 515, w: 360, h: 125 };
    const f = aimFinger(target, { x: 300, y: 600 }, [below], 360, 640);
    expect(f.flip).toBe(true);
    expect(overlaps(fingerRect(f), below)).toBe(false);
    expect(f.y).toBeGreaterThan(target.y + 10);
  });
  it("палец никогда не смотрит вниз без отражения; снизу свободно — палец снизу, даже если Бит сверху", () => {
    const target = { x: 120, y: 300, w: 120, h: 48 };
    for (const from of [
      { x: 180, y: 0 },
      { x: 0, y: 0 },
      { x: 360, y: 0 },
      { x: 180, y: 640 },
      { x: 0, y: 324 },
    ]) {
      const f = aimFinger(target, from, [], 360, 640);
      if (Math.abs(f.angle) > 90) expect(f.flip).toBe(true);
      else expect(f.flip).toBeUndefined();
    }
    expect(Math.abs(aimFinger(target, { x: 180, y: 0 }, [], 360, 640).angle)).toBeLessThanOrEqual(90);
  });
});

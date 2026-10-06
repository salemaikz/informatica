import { describe, expect, it } from "vitest";
import { TIP_IDS, sanitizeTips, type TipsState } from "@/lib/tips";
import {
  BIT_SIZE,
  GUIDE_SCENES,
  completedLessonsCount,
  aimFinger,
  estimateBubbleH,
  fingerPose,
  fingerRect,
  overlaps,
  padRect,
  placeBit,
  placementRects,
  sameRect,
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
  it("кончик пальца «нажимает» чуть внутри цели (по умолчанию — треть меньшей стороны, не больше 14 px)", () => {
    expect(fingerPose(target, { x: 150, y: 600 }, 10).y).toBeCloseTo(130);
    expect(fingerPose(target, { x: 150, y: 600 }).y).toBeCloseTo(140 - 40 / 3);
    expect(fingerPose({ x: 0, y: 0, w: 300, h: 300 }, { x: 150, y: 900 }).y).toBeCloseTo(286);
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

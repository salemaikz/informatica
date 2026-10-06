import { describe, expect, it } from "vitest";
import { TIP_IDS, sanitizeTips, type TipsState } from "@/lib/tips";
import {
  BIT_SIZE,
  BUTTON_EDGE,
  FINGER_ROOM,
  GUIDE_SCENES,
  completedLessonsCount,
  aimFinger,
  bubbleH,
  dockTail,
  estimateBubbleH,
  fingerPose,
  fingerRect,
  guideScroll,
  keepDash,
  overlapArea,
  overlaps,
  padRect,
  placeBit,
  placeFromDock,
  placementRects,
  roomBelow,
  sameRect,
  sideTail,
  TAIL_TIP,
  tailLeft,
  sceneFor,
  sceneSteps,
  stepText,
  tourBlocking,
  dockExplained,
  alsoDue,
  skippedTogether,
  unionRect,
  unseenTips,
  type BitPlacement,
  type Rect,
  type Say,
  type SceneCtx,
} from "@/lib/guide";
import { dict } from "@/i18n/dict";

// Всплывающий Бит-проводник (этап 16В, P2a): какая сцена играет, тексты шагов, геометрия Бита, пузыря и пальца.

const seen = (...ids: (typeof TIP_IDS)[number][]): TipsState => Object.fromEntries(ids.map((id) => [id, 1]));
const all: TipsState = Object.fromEntries(TIP_IDS.map((id) => [id, 1]));
const ctx = (over: Partial<SceneCtx> = {}): SceneCtx => ({ pathname: "/learn", onboarded: true, completedLessons: 0, inLesson: false, onResults: false, ...over });

describe("sceneFor: путь первого входа", () => {
  it("новый ученик на «Учиться» — знакомство (intro), при любом числе уроков и на школьном треке", () => {
    expect(sceneFor({}, ctx())).toBe("intro");
    expect(sceneFor(undefined, ctx())).toBe("intro");
    expect(sceneFor({}, ctx({ completedLessons: 3 }))).toBe("intro");
    expect(sceneFor({}, ctx({ school: true }))).toBe("intro");
  });
  it("знакомство закрыто, урока ещё нет — молчит до первого урока", () => {
    expect(sceneFor(seen("intro"), ctx())).toBeNull();
  });
  it("в первом уроке (режим «Учиться») — lesson-first; уже не первый урок — ничего", () => {
    expect(sceneFor(seen("intro"), ctx({ pathname: "/lesson/a", inLesson: true }))).toBe("lesson-first");
    expect(sceneFor(seen("intro", "lesson-first", "lesson-icons"), ctx({ pathname: "/lesson/a", inLesson: true }))).toBeNull();
    expect(sceneFor({}, ctx({ pathname: "/lesson/a", inLesson: true, completedLessons: 1 }))).toBeNull();
  });
  it("подсказки вернули (intro снова показан, обучение не закончено) — lesson-first и after-first при пройденных уроках", () => {
    expect(sceneFor(seen("intro"), ctx({ pathname: "/lesson/a", inLesson: true, completedLessons: 3 }))).toBe("lesson-first");
    expect(sceneFor(seen("intro", "lesson-first"), ctx({ pathname: "/lesson/a", inLesson: true, onResults: true, completedLessons: 4 }))).toBe("after-first");
    // Обучение закончено — нет.
    expect(sceneFor(seen("intro", "learn-next"), ctx({ pathname: "/lesson/a", inLesson: true, completedLessons: 3 }))).toBeNull();
  });
  it("урок без метки «Учиться» («Проверить себя», тренировка) — ничего", () => {
    expect(sceneFor({}, ctx({ pathname: "/lesson/a" }))).toBeNull();
    expect(sceneFor({}, ctx({ pathname: "/drill" }))).toBeNull();
  });
  it("итоги первого урока — after-first, метка итогов важнее метки урока", () => {
    expect(sceneFor(seen("intro", "lesson-first"), ctx({ pathname: "/lesson/a", inLesson: true, onResults: true, completedLessons: 1 }))).toBe("after-first");
    expect(sceneFor(seen("after-first"), ctx({ pathname: "/lesson/a", inLesson: true, onResults: true, completedLessons: 1 }))).toBeNull();
    // Не первый пройденный урок — итоги без сцены (и без lesson-first).
    expect(sceneFor({}, ctx({ pathname: "/lesson/b", inLesson: true, onResults: true, completedLessons: 2 }))).toBeNull();
  });
  it("после первого урока на «Учиться» — одна реплика learn-next", () => {
    expect(sceneFor(seen("intro", "lesson-first", "after-first"), ctx({ completedLessons: 1 }))).toBe("learn-next");
    expect(sceneFor(seen("intro", "lesson-first", "after-first", "learn-next"), ctx({ completedLessons: 1 }))).toBeNull();
  });
  it("видел старое приветствие (welcome), но не обзор (nav) — короткий nav при любом числе уроков; видел nav — ничего", () => {
    expect(sceneFor(seen("welcome"), ctx())).toBe("nav");
    expect(sceneFor(seen("welcome", "lesson-first", "after-first"), ctx({ completedLessons: 1 }))).toBe("nav");
    expect(sceneFor(seen("welcome", "nav"), ctx({ completedLessons: 1 }))).toBeNull();
  });
  it("прошедшим старый lesson-first — lesson-icons один раз в следующем уроке; новый lesson-first его заменяет", () => {
    const lesson = ctx({ pathname: "/lesson/b", inLesson: true, completedLessons: 2 });
    // Прошёл по очереди: nav — позже lesson-first.
    const old: TipsState = { welcome: 1000, "lesson-first": 60_000, "after-first": 200_000, nav: 210_000 };
    expect(sceneFor(old, lesson)).toBe("lesson-icons");
    expect(sceneFor(seen("welcome", "lesson-first", "after-first"), lesson)).toBe("lesson-icons");
    // Старый «Пропустить»/Escape отметил lesson-first и nav разом — от обучения отказались, lesson-icons не играет.
    expect(sceneFor(seen("welcome", "lesson-first", "after-first", "nav"), lesson)).toBeNull();
    expect(sceneFor({ welcome: 1000, "lesson-first": 60_000, "after-first": 60_000, nav: 60_000 }, lesson)).toBeNull();
    expect(sceneFor(seen("welcome", "lesson-first", "after-first", "nav", "lesson-icons"), lesson)).toBeNull();
    // Новый путь: intro показан — lesson-icons не нужен (lesson-first его отмечает сам, но и без отметки — нет).
    expect(sceneFor(seen("intro", "lesson-first", "after-first", "learn-next"), lesson)).toBeNull();
    // Итоги — не урок.
    expect(sceneFor(seen("welcome", "lesson-first", "after-first", "nav"), { ...lesson, onResults: true })).toBeNull();
    expect(GUIDE_SCENES["lesson-first"].also).toEqual(["lesson-icons"]);
  });
  it("страницы — только после конца обучения (learn-next или nav) и один раз", () => {
    expect(sceneFor({}, ctx({ pathname: "/practice", completedLessons: 1 }))).toBeNull();
    expect(sceneFor(seen("intro"), ctx({ pathname: "/practice" }))).toBeNull();
    expect(sceneFor(seen("intro", "learn-next"), ctx({ pathname: "/practice" }))).toBe("page-practice");
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
  it("школьный трек: после конца обучения на «Учиться» — сцена про выбор класса", () => {
    expect(sceneFor(seen("nav"), ctx({ school: true }))).toBe("page-school");
    expect(sceneFor(seen("intro", "learn-next"), ctx({ school: true, completedLessons: 1 }))).toBe("page-school");
    expect(sceneFor(seen("nav"), ctx())).toBeNull();
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
  it("пока не показаны ни learn-next, ни nav — тарифы, напоминания и кейс ждут", () => {
    expect(tourBlocking({})).toBe(true);
    expect(tourBlocking(seen("intro", "lesson-first", "after-first"))).toBe(true);
    expect(tourBlocking(seen("welcome", "lesson-first", "after-first"))).toBe(true);
    expect(tourBlocking(seen("learn-next"))).toBe(false);
    expect(tourBlocking(seen("nav"))).toBe(false);
    expect(tourBlocking(sanitizeTips({ nav: 5, junk: 1 }))).toBe(false);
  });
  it("стрелка у кнопки Бита — пока кнопку не объяснили (intro или nav)", () => {
    expect(dockExplained({})).toBe(false);
    expect(dockExplained(seen("welcome", "lesson-first", "after-first"))).toBe(false);
    expect(dockExplained(seen("intro"))).toBe(true);
    expect(dockExplained(seen("nav"))).toBe(true);
  });
  it("alsoDue: lesson-first отмечает lesson-icons только пройдя шаг ИИ (или в конце), intro — никогда", () => {
    const lf = GUIDE_SCENES["lesson-first"];
    const full = lf.steps;
    const at = (id: string) => full.findIndex((s) => s.id === id);
    expect(alsoDue(lf, full, at("hearts"))).toBe(false);
    expect(alsoDue(lf, full, at("progress"))).toBe(false);
    expect(alsoDue(lf, full, at("tools"))).toBe(false);
    expect(alsoDue(lf, full, at("ask"))).toBe(true);
    expect(alsoDue(lf, full, at("options"))).toBe(true);
    expect(alsoDue(lf, full, full.length - 1)).toBe(true);
    const intro = GUIDE_SCENES.intro;
    expect(alsoDue(intro, intro.steps, intro.steps.length - 1)).toBe(false);
  });
  it("skippedTogether: отметки одного «Пропустить» — в одну секунду; показ по очереди — нет", () => {
    expect(skippedTogether({ "lesson-first": 5000, nav: 5000 }, "lesson-first", "nav")).toBe(true);
    expect(skippedTogether({ "lesson-first": 5000, nav: 5001 }, "lesson-first", "nav")).toBe(true);
    expect(skippedTogether({ "lesson-first": 5000, nav: 95_000 }, "lesson-first", "nav")).toBe(false);
    expect(skippedTogether({ "lesson-first": 5000 }, "lesson-first", "nav")).toBe(false);
  });
  it("новые сцены сохраняются, чужие id — нет", () => {
    expect(sanitizeTips({ "page-shop": 3, "page-profile": 4, "page-x": 1 })).toEqual({ "page-shop": 3, "page-profile": 4 });
    expect(sanitizeTips({ intro: 1, "learn-next": 2, "lesson-icons": 3, welcome: 4 })).toEqual({ intro: 1, "learn-next": 2, "lesson-icons": 3, welcome: 4 });
  });
  it("completedLessonsCount считает уроки, пройденные хотя бы раз", () => {
    expect(completedLessonsCount(undefined)).toBe(0);
    expect(completedLessonsCount({ a: { completions: 1 }, b: { completions: 0 }, c: undefined, d: {} })).toBe(1);
  });
});

const SCENE_IDS = Object.keys(GUIDE_SCENES) as (keyof typeof GUIDE_SCENES)[];
const stepOf = (scene: keyof typeof GUIDE_SCENES, id: string) => {
  const st = GUIDE_SCENES[scene].steps.find((s) => s.id === id);
  if (!st) throw new Error(`${scene}/${id}`);
  return st;
};

describe("сцены", () => {
  it("сцена есть у каждой отметки, кроме welcome (только отметка); тексты — ключи guide.* на двух языках", () => {
    expect([...SCENE_IDS].sort()).toEqual(TIP_IDS.filter((id) => id !== "welcome").sort());
    for (const id of SCENE_IDS) {
      const scene = GUIDE_SCENES[id];
      expect(scene.id).toBe(id);
      expect(scene.steps.length).toBeGreaterThan(0);
      for (const st of scene.steps) {
        for (const key of [st.text, st.textSchool, st.textNoName, st.textMany, st.textFree, st.textPartial, st.textNoCount, st.textAgain, st.orElse?.text]) {
          if (!key) continue;
          expect(key.startsWith("guide."), key).toBe(true);
          expect(dict[key].ru.length).toBeGreaterThan(0);
          expect(dict[key].kk.length).toBeGreaterThan(0);
        }
      }
    }
  });
  it("сцены короткие: знакомство и первый урок — до 6 реплик, остальные — до 5, страницы — 1–2", () => {
    for (const id of SCENE_IDS) {
      const n = GUIDE_SCENES[id].steps.length;
      expect(n, id).toBeLessThanOrEqual(id.startsWith("page-") ? 2 : id === "intro" || id === "lesson-first" ? 6 : 5);
    }
  });
  it("ключевые шаги «нажми»: любое обучение кончается кнопкой урока; вариант, «Проверить», «Продолжить» на итогах", () => {
    const tap = (id: keyof typeof GUIDE_SCENES) => GUIDE_SCENES[id].steps.filter((s) => s.action === "tap").map((s) => s.targets?.[0]);
    expect(tap("intro")).toEqual(["continue"]);
    expect(tap("lesson-first")).toEqual(["lesson-options", "lesson-check"]);
    expect(tap("after-first")).toEqual(["res-continue"]);
    expect(tap("learn-next")).toEqual(["continue"]);
    expect(tap("nav")).toEqual(["continue"]);
    expect(tap("lesson-icons")).toEqual([]);
    for (const id of ["intro", "nav", "learn-next"] as const) expect(GUIDE_SCENES[id].steps.at(-1)?.targets).toEqual(["continue"]);
    // Магазин из обучения убран (его объяснит page-shop при первом заходе).
    for (const id of SCENE_IDS) for (const s of GUIDE_SCENES[id].steps) if (s.action === "tap") expect(s.targets, `${id}/${s.id}`).not.toContain("hdr-chips");
    // У каждого шага «нажми» есть цель — иначе нажимать некуда.
    for (const id of SCENE_IDS) for (const s of GUIDE_SCENES[id].steps) if (s.action === "tap") expect(s.targets?.length, `${id}/${s.id}`).toBeGreaterThan(0);
  });
  it("порядок знакомства: привет → карточка → шапка → вкладки → кнопка Бита → «Начать»", () => {
    expect(GUIDE_SCENES.intro.steps.map((s) => s.id)).toEqual(["hi", "card", "header", "bar", "dock", "start"]);
    expect(stepOf("intro", "header").targets).toEqual(["hdr-streak", "hdr-hearts", "hdr-chips"]);
    expect(GUIDE_SCENES.nav.steps.map((s) => s.id)).toEqual(["bar", "dock", "go"]);
  });
  it("первый урок: сердечки → полоска → инструменты → ИИ → вариант (ждём долго) → «Проверить» (только после варианта)", () => {
    expect(GUIDE_SCENES["lesson-first"].steps.map((s) => s.id)).toEqual(["hearts", "progress", "tools", "ask", "options", "check"]);
    expect(stepOf("lesson-first", "tools").targets).toEqual(["lesson-tools"]);
    expect(stepOf("lesson-first", "ask")).toMatchObject({ targets: ["lesson-ask"], action: "next" });
    // Значка ИИ нет — шаг просто пропускается, следующие от него не зависят.
    expect(stepOf("lesson-first", "ask").chain).toBeFalsy();
    expect(stepOf("lesson-first", "options").waitMs).toBeGreaterThanOrEqual(60_000);
    expect(stepOf("lesson-first", "check").chain).toBe(true);
    expect(GUIDE_SCENES["lesson-icons"].steps.map((s) => s.targets)).toEqual([["lesson-tools"], ["lesson-ask"]]);
  });
  it("sceneSteps убирает шаги «только ЕНТ» для школьного трека", () => {
    const scene = { id: "nav" as const, steps: [{ id: "a", text: "guide.ok" as const, action: "next" as const }, { id: "b", text: "guide.ok" as const, action: "next" as const, ent: true }] };
    expect(sceneSteps(scene, true).map((s) => s.id)).toEqual(["a", "b"]);
    expect(sceneSteps(scene, false).map((s) => s.id)).toEqual(["a"]);
  });
});

describe("stepText", () => {
  const hi = stepOf("intro", "hi");
  const card = stepOf("intro", "card");
  const start = stepOf("intro", "start");
  it("приветствие с именем и без", () => {
    expect(stepText(hi, { name: "Аня" })).toBe("guide.welcome.hi");
    expect(stepText(hi, { name: "  " })).toBe("guide.welcome.hi0");
    expect(dict["guide.welcome.hi"].ru).toContain("{name}");
  });
  it("школьный трек: про урок — без «по порядку» и без названия кнопки", () => {
    expect(stepText(card, { school: true })).toBe("guide.welcome.continue.school");
    expect(stepText(start, { school: true })).toBe("guide.welcome.start.school");
    expect(stepText(start, { school: true, again: true })).toBe("guide.welcome.start.school");
    expect(stepText(start, { school: true, fallback: true })).toBe("guide.welcome.noLesson");
  });
  it("нет урока — запасная реплика", () => {
    expect(stepText(start, { fallback: true })).toBe("guide.welcome.noLesson");
    expect(stepText(start, {})).toBe("guide.welcome.start");
  });
  it("урок уже был (на кнопке «Продолжить») — реплика без названия кнопки", () => {
    expect(stepText(start, { again: true })).toBe("guide.next.go");
    expect(stepText(stepOf("learn-next", "go"), {})).toBe("guide.next.go");
    expect(stepText(stepOf("nav", "go"), { again: true })).toBe("guide.next.go");
    expect(dict["guide.next.go"].ru).not.toMatch(/«/);
    expect(dict["guide.welcome.start"].ru).toContain("«Начать»");
  });
  it("школьный трек — без пробного ЕНТ", () => {
    const bar = stepOf("intro", "bar");
    expect(stepText(bar, { school: false })).toBe("guide.nav.bar");
    expect(stepText(bar, { school: true })).toBe("guide.nav.bar.school");
    expect(dict["guide.nav.bar.school"].ru).not.toContain("ЕНТ");
    expect(dict["guide.nav.bar.school"].kk).not.toContain("ҰБТ");
    const tools = stepOf("lesson-first", "tools");
    expect(stepText(tools, {})).toBe("guide.lesson.tools");
    expect(stepText(tools, { school: true })).toBe("guide.lesson.tools.school");
    expect(dict["guide.lesson.tools"].ru).toContain("как на ЕНТ");
    expect(dict["guide.lesson.tools"].kk).toContain("ҰБТ");
    expect(dict["guide.lesson.tools.school"].ru).not.toContain("ЕНТ");
    expect(dict["guide.lesson.tools.school"].kk).not.toContain("ҰБТ");
  });
  it("значок ИИ: число видно — фраза про бесплатные; нет — без неё", () => {
    const ask = stepOf("lesson-first", "ask");
    expect(stepText(ask, {})).toBe("guide.lesson.ask");
    expect(stepText(ask, { aiCount: true })).toBe("guide.lesson.ask");
    expect(stepText(ask, { aiCount: false })).toBe("guide.lesson.askNoCount");
    expect(dict["guide.lesson.ask"].ru).toContain("бесплатных");
    expect(dict["guide.lesson.askNoCount"].ru).not.toContain("бесплатных");
    expect(dict["guide.lesson.askNoCount"].kk).not.toContain("тегін");
    expect(stepText(stepOf("lesson-icons", "ask"), { aiCount: false })).toBe("guide.lesson.askNoCount");
  });
  it("одно сердечко — «сердечко», два — «сердечка»", () => {
    const hearts = stepOf("lesson-first", "hearts");
    expect(stepText(hearts, { n: 1 })).toBe("guide.lesson.hearts");
    expect(stepText(hearts, { n: 2 })).toBe("guide.lesson.heartsMany");
    expect(stepText(hearts, {})).toBe("guide.lesson.hearts");
  });
  it("«Безлимит» и пробный: сердечки не списывались — своя реплика, без «списал»", () => {
    const hearts = stepOf("lesson-first", "hearts");
    expect(stepText(hearts, { n: 1, free: true })).toBe("guide.lesson.heartsFree");
    expect(stepText(hearts, { n: 2, free: true })).toBe("guide.lesson.heartsFree");
    expect(dict["guide.lesson.heartsFree"].ru).not.toContain("списал");
    expect(dict["guide.lesson.heartsFree"].ru).toContain("Безлимит");
    expect(dict["guide.lesson.heartsFree"].kk).toContain("Шексіз");
    // Шапка знакомства — свой вариант; остальные шаги на безлимит не реагируют.
    expect(stepText(stepOf("intro", "header"), {})).toBe("guide.intro.header");
    expect(stepText(stepOf("intro", "header"), { free: true })).toBe("guide.intro.headerFree");
    expect(dict["guide.intro.headerFree"].ru).toContain("Безлимит");
    expect(stepText(card, { free: true })).toBe("guide.welcome.continue");
  });
  it("реплики без глаголов с родом и без эмодзи", () => {
    for (const key of ["guide.intro.header", "guide.intro.headerFree", "guide.next.go", "guide.lesson.tools", "guide.lesson.tools.school", "guide.lesson.ask", "guide.lesson.askNoCount"] as const) {
      expect(dict[key].ru).not.toMatch(/(сделал|прошёл|прошла|застрял|смог|смогла)/i);
      expect(dict[key].ru + dict[key].kk).not.toMatch(/\p{Extended_Pictographic}/u);
    }
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
    const intro = GUIDE_SCENES.intro.steps;
    expect(intro.find((s) => s.id === "card")?.targets).toEqual(["next-lesson"]);
    expect(intro.find((s) => s.id === "start")).toMatchObject({ targets: ["continue"], action: "tap" });
    expect(GUIDE_SCENES["learn-next"].steps[0]).toMatchObject({ targets: ["continue"], action: "tap" });
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
  it("карточка профиля: реплика называет то, что в рамке (фон, рамка, имя, титул), — уровня в карточке нет", () => {
    const card = GUIDE_SCENES["page-profile"].steps[0];
    expect(card.targets).toEqual(["profile-card"]);
    const { ru, kk } = dict[card.text];
    expect(ru).toBe("Это твоя карточка: фон, рамка, имя и титул. Украшения подбираются в магазине.");
    expect(kk).toContain("фон, жақтау, атың мен атағың");
    expect(kk).toContain("дүкен");
    expect(ru).not.toMatch(/уров/i);
    expect(kk).not.toMatch(/деңгей/i);
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

  // Раскладка «Учиться» на 360×640 по скриншоту v18 (welcome-dark-640-1): режимы, «Курс», «Другие режимы», «Начать».
  const vp640 = { vw: 360, vh: 640, bottomInset: 64, safeBottom: 0 };
  const other = { x: 158, y: 406, w: 168, h: 40 };
  const start640 = { x: 38, y: 460, w: 288, h: 52 };
  const page640 = [{ x: 16, y: 156, w: 120, h: 50 }, { x: 144, y: 156, w: 136, h: 50 }, { x: 16, y: 230, w: 328, h: 50 }, other, start640];
  const nav640 = [0, 90, 180, 270].map((x) => ({ x, y: 576, w: 90, h: 64 }));

  it("360×640, приветствие (ru и kk): пузырь не режет «Другие режимы» и «Начать» — закрывает целиком или обходит; Бит их не задевает", () => {
    for (const len of [56, 66]) {
      const p = placeBit(null, vp640, len, { avoid: [...page640, ...nav640] });
      const r = placementRects(p, vp640.vh, len);
      for (const a of page640) {
        const o = overlapArea(r.bubble, a);
        expect(o === 0 || o === a.w * a.h).toBe(true);
        // Не задетая кнопка — не вплотную к пузырю.
        if (o === 0) expect(overlaps(r.bubble, a, 7)).toBe(false);
        expect(overlapArea(r.bit, a)).toBe(0);
      }
      expect(r.bubble.y).toBeGreaterThanOrEqual(0);
      expect(p.corner).toBe("br");
    }
  });

  it("кнопки нижней панели не в счёт: Бит садится на затемнённую панель, как на шагах с целью", () => {
    expect(placeBit(null, vp640, 56, { avoid: nav640 })).toEqual(placeBit(null, vp640, 56));
  });

  it("кнопка вплотную под пузырём — пузырь отходит от неё хотя бы на 8 px", () => {
    const vp = { vw: 360, vh: 760, bottomInset: 0 };
    const plain = placementRects(placeBit(null, vp, 57), vp.vh, 57);
    const btn = { x: 16, y: plain.bubble.y + plain.bubble.h + 2, w: 184, h: 28 };
    expect(overlaps(plain.bubble, btn, 7)).toBe(true);
    const r = placementRects(placeBit(null, vp, 57, { avoid: [btn] }), vp.vh, 57);
    expect(overlaps(r.bubble, btn, 7)).toBe(false);
    expect(overlaps(r.bit, btn)).toBe(false);
  });

  it("при равных местах Бит остаётся в прошлом углу (V8 и для шага без цели)", () => {
    expect(placeBit(null, vp640, 56, { prev: "bl", avoid: [...page640, ...nav640] }).corner).toBe("bl");
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

// ---------------------------------------------------------------------------------------------------------------------
// Перепроверка v18b: 3D-грань кнопок (F1), края пузыря на шагах с целью и у пузыря из кнопки Бита (F2), Бит на нижней
// панели (F3), высота пузыря по замеру текста.

describe("v18b: края пузыря и нижняя панель", () => {
  const vp640 = { vw: 360, vh: 640, bottomInset: 64, safeBottom: 0 };
  const vp760 = { vw: 360, vh: 760, bottomInset: 64, safeBottom: 0 };
  const nav = (vh: number): Rect[] => [0, 90, 180, 270].map((x) => ({ x, y: vh - 64, w: 90, h: 64 }));
  const header: Rect[] = [
    { x: 12, y: 10, w: 40, h: 40 },
    { x: 238, y: 12, w: 64, h: 36 },
    { x: 312, y: 12, w: 36, h: 36 },
  ];
  /** «Учиться» по скриншотам v18b (прокрутка `-dy`): режимы, «Курс», «Другие режимы», «Начать», карточка плана. */
  const learn = (dy = 0): Rect[] =>
    [
      { x: 24, y: 84, w: 152, h: 44 },
      { x: 184, y: 84, w: 152, h: 44 },
      { x: 16, y: 156, w: 120, h: 50 },
      { x: 144, y: 156, w: 136, h: 50 },
      { x: 288, y: 156, w: 72, h: 50 },
      { x: 16, y: 230, w: 328, h: 50 },
      { x: 158, y: 405, w: 168, h: 40 },
      { x: 38, y: 459, w: 288, h: 52 },
      { x: 18, y: 558, w: 324, h: 62 },
      { x: 30, y: 628, w: 300, h: 56 },
    ].map((r) => ({ ...r, y: r.y + dy }));
  const START = 7;
  /** Реплика с замером текста: строк над Битом (текст шириной 300 px) и сбоку (220 px). */
  const say = (len: number, wide: number, narrow: number, tap = false): Say => ({ len, tap, textH: (w) => (w >= 290 ? wide : narrow) * 21 });
  /** Кнопка (с 3D-гранью) пузырём не задета или закрыта целиком — край её не режет. */
  const clean = (bubble: Rect, a: Rect) => {
    const b = { ...a, h: a.h + BUTTON_EDGE };
    const o = overlapArea(bubble, b);
    return o === 0 || o >= b.w * b.h - 1;
  };

  it("высота пузыря — по замеру текста (а нет его — на глаз); на шаге «нажми» выше: строка-подсказка над кнопками", () => {
    // 2 строки по 20,6 px: 26 (поля) + 41 + 52 (ряд с «Дальше») = 119 — как пузырь приветствия на скриншоте.
    expect(bubbleH({ len: 56, textH: () => 41 }, 336)).toBe(119);
    expect(bubbleH({ len: 56, textH: () => null }, 336)).toBe(estimateBubbleH(56, 336));
    expect(bubbleH({ len: 47, tap: true, textH: () => 41 }, 256)).toBe(bubbleH({ len: 47, textH: () => 41 }, 256) + 11);
    expect(estimateBubbleH(47, 256, true)).toBeGreaterThan(estimateBubbleH(47, 256));
  });

  it("F1: грань кнопки — часть кнопки: пузырь, закрывший кнопку без грани, сдвигается — полоска грани не торчит", () => {
    const s: Say = { len: 57, textH: () => 42 };
    const plain = placementRects(placeBit(null, vp760, s), 760, s);
    // Кнопка кончается за 2 px до низа пузыря, а её грань — на 2 px ниже него.
    const btn = { x: 40, y: plain.bubble.y + plain.bubble.h - 46, w: 200, h: 44 };
    expect(overlapArea(plain.bubble, btn)).toBe(btn.w * btn.h);
    expect(clean(plain.bubble, btn)).toBe(false);
    const r = placementRects(placeBit(null, vp760, s, { avoid: [btn] }), 760, s);
    expect(clean(r.bubble, btn)).toBe(true);
  });

  it("F1, 640, приветствие (ru и kk): пузырь закрывает «Другие режимы» и «Начать» целиком — вместе с гранью", () => {
    for (const s of [say(56, 2, 3), say(70, 3, 4)]) {
      const p = placeBit(null, vp640, s, { avoid: [...header, ...learn(), ...nav(640)] });
      const r = placementRects(p, 640, s);
      for (const a of learn()) expect(clean(r.bubble, a), `len ${s.len}, y ${a.y}`).toBe(true);
      const start = learn()[START];
      expect(r.bubble.y + r.bubble.h).toBeGreaterThanOrEqual(start.y + start.h + BUTTON_EDGE);
      expect(r.bubble.y).toBeGreaterThanOrEqual(0);
      expect(p.corner).toBe("br");
    }
  });

  it("F1: закрыть кнопку целиком — хуже, чем не задеть её совсем: есть такое место — пузырь встаёт туда", () => {
    const s: Say = { len: 57, textH: () => 42 };
    const btn = { x: 20, y: 520, w: 60, h: 30 };
    // Обычное место (левый угол, пузырь над Битом) закрыло бы кнопку целиком, с запасом.
    const plain = placementRects(placeBit(null, vp760, s, { prev: "bl" }), 760, s);
    expect(overlapArea(plain.bubble, btn)).toBe(btn.w * btn.h);
    const p = placeBit(null, vp760, s, { prev: "bl", avoid: [btn] });
    const r = placementRects(p, 760, s);
    expect(overlaps(r.bubble, btn, 7)).toBe(false);
    expect(overlaps(r.bit, btn)).toBe(false);
    expect(p.corner).toBe("bl");
  });

  it("F2, шаг с целью вверху (сердечки), 760: край пузыря не режет «Начать» — Бит чуть опускается", () => {
    const s = say(73, 2, 3);
    const target = { x: 180, y: 6, w: 64, h: 48 };
    const start = { x: 38, y: 440, w: 288, h: 52 };
    const plain = placementRects(placeBit(target, vp760, s, { prev: "br" }), 760, s);
    expect(clean(plain.bubble, start)).toBe(false);
    const p = placeBit(target, vp760, s, { prev: "br", avoid: [start, ...nav(760)] });
    const r = placementRects(p, 760, s);
    expect(clean(r.bubble, start)).toBe(true);
    expect(overlaps(r.bubble, { ...start, h: start.h + BUTTON_EDGE }, 7)).toBe(false);
    expect(overlaps(r.bubble, target)).toBe(false);
    expect(overlaps(r.bit, target)).toBe(false);
    expect(p.corner).toBe("br");
  });

  it("F2, шаг про кнопку Бита (640 и 760): пузырь поднимается, пока его края не перестанут резать кнопки; хвостик — к кнопке", () => {
    const s = say(76, 3, 4);
    for (const [vp, dy] of [
      [vp640, -139],
      [vp760, -19],
    ] as const) {
      const anchor = { x: 278, y: vp.vh - 64 - 12 - 56 - 6, w: 79, h: 68 };
      const aimX = 284 + 28;
      const page = learn(dy);
      const p0 = placeFromDock(anchor, vp, aimX);
      const plain = placementRects(p0, vp.vh, s);
      expect(page.every((a) => clean(plain.bubble, a))).toBe(false);
      const p = placeFromDock(anchor, vp, aimX, { avoid: [...header, ...page, ...nav(vp.vh)], say: s });
      const r = placementRects(p, vp.vh, s);
      for (const a of page) expect(clean(r.bubble, a), `${vp.vh}: y ${a.y}`).toBe(true);
      expect(r.bubble.y).toBeGreaterThanOrEqual(0);
      expect(r.bubble.y + r.bubble.h).toBeLessThanOrEqual(anchor.y - 9);
      expect(p.dock).toBe(true);
      expect(p.bubbleX + tailLeft(p) + 8).toBeCloseTo(aimX);
      // Пузырь поднят — хвостик вытянут до кнопки: его кончик там же, где у неподнятого (над рамкой кнопки, 2–6 px).
      expect(p.lift).toBe(p.bubbleBottom - p0.bubbleBottom);
      expect(p.lift).toBeGreaterThan(0);
      expect(dockTail(p0)).toBe(TAIL_TIP);
      const tip = vp.vh - p.bubbleBottom + dockTail(p);
      expect(tip).toBe(vp.vh - p0.bubbleBottom + dockTail(p0));
      expect(tip).toBeLessThanOrEqual(anchor.y - 2);
      expect(tip).toBeGreaterThanOrEqual(anchor.y - 6);
    }
  });

  it("F2: кнопок вокруг нет — пузырь из кнопки Бита на обычном месте, хвостик обычный", () => {
    const anchor = { x: 278, y: 760 - 64 - 12 - 56 - 6, w: 79, h: 68 };
    const p = placeFromDock(anchor, vp760, 312, { avoid: nav(760), say: 76 });
    expect(p).toEqual(placeFromDock(anchor, vp760, 312));
    expect(p.lift).toBeUndefined();
    expect(dockTail(p)).toBe(TAIL_TIP);
    // У говорящего Бита хвостик не вытягивается никогда.
    expect(dockTail({ ...placeBit(null, vp760), lift: 40 })).toBe(TAIL_TIP);
  });

  it("F3: Бит на затемнённой нижней панели — нижний край пузыря сбоку над панелью, хвостик у низа пузыря", () => {
    // Под целью (низ — 440) Бит с пузырём над панелью не помещается — Бит садится на панель.
    const target = { x: 10, y: 300, w: 340, h: 140 };
    const s: Say = { len: 40, textH: () => 42 };
    const p = placeBit(target, vp640, s);
    const r = placementRects(p, 640, s);
    expect(p.bitBottom).toBe(12);
    expect(p.bubble).toBe("side");
    expect(r.bubble.y + r.bubble.h).toBeLessThanOrEqual(640 - 64 - 6);
    expect(overlaps(r.bubble, target)).toBe(false);
    expect(sideTail(p)).toBe(10);
    // Обычный пузырь сбоку (Бит над панелью) — хвостик на прежнем месте.
    expect(sideTail({ ...p, bitBottom: 76, bubbleBottom: 86 })).toBe(22);
  });

  it("F3, «Нажми «Начать»» (640 и 760, ru и kk): пузырь сбоку не кончается на высоте подписей вкладок; цель и место пальца открыты", () => {
    for (const vp of [vp640, vp760]) {
      for (const s of [say(47, 2, 2, true), say(56, 2, 3, true)]) {
        const btn = learn()[START];
        const spot0 = { x: btn.x - 6, y: btn.y - 6, w: btn.w + 12, h: btn.h + 12 + FINGER_ROOM };
        const dy = guideScroll(spot0, vp, 58, s);
        const spot = { ...spot0, y: spot0.y - dy };
        const page = learn(-dy).filter((_, i) => i !== START);
        const p: BitPlacement = placeBit(spot, vp, s, { prev: "br", avoid: [...header, ...page, ...nav(vp.vh)] });
        const r = placementRects(p, vp.vh, s);
        const tag = `${vp.vh}, len ${s.len}`;
        expect(overlaps(r.bubble, spot), tag).toBe(false);
        expect(overlaps(r.bit, spot), tag).toBe(false);
        expect(r.bubble.y, tag).toBeGreaterThanOrEqual(0);
        if (p.bubble === "side" && p.bitBottom < 64) expect(p.bubbleBottom >= 64 + 6 || p.bubbleBottom <= p.bitBottom, tag).toBe(true);
        else expect(r.bubble.y + r.bubble.h, tag).toBeLessThanOrEqual(vp.vh - 64);
      }
    }
  });

  /** Низ подписей вкладок нижней панели: pt-[7px] + значок h-8 + gap-0.5 + строка 11 px (~16,5) — ~6,5 px над низом панели. */
  const LABEL_GAP = 6.5;

  it("F3: над панелью пузырю места нет — он закрывает полосу панели целиком, до её низа (подписи вкладок не торчат)", () => {
    const target = { x: 10, y: 300, w: 340, h: 195 };
    const s: Say = { len: 30, textH: () => 42 };
    for (const avoid of [undefined, [...header, ...nav(640)]]) {
      const p = placeBit(target, vp640, s, { avoid });
      const r = placementRects(p, 640, s);
      expect(p.bitBottom).toBe(12);
      expect(p.bubble).toBe("side");
      expect(p.bubbleBottom).toBe(0);
      expect(r.bubble.y + r.bubble.h).toBeGreaterThanOrEqual(640 - LABEL_GAP);
      expect(overlaps(r.bubble, target)).toBe(false);
      expect(overlaps(r.bit, target)).toBe(false);
      // Хвостик — напротив лица Бита, на той же высоте, что у обычного пузыря сбоку (низ Бита + 10 + 22).
      expect(p.bubbleBottom + sideTail(p)).toBe(p.bitBottom + 10 + 22);
    }
  });

  it("F3: то же с полоской «домой» (safe-area 34 px): пузырь — до низа панели, над полоской", () => {
    const vp = { vw: 360, vh: 700, bottomInset: 64 + 34, safeBottom: 34 };
    const target = { x: 10, y: 300, w: 340, h: 230 };
    const s: Say = { len: 30, textH: () => 42 };
    const p = placeBit(target, vp, s);
    const r = placementRects(p, vp.vh, s);
    expect(p.bitBottom).toBe(34 + 12);
    expect(p.bubbleBottom).toBe(34);
    expect(r.bubble.y + r.bubble.h).toBeGreaterThanOrEqual(vp.vh - 34 - LABEL_GAP);
    expect(overlaps(r.bubble, target)).toBe(false);
  });

  it("кнопки затемнённой нижней панели не влияют на выбор, когда чисто не помещается ничего (Бит не лезет на цель)", () => {
    // Узкая высокая цель справа: и пузырь, и Бит задевают её где угодно — выбирается «наименьшее зло».
    const target = { x: 250, y: 100, w: 100, h: 400 };
    const s: Say = { len: 90, textH: () => 63 };
    for (const prev of [undefined, "br", "bl"] as const) {
      const p = placeBit(target, vp640, s, { prev, avoid: nav(640) });
      expect(p).toEqual(placeBit(target, vp640, s, { prev }));
      expect(overlaps(placementRects(p, 640, s).bit, target)).toBe(false);
    }
  });
});

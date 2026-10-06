// Всплывающий Бит-проводник (этап 16В, P2a; ТЗ — docs/specs/stage16c.md, §4): сцены, выбор сцены, геометрия Бита,
// пузыря и пальца-указателя. Чистая логика без React. Показано ли — `useApp.tips` (lib/tips.ts), отметка — `noteTip(id)`.

import type { DictKey } from "@/i18n/dict";
import type { Mood } from "@/components/mascot/Mascot";
import { TIP_IDS, tipSeen, type TipId, type TipsState } from "./tips";

export type GuideAction = "next" | "tap";

export interface GuideStep {
  id: string;
  /**
   * Метки `data-tour`; рамка — их объединение (заголовок во всю ширину + первая карточка = заголовок с первым рядом).
   * Нет — шаг модальный: экран затемнён целиком, страницу под ним не нажать, Бит просто говорит.
   */
  targets?: readonly string[];
  /** Ключ `guide.*`. */
  text: DictKey;
  /** Школьный трек (без пробного ЕНТ). */
  textSchool?: DictKey;
  /** Имени нет — этот вариант (приветствие). */
  textNoName?: DictKey;
  /** `{n}` ≠ 1 — этот вариант («сердечка» вместо «сердечко»). */
  textMany?: DictKey;
  /** Сердечки не списывались («Безлимит», пробный) — этот вариант. */
  textFree?: DictKey;
  mood?: Mood;
  /** next — кнопка «Дальше»/«Понятно»; tap — ждём нажатия на цель (кнопки «Дальше» нет). */
  action: GuideAction;
  /** Ждать появления цели (мс). Не появилась — шаг пропускается. По умолчанию DEFAULT_WAIT_MS. */
  waitMs?: number;
  /** Только для ЕНТ-трека (`entVisible`). */
  ent?: boolean;
  /** Показывать, только если предыдущий шаг сцены был показан (не пропущен). */
  chain?: boolean;
  /** Цель так и не появилась — вместо пропуска сказать это (без цели, на затемнённом экране, «Понятно»). */
  orElse?: { text: DictKey; mood?: Mood };
  /** Нашлись не все метки (у новичка нет слабых тем — нет первой строки списка) — этот вариант. */
  textPartial?: DictKey;
}

export type SceneId = TipId;

export interface GuideScene {
  id: SceneId;
  steps: readonly GuideStep[];
}

/** Ожидание цели по умолчанию: страница могла ещё дорисоваться. */
export const DEFAULT_WAIT_MS = 1500;
/** В уроке вопрос с вариантами может появиться не сразу (сначала шаги-рассказы). */
export const LESSON_WAIT_MS = 10 * 60_000;
/** Пауза после прихода на страницу: сначала виден сам экран, потом выпрыгивает Бит. */
export const GUIDE_DELAY_MS = 600;

/** Шаг сцены страницы: id (он же метка), реплика, метки (по умолчанию — id) и прочие поля шага. */
type PageStep = [id: string, text: DictKey, targets?: readonly string[], extra?: Partial<GuideStep>];

const two = (id: SceneId, a: PageStep, b: PageStep): GuideScene => ({
  id,
  steps: [
    { id: a[0], targets: a[2] ?? [a[0]], text: a[1], action: "next", mood: "happy", ...a[3] },
    { id: b[0], targets: b[2] ?? [b[0]], text: b[1], action: "next", ...b[3] },
  ],
});

export const GUIDE_SCENES: Record<SceneId, GuideScene> = {
  welcome: {
    id: "welcome",
    steps: [
      { id: "hi", text: "guide.welcome.hi", textNoName: "guide.welcome.hi0", mood: "happy", action: "next" },
      // Реплика про карточку урока — рамка на всей карточке; кнопку «Начать» (метка continue) — только на шаге «нажми».
      { id: "continue", targets: ["next-lesson"], text: "guide.welcome.continue", textSchool: "guide.welcome.continue.school", action: "next" },
      { id: "hearts", targets: ["hdr-hearts"], text: "guide.welcome.hearts", action: "next" },
      {
        id: "start",
        targets: ["continue"],
        text: "guide.welcome.start",
        // У школьного трека на кнопке не «Начать», а «Продолжить» — без названия кнопки.
        textSchool: "guide.welcome.start.school",
        mood: "celebrate",
        action: "tap",
        orElse: { text: "guide.welcome.noLesson" },
      },
    ],
  },
  "lesson-first": {
    id: "lesson-first",
    steps: [
      {
        id: "hearts",
        targets: ["lesson-hearts"],
        text: "guide.lesson.hearts",
        textMany: "guide.lesson.heartsMany",
        textFree: "guide.lesson.heartsFree",
        mood: "happy",
        action: "next",
      },
      { id: "progress", targets: ["lesson-progress"], text: "guide.lesson.progress", action: "next" },
      { id: "options", targets: ["lesson-options"], text: "guide.lesson.options", action: "tap", waitMs: LESSON_WAIT_MS },
      { id: "check", targets: ["lesson-check"], text: "guide.lesson.check", action: "tap", chain: true },
      { id: "ask", targets: ["lesson-ask"], text: "guide.lesson.ask", mood: "thinking", action: "next", chain: true },
    ],
  },
  "after-first": {
    id: "after-first",
    steps: [
      { id: "xp", targets: ["res-xp"], text: "guide.after.xp", mood: "celebrate", action: "next" },
      { id: "chips", targets: ["res-chips"], text: "guide.after.chips", action: "next" },
      { id: "streak", targets: ["res-streak"], text: "guide.after.streak", action: "next" },
      { id: "continue", targets: ["res-continue"], text: "guide.after.continue", mood: "happy", action: "tap" },
    ],
  },
  nav: {
    id: "nav",
    steps: [
      { id: "continue", targets: ["next-lesson"], text: "guide.nav.continue", mood: "happy", action: "next" },
      { id: "bar", targets: ["nav-practice", "nav-materials", "nav-progress"], text: "guide.nav.bar", textSchool: "guide.nav.bar.school", action: "next" },
      { id: "dock", targets: ["bit-dock"], text: "guide.nav.dock", mood: "happy", action: "next" },
      { id: "shop", targets: ["hdr-chips"], text: "guide.nav.shop", action: "tap" },
    ],
  },
  // Цели — компактные: заголовок раздела и первая строка (рамка выше полэкрана расползлась бы по краям экрана).
  // Объединение заголовка (во всю ширину) и первой карточки — это заголовок с первым рядом.
  "page-practice": two(
    "page-practice",
    ["practice-train", "guide.practice.train"],
    ["practice-games", "guide.practice.games", ["practice-games", "practice-games-first"]],
  ),
  "page-materials": two("page-materials", ["materials-notes", "guide.materials.notes"], ["materials-theory", "guide.materials.theory"]),
  "page-progress": two(
    "page-progress",
    ["stats-overview", "guide.stats.overview"],
    // Слабых тем ещё нет (первой строки нет) — «реши пару заданий», а не «нажми на тему».
    ["stats-weak", "guide.stats.weak", ["stats-weak", "stats-weak-first"], { textPartial: "guide.stats.weakEmpty" }],
  ),
  // В порядке страницы: украшения выше сердечек (иначе экран прыгал бы обратно вверх).
  "page-shop": two(
    "page-shop",
    ["shop-cosmetics", "guide.shop.cosmetics"],
    ["shop-hearts", "guide.shop.hearts", ["shop-hearts", "shop-hearts-first"]],
  ),
  "page-profile": two("page-profile", ["profile-card", "guide.profile.card"], ["profile-settings", "guide.profile.settings"]),
  // Рамка — на «Свободном» чате (или «Новый чат»); не нашлась — та же реплика без цели.
  "page-tutor": {
    id: "page-tutor",
    steps: [{ id: "hi", targets: ["tutor-free"], text: "guide.tutor.hi", mood: "happy", action: "next", orElse: { text: "guide.tutor.hi", mood: "happy" } }],
  },
  "page-school": { id: "page-school", steps: [{ id: "grades", targets: ["school-grades"], text: "guide.school.grades", mood: "happy", action: "next" }] },
};

/** Сцены страниц: точный путь → сцена (подстраницы вроде /tutor/123 — без сцены). */
const PAGE_SCENES: Readonly<Record<string, SceneId>> = {
  "/practice": "page-practice",
  "/materials": "page-materials",
  "/stats": "page-progress",
  "/shop": "page-shop",
  "/profile": "page-profile",
  "/tutor": "page-tutor",
};

export interface SceneCtx {
  pathname: string;
  /** Онбординг пройден. */
  onboarded: boolean;
  /** Сколько уроков пройдено хотя бы раз. */
  completedLessons: number;
  /** На экране плеер урока в режиме «Учиться» (метка в LessonScreen). */
  inLesson: boolean;
  /** На экране итоги урока (метка в Results). */
  onResults: boolean;
  /** Школьный трек (`!entVisible`): на «Учиться» — карта класса. */
  school?: boolean;
}

/**
 * Какую сцену играть сейчас. Порядок пути: welcome (на «Учиться», уроков 0) → lesson-first (в первом уроке) →
 * after-first (итоги первого урока) → nav (на «Учиться» после первого урока) → сцены страниц при первом заходе.
 * Страницы ждут обзор (nav): две сцены сразу не играем. Приветствие, закрытое при нуле уроков, ждёт первого урока молча.
 * Онбординг, пробный ЕНТ, тесты и игры — без сцен (у них нет ни пути, ни метки).
 */
export function sceneFor(tips: TipsState | undefined, ctx: SceneCtx): SceneId | null {
  if (!ctx.onboarded) return null;
  const fresh = (id: SceneId) => !tipSeen(tips, id);
  // Итоги идут внутри экрана урока — их метка важнее метки урока.
  if (ctx.onResults) return ctx.completedLessons <= 1 && fresh("after-first") ? "after-first" : null;
  if (ctx.inLesson) return ctx.completedLessons === 0 && fresh("lesson-first") ? "lesson-first" : null;
  if (ctx.pathname === "/learn") {
    if (fresh("nav")) {
      if (ctx.completedLessons >= 1) return "nav";
      return fresh("welcome") ? "welcome" : null;
    }
    return ctx.school && fresh("page-school") ? "page-school" : null;
  }
  if (fresh("nav")) return null;
  const page = PAGE_SCENES[ctx.pathname];
  return page && fresh(page) ? page : null;
}

/** Шаги сцены для ученика: шаги только для ЕНТ школьному треку не показываем. */
export function sceneSteps(scene: GuideScene, ent: boolean): GuideStep[] {
  return scene.steps.filter((s) => ent || !s.ent);
}

/**
 * Какой текст сказать на шаге: имя есть/нет, школьный трек, сердечки не списывались (`free`: «Безлимит», пробный),
 * число сердечек, запасная реплика (`orElse`), нашлись не все метки (`partial`).
 */
export function stepText(
  step: GuideStep,
  o: { name?: string; school?: boolean; n?: number; free?: boolean; fallback?: boolean; partial?: boolean },
): DictKey {
  if (o.fallback && step.orElse) return step.orElse.text;
  if (o.partial && step.textPartial) return step.textPartial;
  if (step.textNoName && !o.name?.trim()) return step.textNoName;
  if (step.textSchool && o.school) return step.textSchool;
  if (step.textFree && o.free) return step.textFree;
  if (step.textMany && o.n !== undefined && o.n !== 1) return step.textMany;
  return step.text;
}

/** Тире не уезжает в начало строки: пробел перед ним — неразрывный (длина текста та же — печать не сбивается). */
export const keepDash = (text: string): string => text.replace(/ (?=—)/g, "\u00a0");

/**
 * Проводник ещё не закончен (обзор панели не показан): окна тарифов, напоминаний и кейса ждут.
 * «Пропустить» отмечает все подсказки, поэтому снимает ожидание.
 */
export const tourBlocking = (tips: TipsState | undefined): boolean => !tipSeen(tips, "nav");

/** «Пропустить»: закрыть весь проводник — отметить все сцены, которые ещё не показаны. */
export function unseenTips(tips: TipsState | undefined): TipId[] {
  return TIP_IDS.filter((id) => !tipSeen(tips, id));
}

/** Сколько уроков пройдено хотя бы раз (по `useApp.lessons`). */
export function completedLessonsCount(lessons: Record<string, { completions?: number } | undefined> | undefined): number {
  let n = 0;
  for (const id in lessons) if ((lessons[id]?.completions ?? 0) > 0) n++;
  return n;
}

// ---------------------------------------------------------------------------------------------------------------------
// Геометрия (пиксели окна).

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Объединение нескольких прямоугольников (рамка вокруг группы). Пусто — null. */
export function unionRect(rects: readonly Rect[]): Rect | null {
  if (!rects.length) return null;
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const r of rects) {
    x1 = Math.min(x1, r.x);
    y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.w);
    y2 = Math.max(y2, r.y + r.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/**
 * Прямоугольник, раздутый на pad со всех сторон и не вылезающий за окно. `inset` — поле от краёв окна: рамка цели,
 * которая выше экрана, остаётся рамкой, а не обводкой по краям экрана.
 */
export function padRect(r: Rect, pad: number, vw: number, vh: number, inset = 0): Rect {
  const x = Math.max(inset, r.x - pad);
  const y = Math.max(inset, r.y - pad);
  const x2 = Math.min(vw - inset, r.x + r.w + pad);
  const y2 = Math.min(vh - inset, r.y + r.h + pad);
  return { x, y, w: Math.max(0, x2 - x), h: Math.max(0, y2 - y) };
}

export const sameRect = (a: Rect | null, b: Rect | null): boolean =>
  a === b ||
  (!!a && !!b && Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y) && Math.round(a.w) === Math.round(b.w) && Math.round(a.h) === Math.round(b.h));

/** Пересекаются ли прямоугольники (с запасом `gap` вокруг). */
export function overlaps(a: Rect, b: Rect, gap = 0): boolean {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}

/** Размер Бита, px. */
export const BIT_SIZE = 72;
/** Самый широкий пузырь, px. */
export const BUBBLE_MAX_W = 340;
/** Пузырь над Битом: зазор до головы. */
const ABOVE_GAP = 6;
/** Пузырь сбоку: зазор до Бита и подъём над его низом. */
const SIDE_GAP = 8;
const SIDE_LIFT = 10;
/** Бит над целью (цель внизу экрана): зазор. */
const LIFT_GAP = 12;
/** Запас вокруг цели при проверке «не закрывает ли». */
const CLEAR = 4;
/** Пузырь из плавающей кнопки Бита: зазор от рамки кнопки (хвостик выступает на ~9 px). */
const DOCK_GAP = 14;
/** Поле под шапкой, до которого прокручивается верх цели. */
const SCROLL_MARGIN = 8;
/** Шаг «нажми»: место под целью для пальца (палец снизу — кисть ниже кончика). */
export const FINGER_ROOM = 40;

/** Поле у краёв окна: телефон — 12 px, компьютер — 24 px. */
export const edgeOf = (vw: number): number => (vw >= 1024 ? 24 : 12);

/**
 * Высота пузыря на глаз (для выбора места — до того, как он нарисован): ~8,4 px на букву 15-го кегля, строка 21 px,
 * поля 24 px и ряд кнопок 46 px. С запасом на переносы слов.
 */
export function estimateBubbleH(textLen: number, w: number): number {
  const perLine = Math.max(8, Math.floor((w - 32) / 8.4));
  const lines = Math.max(1, Math.ceil((textLen * 1.12) / perLine));
  return 24 + lines * 21 + 46;
}

export interface GuideViewport {
  vw: number;
  vh: number;
  /** Занято снизу: нижняя панель телефона (64 px + safe-area) или safe-area на экранах без панели. */
  bottomInset: number;
  /**
   * Одна safe-area снизу (полоска «домой»). Меньше `bottomInset` — внизу нижняя панель: если цель не в ней, Бит может
   * сесть на затемнённую панель. Нет — как `bottomInset` (на панель не садится).
   */
  safeBottom?: number;
}

export interface BitPlacement {
  /** Угол: правый нижний (дом плавающей кнопки Бита) или левый нижний. */
  corner: "br" | "bl";
  /** Пузырь над Битом или сбоку от него. */
  bubble: "above" | "side";
  /** Левый край Бита и отступ его низа от низа окна. */
  bitX: number;
  bitBottom: number;
  /** Пузырь: левый край, ширина и отступ его низа от низа окна (растёт вверх). */
  bubbleX: number;
  bubbleW: number;
  bubbleBottom: number;
  /** Пузырь выходит из плавающей кнопки Бита (шаг про неё): говорящего Бита нет, хвостик — к кнопке (`bitX` — её центр). */
  dock?: boolean;
}

type Corner = BitPlacement["corner"];
type Combo = [Corner, BitPlacement["bubble"]];

function layout(corner: Corner, bubble: BitPlacement["bubble"], bottom: number, vw: number): BitPlacement {
  const edge = edgeOf(vw);
  const bitX = corner === "br" ? vw - edge - BIT_SIZE : edge;
  if (bubble === "above") {
    const w = Math.min(BUBBLE_MAX_W, Math.max(0, vw - edge * 2));
    return { corner, bubble, bitX, bitBottom: bottom, bubbleX: corner === "br" ? vw - edge - w : edge, bubbleW: w, bubbleBottom: bottom + BIT_SIZE + ABOVE_GAP };
  }
  const w = Math.min(BUBBLE_MAX_W, Math.max(0, vw - edge * 2 - BIT_SIZE - SIDE_GAP));
  return { corner, bubble, bitX, bitBottom: bottom, bubbleX: corner === "br" ? bitX - SIDE_GAP - w : bitX + BIT_SIZE + SIDE_GAP, bubbleW: w, bubbleBottom: bottom + SIDE_LIFT };
}

/** Прямоугольники Бита и пузыря (в координатах окна). */
export function placementRects(p: BitPlacement, vh: number, textLen: number): { bit: Rect; bubble: Rect } {
  const bh = estimateBubbleH(textLen, p.bubbleW);
  return {
    bit: { x: p.bitX, y: vh - p.bitBottom - BIT_SIZE, w: BIT_SIZE, h: BIT_SIZE },
    bubble: { x: p.bubbleX, y: vh - p.bubbleBottom - bh, w: p.bubbleW, h: bh },
  };
}

/** Хвостик пузыря над Битом: левый край его квадратика от левого края пузыря — напротив центра Бита (или кнопки Бита). */
export function tailLeft(p: BitPlacement): number {
  return Math.max(18, Math.min(p.bitX + BIT_SIZE / 2 - p.bubbleX - 8, p.bubbleW - 34));
}

/** Пересечение прямоугольников, px² (0 — не пересекаются). */
export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Сколько площади прямоугольников `list` закрывает `r`; `cut` — только «разрезанных» (закрытых не целиком). */
function coverArea(r: Rect, list: readonly Rect[], cut = false): number {
  let sum = 0;
  for (const a of list) {
    const o = overlapArea(r, a);
    if (o > 0 && !(cut && o >= a.w * a.h - 1)) sum += o;
  }
  return sum;
}

/** Верх пузыря не выше этого поля: текст реплики виден целиком. */
const TOP_MARGIN = 4;

/** Отступы снизу: нижняя панель (с safe-area) и одна safe-area (на ней — Бит на затемнённой панели). */
function insets(vp: GuideViewport): { panel: number; safe: number } {
  const panel = Math.max(0, vp.bottomInset);
  return { panel, safe: Math.max(0, Math.min(panel, vp.safeBottom ?? panel)) };
}

/** Бит может сесть на затемнённую нижнюю панель: панель есть (телефон) и цель не в ней. */
function panelFree(target: Rect, vp: GuideViewport): boolean {
  const { panel, safe } = insets(vp);
  return panel > safe && target.y + target.h <= vp.vh - panel;
}

/** Сколько места оставить под целью Биту с пузырём (пузырь сбоку или над Битом — что ниже), с запасом. */
export function roomNeeded(vw: number, textLen = 90): number {
  const sideH = Math.max(BIT_SIZE, SIDE_LIFT + estimateBubbleH(textLen, layout("br", "side", 0, vw).bubbleW));
  const aboveH = BIT_SIZE + ABOVE_GAP + estimateBubbleH(textLen, layout("br", "above", 0, vw).bubbleW);
  return Math.min(sideH, aboveH) + CLEAR;
}

/** Под целью помещается Бит (над нижней панелью, а если цель не в панели — и на ней). */
export function roomBelow(target: Rect, vp: GuideViewport): boolean {
  const { panel, safe } = insets(vp);
  const floor = (panelFree(target, vp) ? safe : panel) + edgeOf(vp.vw);
  return target.y + target.h + CLEAR <= vp.vh - floor - BIT_SIZE;
}

/**
 * На сколько прокрутить страницу (px; плюс — вниз), чтобы цель была видна целиком (верх — не под шапкой, её низ — `top`)
 * и под ней поместились Бит с пузырём: сначала — над нижней панелью, не выходит — на затемнённой панели.
 * Нижней панели нет (урок, итоги, компьютер) — только чтобы цель была видна: в уроке текст задания над вариантами
 * не должен уезжать под шапку, а Бит там встаёт поверх нижней кнопки.
 * Цель выше, чем помещается: видна целиком — не трогаем, иначе её верх встаёт под шапку. 0 — прокручивать не нужно.
 */
export function guideScroll(target: Rect, vp: GuideViewport, top: number, textLen = 90): number {
  const { panel, safe } = insets(vp);
  const minY = top + SCROLL_MARGIN;
  const fit = (maxBottom: number): number | null => {
    if (target.h > maxBottom - minY) return null;
    if (target.y + target.h > maxBottom) return target.y + target.h - maxBottom;
    return target.y < minY ? target.y - minY : 0;
  };
  if (panel > safe) {
    const need = roomNeeded(vp.vw, textLen) + edgeOf(vp.vw);
    for (const inset of [panel, safe]) {
      const dy = fit(vp.vh - inset - need);
      if (dy !== null) return dy;
    }
  } else {
    const dy = fit(vp.vh - panel - SCROLL_MARGIN);
    if (dy !== null) return dy;
  }
  if (target.y >= minY && target.y + target.h <= vp.vh - panel) return 0;
  return target.y - minY;
}

export interface PlaceOpts {
  /** Угол Бита на прошлом шаге: Бит остаётся там, если он и пузырь не закрывают цель (не прыгает из угла в угол). */
  prev?: Corner;
  /**
   * Кнопки и ссылки на экране (кроме самой цели): поднятые над целью Бит и пузырь на них не садятся; на шаге без цели
   * пузырь их по возможности не режет.
   */
  avoid?: readonly Rect[];
}

/**
 * Где Бит и пузырь. Бит в нижнем углу над нижней панелью — в прошлом углу (`prev`), а на первом шаге — в правом, если
 * цель не в правой нижней четверти и Бит её не закрыл бы. Пузырь — над Битом, а если цель в нижней половине — сбоку.
 * Закрыли бы цель — пробуем другой пузырь, Бита на затемнённой нижней панели (цель не в ней), другой угол.
 * Варианты, где пузырь вылез бы за верх окна, отбрасываются. Бит поднимается над целью, только если под ней ему нет места
 * (кнопка у самого низа экрана: «Проверить», «Продолжить»), и тогда не садится на кнопки вокруг (`avoid`).
 * Чисто не помещается ничего — там, где меньше всего закрыто цели (пузырь растёт вверх — его кнопки видны всегда).
 * Без цели (экран затемнён целиком) — прошлый угол, пузырь над Битом; есть `avoid` — где пузырь не режет кнопки.
 * `textLen` — длина реплики: по ней оценивается высота пузыря.
 */
export function placeBit(target: Rect | null, vp: GuideViewport, textLen = 90, opts: PlaceOpts = {}): BitPlacement {
  const { vw, vh } = vp;
  const edge = edgeOf(vw);
  const { panel, safe } = insets(vp);
  const base = panel + edge;
  const low = safe + edge;
  const avoid = opts.avoid ?? [];
  const rects = (p: BitPlacement) => placementRects(p, vh, textLen);
  const fits = (p: BitPlacement) => {
    const r = rects(p);
    return r.bubble.y >= TOP_MARGIN && r.bit.y >= 0;
  };

  if (!target) {
    const first = opts.prev ?? "br";
    const plain = layout(first, "above", base, vw);
    if (!avoid.length) return plain;
    let best = plain;
    let bestCut = Infinity;
    for (const c of [first, first === "br" ? "bl" : "br"] as const) {
      for (const lvl of panel > safe ? [base, low] : [base]) {
        for (const b of ["above", "side"] as const) {
          const p = layout(c, b, lvl, vw);
          if (!fits(p)) continue;
          const r = rects(p);
          const cut = coverArea(r.bubble, avoid, true) + coverArea(r.bit, avoid, true);
          if (cut < bestCut) {
            best = p;
            bestCut = cut;
          }
        }
      }
    }
    return best;
  }

  const hits = (p: BitPlacement) => {
    const r = rects(p);
    return overlaps(r.bit, target, CLEAR) || overlaps(r.bubble, target, CLEAR);
  };
  const onAvoid = (p: BitPlacement) => {
    const r = rects(p);
    return avoid.some((a) => overlaps(r.bit, a) || overlaps(r.bubble, a));
  };
  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;
  const brBit = rects(layout("br", "above", base, vw)).bit;
  const guess: Corner = (cx > vw / 2 && cy > vh / 2) || overlaps(brBit, target, CLEAR) ? "bl" : "br";
  const first = opts.prev ?? guess;
  const second: Corner = first === "br" ? "bl" : "br";
  const bubble: BitPlacement["bubble"] = cy > vh / 2 ? "side" : "above";
  const otherBubble: BitPlacement["bubble"] = bubble === "side" ? "above" : "side";
  const levels = panelFree(target, vp) ? [base, low] : [base];
  const order: BitPlacement[] = [];
  if (opts.prev) {
    // Сначала прошлый угол (над панелью, потом на ней), и только потом — другой.
    for (const c of [first, second]) for (const lvl of levels) for (const b of [bubble, otherBubble]) order.push(layout(c, b, lvl, vw));
  } else {
    const combos: Combo[] = [
      [first, bubble],
      [second, bubble],
      [first, otherBubble],
      [second, otherBubble],
    ];
    for (const lvl of levels) for (const [c, b] of combos) order.push(layout(c, b, lvl, vw));
  }
  for (const p of order) if (fits(p) && !hits(p)) return p;

  const pool = order.filter(fits);
  // Под целью Биту нет места (цель у самого низа экрана) — он встаёт над ней, но не на соседние кнопки.
  if (!roomBelow(target, vp)) {
    const lifted = Math.max(base, vh - target.y + LIFT_GAP);
    const liftedOrder: Combo[] = opts.prev
      ? [
          [first, "above"],
          [first, "side"],
          [second, "above"],
          [second, "side"],
        ]
      : [
          ["br", "above"],
          ["bl", "above"],
          ["br", "side"],
          ["bl", "side"],
        ];
    for (const [c, b] of liftedOrder) {
      const p = layout(c, b, lifted, vw);
      if (!fits(p)) continue;
      if (!hits(p) && !onAvoid(p)) return p;
      pool.push(p);
    }
  }

  // Ничего не помещается чисто: где меньше всего закрыто цели (Бит поверх цели — вдвое хуже пузыря), потом — кнопок вокруг.
  const cands = pool.length ? pool : order;
  let best = cands[0];
  let bestScore = Infinity;
  for (const p of cands) {
    const r = rects(p);
    const score = overlapArea(r.bubble, target) + 2 * overlapArea(r.bit, target) + (coverArea(r.bubble, avoid) + coverArea(r.bit, avoid)) / 2;
    if (score < bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Шаг про плавающую кнопку Бита: говорящий Бит прячется, пузырь выходит из самой кнопки — над её рамкой `anchor`,
 * хвостик смотрит на кнопку (`aimX` — её центр по горизонтали). Пузырь — во всю ширину пузыря, в пределах окна.
 */
export function placeFromDock(anchor: Rect, vp: GuideViewport, aimX = anchor.x + anchor.w / 2): BitPlacement {
  const edge = edgeOf(vp.vw);
  const w = Math.min(BUBBLE_MAX_W, Math.max(0, vp.vw - edge * 2));
  const right = aimX > vp.vw / 2;
  const x = right ? anchor.x + anchor.w - w : anchor.x;
  return {
    corner: right ? "br" : "bl",
    bubble: "above",
    bitX: aimX - BIT_SIZE / 2,
    bitBottom: vp.vh - (anchor.y + anchor.h),
    bubbleX: Math.max(edge, Math.min(vp.vw - edge - w, x)),
    bubbleW: w,
    bubbleBottom: vp.vh - anchor.y + DOCK_GAP,
    dock: true,
  };
}

/** Палец-указатель: кончик (x; y) и поворот `angle` в градусах по часовой стрелке от «пальцем вверх». */
export interface FingerPose {
  x: number;
  y: number;
  angle: number;
  /**
   * Палец пришёл сверху (смотрит вниз): иконка ещё и отражена вдоль пальца — поворот на 180° с отражением даёт
   * просто отражённую по вертикали кисть, а не перевёрнутую «вверх ногами».
   */
  flip?: boolean;
}

/**
 * Палец-указатель «нажимает» на цель со стороны `from`: кончик — внутри цели (на `depth` px от края, по умолчанию
 * 40 % меньшей стороны, не больше 22 — ближе к середине кнопки, а не на её краю), палец смотрит на центр цели.
 * `angle` — поворот в градусах по часовой стрелке от «пальцем вверх»; палец сверху (|angle| > 90) — `flip`.
 */
export function fingerPose(target: Rect, from: { x: number; y: number }, depth?: number): FingerPose {
  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;
  let dx = from.x - cx;
  let dy = from.y - cy;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
    dx = 0;
    dy = 1;
  }
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  // Где луч от центра цели к источнику пересекает край рамки.
  const tx = ux === 0 ? Infinity : target.w / 2 / Math.abs(ux);
  const ty = uy === 0 ? Infinity : target.h / 2 / Math.abs(uy);
  const d = depth ?? Math.min(22, Math.min(target.w, target.h) * 0.4);
  const t = Math.max(0, Math.min(tx, ty) - d);
  const raw = (Math.atan2(-ux, uy) * 180) / Math.PI;
  const angle = Math.abs(raw) < 1e-9 ? 0 : raw;
  const pose: FingerPose = { x: cx + ux * t, y: cy + uy * t, angle };
  if (Math.abs(angle) > 90 + 1e-6) pose.flip = true;
  return pose;
}

/**
 * Где лежит палец (в системе «пальцем вверх», кончик в 0; 0): иконка 40 px (`GuidePointer`) с белой обводкой — поперёк
 * оси от −14 до 28 px (кисть справа; у отражённого — слева), вдоль — до 56 px от кончика с учётом «тычка».
 */
const FINGER_BOX = { x1: -14, x2: 28, y1: -2, y2: 56 } as const;

/** Прямоугольник, который закрывает палец на экране (рамка повёрнутого пальца). */
export function fingerRect(f: FingerPose): Rect {
  const a = (f.angle * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const xs = f.flip ? [-FINGER_BOX.x2, -FINGER_BOX.x1] : [FINGER_BOX.x1, FINGER_BOX.x2];
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const px of xs) {
    for (const py of [FINGER_BOX.y1, FINGER_BOX.y2]) {
      const x = f.x + px * cos - py * sin;
      const y = f.y + px * sin + py * cos;
      x1 = Math.min(x1, x);
      y1 = Math.min(y1, y);
      x2 = Math.max(x2, x);
      y2 = Math.max(y2, y);
    }
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/**
 * Откуда палец показывает на цель: со стороны Бита (`from` — его центр), а если там палец лёг бы на Бита или пузырь
 * (`avoid`) или вылез за окно — снизу, снизу по диагонали или сбоку, где свободно; сверху (палец смотрит вниз) — только
 * когда снизу и сбоку места нет. Свободно нигде — со стороны Бита.
 */
export function aimFinger(target: Rect, from: { x: number; y: number }, avoid: readonly Rect[], vw: number, vh: number): FingerPose {
  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;
  const far = 10_000;
  const own = fingerPose(target, from);
  const lowAndSides = [
    { x: cx, y: cy + far },
    { x: cx - far, y: cy + far },
    { x: cx + far, y: cy + far },
    { x: cx - far, y: cy },
    { x: cx + far, y: cy },
  ];
  const above = [
    { x: cx - far, y: cy - far },
    { x: cx + far, y: cy - far },
    { x: cx, y: cy - far },
  ];
  const sources = own.flip ? [...lowAndSides, from, ...above] : [from, ...lowAndSides, ...above];
  for (const s of sources) {
    const pose = fingerPose(target, s);
    const r = fingerRect(pose);
    const inside = r.x >= 0 && r.y >= 0 && r.x + r.w <= vw && r.y + r.h <= vh;
    if (inside && !avoid.some((a) => overlaps(r, a))) return pose;
  }
  return own;
}

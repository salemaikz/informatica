// Всплывающий Бит-проводник (этап 16В, P2a; ТЗ — docs/specs/stage16c.md, §4): сцены, выбор сцены, геометрия Бита,
// пузыря и пальца-указателя. Чистая логика без React. Показано ли — `useApp.tips` (lib/tips.ts), отметка — `noteTip(id)`.

import type { DictKey } from "@/i18n/dict";
import type { Mood } from "@/components/mascot/Mascot";
import { TIP_IDS, tipSeen, type TipId, type TipsState } from "./tips";

export type GuideAction = "next" | "tap";

export interface GuideStep {
  id: string;
  /** Метки `data-tour`; рамка — их объединение. Нет — Бит просто говорит (без затемнения). */
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
  /** Цель так и не появилась — вместо пропуска сказать это (без цели, «Понятно»). */
  orElse?: { text: DictKey; mood?: Mood };
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

const two = (id: SceneId, a: [string, DictKey], b: [string, DictKey]): GuideScene => ({
  id,
  steps: [
    { id: a[0], targets: [a[0]], text: a[1], action: "next", mood: "happy" },
    { id: b[0], targets: [b[0]], text: b[1], action: "next" },
  ],
});

export const GUIDE_SCENES: Record<SceneId, GuideScene> = {
  welcome: {
    id: "welcome",
    steps: [
      { id: "hi", text: "guide.welcome.hi", textNoName: "guide.welcome.hi0", mood: "happy", action: "next" },
      { id: "continue", targets: ["continue"], text: "guide.welcome.continue", textSchool: "guide.welcome.continue.school", action: "next" },
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
      { id: "continue", targets: ["continue"], text: "guide.nav.continue", mood: "happy", action: "next" },
      { id: "bar", targets: ["nav-practice", "nav-materials", "nav-progress"], text: "guide.nav.bar", textSchool: "guide.nav.bar.school", action: "next" },
      { id: "dock", targets: ["bit-dock"], text: "guide.nav.dock", mood: "happy", action: "next" },
      { id: "shop", targets: ["hdr-chips"], text: "guide.nav.shop", action: "tap" },
    ],
  },
  "page-practice": two("page-practice", ["practice-train", "guide.practice.train"], ["practice-games", "guide.practice.games"]),
  "page-materials": two("page-materials", ["materials-notes", "guide.materials.notes"], ["materials-theory", "guide.materials.theory"]),
  "page-progress": two("page-progress", ["stats-overview", "guide.stats.overview"], ["stats-weak", "guide.stats.weak"]),
  "page-shop": two("page-shop", ["shop-hearts", "guide.shop.hearts"], ["shop-cosmetics", "guide.shop.cosmetics"]),
  "page-profile": two("page-profile", ["profile-card", "guide.profile.card"], ["profile-settings", "guide.profile.settings"]),
  "page-tutor": { id: "page-tutor", steps: [{ id: "hi", text: "guide.tutor.hi", mood: "happy", action: "next" }] },
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
 * число сердечек, запасная реплика (`orElse`).
 */
export function stepText(step: GuideStep, o: { name?: string; school?: boolean; n?: number; free?: boolean; fallback?: boolean }): DictKey {
  if (o.fallback && step.orElse) return step.orElse.text;
  if (step.textNoName && !o.name?.trim()) return step.textNoName;
  if (step.textSchool && o.school) return step.textSchool;
  if (step.textFree && o.free) return step.textFree;
  if (step.textMany && o.n !== undefined && o.n !== 1) return step.textMany;
  return step.text;
}

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

/** Прямоугольник, раздутый на pad со всех сторон и не вылезающий за окно. */
export function padRect(r: Rect, pad: number, vw: number, vh: number): Rect {
  const x = Math.max(0, r.x - pad);
  const y = Math.max(0, r.y - pad);
  const x2 = Math.min(vw, r.x + r.w + pad);
  const y2 = Math.min(vh, r.y + r.h + pad);
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
}

function layout(corner: BitPlacement["corner"], bubble: BitPlacement["bubble"], bottom: number, vw: number): BitPlacement {
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

/** Пересечение прямоугольников, px² (0 — не пересекаются). */
export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Верх пузыря не выше этого поля: текст реплики виден целиком. */
const TOP_MARGIN = 4;

/**
 * Где Бит и пузырь: Бит в правом нижнем углу (над нижней панелью); если цель в правой нижней четверти или Бит её закрыл бы —
 * в левом нижнем. Пузырь — над Битом, а если цель в нижней половине — сбоку от Бита. Закрыли бы цель и так — пробуем
 * остальные сочетания. Варианты, где пузырь вылез бы за верх окна, отбрасываются.
 * Бит поднимается над целью, только если под ней ему нет места (кнопка у самого низа экрана: «Проверить», «Продолжить»);
 * иначе он сел бы на соседние кнопки. Чисто не помещается ничего — Бит и пузырь остаются внизу, там, где меньше всего
 * закрыто цели (пузырь растёт вверх от низа экрана — его кнопки видны всегда).
 * `textLen` — длина реплики: по ней оценивается высота пузыря.
 */
export function placeBit(target: Rect | null, vp: GuideViewport, textLen = 90): BitPlacement {
  const { vw, vh } = vp;
  const edge = edgeOf(vw);
  const base = Math.max(0, vp.bottomInset) + edge;
  if (!target) return layout("br", "above", base, vw);

  const hits = (p: BitPlacement) => {
    const r = placementRects(p, vh, textLen);
    return overlaps(r.bit, target, CLEAR) || overlaps(r.bubble, target, CLEAR);
  };
  const fits = (p: BitPlacement) => {
    const r = placementRects(p, vh, textLen);
    return r.bubble.y >= TOP_MARGIN && r.bit.y >= 0;
  };
  const clean = (p: BitPlacement) => fits(p) && !hits(p);
  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;
  const brBit = placementRects(layout("br", "above", base, vw), vh, textLen).bit;
  const corner: BitPlacement["corner"] = (cx > vw / 2 && cy > vh / 2) || overlaps(brBit, target, CLEAR) ? "bl" : "br";
  const other = corner === "br" ? "bl" : "br";
  const bubble: BitPlacement["bubble"] = cy > vh / 2 ? "side" : "above";
  const otherBubble = bubble === "side" ? "above" : "side";
  const order: [BitPlacement["corner"], BitPlacement["bubble"]][] = [
    [corner, bubble],
    [other, bubble],
    [corner, otherBubble],
    [other, otherBubble],
  ];
  const atBase = order.map(([c, b]) => layout(c, b, base, vw));
  for (const p of atBase) if (clean(p)) return p;

  // Под целью Биту нет места (цель у самого низа экрана) — он встаёт над ней.
  const roomBelow = target.y + target.h + CLEAR <= vh - base - BIT_SIZE;
  if (!roomBelow) {
    const lifted = Math.max(base, vh - target.y + LIFT_GAP);
    const liftedOrder: [BitPlacement["corner"], BitPlacement["bubble"]][] = [
      ["br", "above"],
      ["bl", "above"],
      ["br", "side"],
      ["bl", "side"],
    ];
    for (const [c, b] of liftedOrder) {
      const p = layout(c, b, lifted, vw);
      if (clean(p)) return p;
    }
  }

  // Ничего не помещается чисто: внизу, где закрыто меньше всего цели (Бит поверх цели — вдвое хуже пузыря).
  const pool = atBase.filter(fits);
  let best = (pool.length ? pool : atBase)[0];
  let bestScore = Infinity;
  for (const p of pool.length ? pool : atBase) {
    const r = placementRects(p, vh, textLen);
    const score = overlapArea(r.bubble, target) + 2 * overlapArea(r.bit, target);
    if (score < bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}

/** Палец-указатель: кончик (x; y) и поворот `angle` в градусах по часовой стрелке от «пальцем вверх». */
export interface FingerPose {
  x: number;
  y: number;
  angle: number;
}

/**
 * Палец-указатель «нажимает» на цель со стороны Бита: кончик — чуть внутри рамки (на `depth` px от края, по умолчанию
 * треть меньшей стороны, не больше 14), палец смотрит на центр цели. `angle` — поворот в градусах по часовой стрелке
 * от «пальцем вверх».
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
  // Где луч от центра цели к Биту пересекает край рамки.
  const tx = ux === 0 ? Infinity : target.w / 2 / Math.abs(ux);
  const ty = uy === 0 ? Infinity : target.h / 2 / Math.abs(uy);
  const d = depth ?? Math.min(14, Math.min(target.w, target.h) / 3);
  const t = Math.max(0, Math.min(tx, ty) - d);
  const angle = (Math.atan2(-ux, uy) * 180) / Math.PI;
  return { x: cx + ux * t, y: cy + uy * t, angle: Math.abs(angle) < 1e-9 ? 0 : angle };
}

/**
 * Где лежит палец (в системе «пальцем вверх», кончик в 0; 0): иконка 40 px (`GuidePointer`) с белой обводкой — поперёк
 * оси от −14 до 28 px (кисть справа), вдоль — до 56 px от кончика с учётом «тычка».
 */
const FINGER_BOX = { x1: -14, x2: 28, y1: -2, y2: 56 } as const;

/** Прямоугольник, который закрывает палец на экране (рамка повёрнутого пальца). */
export function fingerRect(f: FingerPose): Rect {
  const a = (f.angle * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const px of [FINGER_BOX.x1, FINGER_BOX.x2]) {
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
 * (`avoid`) или вылез за окно — сверху, снизу, сбоку или по диагонали, где свободно. Свободно нигде — со стороны Бита.
 */
export function aimFinger(target: Rect, from: { x: number; y: number }, avoid: readonly Rect[], vw: number, vh: number): FingerPose {
  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;
  const far = 10_000;
  const sources = [
    from,
    { x: cx, y: cy - far },
    { x: cx, y: cy + far },
    { x: cx - far, y: cy },
    { x: cx + far, y: cy },
    { x: cx - far, y: cy - far },
    { x: cx + far, y: cy - far },
    { x: cx - far, y: cy + far },
    { x: cx + far, y: cy + far },
  ];
  for (const s of sources) {
    const pose = fingerPose(target, s);
    const r = fingerRect(pose);
    const inside = r.x >= 0 && r.y >= 0 && r.x + r.w <= vw && r.y + r.h <= vh;
    if (inside && !avoid.some((a) => overlaps(r, a))) return pose;
  }
  return fingerPose(target, from);
}

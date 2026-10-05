// Проводник первого входа (этап 16Б, пакет P6): чистая логика «что показать» и геометрия выреза. Без React.
// Состояние — `useApp.tips` (lib/tips.ts); показано → `noteTip(id)`. Сценарий — docs/specs/stage16b.md, P6.

import { TIP_IDS, tipSeen, type TipId, type TipsState } from "./tips";

/** Один пройденный урок и больше — «Учиться» уже не новое место, приветствие не нужно. */
export interface TourCtx {
  /** Сколько уроков пройдено хотя бы раз. */
  completedLessons: number;
  /** Онбординг пройден. */
  onboarded: boolean;
  /** Текущий путь: проводник живёт только на «Учиться». */
  pathname: string;
}

/** Сколько уроков пройдено хотя бы раз (по `useApp.lessons`). */
export function completedLessonsCount(lessons: Record<string, { completions?: number } | undefined> | undefined): number {
  let n = 0;
  for (const id in lessons) if ((lessons[id]?.completions ?? 0) > 0) n++;
  return n;
}

export type LearnScene = "welcome" | "nav";

/**
 * Что показать на «Учиться»:
 * - `welcome` — пока нет ни одного пройденного урока и приветствие не закрыто;
 * - `nav` — обзор панели, когда пройден первый урок (или прежний ученик, у которого уроки уже есть).
 * Всё закрыто, онбординг не пройден или путь не /learn — null. Приветствие, закрытое при нуле уроков, ждёт первого урока молча.
 */
export function learnScene(tips: TipsState | undefined, ctx: TourCtx): LearnScene | null {
  if (!ctx.onboarded || ctx.pathname !== "/learn") return null;
  if (tipSeen(tips, "nav")) return null;
  if (ctx.completedLessons >= 1) return "nav";
  return tipSeen(tips, "welcome") ? null : "welcome";
}

/**
 * Проводник ещё не закончен (обзор панели не показан): окна «Включить напоминания» и тарифов ждут.
 * «Пропустить» отмечает все подсказки, поэтому снимает ожидание.
 */
export const tourBlocking = (tips: TipsState | undefined): boolean => !tipSeen(tips, "nav");

/** Карточка «что значит всё это» на итогах: только на первом пройденном уроке (с его учётом) и один раз. */
export function showAfterFirst(tips: TipsState | undefined, completedLessons: number): boolean {
  return !tipSeen(tips, "after-first") && completedLessons <= 1;
}

/** Подсказка в первом уроке: до первого пройденного урока, один раз. */
export function showLessonFirst(tips: TipsState | undefined, completedLessons: number): boolean {
  return !tipSeen(tips, "lesson-first") && completedLessons === 0;
}

/** Подсказка страницы: ещё не показывалась и проводник закончен (две подсказки сразу не показываем). */
export function showPageTip(tips: TipsState | undefined, id: TipId): boolean {
  return !tipSeen(tips, id) && !tourBlocking(tips);
}

/** «Пропустить»: закрыть весь проводник — отметить все подсказки, которые ещё не показаны. */
export function unseenTips(tips: TipsState | undefined): TipId[] {
  return TIP_IDS.filter((id) => !tipSeen(tips, id));
}

/** Шаги обзора панели: какие элементы `[data-tour]` обвести (объединением) и какой текст показать. */
export const NAV_STEPS = [
  { id: "header", targets: ["hdr-streak", "hdr-hearts", "hdr-chips"] },
  { id: "bar", targets: ["nav-learn", "nav-practice", "nav-tutor", "nav-materials", "nav-progress"] },
  { id: "done", targets: ["continue"] },
] as const;

export type NavStepId = (typeof NAV_STEPS)[number]["id"];

// ---------------------------------------------------------------------------------------------------------------------
// Геометрия выреза и пузыря (в пикселях окна).

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
  a === b || (!!a && !!b && Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y) && Math.round(a.w) === Math.round(b.w) && Math.round(a.h) === Math.round(b.h));

export interface PlaceOpts {
  /** Ширина и высота пузыря. */
  w: number;
  h: number;
  /** Окно. */
  vw: number;
  vh: number;
  /** Зазор до выреза и поля у краёв окна. */
  gap?: number;
  margin?: number;
}

/**
 * Где поставить пузырь: под вырезом, если там хватает места, иначе над ним, иначе по центру окна (без выреза — тоже по центру).
 * По горизонтали — по центру выреза, но не за края окна. Пузырь шире окна сжимается до `vw - 2·margin`.
 */
export function placeBubble(target: Rect | null, o: PlaceOpts): { top: number; left: number; width: number } {
  const gap = o.gap ?? 12;
  const margin = o.margin ?? 12;
  const width = Math.min(o.w, Math.max(0, o.vw - margin * 2));
  const clampTop = (top: number) => Math.max(margin, Math.min(top, o.vh - o.h - margin));
  if (!target) return { top: clampTop((o.vh - o.h) / 2), left: (o.vw - width) / 2, width };
  const cx = target.x + target.w / 2;
  const left = Math.max(margin, Math.min(cx - width / 2, o.vw - width - margin));
  const below = o.vh - (target.y + target.h) - gap - margin;
  const above = target.y - gap - margin;
  if (below >= o.h) return { top: target.y + target.h + gap, left, width };
  if (above >= o.h) return { top: target.y - gap - o.h, left, width };
  // Места нет ни там, ни там: пузырь прижат к краю, где его больше, — вырез остаётся виден частично.
  return { top: clampTop(below >= above ? target.y + target.h + gap : target.y - gap - o.h), left, width };
}

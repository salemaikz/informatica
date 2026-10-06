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
  /** Вход в урок уже был оплачен — на этом входе ничего не списано (`prepaid`; «Безлимит» — по-прежнему `textFree`). */
  textPrepaid?: DictKey;
  /** Числа бесплатных обращений на значке ИИ нет (безлимит, тариф без счёта) — этот вариант (без фразы про число). */
  textNoCount?: DictKey;
  /** Уже пройден хотя бы один урок (кнопка урока — не «Начать», а «Продолжить») — этот вариант, без названия кнопки. */
  textAgain?: DictKey;
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

/** «welcome» — только отметка (видел старое приветствие v0.16–0.18), своей сцены нет. */
export type SceneId = Exclude<TipId, "welcome">;

export interface GuideScene {
  id: SceneId;
  steps: readonly GuideStep[];
  /**
   * Отметить и эти сцены, когда показ дошёл до шага `alsoAfter` (или до конца сцены): новый lesson-first уже объяснил то,
   * что повторяет lesson-icons. Прерванная раньше сцена их не отмечает.
   */
  also?: readonly TipId[];
  /** id шага, пройдя который сцена отмечает `also`; нет такого шага среди показанных — только по концу сцены. */
  alsoAfter?: string;
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

/** Нижние вкладки и кнопка Бита — общие шаги знакомства (intro) и короткой версии для старых учеников (nav). */
const BAR_STEP: GuideStep = {
  id: "bar",
  targets: ["nav-practice", "nav-materials", "nav-progress"],
  text: "guide.nav.bar",
  textSchool: "guide.nav.bar.school",
  action: "next",
};
const DOCK_STEP: GuideStep = { id: "dock", targets: ["bit-dock"], text: "guide.nav.dock", mood: "happy", action: "next" };
/** Значки шапки урока: инструменты (калькулятор, перевод, черновик) и ИИ (с числом бесплатных, если оно видно). */
const TOOLS_STEP: GuideStep = { id: "tools", targets: ["lesson-tools"], text: "guide.lesson.tools", textSchool: "guide.lesson.tools.school", action: "next" };
const ASK_STEP: GuideStep = {
  id: "ask",
  targets: ["lesson-ask"],
  text: "guide.lesson.ask",
  textNoCount: "guide.lesson.askNoCount",
  mood: "thinking",
  action: "next",
};

export const GUIDE_SCENES: Record<SceneId, GuideScene> = {
  // Этап 16Г: всё знакомство с приложением — до первого урока, последний шаг — нажать кнопку урока.
  intro: {
    id: "intro",
    steps: [
      { id: "hi", text: "guide.welcome.hi", textNoName: "guide.welcome.hi0", mood: "happy", action: "next" },
      // Реплика про карточку урока — рамка на всей карточке; кнопку «Начать» (метка continue) — только на шаге «нажми».
      { id: "card", targets: ["next-lesson"], text: "guide.welcome.continue", textSchool: "guide.welcome.continue.school", action: "next" },
      // Шапка одной рамкой: огонь, сердечки, чипы (на 1024–1279 px шапки нет — шаг пропускается).
      { id: "header", targets: ["hdr-streak", "hdr-hearts", "hdr-chips"], text: "guide.intro.header", textFree: "guide.intro.headerFree", action: "next" },
      BAR_STEP,
      DOCK_STEP,
      {
        id: "start",
        targets: ["continue"],
        text: "guide.welcome.start",
        // Урок уже был (подсказки вернули) — на кнопке «Продолжить»: реплика без названия кнопки.
        textAgain: "guide.next.go",
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
    // Значки уже объяснены — отдельная сцена для старых учеников не нужна.
    also: ["lesson-icons"],
    alsoAfter: "ask",
    steps: [
      {
        id: "hearts",
        targets: ["lesson-hearts"],
        text: "guide.lesson.hearts",
        textMany: "guide.lesson.heartsMany",
        textFree: "guide.lesson.heartsFree",
        textPrepaid: "guide.lesson.heartsPrepaid",
        mood: "happy",
        action: "next",
      },
      { id: "progress", targets: ["lesson-progress"], text: "guide.lesson.progress", action: "next" },
      TOOLS_STEP,
      // Значка ИИ нет (до ответа скрыт) — шаг пропускается.
      ASK_STEP,
      { id: "options", targets: ["lesson-options"], text: "guide.lesson.options", action: "tap", waitMs: LESSON_WAIT_MS },
      { id: "check", targets: ["lesson-check"], text: "guide.lesson.check", action: "tap", chain: true },
    ],
  },
  // Этап 16Г: прошедшим старый lesson-first (v0.18) — один раз в следующем уроке, только значки.
  "lesson-icons": { id: "lesson-icons", steps: [{ ...TOOLS_STEP, mood: "happy" }, ASK_STEP] },
  "after-first": {
    id: "after-first",
    steps: [
      { id: "xp", targets: ["res-xp"], text: "guide.after.xp", mood: "celebrate", action: "next" },
      { id: "chips", targets: ["res-chips"], text: "guide.after.chips", action: "next" },
      { id: "streak", targets: ["res-streak"], text: "guide.after.streak", action: "next" },
      { id: "continue", targets: ["res-continue"], text: "guide.after.continue", mood: "happy", action: "tap" },
    ],
  },
  // Этап 16Г: после первого урока — одна реплика у карточки урока. Курс пройден (карточки нет) — шаг молча пропускается.
  "learn-next": {
    id: "learn-next",
    steps: [{ id: "go", targets: ["continue"], text: "guide.next.go", textSchool: "guide.welcome.start.school", mood: "happy", action: "tap" }],
  },
  // Короткая версия для видевших старое приветствие (v0.16–0.18): вкладки, кнопка Бита, нажать кнопку урока.
  nav: {
    id: "nav",
    steps: [
      BAR_STEP,
      DOCK_STEP,
      {
        id: "go",
        targets: ["continue"],
        text: "guide.next.go",
        textSchool: "guide.welcome.start.school",
        mood: "celebrate",
        action: "tap",
        orElse: { text: "guide.welcome.noLesson" },
      },
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
  // Этап 16Д: хаб дуэлей — что такое дуэль (бот всегда помечен) у кнопки Бита; друзья и живые соперники — скоро.
  "page-duel": two("page-duel", ["duel-bot", "guide.duel.what"], ["duel-soon", "guide.duel.soon"]),
};

/** Сцены страниц: точный путь → сцена (подстраницы вроде /tutor/123 — без сцены). */
const PAGE_SCENES: Readonly<Record<string, SceneId>> = {
  "/practice": "page-practice",
  "/materials": "page-materials",
  "/stats": "page-progress",
  "/shop": "page-shop",
  "/profile": "page-profile",
  "/tutor": "page-tutor",
  "/duel": "page-duel",
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
 * Какую сцену играть сейчас (этап 16Г). Путь нового ученика: intro (на «Учиться», до первого урока; кончается нажатием
 * «Начать») → lesson-first (в первом уроке) → after-first (итоги) → learn-next (на «Учиться»: «нажми» у карточки урока)
 * → сцены страниц при первом заходе. Видевшим старое приветствие (`welcome`, v0.16–0.18), но не обзор (`nav`), — короткий
 * nav; прошедшим старый lesson-first — lesson-icons в следующем уроке. Пока обучение идёт (`tourBlocking`), страницы
 * молчат: две сцены сразу не играем. Знакомство, закрытое при нуле уроков, ждёт первого урока молча. После «Показать
 * подсказки снова» (intro снова показан, обучение не закончено) lesson-first и after-first играют и при пройденных уроках.
 * Онбординг, пробный ЕНТ, тесты и игры — без сцен (у них нет ни пути, ни метки).
 */
export function sceneFor(tips: TipsState | undefined, ctx: SceneCtx): SceneId | null {
  if (!ctx.onboarded) return null;
  const fresh = (id: TipId) => !tipSeen(tips, id);
  const touring = tourBlocking(tips);
  const replay = !fresh("intro") && touring;
  // Итоги идут внутри экрана урока — их метка важнее метки урока.
  if (ctx.onResults) return (ctx.completedLessons <= 1 || replay) && fresh("after-first") ? "after-first" : null;
  if (ctx.inLesson) {
    if ((ctx.completedLessons === 0 || replay) && fresh("lesson-first")) return "lesson-first";
    // Старый lesson-first (v0.18) значков не объяснял; новый отмечает lesson-icons сам (`also`).
    // Старый «Пропустить» (v0.16–0.18) отметил lesson-first вместе с nav одним махом — такой ученик от обучения отказался.
    return !fresh("lesson-first") && fresh("intro") && fresh("lesson-icons") && !skippedTogether(tips, "lesson-first", "nav")
      ? "lesson-icons"
      : null;
  }
  if (ctx.pathname === "/learn") {
    if (touring) {
      if (!fresh("intro")) return ctx.completedLessons >= 1 ? "learn-next" : null;
      return fresh("welcome") ? "intro" : "nav";
    }
    return ctx.school && fresh("page-school") ? "page-school" : null;
  }
  if (touring) return null;
  const page = PAGE_SCENES[ctx.pathname];
  return page && fresh(page) ? page : null;
}

/** Шаги сцены для ученика: шаги только для ЕНТ школьному треку не показываем. */
export function sceneSteps(scene: GuideScene, ent: boolean): GuideStep[] {
  return scene.steps.filter((s) => ent || !s.ent);
}

/**
 * Какой текст сказать на шаге: имя есть/нет, школьный трек, урок уже был (`again`: кнопка — «Продолжить»), сердечки
 * не списывались (`free`: «Безлимит», пробный), вход уже был оплачен (`prepaid`), на значке ИИ нет числа (`aiCount: false`), число сердечек, запасная
 * реплика (`orElse`), нашлись не все метки (`partial`).
 */
export function stepText(
  step: GuideStep,
  o: { name?: string; school?: boolean; n?: number; free?: boolean; prepaid?: boolean; fallback?: boolean; partial?: boolean; again?: boolean; aiCount?: boolean },
): DictKey {
  if (o.fallback && step.orElse) return step.orElse.text;
  if (o.partial && step.textPartial) return step.textPartial;
  if (step.textNoName && !o.name?.trim()) return step.textNoName;
  if (step.textSchool && o.school) return step.textSchool;
  if (step.textAgain && o.again) return step.textAgain;
  if (step.textFree && o.free) return step.textFree;
  if (step.textPrepaid && o.prepaid) return step.textPrepaid;
  if (step.textNoCount && o.aiCount === false) return step.textNoCount;
  if (step.textMany && o.n !== undefined && o.n !== 1) return step.textMany;
  return step.text;
}

/** Тире не уезжает в начало строки: пробел перед ним — неразрывный (длина текста та же — печать не сбивается). */
export const keepDash = (text: string): string => text.replace(/ (?=—)/g, "\u00a0");

/**
 * Обучение ещё не закончено (этап 16Г: не показаны ни learn-next — конец пути нового ученика, — ни nav — обзор v0.18
 * или короткая версия): окна тарифов, напоминаний и кейса ждут, страницы молчат.
 * «Пропустить» отмечает все подсказки, поэтому снимает ожидание.
 */
export function tourBlocking(tips: TipsState | undefined): boolean {
  return !tipSeen(tips, "learn-next") && !tipSeen(tips, "nav");
}

/** Кнопку Бита уже объяснили (знакомство или обзор): стрелка «смахни вправо» у неё больше не нужна. */
export const dockExplained = (tips: TipsState | undefined): boolean => tipSeen(tips, "intro") || tipSeen(tips, "nav");

/**
 * Шаг `from` из показанных `steps` пройден — пора ли отметить `also` сцены. Да, если пройден шаг `alsoAfter`
 * или любой после него (сам шаг мог быть пропущен: значка нет).
 */
export function alsoDue(scene: GuideScene, steps: readonly GuideStep[], from: number): boolean {
  if (!scene.also?.length) return false;
  if (from + 1 >= steps.length) return true;
  if (!scene.alsoAfter) return false;
  const order = scene.steps.findIndex((s) => s.id === scene.alsoAfter);
  const passed = scene.steps.findIndex((s) => s.id === steps[from]?.id);
  return order >= 0 && passed >= order;
}

/** Две отметки поставлены одним «Пропустить» (все разом, в одну секунду), а не показом сцен по очереди. */
export function skippedTogether(tips: TipsState | undefined, a: TipId, b: TipId): boolean {
  const x = tips?.[a];
  const y = tips?.[b];
  return !!x && !!y && Math.abs(x - y) < 1000;
}

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

// Вёрстка пузыря (BitPopup): по ней считается его высота.
/** Классы текста реплики — общие у пузыря и «линейки», которой проводник меряет высоту текста. */
export const BUBBLE_TEXT = "text-[15px] font-semibold leading-snug";
/** Поля по высоте: pt-3 + pb-2.5 + рамка 2 × 2 px. */
const BUBBLE_PAD_Y = 26;
/** Поля по ширине: px-4 и рамка — текст на столько уже пузыря. */
const BUBBLE_PAD_X = 36;
/** Ряд кнопок под текстом: mt-2 + «Дальше» (h-11). */
const ROW_NEXT = 52;
/** Шаг «нажми»: mt-2 + строка «Нажми, куда показываю» (15) + mt-1 + «Пропустить» (h-9). */
const ROW_TAP = 63;

/** Реплика — для расчёта высоты пузыря. */
export interface Say {
  /** Длина реплики: по ней высота текста оценивается, пока её не измерили. */
  len: number;
  /** Шаг «нажми»: над кнопками — строка-подсказка. */
  tap?: boolean;
  /** Точная высота текста при ширине текста `w` (замер на странице); null — не измерить, берётся оценка. */
  textH?: (w: number) => number | null;
}
/** Реплика или только её длина. */
export type SayLike = number | Say;
const sayOf = (s: SayLike): Say => (typeof s === "number" ? { len: s } : s);

/** Ширина текста в пузыре шириной `w`. */
export const bubbleTextW = (w: number): number => Math.max(0, w - BUBBLE_PAD_X);

/** Высота пузыря шириной `w`: текст (замер, а нет его — на глаз: ~8,4 px на букву, строка 21 px, с запасом на переносы), поля и ряд кнопок. */
export function bubbleH(s: SayLike, w: number): number {
  const say = sayOf(s);
  const perLine = Math.max(8, Math.floor((w - 32) / 8.4));
  const text = say.textH?.(bubbleTextW(w)) ?? Math.max(1, Math.ceil((say.len * 1.12) / perLine)) * 21;
  return BUBBLE_PAD_Y + text + (say.tap ? ROW_TAP : ROW_NEXT);
}

/** Высота пузыря на глаз (для выбора места — до того, как он нарисован). */
export function estimateBubbleH(textLen: number, w: number, tap = false): number {
  return bubbleH({ len: textLen, tap }, w);
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
  /** Пузырь из кнопки Бита поднят над обычным местом на столько px (его края не режут кнопки): хвостик вытянут до кнопки. */
  lift?: number;
}

type Corner = BitPlacement["corner"];
type Combo = [Corner, BitPlacement["bubble"]];

/**
 * Бит в углу на высоте `bottom` и пузырь над ним или сбоку. `sideFloor` — ниже этого (от низа окна) пузырь сбоку не
 * опускается: Бит стоит на затемнённой нижней панели, а пузырь — над ней (подписи вкладок не торчат из-под него).
 */
function layout(corner: Corner, bubble: BitPlacement["bubble"], bottom: number, vw: number, sideFloor = 0): BitPlacement {
  const edge = edgeOf(vw);
  const bitX = corner === "br" ? vw - edge - BIT_SIZE : edge;
  if (bubble === "above") {
    const w = Math.min(BUBBLE_MAX_W, Math.max(0, vw - edge * 2));
    return { corner, bubble, bitX, bitBottom: bottom, bubbleX: corner === "br" ? vw - edge - w : edge, bubbleW: w, bubbleBottom: bottom + BIT_SIZE + ABOVE_GAP };
  }
  const w = Math.min(BUBBLE_MAX_W, Math.max(0, vw - edge * 2 - BIT_SIZE - SIDE_GAP));
  return {
    corner,
    bubble,
    bitX,
    bitBottom: bottom,
    bubbleX: corner === "br" ? bitX - SIDE_GAP - w : bitX + BIT_SIZE + SIDE_GAP,
    bubbleW: w,
    bubbleBottom: Math.max(bottom + SIDE_LIFT, sideFloor),
  };
}

/** Какой ширины бывает пузырь в окне шириной `vw`: над Битом (и из кнопки Бита) и сбоку от него. */
export function bubbleWidths(vw: number): number[] {
  return [layout("br", "above", 0, vw).bubbleW, layout("br", "side", 0, vw).bubbleW];
}

/** Прямоугольники Бита и пузыря (в координатах окна). */
export function placementRects(p: BitPlacement, vh: number, say: SayLike): { bit: Rect; bubble: Rect } {
  const bh = bubbleH(say, p.bubbleW);
  return {
    bit: { x: p.bitX, y: vh - p.bitBottom - BIT_SIZE, w: BIT_SIZE, h: BIT_SIZE },
    bubble: { x: p.bubbleX, y: vh - p.bubbleBottom - bh, w: p.bubbleW, h: bh },
  };
}

/** Хвостик пузыря над Битом: левый край его квадратика от левого края пузыря — напротив центра Бита (или кнопки Бита). */
export function tailLeft(p: BitPlacement): number {
  return Math.max(18, Math.min(p.bitX + BIT_SIZE / 2 - p.bubbleX - 8, p.bubbleW - 34));
}

/** Кончик хвостика (квадратик 16 px, повёрнутый на 45°) — ниже низа пузыря на столько px. */
export const TAIL_TIP = 10;

/**
 * Хвостик пузыря из кнопки Бита: на сколько px ниже низа пузыря его кончик. Пузырь поднят над кнопкой (`lift`) —
 * хвостик вытянут до неё: кончик там же, где у неподнятого пузыря, — пузырь не «отрывается» от кнопки.
 */
export function dockTail(p: BitPlacement): number {
  return TAIL_TIP + (p.dock ? Math.max(0, p.lift ?? 0) : 0);
}

/** Хвостик пузыря сбоку: обычно — на 22 px выше низа пузыря (напротив лица Бита). */
const SIDE_TAIL = 22;
/** Ниже хвостик не опускается: у скруглённого угла пузыря он отрывался бы от края. */
const SIDE_TAIL_MIN = 10;

/**
 * Хвостик пузыря сбоку: низ его квадратика от низа пузыря — напротив лица Бита, на той же высоте окна, что и у обычного
 * пузыря. Пузырь поднят над нижней панелью (Бит стоит на ней) — хвостик опускается к самому низу пузыря; пузырь опущен
 * до низа панели — хвостик выше от его низа (всё так же напротив лица).
 */
export function sideTail(p: BitPlacement): number {
  return Math.max(SIDE_TAIL_MIN, p.bitBottom + SIDE_LIFT + SIDE_TAIL - p.bubbleBottom);
}

/** Пересечение прямоугольников, px² (0 — не пересекаются). */
export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Сколько площади прямоугольников `list` закрывает `r`. */
function coverArea(r: Rect, list: readonly Rect[]): number {
  let sum = 0;
  for (const a of list) sum += overlapArea(r, a);
  return sum;
}

/** Верх пузыря не выше этого поля: текст реплики виден целиком. */
const TOP_MARGIN = 4;
/**
 * Шаг без цели: край пузыря не ближе этого к краю кнопки — ни снаружи (кнопка «прилипла» к пузырю), ни изнутри
 * (высота пузыря — оценка: настоящий край может её чуть разрезать).
 */
const NEAR = 8;
/** Кнопка у самого края пузыря — меньшее зло, чем разрезанная: её площадь в полосе NEAR идёт с этим весом. */
const NEAR_WEIGHT = 0.25;
/**
 * Пузырь закрывает кнопку целиком — терпимо, но хуже, чем не задевать её совсем: «цена» за кнопку (как сдвиг Бита
 * на 25 px). Разрезать кнопку всё равно дороже.
 */
const COVER_COST = 100;
/** «Цена» сдвига Бита (или пузыря из кнопки Бита) на 1 px от обычного места (в px² разрезанной кнопки). */
const SHIFT_COST = 4;
/** «Цена» другого угла (Бит не прыгает из угла в угол ради пары пикселей). */
const SWITCH_COST = 400;
/** Первый шаг сцены (прошлого угла нет): другой угол почти бесплатен — дешевле, чем другой пузырь. */
const SWITCH_COST_FREE = 50;
/** Шаг с целью: «цена» другого пузыря (сбоку вместо над Битом и наоборот). */
const BUBBLE_COST = 100;
/** Выше обычного места Бит поднимается не больше чем на полроста — остаётся внизу экрана. */
const RAISE_MAX = BIT_SIZE / 2;
/** Шаг перебора высоты Бита, px. */
const LEVEL_STEP = 2;
/** 3D-грань кнопки (тень `shadow-[0_4px_0]`) — вне её getBoundingClientRect: кнопка для пузыря на столько ниже. */
export const BUTTON_EDGE = 4;
/** Пузырь сбоку от Бита на затемнённой нижней панели: его низ — над верхом панели на столько. */
const PANEL_GAP = 6;
/**
 * Пузырь из кнопки Бита: на столько он может подняться над кнопкой, чтобы его края не резали кнопки страницы (на
 * плотной «Учиться» чистое место бывает только ~на 90 px выше). Хвостик тогда вытягивается до кнопки (`dockTail`).
 */
const DOCK_LIFT_MAX = 120;

/** Прямоугольник, раздутый (или при d < 0 — сжатый) на d со всех сторон. */
const inflate = (r: Rect, d: number): Rect => ({ x: r.x - d, y: r.y - d, w: Math.max(0, r.w + 2 * d), h: Math.max(0, r.h + 2 * d) });

/** Разрез кнопки краем пузыря: за каждый пиксель края поверх кнопки — не меньше, чем стоила бы кнопка в полосе NEAR. */
const CUT_LINE = 2 * NEAR * NEAR_WEIGHT;

/** Длина границы прямоугольника `r`, что проходит по `a` (край пузыря поверх кнопки), px. */
function cutLine(r: Rect, a: Rect): number {
  const ow = Math.min(r.x + r.w, a.x + a.w) - Math.max(r.x, a.x);
  const oh = Math.min(r.y + r.h, a.y + a.h) - Math.max(r.y, a.y);
  if (ow <= 0 || oh <= 0) return 0;
  const inside = (v: number, from: number, size: number) => v > from && v < from + size;
  return (
    (inside(r.y, a.y, a.h) ? ow : 0) +
    (inside(r.y + r.h, a.y, a.h) ? ow : 0) +
    (inside(r.x, a.x, a.w) ? oh : 0) +
    (inside(r.x + r.w, a.x, a.w) ? oh : 0)
  );
}

/**
 * «Цена» прямоугольника `r` для кнопок `list`. Бит: разрезанная кнопка — площадь разреза. Пузырь (`bubble`): разрез —
 * площадь и длина края поверх кнопки (разрезать хуже, чем липнуть); кнопка у самого края (ближе NEAR снаружи или
 * изнутри) — её площадь в этой полосе с весом NEAR_WEIGHT; закрытая целиком — ещё и COVER_COST. Далёкая — 0.
 */
function edgeCost(r: Rect, list: readonly Rect[], bubble: boolean): number {
  let sum = 0;
  for (const a of list) {
    const o = overlapArea(r, a);
    if (o > 0 && o < a.w * a.h - 1) sum += o + (bubble ? CUT_LINE * cutLine(r, a) : 0);
    else if (bubble) sum += NEAR_WEIGHT * (overlapArea(inflate(r, NEAR), a) - overlapArea(inflate(r, -NEAR), a)) + (o > 0 ? COVER_COST : 0);
  }
  return sum;
}

/** Отступы снизу: нижняя панель (с safe-area) и одна safe-area (на ней — Бит на затемнённой панели). */
function insets(vp: GuideViewport): { panel: number; safe: number } {
  const panel = Math.max(0, vp.bottomInset);
  return { panel, safe: Math.max(0, Math.min(panel, vp.safeBottom ?? panel)) };
}

/** Ниже этого (от низа окна) пузырь сбоку не опускается: есть нижняя панель, на которую садится Бит, — пузырь над ней. */
function sideFloorOf(vp: GuideViewport): number {
  const { panel, safe } = insets(vp);
  return panel > safe ? panel + PANEL_GAP : 0;
}

/**
 * Кнопки, которые пузырь не должен резать: без кнопок затемнённой нижней панели (Бит садится на неё и на шагах
 * с целью) и с 3D-гранью снизу (иначе пузырь, «закрывший» кнопку, оставлял бы торчать её край).
 */
function zoneOf(avoid: readonly Rect[], vp: GuideViewport): Rect[] {
  const { panel, safe } = insets(vp);
  const list = panel > safe ? avoid.filter((a) => a.y < vp.vh - panel - 1) : avoid;
  return list.map((a) => ({ ...a, h: a.h + BUTTON_EDGE }));
}

/** Высоты Бита для перебора: обычная первой, потом — от `floor` до полроста выше обычной. */
function levelsFrom(base: number, floor: number): number[] {
  const out = [base];
  for (let lvl = floor; lvl <= base + RAISE_MAX; lvl += LEVEL_STEP) if (Math.abs(lvl - base) >= 1) out.push(lvl);
  return out;
}

/** Бит может сесть на затемнённую нижнюю панель: панель есть (телефон) и цель не в ней. */
function panelFree(target: Rect, vp: GuideViewport): boolean {
  const { panel, safe } = insets(vp);
  return panel > safe && target.y + target.h <= vp.vh - panel;
}

/**
 * Сколько места (от низа окна) займут Бит на высоте `bottom` и пузырь — сбоку или над Битом, что ниже, — с запасом.
 * Пузырь сбоку не ниже `sideFloor` (Бит на нижней панели — пузырь над ней).
 */
function roomFrom(bottom: number, vw: number, say: SayLike, sideFloor = 0): number {
  const side = layout("br", "side", bottom, vw, sideFloor);
  const sideTop = Math.max(bottom + BIT_SIZE, side.bubbleBottom + bubbleH(say, side.bubbleW));
  const aboveTop = bottom + BIT_SIZE + ABOVE_GAP + bubbleH(say, layout("br", "above", 0, vw).bubbleW);
  return Math.min(sideTop, aboveTop) - bottom + CLEAR;
}

/** Сколько места оставить под целью Биту с пузырём (пузырь сбоку или над Битом — что ниже), с запасом. */
export function roomNeeded(vw: number, say: SayLike = 90): number {
  return roomFrom(0, vw, say);
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
export function guideScroll(target: Rect, vp: GuideViewport, top: number, say: SayLike = 90): number {
  const { panel, safe } = insets(vp);
  const minY = top + SCROLL_MARGIN;
  const fit = (maxBottom: number): number | null => {
    if (target.h > maxBottom - minY) return null;
    if (target.y + target.h > maxBottom) return target.y + target.h - maxBottom;
    return target.y < minY ? target.y - minY : 0;
  };
  if (panel > safe) {
    const edge = edgeOf(vp.vw);
    const floor = sideFloorOf(vp);
    for (const inset of [panel, safe]) {
      const dy = fit(vp.vh - inset - edge - roomFrom(inset + edge, vp.vw, say, floor));
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
   * Кнопки и ссылки на экране (кроме самой цели): пузырь их по возможности не режет и не липнет к ним (на шаге без
   * цели — и Бит не режет); поднятые над целью Бит и пузырь на них не садятся.
   */
  avoid?: readonly Rect[];
}

/**
 * Где Бит и пузырь. Бит в нижнем углу над нижней панелью — в прошлом углу (`prev`), а на первом шаге — в правом, если
 * цель не в правой нижней четверти и Бит её не закрыл бы. Пузырь — над Битом, а если цель в нижней половине — сбоку.
 * Закрыли бы цель — пробуем другой пузырь, Бита на затемнённой нижней панели (цель не в ней), другой угол.
 * Варианты, где пузырь вылез бы за верх окна, отбрасываются. Есть `avoid` — из вариантов, что не закрывают цель, берётся
 * тот, где пузырь не режет кнопки вокруг (Бит при этом может чуть подняться или опуститься до затемнённой панели).
 * Бит поднимается над целью, только если под ней ему нет места (кнопка у самого низа экрана: «Проверить»,
 * «Продолжить»), и тогда не садится на кнопки вокруг. Чисто не помещается ничего — там, где меньше всего закрыто цели
 * (пузырь растёт вверх — его кнопки видны всегда).
 * Без цели (экран затемнён целиком) — прошлый угол, пузырь над Битом; есть `avoid` — Бит чуть поднимается или опускается
 * (до затемнённой панели), пока пузырь не перестанет резать кнопки и липнуть к ним (кнопки самой панели не в счёт).
 * Бит на затемнённой панели — пузырь сбоку всё равно над ней, а нет там места — закрывает её полосу целиком, до низа.
 * `say` — реплика (или её длина): по ней — высота пузыря.
 */
export function placeBit(target: Rect | null, vp: GuideViewport, say: SayLike = 90, opts: PlaceOpts = {}): BitPlacement {
  const { vw, vh } = vp;
  const edge = edgeOf(vw);
  const { panel, safe } = insets(vp);
  const base = panel + edge;
  const low = safe + edge;
  const floor = sideFloorOf(vp);
  const avoid = opts.avoid ?? [];
  // Кнопки нижней панели — под затемнением, Бит садится на неё: их не считаем. Кнопки — с 3D-гранью.
  const zone = zoneOf(avoid, vp);
  const at = (c: Corner, b: BitPlacement["bubble"], lvl: number) => layout(c, b, lvl, vw, floor);
  const rects = (p: BitPlacement) => placementRects(p, vh, say);
  const fits = (p: BitPlacement) => {
    const r = rects(p);
    return r.bubble.y >= TOP_MARGIN && r.bit.y >= 0;
  };
  // Пузырь не режет кнопки и не липнет к ним; с `bit` — и Бит не режет (на шагах с целью Бит может стоять поверх
  // нижней кнопки урока, как и раньше: там считаются только края пузыря).
  const edges = (p: BitPlacement, bit = true) => {
    const r = rects(p);
    return edgeCost(r.bubble, zone, true) + (bit ? edgeCost(r.bit, zone, false) : 0);
  };

  if (!target) {
    const first = opts.prev ?? "br";
    const plain = at(first, "above", base);
    if (!zone.length) return plain;
    // Высота Бита — от затемнённой панели (или от места над ней) до полроста выше обычного места; обычное — первым.
    const levels = levelsFrom(base, panel > safe ? low : base);
    let best = plain;
    let bestCost = Infinity;
    for (const c of [first, first === "br" ? "bl" : "br"] as const) {
      for (const b of ["above", "side"] as const) {
        for (const lvl of levels) {
          const p = at(c, b, lvl);
          if (!fits(p)) continue;
          // При прочих равных — ближе к обычному месту и углу.
          const cost = edges(p) + Math.abs(lvl - base) * SHIFT_COST + (c === first ? 0 : SWITCH_COST);
          if (cost < bestCost - 0.5) {
            best = p;
            bestCost = cost;
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
  // Кнопки затемнённой нижней панели — не помеха (как в `edges`): Бит садится на неё.
  const onAvoid = (p: BitPlacement) => {
    const r = rects(p);
    return zone.some((a) => overlaps(r.bit, a) || overlaps(r.bubble, a));
  };
  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;
  const brBit = rects(at("br", "above", base)).bit;
  const guess: Corner = (cx > vw / 2 && cy > vh / 2) || overlaps(brBit, target, CLEAR) ? "bl" : "br";
  const first = opts.prev ?? guess;
  const second: Corner = first === "br" ? "bl" : "br";
  const bubble: BitPlacement["bubble"] = cy > vh / 2 ? "side" : "above";
  const otherBubble: BitPlacement["bubble"] = bubble === "side" ? "above" : "side";
  const free = panelFree(target, vp);
  const levels = free ? [base, low] : [base];
  const order: BitPlacement[] = [];
  if (opts.prev) {
    // Сначала прошлый угол (над панелью, потом на ней), и только потом — другой.
    for (const c of [first, second]) for (const lvl of levels) for (const b of [bubble, otherBubble]) order.push(at(c, b, lvl));
  } else {
    const combos: Combo[] = [
      [first, bubble],
      [second, bubble],
      [first, otherBubble],
      [second, otherBubble],
    ];
    for (const lvl of levels) for (const [c, b] of combos) order.push(at(c, b, lvl));
  }
  /**
   * Место, где цель открыта, с вариантом пузыря `vary`. Кнопок вокруг нет — первое по очереди `order`. Есть — то, где
   * пузырь не режет кнопки; очерёдность — «ценой»: другой угол, другой пузырь, сдвиг Бита (до затемнённой панели или на
   * полроста выше обычного места).
   */
  const pick = (vary: (p: BitPlacement) => BitPlacement | null): BitPlacement | null => {
    if (!zone.length) {
      for (const p0 of order) {
        const p = vary(p0);
        if (p && fits(p) && !hits(p)) return p;
      }
      return null;
    }
    const switchCost = opts.prev ? SWITCH_COST : SWITCH_COST_FREE;
    let best: BitPlacement | null = null;
    let bestCost = Infinity;
    for (const c of [first, second]) {
      for (const b of [bubble, otherBubble]) {
        for (const lvl of levelsFrom(base, free ? low : base)) {
          const p = vary(at(c, b, lvl));
          if (!p || !fits(p) || hits(p)) continue;
          const cost = edges(p, false) + Math.abs(lvl - base) * SHIFT_COST + (c === first ? 0 : switchCost) + (b === bubble ? 0 : BUBBLE_COST);
          if (cost < bestCost - 0.5) {
            best = p;
            bestCost = cost;
          }
        }
      }
    }
    return best;
  };
  // Пузырь сбоку над нижней панелью (Бит стоит на её низу) не помещается — он опускается до низа панели и закрывает её
  // полосу целиком, а не наполовину: подписи вкладок (их низ — ~6 px над низом панели) не торчат из-под него.
  const deep = (p: BitPlacement): BitPlacement | null =>
    p.bubble === "side" && p.bitBottom === low && p.bubbleBottom > p.bitBottom + SIDE_LIFT ? { ...p, bubbleBottom: safe } : null;
  const clean = pick((p) => p) ?? pick(deep);
  if (clean) return clean;

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
      const p = at(c, b, lifted);
      if (!fits(p)) continue;
      if (!hits(p) && !onAvoid(p)) return p;
      pool.push(p);
    }
  }

  // Ничего не помещается чисто: где меньше всего закрыто цели (Бит поверх цели — вдвое хуже пузыря), потом — кнопок вокруг
  // (кнопки затемнённой нижней панели не в счёт: Бит садится на неё).
  const cands = pool.length ? pool : order;
  let best = cands[0];
  let bestScore = Infinity;
  for (const p of cands) {
    const r = rects(p);
    const score = overlapArea(r.bubble, target) + 2 * overlapArea(r.bit, target) + (coverArea(r.bubble, zone) + coverArea(r.bit, zone)) / 2;
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
 * Есть `avoid` — пузырь поднимается (не больше DOCK_LIFT_MAX), пока его края не перестанут резать кнопки страницы
 * и липнуть к ним; поднятый (`lift`) — с хвостиком, вытянутым до кнопки. `say` — реплика (или её длина): по ней — высота
 * пузыря.
 */
export function placeFromDock(
  anchor: Rect,
  vp: GuideViewport,
  aimX = anchor.x + anchor.w / 2,
  opts: { avoid?: readonly Rect[]; say?: SayLike } = {},
): BitPlacement {
  const edge = edgeOf(vp.vw);
  const w = Math.min(BUBBLE_MAX_W, Math.max(0, vp.vw - edge * 2));
  const right = aimX > vp.vw / 2;
  const x = right ? anchor.x + anchor.w - w : anchor.x;
  const plain: BitPlacement = {
    corner: right ? "br" : "bl",
    bubble: "above",
    bitX: aimX - BIT_SIZE / 2,
    bitBottom: vp.vh - (anchor.y + anchor.h),
    bubbleX: Math.max(edge, Math.min(vp.vw - edge - w, x)),
    bubbleW: w,
    bubbleBottom: vp.vh - anchor.y + DOCK_GAP,
    dock: true,
  };
  const zone = zoneOf(opts.avoid ?? [], vp);
  if (!zone.length) return plain;
  const say = opts.say ?? 90;
  let best = plain;
  let bestCost = Infinity;
  for (let lift = 0; lift <= DOCK_LIFT_MAX; lift += LEVEL_STEP) {
    const p = { ...plain, bubbleBottom: plain.bubbleBottom + lift };
    const r = placementRects(p, vp.vh, say);
    if (r.bubble.y < TOP_MARGIN) break;
    const cost = edgeCost(r.bubble, zone, true) + lift * SHIFT_COST;
    if (cost < bestCost - 0.5) {
      best = lift ? { ...p, lift } : p;
      bestCost = cost;
    }
  }
  return best;
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

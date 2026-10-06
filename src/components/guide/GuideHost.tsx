"use client";

import { AnimatePresence } from "motion/react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BIT_SIZE,
  DEFAULT_WAIT_MS,
  FINGER_ROOM,
  GUIDE_DELAY_MS,
  GUIDE_SCENES,
  aimFinger,
  guideScroll,
  padRect,
  placeBit,
  placeFromDock,
  placementRects,
  roomBelow,
  sameRect,
  sceneSteps,
  stepText,
  unionRect,
  unseenTips,
  type BitPlacement,
  type FingerPose,
  type GuideScene,
  type GuideViewport,
  type Rect,
  type SceneId,
} from "@/lib/guide";
import { PLAN_FEATURES, formatHearts } from "@/lib/economy";
import { entVisible } from "@/lib/school";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { usePlanTier } from "@/components/economy/useEconomy";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { BitPopup } from "./BitPopup";
import { GuideDim, GuideFinger } from "./GuidePointer";
import { useGuideSpots } from "./GuideSpot";
import { useGuideUi, useWantedScene } from "./guide-state";
import { bottomInset, findTour, focusableIn, foreignModal, obstacles, pinned, radiusOf, rectOf, safeBottom, scrollPage, topBar, tourSel } from "./targets";

/** Зазор вокруг подсвеченного элемента, px. */
const HOLE_PAD = 6;
/** Рамка не ближе к краям окна: цель выше экрана — всё равно рамка, а не обводка по краям экрана. */
const FRAME_INSET = 3;
/**
 * Цели нет дольше — Бит прячется. Обычное ожидание (страница дорисовывается, шаг пропускается) он пережидает на месте,
 * задумавшись; прячется только при долгом ожидании (в уроке — пока не появится вопрос с вариантами).
 */
const HIDE_AFTER_MS = DEFAULT_WAIT_MS + 100;
/** Как часто перемеряем цель (страница дорисовывается, анимации). */
const POLL_MS = 150;
/**
 * Плавная прокрутка к цели идёт не дольше: пока она едет, Бит встаёт туда, где цель окажется после неё. Дольше —
 * значит, прокрутку прервали (ученик сам листает): мерим как есть.
 */
const SETTLE_MS = 1000;
/** Сцена закончилась — столько времени Бит уезжает вниз, потом сцена снимается. */
const LEAVE_MS = 450;
/**
 * Шаг «нажми» засчитывается только нажатием на сам элемент управления внутри цели (вариант, кнопку, ссылку), а не
 * в промежуток между ними: иначе Бит просил бы «Проверить», когда вариант ещё не выбран.
 */
const INTERACTIVE = "button, [role=button], [role=radio], [role=checkbox], input, a";

/** Точка нажатия внутри прямоугольника. */
const inRect = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** Прямоугольник с зазором `pad` вокруг и ещё `below` px снизу (без обрезки окном — для расчёта прокрутки). */
const grow = (r: Rect, pad: number, below = 0): Rect => ({ x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 + below });

/** Середина элемента по горизонтали. */
const centerX = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.left + r.width / 2;
};

/** «Пропустить» и Escape: закрыть весь проводник — отметить все сцены. */
function noteAll() {
  const s = useApp.getState();
  for (const id of unseenTips(s.tips)) s.noteTip(id);
}

/** Замер для шага `idx`: нашлась ли цель, вырез с рамкой, окно и где Бит с пузырём. */
interface View {
  idx: number;
  fallback: boolean;
  found: boolean;
  /** Цели нет дольше HIDE_AFTER_MS (или Бит ещё не выходил) — Бит спрятан. */
  hideBit: boolean;
  /** Вырез с рамкой: цель с зазором, в пределах окна. Шаг без цели — null. */
  hole: Rect | null;
  radius: number;
  vw: number;
  vh: number;
  /** Нашлись не все метки шага — реплика `textPartial`. */
  partial: boolean;
  /** Где Бит и пузырь; null — ещё не мерили. Пока цель ищется — прошлое место (Бит не прыгает). */
  place: BitPlacement | null;
  /** Угол, где Бит стоял в последний раз (шаг про кнопку Бита его не меняет): между шагами Бит остаётся в нём. */
  corner: BitPlacement["corner"] | null;
}

const START: View = { idx: -1, fallback: false, found: false, hideBit: true, hole: null, radius: 16, vw: 0, vh: 0, partial: false, place: null, corner: null };

const samePlace = (a: BitPlacement | null, b: BitPlacement | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.corner === b.corner &&
    a.bubble === b.bubble &&
    !!a.dock === !!b.dock &&
    Math.round(a.bitX) === Math.round(b.bitX) &&
    Math.round(a.bitBottom) === Math.round(b.bitBottom) &&
    Math.round(a.bubbleX) === Math.round(b.bubbleX) &&
    Math.round(a.bubbleW) === Math.round(b.bubbleW) &&
    Math.round(a.bubbleBottom) === Math.round(b.bubbleBottom));

const sameView = (a: View, b: View) =>
  a.idx === b.idx &&
  a.fallback === b.fallback &&
  a.found === b.found &&
  a.hideBit === b.hideBit &&
  sameRect(a.hole, b.hole) &&
  a.radius === b.radius &&
  a.vw === b.vw &&
  a.vh === b.vh &&
  a.partial === b.partial &&
  samePlace(a.place, b.place) &&
  a.corner === b.corner;

/**
 * Одна сцена: ведёт шаги, ждёт цели, ставит Бита, пузырь, затемнение и палец. Шаг «нажми» ждёт нажатия в элемент
 * управления внутри цели (клик ловим на document в фазе захвата — он проходит в элемент как обычно); шаг «Дальше»
 * с целью, наоборот, перехватывает нажатие в вырез — цель не срабатывает (ссылка не уводит со страницы), шаг идёт дальше.
 * Доиграна — `noteTip(сцена)`. `leaving` — сцена уже закончилась: Бит, пузырь и затемнение уходят (exit-анимации),
 * обработчики сняты.
 */
function SceneRunner({ scene, cost, leaving }: { scene: GuideScene; cost?: number; leaving: boolean }) {
  const { t } = useT();
  const name = useApp((s) => s.profile.name);
  const ent = useApp((s) => entVisible(s.profile));
  const sound = useApp((s) => s.profile.sound);
  // «Безлимит» (и пробный): сердечки за вход не списываются — реплика про сердечки другая.
  const freeHearts = !Number.isFinite(PLAN_FEATURES[usePlanTier()].maxHearts);
  const reduce = useReduceMotion();
  const isPresent = !leaving;
  const steps = useMemo(() => sceneSteps(scene, ent), [scene, ent]);
  const [at, setAt] = useState({ idx: 0, fallback: false });
  const [view, setView] = useState<View>(START);
  const [shake, setShake] = useState(0);
  /** Какие шаги пропущены (для `chain`). */
  const skipped = useRef<boolean[]>([]);
  /** Бит сейчас на экране — между шагами он не прячется сразу. */
  const shownRef = useRef(false);
  /** Текущий шаг — сразу, без ожидания перерисовки: запоздалый замер или клик прошлого шага его не сдвинет. */
  const cursor = useRef(0);

  const step = steps[at.idx];
  const targetsKey = step && !at.fallback ? (step.targets ?? []).join("|") : "";

  // Реплика шага (и вариант «нашлись не все метки»): по её длине оценивается высота пузыря ещё при замере.
  const sayFor = (partial: boolean): string | null => {
    if (!step) return null;
    const key = stepText(step, { name, school: !ent, n: cost, free: freeHearts, fallback: at.fallback, partial });
    return t(key, { name: name.trim(), n: formatHearts(cost ?? 1) });
  };
  const sayFull = sayFor(false);
  const sayPartial = sayFor(true);
  const lens = useRef({ full: 90, partial: 90 });
  // Объявлен до эффекта замера: к первому замеру шага длины уже его.
  useEffect(() => {
    lens.current = { full: sayFull?.length ?? 90, partial: sayPartial?.length ?? 90 };
  });

  /** Шаг `from` закончен (или пропущен) — следующий; шагов больше нет — сцена доиграна. */
  const go = useCallback(
    (from: number, skip: boolean) => {
      if (cursor.current !== from) return;
      cursor.current = from + 1;
      skipped.current[from] = skip;
      if (from + 1 >= steps.length) useApp.getState().noteTip(scene.id);
      else setAt({ idx: from + 1, fallback: false });
    },
    [steps.length, scene.id],
  );

  // Замер цели: ждём её появления (`waitMs`), прокручиваем один раз так, чтобы под ней поместились Бит с пузырём,
  // ставим Бита (в прошлый угол, если можно), следим за прокруткой и размером окна.
  useEffect(() => {
    if (!isPresent || !step) return;
    const idx = at.idx;
    const fallback = at.fallback;
    if (step.chain && skipped.current[idx - 1]) {
      const id = window.setTimeout(() => go(idx, true), 0);
      return () => window.clearTimeout(id);
    }
    const list = targetsKey ? targetsKey.split("|") : [];
    const tap = step.action === "tap" && list.length > 0;
    // Шаг про плавающую кнопку Бита: пузырь выходит из неё самой.
    const dock = list.includes("bit-dock");
    const start = Date.now();
    let deadline = start + (step.waitMs ?? DEFAULT_WAIT_MS);
    let lastFound = start;
    let scrolled = false;
    /** Сколько ещё проедет плавная прокрутка к цели (null — не едет). */
    let left: (() => number) | null = null;
    let settleUntil = 0;
    let stopped = false;
    let raf = 0;
    const measure = () => {
      if (stopped) return;
      const now = Date.now();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Открыто чужое окно (шторка, кейс): Бит прячется и ждёт, ожидание цели на это время не тратится.
      const blocked = foreignModal();
      const els = blocked ? [] : list.map(findTour).filter((e): e is HTMLElement => !!e);
      const found = !blocked && (list.length === 0 || els.length > 0);
      if (blocked) deadline = Math.max(deadline, now + POLL_MS * 2);
      if (!found && !blocked && now > deadline) {
        stopped = true;
        if (step.orElse && !fallback) setAt({ idx, fallback: true });
        else go(idx, true);
        return;
      }
      const vp: GuideViewport = { vw, vh, bottomInset: bottomInset(vh), safeBottom: safeBottom() };
      const partial = found && els.length < list.length;
      const len = partial ? lens.current.partial : lens.current.full;
      if (found) {
        lastFound = now;
        // Цель была и пропала (её нажали, страница перерисовалась) — шаг ждёт её ещё обычное время, потом идёт дальше.
        deadline = Math.max(deadline, now + DEFAULT_WAIT_MS);
        if (!scrolled && els.length) {
          scrolled = true;
          // Под целью — место Биту с пузырём (на шаге «нажми» — и пальцу); приколотые к экрану цели не прокручиваются.
          if (!els.some(pinned)) {
            const dy = guideScroll(grow(unionRect(els.map(rectOf))!, HOLE_PAD, tap ? FINGER_ROOM : 0), vp, topBar(), len);
            if (Math.abs(dy) >= 2) {
              left = scrollPage(els[0], dy, !reduce);
              settleUntil = now + SETTLE_MS;
            }
          }
        }
      }
      // Плавная прокрутка ещё едет: место Бита — по тому, где цель будет после неё. Иначе низкая цель на миг поднимет
      // Бита над собой, он вернётся вниз, а угол этого мига запомнится как прошлый.
      let ahead = left && now < settleUntil ? left() : 0;
      if (Math.abs(ahead) < 1) {
        left = null;
        ahead = 0;
      }
      const hideBit = !found && (!shownRef.current || now - lastFound > HIDE_AFTER_MS);
      shownRef.current = !hideBit;
      const rect = found && els.length ? unionRect(els.map(rectOf)) : null;
      // Вырез — где цель сейчас (едет вместе со страницей); место Бита — где она будет.
      const hole = rect ? padRect(rect, HOLE_PAD, vw, vh, FRAME_INSET) : null;
      const final = rect && ahead ? padRect({ ...rect, y: rect.y - ahead }, HOLE_PAD, vw, vh, FRAME_INSET) : hole;
      // Шаг «нажми»: под целью место пальцу — Бит и пузырь его не займут.
      const spot = final && tap ? { ...final, h: final.h + FINGER_ROOM } : final;
      // Кнопки вокруг нужны, только если Бит встанет над целью или цели нет (пузырь не должен резать кнопки).
      const avoid = found && (!spot || !roomBelow(spot, vp)) ? obstacles(els, vw, vh, ahead) : undefined;
      const aimX = dock && els[0] ? centerX(focusableIn(els[0]) ?? els[0]) : undefined;
      const radius = els.length ? Math.min(...els.map((e) => radiusOf(e))) : 16;
      setView((prev) => {
        const corner0 = prev.corner ?? undefined;
        // Цель ещё ищется — Бит ждёт, где стоял (после шага про кнопку Бита — в своём углу).
        const waiting = prev.place?.dock && !dock ? placeBit(null, vp, len, { prev: corner0 }) : prev.place;
        const place = !found ? waiting : dock && hole ? placeFromDock(hole, vp, aimX) : placeBit(spot, vp, len, { prev: corner0, avoid });
        const corner = place && !place.dock ? place.corner : prev.corner;
        const next: View = { idx, fallback, found, hideBit, hole, radius, vw, vh, partial, place, corner };
        return sameView(prev, next) ? prev : next;
      });
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    queueMicrotask(measure);
    const timer = window.setInterval(measure, POLL_MS);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.clearInterval(timer);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [at.idx, at.fallback, targetsKey, step, isPresent, go, reduce]);

  // Шаг «нажми»: нажатие на элемент управления внутри цели (вариант, кнопку, ссылку) — следующий шаг. Нажатие в
  // промежуток между вариантами не в счёт. Само нажатие проходит в элемент как обычно.
  const tapStep = !!step && step.action === "tap" && !at.fallback && !!targetsKey;
  useEffect(() => {
    if (!isPresent || !tapStep) return;
    const sel = targetsKey.split("|").map(tourSel).join(",");
    const idx = at.idx;
    let timer = 0;
    const onClick = (e: MouseEvent) => {
      const hit = e.target instanceof Element ? e.target.closest(INTERACTIVE) : null;
      if (!hit || !hit.closest(sel)) return;
      // После обработчика самого элемента (он мог открыть урок или выбрать вариант).
      timer = window.setTimeout(() => go(idx, false), 0);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.clearTimeout(timer);
    };
  }, [isPresent, tapStep, targetsKey, at.idx, go]);

  const cur = view.idx === at.idx && view.fallback === at.fallback;
  const found = isPresent && cur && view.found && !!step;
  const hole = found ? view.hole : null;
  // Шаг без цели — модальный: затемнён весь экран, страницу под ним не нажать.
  const dimAll = found && !targetsKey;

  // Шаг «Дальше» с целью: нажатие в вырез — это «Дальше». Сама цель не срабатывает (сердечки и «Начать» — ссылки,
  // увели бы со страницы и сожгли сцену), свайп по кнопке Бита не начинается. Пузырь, Бит и затемнение — свои, их не трогаем.
  const holeRef = useRef<Rect | null>(null);
  useEffect(() => {
    holeRef.current = hole;
  });
  const nextStep = isPresent && !!step && !at.fallback && !!targetsKey && step.action === "next";
  useEffect(() => {
    if (!nextStep) return;
    const sel = targetsKey.split("|").map(tourSel).join(",");
    const idx = at.idx;
    const inHole = (e: MouseEvent) => {
      const h = holeRef.current;
      if (!h) return false;
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest("[data-guide]")) return false;
      if (el?.closest(sel)) return true;
      // Клик с клавиатуры (detail = 0) приходит с координатами 0; 0 — по точке судим только о нажатиях указателем.
      const pointer = e.type === "pointerdown" || e.detail > 0;
      return pointer && inRect(h, e.clientX, e.clientY);
    };
    const onDown = (e: PointerEvent) => {
      if (!inHole(e)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const onClick = (e: MouseEvent) => {
      if (!inHole(e)) return;
      e.preventDefault();
      e.stopPropagation();
      go(idx, false);
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [nextStep, targetsKey, at.idx, go]);

  // Пока Бит рассказывает, плавающая кнопка Бита (P2b) спрятана — он «вышел» из неё. На шаге про саму кнопку — видна.
  const dockStep = !!step && !at.fallback && !!step.targets?.includes("bit-dock");
  useEffect(() => {
    const ui = useGuideUi.getState();
    ui.setActive(isPresent && !dockStep);
    ui.setDockStep(isPresent && dockStep);
  }, [isPresent, dockStep]);
  useEffect(
    () => () => {
      const ui = useGuideUi.getState();
      ui.setActive(false);
      ui.setDockStep(false);
    },
    [],
  );

  const text = found ? (view.partial ? sayPartial : sayFull) : null;
  const textLen = text?.length ?? 90;
  const place = view.place ?? placeBit(null, { vw: view.vw, vh: view.vh, bottomInset: 0 });
  const bitVisible = isPresent && view.vw > 0 && !view.hideBit;
  const action = at.fallback || !targetsKey ? "next" : (step?.action ?? "next");
  // Палец — только на шаге «нажми» (зовёт нажать); ложится там, где не закроет Бита и пузырь.
  let finger: FingerPose | null = null;
  if (hole && tapStep) {
    const r = placementRects(place, view.vh, textLen);
    finger = aimFinger(hole, { x: r.bit.x + BIT_SIZE / 2, y: r.bit.y + BIT_SIZE / 2 }, place.dock ? [r.bubble] : [r.bit, r.bubble], view.vw, view.vh);
  }
  const stepKey = `${scene.id}:${at.idx}:${at.fallback ? 1 : 0}`;
  // Ждёт цель — задумался; говорит — настроение шага.
  const mood = text === null ? "thinking" : ((at.fallback ? step?.orElse?.mood : undefined) ?? step?.mood ?? "neutral");

  // Escape — закрыть весь проводник, но только пока Бит на экране: спрятанный Бит (ждёт вопрос в уроке) молчит, и
  // Escape ученика не должен молча закрыть всё. Поверх чужое окно — Escape закрывает его.
  useEffect(() => {
    if (!bitVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !foreignModal()) noteAll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bitVisible]);

  // Шаг «нажми»: фокус — на цель (клавиатура: Enter нажимает её же).
  useEffect(() => {
    if (!found || !tapStep) return;
    focusableIn(findTour(targetsKey.split("|")[0]))?.focus({ preventScroll: true });
  }, [found, tapStep, targetsKey]);

  return (
    <div data-guide="" className="pointer-events-none fixed inset-0 z-[60]">
      <AnimatePresence>
        {(hole || dimAll) && (
          <GuideDim
            key="dim"
            stepKey={stepKey}
            hole={hole}
            radius={view.radius + HOLE_PAD}
            vw={view.vw}
            vh={view.vh}
            reduce={reduce}
            onDimTap={() => setShake((n) => n + 1)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {bitVisible && (
          <BitPopup
            key="bit"
            place={place}
            mood={mood}
            stepKey={stepKey}
            text={text}
            action={action}
            last={at.idx >= steps.length - 1}
            // Затемнение с «Дальше» (и шаг без цели) — модальный диалог; шаг «нажми» — статус: фокус на цели, её и нажимают.
            modal={(!!hole || dimAll) && action === "next"}
            reduce={reduce}
            sound={sound}
            shake={shake}
            onNext={() => go(at.idx, false)}
            onSkip={noteAll}
          />
        )}
      </AnimatePresence>
      {/* Палец — поверх пузыря. */}
      <AnimatePresence>{finger && <GuideFinger key="finger" stepKey={stepKey} finger={finger} reduce={reduce} />}</AnimatePresence>
    </div>
  );
}

/**
 * Всплывающий Бит-проводник (этап 16В, P2a): решает, какую сцену играть (`sceneFor`), выжидает паузу после прихода
 * на страницу и ведёт сцену. Ушли со страницы посреди сцены — сцена считается показанной. Монтируется в Providers.
 */
export function GuideHost() {
  const lesson = useGuideSpots((s) => s.lesson);
  const pathname = usePathname();

  const desired = useWantedScene();
  const key = desired ? `${desired}@${pathname}` : null;
  // Сцена, для которой пауза прошла. Сменилась сцена или страница — ждём заново.
  const [ready, setReady] = useState<string | null>(null);
  // Сцена закончилась (или прервана) — ещё LEAVE_MS она на экране: Бит уезжает вниз. `gone` — чья уборка уже прошла.
  const [gone, setGone] = useState<string | null>(null);
  useEffect(() => {
    if (!key) return;
    const id = window.setTimeout(() => {
      setReady(key);
      setGone(null);
    }, GUIDE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [key]);
  const playing: SceneId | null = key && ready === key ? desired : null;
  const leavingKey = !playing && ready && gone !== ready ? ready : null;
  useEffect(() => {
    if (!leavingKey) return;
    const id = window.setTimeout(() => setGone(leavingKey), LEAVE_MS);
    return () => window.clearTimeout(id);
  }, [leavingKey]);

  // Сцену прервали (ушли со страницы, итоги вместо урока) — она считается показанной. Отложено на такт: двойной
  // монтаж React в разработке (размонтирование → сразу монтирование) сцену не отмечает.
  const playingRef = useRef(playing);
  useEffect(() => {
    playingRef.current = playing;
  });
  useEffect(() => {
    if (!playing) return;
    // Вкладку закрыли или перезагрузили посреди сцены — тоже «ушёл со страницы» (стор пишет в localStorage сразу).
    const onHide = () => useApp.getState().noteTip(playing);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.setTimeout(() => {
        if (playingRef.current !== playing) useApp.getState().noteTip(playing);
      }, 0);
    };
  }, [playing]);

  const shown = playing && key ? key : leavingKey;
  if (!shown) return null;
  const scene = GUIDE_SCENES[shown.split("@")[0] as SceneId];
  return <SceneRunner key={shown} scene={scene} cost={lesson?.cost} leaving={!playing} />;
}

"use client";

import { AnimatePresence, animate, m, useMotionValue, type MotionValue } from "motion/react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { dockVisible, nextHopDelayMs, pickDockChat, releaseVelocity, swipeHidesDock, swipeRevealsDock, type Sample } from "@/lib/dock";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { Mascot } from "@/components/mascot/Mascot";
import { useReduceMotion } from "@/components/motion/useReduceMotion";
import { useToolbox } from "@/components/tools/useToolbox";
import { useGuideUi } from "./guide-state";

// Панель с чатом тянет весь чат (ленту, поле ввода, голос) — грузится при первом касании кнопки.
const loadPanel = () => import("./BitChatPanel");
const BitChatPanel = dynamic(() => loadPanel().then((x) => x.BitChatPanel), { ssr: false });

const SPRING = { type: "spring", stiffness: 420, damping: 30 } as const;

// ---------- шторка поверх страницы ----------

function subscribeOverlay(cb: () => void): () => void {
  const mo = new MutationObserver(cb);
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-modal"] });
  return () => mo.disconnect();
}

/** Есть ли поверх страницы окно или шторка (`aria-modal`), не считая саму панель Бита. */
function overlayOpen(): boolean {
  return Array.from(document.querySelectorAll('[aria-modal="true"]')).some((el) => !el.closest("[data-bit-panel]"));
}

/** Следит за окнами и шторками поверх страницы, пока `enabled` (иначе — не слушает DOM и отвечает «нет»). */
function useOverlayOpen(enabled: boolean): boolean {
  return useSyncExternalStore(
    (cb) => (enabled ? subscribeOverlay(cb) : () => {}),
    () => enabled && overlayOpen(),
    () => false,
  );
}

// ---------- жест «смахнуть по горизонтали» ----------

/**
 * Свайп по оси X пальцем и мышью. Элемент едет за указателем (motion-значение `x`, без перерисовок React);
 * при отпускании `decide(сдвиг, скорость)` — «уходим» (onCommit) или возвращаем на место. Вертикальный жест — прокрутка страницы
 * (на элементе `touch-pan-y`). Касание без сдвига — обычный click кнопки; после настоящего свайпа click гасится.
 * dir: 1 — тянем вправо, -1 — влево; в обратную сторону — с сопротивлением.
 */
function useSwipeX(x: MotionValue<number>, dir: 1 | -1, decide: (dx: number, vx: number) => boolean, onCommit: () => void) {
  const reduce = useReduceMotion();
  const st = useRef<{ id: number; x0: number; y0: number; locked: boolean; samples: Sample[] } | null>(null);
  const swiped = useRef(false);

  const snapBack = () => {
    if (reduce) x.set(0);
    else animate(x, 0, SPRING);
  };

  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      swiped.current = false;
      st.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, locked: false, samples: [{ t: e.timeStamp, v: e.clientX }] };
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const s = st.current;
      if (!s || s.id !== e.pointerId) return;
      const dx = e.clientX - s.x0;
      const dy = e.clientY - s.y0;
      if (!s.locked) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
          s.locked = true;
          x.stop();
          e.currentTarget.setPointerCapture(e.pointerId);
        } else if (Math.abs(dy) > 8) {
          st.current = null; // вертикальный жест — страница прокручивается сама
          return;
        } else return;
      }
      s.samples.push({ t: e.timeStamp, v: e.clientX });
      if (s.samples.length > 10) s.samples.shift();
      x.set(dx * dir > 0 ? dx : dx * 0.15);
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      const s = st.current;
      if (!s || s.id !== e.pointerId) return;
      st.current = null;
      if (!s.locked) return;
      swiped.current = true;
      window.setTimeout(() => (swiped.current = false), 80);
      if (decide(e.clientX - s.x0, releaseVelocity(s.samples))) onCommit();
      else snapBack();
    },
    onPointerCancel: (e: PointerEvent<HTMLElement>) => {
      const s = st.current;
      if (!s || s.id !== e.pointerId) return;
      st.current = null;
      if (s.locked) snapBack();
    },
    onClickCapture: (e: { stopPropagation: () => void; preventDefault: () => void }) => {
      if (!swiped.current) return;
      swiped.current = false;
      e.stopPropagation();
      e.preventDefault();
    },
  };
}

// ---------- кнопка ----------

/** Круглая кнопка Бита и стрелка «›» справа («смахни вправо»). */
function DockButton({ onOpen, onHide, onWarm }: { onOpen: () => void; onHide: () => void; onWarm: () => void }) {
  const { t } = useT();
  const reduce = useReduceMotion();
  const hintId = useId();
  const x = useMotionValue(0);
  const swipe = useSwipeX(x, 1, swipeHidesDock, onHide);

  // Раз в ~40 с Бит слегка подпрыгивает (настроение «радость» у маскота — его собственный прыжок). «Меньше анимаций» — без этого.
  const [hop, setHop] = useState(false);
  useEffect(() => {
    if (reduce) return;
    let wait = 0;
    let back = 0;
    const schedule = () => {
      wait = window.setTimeout(() => {
        if (document.visibilityState === "visible") {
          setHop(true);
          back = window.setTimeout(() => setHop(false), 1400);
        }
        schedule();
      }, nextHopDelayMs(Math.random()));
    };
    schedule();
    return () => {
      window.clearTimeout(wait);
      window.clearTimeout(back);
    };
  }, [reduce]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    // Без свайпа: стрелка вправо на кнопке тоже прячет Бита.
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onHide();
    }
  };

  return (
    <m.div
      {...swipe}
      style={{ x }}
      initial={{ y: 90, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ x: 150, opacity: 0, transition: { duration: 0.18, ease: "easeIn" } }}
      transition={SPRING}
      className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] right-1 z-40 flex touch-pan-y select-none items-center lg:bottom-6 lg:right-3"
    >
      <button
        type="button"
        data-tour="bit-dock"
        aria-label={t("dock.ask")}
        aria-describedby={hintId}
        onClick={onOpen}
        onPointerEnter={onWarm}
        onFocus={onWarm}
        onKeyDown={onKeyDown}
        className={cn(
          "relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-ai bg-surface",
          "shadow-[0_4px_0_var(--ai-strong),0_8px_18px_rgb(0_0_0/0.14)] transition-[translate,box-shadow] duration-75",
          "active:translate-y-[3px] active:shadow-[0_1px_0_var(--ai-strong)]",
          "focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ai",
        )}
      >
        <Mascot size={44} mood={hop ? "happy" : "neutral"} className="pointer-events-none" />
        {/* Значок «Спросить ИИ» — всё, что делает ИИ, фиолетовое. */}
        <span aria-hidden className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ai text-white ring-2 ring-surface">
          <Sparkles size={12} />
        </span>
      </button>
      <span id={hintId} className="sr-only">
        {t("dock.hideHint")}
      </span>
      {/* Подсказка «смахни вправо»: стрелка изредка «кивает» вправо. */}
      <m.span
        aria-hidden
        className="flex w-4 justify-center text-ai/70"
        animate={reduce ? undefined : { x: [0, 3, 0] }}
        transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity, repeatDelay: 5 }}
      >
        <ChevronRight size={16} strokeWidth={3} />
      </m.span>
    </m.div>
  );
}

// ---------- язычок у края ----------

/** Кнопка спрятана: у правого края остался язычок со стрелкой «‹». Касание или свайп влево возвращают кнопку. */
function DockTab({ onShow }: { onShow: () => void }) {
  const { t } = useT();
  const hintId = useId();
  const x = useMotionValue(0);
  const swipe = useSwipeX(x, -1, swipeRevealsDock, onShow);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onShow();
    }
  };

  return (
    <m.div
      {...swipe}
      style={{ x }}
      initial={{ x: 30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 30, opacity: 0, transition: { duration: 0.15 } }}
      transition={SPRING}
      // Язычок стоит на той же высоте, что кнопка (по её центру).
      className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem+4px)] right-0 z-40 touch-pan-y select-none lg:bottom-[calc(1.5rem+4px)]"
    >
      <button
        type="button"
        aria-label={t("dock.show")}
        aria-describedby={hintId}
        onClick={onShow}
        onKeyDown={onKeyDown}
        className={cn(
          "relative flex h-12 w-6 items-center justify-center rounded-l-2xl border-2 border-r-0 border-ai bg-ai-soft text-ai shadow-md",
          // Зона касания шире самого язычка: 24 px — маловато для пальца.
          "before:absolute before:-bottom-2 before:-left-3 before:-top-2 before:right-0 before:content-['']",
          "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ai",
        )}
      >
        <ChevronLeft size={18} strokeWidth={3} aria-hidden />
      </button>
      <span id={hintId} className="sr-only">
        {t("dock.showHint")}
      </span>
    </m.div>
  );
}

// ---------- сборка ----------

/**
 * Плавающая кнопка Бита (ИИ-чат вместо вкладки в нижней панели). Монтируется в AppShell.
 * Круг в правом нижнем углу открывает чат-панель; свайп вправо прячет кнопку за край (остаётся язычок), свайп влево/касание возвращают.
 * Прячется на `/tutor*`, пока играет сцена проводника, пока открыты «Инструменты» или шторка поверх (и пока открыта сама панель).
 */
export function BitDock() {
  const pathname = usePathname();
  const hidden = useApp((s) => s.profile.bitHidden);
  const updateProfile = useApp((s) => s.updateProfile);
  const guideActive = useGuideUi((s) => s.active);
  const toolboxOpen = useToolbox((s) => s.open);
  const onPage = dockVisible(pathname);

  // Панель открыта на странице openPath; при переходе на другую страницу закрывается (приём «поправить состояние при рендере»).
  const [openPath, setOpenPath] = useState<string | null>(null);
  if (openPath !== null && openPath !== pathname) setOpenPath(null);
  const open = onPage && openPath === pathname;
  // Панель уже открывали: держим её смонтированной (ответ дописывается и поле ввода не теряется, пока она закрыта).
  const [mounted, setMounted] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);

  const overlay = useOverlayOpen(onPage && !open);
  const show = onPage && !open && !guideActive && !toolboxOpen && !overlay;

  // «Инструменты» открылись (кнопка в боковом меню компьютера) — панель Бита уступает место.
  useEffect(() => useToolbox.subscribe((s) => s.open && setOpenPath(null)), []);

  // Панель закрылась — фокус возвращаем на кнопку Бита.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) document.querySelector<HTMLElement>('[data-tour="bit-dock"]')?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  /** Какой чат показать: последний; чатов нет — новый «свободный». Создаём в обработчике касания, не в эффекте. */
  const chooseChat = (): string => {
    const st = useApp.getState();
    return pickDockChat(st.chats)?.id ?? st.createChat("free");
  };

  const openPanel = () => {
    setChatId(chooseChat());
    setMounted(true);
    setOpenPath(pathname);
  };

  const newChat = () => setChatId(useApp.getState().createChat("free"));

  return (
    <>
      <AnimatePresence>
        {show && !hidden && <DockButton key="dock" onOpen={openPanel} onHide={() => updateProfile({ bitHidden: true })} onWarm={() => void loadPanel()} />}
        {show && hidden && <DockTab key="tab" onShow={() => updateProfile({ bitHidden: false })} />}
      </AnimatePresence>
      {onPage && mounted && chatId && (
        <BitChatPanel
          open={open}
          chatId={chatId}
          onClose={() => setOpenPath(null)}
          onNewChat={newChat}
        />
      )}
    </>
  );
}

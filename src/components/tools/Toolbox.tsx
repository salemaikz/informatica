"use client";

import { m } from "motion/react";
import dynamic from "next/dynamic";
import {
  Binary,
  Calculator as CalculatorIcon,
  HardDrive,
  Info,
  NotebookText,
  PenLine,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import type { DictKey } from "@/i18n/dict";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { Calculator } from "./Calculator";
import { tabsFor, TOOL_TABS, useToolbox, type ToolTab } from "./useToolbox";

// Остальные вкладки подгружаются при первом открытии.
const BaseConverter = dynamic(() => import("./BaseConverter").then((x) => x.BaseConverter));
const UnitsTool = dynamic(() => import("./UnitsTool").then((x) => x.UnitsTool));
const CheatSheet = dynamic(() => import("./CheatSheet").then((x) => x.CheatSheet));
const Scratchpad = dynamic(() => import("./Scratchpad").then((x) => x.Scratchpad), { ssr: false });

const TAB_META: Record<ToolTab, { icon: LucideIcon; label: DictKey }> = {
  calc: { icon: CalculatorIcon, label: "tools.calc" },
  base: { icon: Binary, label: "tools.base" },
  units: { icon: HardDrive, label: "tools.units" },
  cheat: { icon: NotebookText, label: "cheat.title" },
  scratch: { icon: PenLine, label: "tools.scratch" },
};

const SWIPE_CLOSE_PX = 90;

/** Кнопка, которой открыли панель: туда возвращаем фокус при закрытии (Safari не фокусирует кнопку по клику). */
let lastOpener: HTMLElement | null = null;

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Видимые элементы панели, до которых доходит Tab. */
function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) =>
      !el.hasAttribute("disabled") &&
      el.getAttribute("tabindex") !== "-1" &&
      !el.closest("[hidden], [inert]") &&
      el.getClientRects().length > 0,
  );
}

/** Состояние шторки при свайпе: dragging — идёт за пальцем, closing — отпущена на закрытие, idle — на месте. */
type Drag = { y: number; mode: "idle" | "dragging" | "closing" };

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 1024px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
}

/**
 * Кнопка открытия панели. «icon» — квадрат 40×40 для шапок, «fab» — круглая плавающая кнопка для страниц.
 * Когда инструменты выключены (level === "off"), ничего не рисует.
 */
export function ToolboxButton({ className, variant = "icon" }: { className?: string; variant?: "icon" | "fab" }) {
  const { t } = useT();
  const level = useToolbox((s) => s.level);
  const open = useToolbox((s) => s.open);
  const toggle = useToolbox((s) => s.toggle);
  if (level === "off") return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        if (!open) lastOpener = e.currentTarget;
        toggle();
      }}
      aria-label={t("tools.open")}
      aria-haspopup="dialog"
      aria-expanded={open}
      title={t("tools.open")}
      className={cn(
        "flex items-center justify-center transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
        variant === "fab"
          ? "fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 h-14 w-14 rounded-full bg-action-primary text-white shadow-lg hover:brightness-105 active:scale-95"
          : cn("h-10 w-10 rounded-xl hover:bg-surface-2", open ? "bg-primary-soft text-primary" : "text-muted hover:text-text"),
        className,
      )}
    >
      <CalculatorIcon size={variant === "fab" ? 26 : 22} aria-hidden />
    </button>
  );
}

/**
 * Панель «Инструменты»: калькулятор, системы счисления с шагами, единицы, шпаргалка, черновик.
 * Телефон — шторка снизу; ≥1024px — панель справа без затемнения. Монтируется один раз (в корне приложения).
 * Требует <LazyMotion features={domAnimation}> выше по дереву (используются m-компоненты).
 */
export function Toolbox() {
  const { t } = useT();
  const open = useToolbox((s) => s.open);
  const level = useToolbox((s) => s.level);
  const tab = useToolbox((s) => s.tab);
  const setOpen = useToolbox((s) => s.setOpen);
  const setTab = useToolbox((s) => s.setTab);
  const isDesktop = useIsDesktop();

  // Вкладки монтируем при первом показе и не размонтируем: набранное переживает закрытие панели.
  const [visited, setVisited] = useState<ToolTab[]>([]);
  if (open && level !== "off" && !visited.includes(tab)) setVisited([...visited, tab]);

  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const dragStart = useRef<number | null>(null);
  const [drag, setDrag] = useState<Drag>({ y: 0, mode: "idle" });

  // Панель открыли снова после закрытия свайпом — снимаем сдвиг (он уезжает плавно вместе с выездом шторки).
  if (open && drag.mode === "closing") setDrag({ y: 0, mode: "idle" });

  // Клавиатура (в фазе перехвата, до обработчиков урока и игры):
  // Escape закрывает только панель; на телефоне Tab не выпускает фокус из шторки (она модальная).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Полноэкранный черновик сам обрабатывает Escape (выход из полного экрана) и держит фокус.
      if (document.querySelector("[data-scratch-fullscreen]")) return;
      if (e.key === "Escape") {
        // Не даём Escape дойти до урока/игры (пауза, окно выхода): он обработан здесь.
        e.preventDefault();
        e.stopImmediatePropagation();
        setOpen(false);
        return;
      }
      const panel = panelRef.current;
      if (e.key !== "Tab" || isDesktop || !panel) return;
      const items = focusableIn(panel);
      const active = document.activeElement;
      if (items.length === 0) {
        e.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (!(active instanceof HTMLElement) || !panel.contains(active) || active === panel) {
        // Фокус на самой шторке или вне её — возвращаем к краю списка.
        e.preventDefault();
        (e.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, setOpen, isDesktop]);

  // Фокус внутрь панели при открытии и обратно на кнопку-открывашку — при закрытии.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    returnFocus.current = lastOpener?.isConnected ? lastOpener : active;
    lastOpener = null;
    const id = requestAnimationFrame(() => panel?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(id);
      const target = returnFocus.current;
      returnFocus.current = null;
      // Не отбираем фокус, если человек успел перейти в другое место страницы (на десктопе панель не модальная).
      const now = document.activeElement;
      const lost = !now || now === document.body || !!panel?.contains(now);
      if (target?.isConnected && lost) target.focus({ preventScroll: true });
    };
  }, [open]);

  // При смене вкладки — к началу.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  if (level === "off" || visited.length === 0) return null;

  const tabs = tabsFor(level);
  const closedPos = isDesktop ? { x: "100%", y: 0 } : { x: 0, y: "100%" };

  const onHandleDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = e.clientY;
    setDrag({ y: 0, mode: "dragging" });
  };
  const onHandleMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return;
    setDrag({ y: Math.max(0, e.clientY - dragStart.current), mode: "dragging" });
  };
  const onHandleUp = (e: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return;
    const dy = Math.max(0, e.clientY - dragStart.current);
    dragStart.current = null;
    if (dy > SWIPE_CLOSE_PX) {
      // Закрытие: сдвиг остаётся, шторка доезжает вниз от текущего места (без прыжка наверх).
      setDrag({ y: dy, mode: "closing" });
      setOpen(false);
    } else {
      // Отмена: сдвиг плавно возвращается в 0 (transition включается в idle).
      setDrag({ y: 0, mode: "idle" });
    }
  };

  const ActiveIcon = TAB_META[tab].icon;

  return (
    <div
      data-toolbox
      inert={!open}
      className={cn(
        "pointer-events-none fixed inset-0 z-50",
        open ? "visible" : "invisible transition-[visibility] duration-0 delay-500",
      )}
    >
      {/* Затемнение — только на телефоне; на десктопе страница остаётся доступной. */}
      <m.button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={() => setOpen(false)}
        initial={{ opacity: 0 }}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className={cn("absolute inset-0 bg-black/40 lg:hidden", open ? "pointer-events-auto" : "pointer-events-none")}
      />
      <div
        className="absolute inset-x-0 bottom-0 lg:inset-x-auto lg:inset-y-0 lg:right-0 lg:w-[400px]"
        style={{
          transform: drag.y > 0 ? `translateY(${drag.y}px)` : undefined,
          // Пока тянем и пока шторка уезжает при закрытии — без transition; возврат в 0 — плавный.
          transition: drag.mode === "idle" ? "transform 220ms ease-out" : "none",
        }}
      >
        <m.div
          ref={panelRef}
          role="dialog"
          aria-label={t("tools.open")}
          tabIndex={-1}
          initial={closedPos}
          animate={open ? { x: 0, y: 0 } : closedPos}
          transition={{ type: "spring", stiffness: 420, damping: 38 }}
          className={cn(
            "pointer-events-auto flex h-[min(40rem,90dvh)] flex-col overflow-hidden rounded-t-3xl border-t-2 border-border bg-surface shadow-2xl outline-none",
            "lg:h-dvh lg:rounded-none lg:border-l-2 lg:border-t-0",
          )}
        >
          {/* Ручка шторки: потяни вниз, чтобы закрыть */}
          <div
            className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5 lg:hidden"
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
            aria-hidden
          >
            <div className="h-1.5 w-10 rounded-full bg-border" />
          </div>

          <div className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-1 lg:pt-4">
            <ActiveIcon size={22} className="shrink-0 text-primary" aria-hidden />
            <h2 className="min-w-0 flex-1 truncate text-lg font-extrabold text-text">{t(TAB_META[tab].label)}</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("common.close")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <X size={22} aria-hidden />
            </button>
          </div>

          <div className="shrink-0 px-4">
            <div role="tablist" aria-label={t("tools.open")} className="flex gap-1 rounded-2xl bg-surface-2 p-1">
              {tabs.map((id) => {
                const { icon: Icon, label } = TAB_META[id];
                const selected = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    id={`tools-tab-${id}`}
                    aria-selected={selected}
                    aria-controls={`tools-pane-${id}`}
                    aria-label={t(label)}
                    title={t(label)}
                    onClick={() => setTab(id)}
                    className={cn(
                      "flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-bold transition-colors",
                      "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
                      selected ? "bg-primary-soft text-primary" : "text-muted hover:text-text",
                    )}
                  >
                    <Icon size={20} aria-hidden />
                    {tabs.length <= 2 && <span className="truncate">{t(label)}</span>}
                  </button>
                );
              })}
            </div>
            {level === "ent" && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-muted">
                <Info size={14} className="shrink-0" aria-hidden />
                {t("tools.entOnly")}
              </p>
            )}
          </div>

          <div
            ref={bodyRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
          >
            {TOOL_TABS.filter((id) => tabs.includes(id) && visited.includes(id)).map((id) => (
              <div key={id} id={`tools-pane-${id}`} role="tabpanel" aria-labelledby={`tools-tab-${id}`} hidden={tab !== id}>
                {id === "calc" && <Calculator active={open && tab === "calc"} />}
                {id === "base" && <BaseConverter />}
                {id === "units" && <UnitsTool />}
                {id === "cheat" && <CheatSheet />}
                {id === "scratch" && <Scratchpad />}
              </div>
            ))}
          </div>
        </m.div>
      </div>
    </div>
  );
}

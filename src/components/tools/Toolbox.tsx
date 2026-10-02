"use client";

import { m } from "motion/react";
import dynamic from "next/dynamic";
import {
  Binary,
  Calculator as CalculatorIcon,
  HardDrive,
  Info,
  PenLine,
  Superscript,
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
const PowersTable = dynamic(() => import("./PowersTable").then((x) => x.PowersTable));
const Scratchpad = dynamic(() => import("./Scratchpad").then((x) => x.Scratchpad), { ssr: false });

const TAB_META: Record<ToolTab, { icon: LucideIcon; label: DictKey }> = {
  calc: { icon: CalculatorIcon, label: "tools.calc" },
  base: { icon: Binary, label: "tools.base" },
  units: { icon: HardDrive, label: "tools.units" },
  powers: { icon: Superscript, label: "tools.powers" },
  scratch: { icon: PenLine, label: "tools.scratch" },
};

const SWIPE_CLOSE_PX = 90;

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
      onClick={toggle}
      aria-label={t("tools.open")}
      aria-haspopup="dialog"
      aria-expanded={open}
      title={t("tools.open")}
      className={cn(
        "flex items-center justify-center transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary",
        variant === "fab"
          ? "fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 h-14 w-14 rounded-full bg-primary text-white shadow-lg hover:brightness-105 active:scale-95"
          : cn("h-10 w-10 rounded-xl hover:bg-surface-2", open ? "bg-primary-soft text-primary" : "text-muted hover:text-text"),
        className,
      )}
    >
      <CalculatorIcon size={variant === "fab" ? 26 : 22} aria-hidden />
    </button>
  );
}

/**
 * Панель «Инструменты»: калькулятор, системы счисления с шагами, единицы, степени двойки, черновик.
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
  const [drag, setDrag] = useState({ y: 0, active: false });

  // Escape закрывает панель (в фазе перехвата, чтобы не дойти до обработчиков урока).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (e.target instanceof Element && e.target.closest("[data-toolbox]")) e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, setOpen]);

  // Фокус внутрь панели при открытии и обратно — при закрытии.
  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const id = requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(id);
      returnFocus.current?.focus?.({ preventScroll: true });
      returnFocus.current = null;
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
    setDrag({ y: 0, active: true });
  };
  const onHandleMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return;
    setDrag({ y: Math.max(0, e.clientY - dragStart.current), active: true });
  };
  const onHandleUp = (e: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return;
    const dy = e.clientY - dragStart.current;
    dragStart.current = null;
    setDrag({ y: 0, active: false });
    if (dy > SWIPE_CLOSE_PX) setOpen(false);
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
        style={
          drag.active || drag.y > 0
            ? { transform: `translateY(${drag.y}px)`, transition: drag.active ? "none" : "transform 200ms ease-out" }
            : undefined
        }
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
            "pointer-events-auto flex h-[min(40rem,85dvh)] flex-col overflow-hidden rounded-t-3xl border-t-2 border-border bg-surface shadow-2xl outline-none",
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
                {id === "powers" && <PowersTable />}
                {id === "scratch" && <Scratchpad />}
              </div>
            ))}
          </div>
        </m.div>
      </div>
    </div>
  );
}

"use client";

import { animate, m, useMotionValue } from "motion/react";
import { MessagesSquare, Plus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { releaseVelocity, swipeClosesSheet, type Sample } from "@/lib/dock";
import { useApp } from "@/lib/store";
import { useT } from "@/i18n/useT";
import { ChatScreen } from "@/components/chat/ChatScreen";
import { useReduceMotion } from "@/components/motion/useReduceMotion";

const PANEL_SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** ≥ lg (1024 px): боковая панель справа; уже — шторка снизу. */
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

/** Видимые элементы панели, до которых доходит Tab. */
function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("disabled") && el.getAttribute("tabindex") !== "-1" && !el.closest("[hidden], [inert]") && el.getClientRects().length > 0,
  );
}

const iconBtn =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-ai focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ai disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted";

/**
 * Чат-панель Бита: на телефоне — шторка снизу почти во всю высоту (ручка, свайп вниз или крестик закрывают),
 * на компьютере — панель 420 px справа (страница остаётся доступной). Внутри — тот же чат, что на `/tutor/<id>` (ChatScreen).
 * После первого открытия не размонтируется: пока панель закрыта, ответ дописывается, а набранное остаётся.
 */
export function BitChatPanel({ open, chatId, onClose, onNewChat }: { open: boolean; chatId: string; onClose: () => void; onNewChat: () => void }) {
  const { t } = useT();
  const desktop = useIsDesktop();
  const reduce = useReduceMotion();
  const empty = useApp((s) => (s.chats.find((c) => c.id === chatId)?.count ?? 0) === 0);
  const panelRef = useRef<HTMLElement>(null);
  const dragY = useMotionValue(0);
  const drag = useRef<{ y0: number; samples: Sample[] } | null>(null);

  // Шторку закрыли свайпом (она осталась сдвинутой) — при новом открытии снова на месте.
  useEffect(() => {
    if (open) dragY.set(0);
  }, [open, dragY]);

  // Телефон: страница под шторкой не прокручивается (как у остальных шторок).
  useEffect(() => {
    if (!open || desktop) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, desktop]);

  // Фокус внутрь при открытии. Escape закрывает панель (если поверх неё нет вложенной шторки — переименование чата);
  // на телефоне Tab не выпускает фокус из шторки.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel || panel.querySelector('[aria-modal="true"]')) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || desktop) return;
      const items = focusableIn(panel);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !panel.contains(active) || active === panel) {
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
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, desktop, onClose]);

  // Ручка шторки: потяни вниз, чтобы закрыть.
  const onHandleDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragY.stop();
    drag.current = { y0: e.clientY, samples: [{ t: e.timeStamp, v: e.clientY }] };
  };
  const onHandleMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    d.samples.push({ t: e.timeStamp, v: e.clientY });
    if (d.samples.length > 10) d.samples.shift();
    dragY.set(Math.max(0, e.clientY - d.y0));
  };
  const onHandleUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const dy = Math.max(0, e.clientY - d.y0);
    if (e.type !== "pointercancel" && swipeClosesSheet(dy, releaseVelocity(d.samples))) onClose();
    else if (reduce) dragY.set(0);
    else animate(dragY, 0, { type: "spring", stiffness: 420, damping: 32 });
  };

  const closedPos = desktop ? { x: "100%", y: 0 } : { x: 0, y: "100%" };

  return (
    <div inert={!open} className={cn("pointer-events-none fixed inset-0 z-50", open ? "visible" : "invisible transition-[visibility] delay-300 duration-0")}>
      {/* Затемнение — только на телефоне; на компьютере страница остаётся доступной. */}
      <m.button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className={cn("absolute inset-0 bg-black/40 lg:hidden", open ? "pointer-events-auto" : "pointer-events-none")}
      />
      <m.section
        ref={panelRef}
        data-bit-panel
        role="dialog"
        aria-modal={!desktop}
        aria-label={t("dock.panel")}
        tabIndex={-1}
        initial={{ ...closedPos, opacity: 0 }}
        animate={open ? { x: 0, y: 0, opacity: 1 } : { ...closedPos, opacity: 0 }}
        transition={PANEL_SPRING}
        className={cn(
          "pointer-events-auto absolute inset-x-0 bottom-0 mx-auto flex h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border-2 border-b-0 border-ai/30 bg-surface shadow-2xl outline-none",
          "lg:inset-x-auto lg:inset-y-0 lg:right-0 lg:mx-0 lg:h-dvh lg:w-[420px] lg:max-w-none lg:rounded-none lg:border-y-0 lg:border-r-0 lg:border-l-2",
        )}
      >
        <m.div style={{ y: dragY }} className="flex min-h-0 flex-1 flex-col">
          {/* Ручка шторки (телефон) */}
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
          <div className="flex min-h-0 flex-1 flex-col px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 lg:px-4 lg:pb-4 lg:pt-4">
            <ChatScreen
              key={chatId}
              id={chatId}
              embedded
              actions={
                <>
                  <button type="button" onClick={onNewChat} disabled={empty} aria-label={t("dock.newChat")} title={t("dock.newChat")} className={iconBtn}>
                    <Plus size={22} aria-hidden />
                  </button>
                  <Link
                    href="/tutor"
                    aria-label={t("dock.allChats")}
                    title={t("dock.allChats")}
                    className={cn(iconBtn, "min-[420px]:w-auto min-[420px]:gap-1.5 min-[420px]:px-3 min-[420px]:text-sm min-[420px]:font-extrabold")}
                  >
                    <MessagesSquare size={20} aria-hidden />
                    <span className="hidden min-[420px]:inline">{t("dock.allChats")}</span>
                  </Link>
                  <button type="button" onClick={onClose} aria-label={t("common.close")} title={t("common.close")} className={iconBtn}>
                    <X size={22} aria-hidden />
                  </button>
                </>
              }
            />
          </div>
        </m.div>
      </m.section>
    </div>
  );
}

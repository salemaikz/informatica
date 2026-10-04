"use client";

import { AnimatePresence, m } from "motion/react";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";

/** sm-брейкпоинт Tailwind: на нём шторка снизу превращается в окно по центру. */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 640px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 640px)").matches,
    () => false,
  );
}

const SHEET = { type: "spring", stiffness: 380, damping: 34 } as const;

/** Открытые окна по порядку: Escape закрывает только верхнее (шторка поверх шторки). */
const stack: symbol[] = [];
const POP = { type: "spring", stiffness: 420, damping: 28 } as const;

/** Модальное окно: на телефоне — шторка снизу (выезжает пружиной), на десктопе — по центру (мягкий «поп»). */
export function Modal({
  open,
  onClose,
  children,
  className,
  label,
  closeLabel,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  label?: string;
  /** Подпись подложки-«закрыть» (для экранов, где язык взят не из стора, — экран восстановления). */
  closeLabel?: string;
}) {
  const desktop = useIsDesktop();
  const { t } = useT();

  useEffect(() => {
    if (!open) return;
    const me = Symbol("modal");
    stack.push(me);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stack[stack.length - 1] === me) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      const i = stack.lastIndexOf(me);
      if (i >= 0) stack.splice(i, 1);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={label}>
          <m.button
            aria-label={closeLabel ?? t("common.close")}
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <m.div
            className={cn(
              "relative max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-3xl",
              className,
            )}
            initial={desktop ? { opacity: 0, scale: 0.92, y: 12 } : { y: "100%" }}
            animate={desktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={desktop ? { opacity: 0, scale: 0.96, transition: { duration: 0.14 } } : { y: "100%", transition: { duration: 0.18, ease: "easeIn" } }}
            transition={desktop ? POP : SHEET}
          >
            {children}
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}

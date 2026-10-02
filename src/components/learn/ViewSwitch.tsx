"use client";

import { m } from "motion/react";
import { LayoutGrid, Route } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/useT";

// Переключатель вида карты: «Путь» | «Карта ЕНТ». Выбор запоминается на устройстве.

export type MapView = "path" | "ent";

const KEY = "informatica-learn-view";

/** Выбранный вид (localStorage может быть недоступен — тогда «Путь» без запоминания). */
export function useMapView(): [MapView, (v: MapView) => void] {
  const [view, setView] = useState<MapView>(() => {
    try {
      return localStorage.getItem(KEY) === "ent" ? "ent" : "path";
    } catch {
      return "path";
    }
  });
  const set = (v: MapView) => {
    setView(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {
      // приватный режим / запрет хранилища — просто не запоминаем
    }
  };
  return [view, set];
}

export function ViewSwitch({ view, onChange }: { view: MapView; onChange: (v: MapView) => void }) {
  const { t } = useT();
  const items: { id: MapView; label: string; icon: typeof Route }[] = [
    { id: "path", label: t("learn2.view.path"), icon: Route },
    { id: "ent", label: t("learn2.view.ent"), icon: LayoutGrid },
  ];
  return (
    <div role="tablist" aria-label={t("learn2.view.label")} className="relative grid grid-cols-2 rounded-2xl border-2 border-border bg-surface-2 p-1">
      {/* Одна «таблетка» скользит между сегментами. */}
      <m.span
        aria-hidden
        className="absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-xl bg-surface shadow-[0_2px_0_var(--border)]"
        initial={false}
        animate={{ x: view === "ent" ? "100%" : "0%" }}
        transition={{ type: "spring", stiffness: 520, damping: 36 }}
      />
      {items.map(({ id, label, icon: Icon }) => {
        const on = view === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(id)}
            className={cn("relative flex h-10 items-center justify-center gap-2 rounded-xl text-[15px] font-extrabold transition-colors", on ? "text-primary" : "text-muted hover:text-text")}
          >
            <Icon size={18} className="relative" />
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

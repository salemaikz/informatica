"use client";

import { useEffect } from "react";
import { create } from "zustand";

export type ToolTab = "calc" | "base" | "units" | "powers" | "scratch";
/** full — все инструменты; ent — как на ЕНТ (калькулятор + черновик); off — инструментов нет. */
export type ToolLevel = "full" | "ent" | "off";

export const TOOL_TABS: ToolTab[] = ["calc", "base", "units", "powers", "scratch"];
export const ENT_TABS: ToolTab[] = ["calc", "scratch"];

export function tabsFor(level: ToolLevel): ToolTab[] {
  return level === "ent" ? ENT_TABS : level === "off" ? [] : TOOL_TABS;
}

interface ToolboxState {
  open: boolean;
  level: ToolLevel;
  tab: ToolTab;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setLevel: (level: ToolLevel) => void;
  setTab: (tab: ToolTab) => void;
}

/** Состояние панели «Инструменты». Не сохраняется: уровень задаёт экран (урок, игра, пробный ЕНТ…). */
export const useToolbox = create<ToolboxState>()((set) => ({
  open: false,
  level: "full",
  tab: "calc",
  setOpen: (open) => set((s) => ({ open: s.level === "off" ? false : open })),
  toggle: () => set((s) => ({ open: s.level === "off" ? false : !s.open })),
  setLevel: (level) =>
    set((s) => ({
      level,
      open: level === "off" ? false : s.open,
      tab: tabsFor(level).length && !tabsFor(level).includes(s.tab) ? tabsFor(level)[0] : s.tab,
    })),
  setTab: (tab) => set((s) => (tabsFor(s.level).includes(tab) ? { tab } : {})),
}));

/** Экран задаёт, какие инструменты доступны, пока он открыт; при уходе — снова все. */
export function useToolboxLevel(level: ToolLevel) {
  useEffect(() => {
    useToolbox.getState().setLevel(level);
    return () => useToolbox.getState().setLevel("full");
  }, [level]);
}

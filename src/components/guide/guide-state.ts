"use client";

import { create } from "zustand";

// Этап 16В: идёт ли сейчас сцена проводника Бита. Пока Бит рассказывает, плавающая кнопка Бита (BitDock) прячется —
// Бит «выпрыгивает» из неё говорить. Не прогресс ученика — в localStorage не сохраняется.
export const useGuideUi = create<{ active: boolean; setActive: (active: boolean) => void }>((set) => ({
  active: false,
  setActive: (active) => set({ active }),
}));

"use client";

import { usePathname } from "next/navigation";
import { create } from "zustand";
import { completedLessonsCount, sceneFor, type SceneId } from "@/lib/guide";
import { entVisible } from "@/lib/school";
import { useApp } from "@/lib/store";
import { useGuideSpots } from "./GuideSpot";

// Этап 16В: состояние проводника для плавающей кнопки Бита (BitDock). Пока Бит рассказывает, кнопка прячется —
// Бит «выпрыгивает» из неё говорить. Не прогресс ученика — в localStorage не сохраняется.
interface GuideUi {
  /** Сцена на экране (кроме шага про саму кнопку): кнопка Бита спрятана. */
  active: boolean;
  /** Шаг сцены, где цель — сама кнопка Бита: кнопка видна, что бы ни решали остальные флаги. */
  dockStep: boolean;
  /**
   * Чат-панель Бита открыта или открывается: ставится синхронно в обработчике нажатия на кнопку Бита (панель грузится
   * отдельным куском и ещё не стала `[role=dialog]`), снимается при закрытии. Окна «Включить напоминания», тарифов
   * и кейса за уровень пока флаг поднят не открываются (иначе ложатся поверх только что открытой панели).
   */
  chatOpen: boolean;
  setActive: (active: boolean) => void;
  setDockStep: (dockStep: boolean) => void;
  setChatOpen: (chatOpen: boolean) => void;
}

export const useGuideUi = create<GuideUi>((set) => ({
  active: false,
  dockStep: false,
  chatOpen: false,
  setActive: (active) => set({ active }),
  setDockStep: (dockStep) => set({ dockStep }),
  setChatOpen: (chatOpen) => set({ chatOpen }),
}));

/**
 * Какую сцену проводник хочет сыграть на этом экране (`sceneFor`): она ещё ждёт паузу после прихода на страницу, играет
 * или ждёт цели. Нет — null. Считается при рендере, без эффектов: кнопка Бита по нему не выезжает на миг перед сценой.
 */
export function useWantedScene(): SceneId | null {
  const onboarded = useApp((s) => s.onboarded);
  const tips = useApp((s) => s.tips);
  const completed = useApp((s) => completedLessonsCount(s.lessons));
  const school = useApp((s) => !entVisible(s.profile));
  const lesson = useGuideSpots((s) => s.lesson);
  const results = useGuideSpots((s) => s.results);
  const pathname = usePathname();
  return sceneFor(tips, { pathname, onboarded, completedLessons: completed, inLesson: !!lesson, onResults: results, school });
}

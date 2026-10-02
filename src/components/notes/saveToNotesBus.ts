"use client";

import { create } from "zustand";

// «Сохранить в конспект» из любого места (черновик, ответ ИИ, урок): компонент кладёт сюда, что сохранить,
// а шторка выбора папки (components/notes/SaveToNotesSheet.tsx, смонтирована в Providers) показывает выбор.

export interface SaveToNotesPayload {
  /** Откуда пришло: влияет на папку по умолчанию и заголовок. */
  source: "ai" | "scratch" | "lesson";
  title?: string;
  /** Markdown-текст. */
  text?: string;
  /** Рисунок: PNG dataURL на белом фоне. */
  image?: string;
  /** Урок, к которому относится запись. */
  lessonId?: string;
}

interface SaveToNotesState {
  payload: SaveToNotesPayload | null;
  open: (p: SaveToNotesPayload) => void;
  close: () => void;
}

export const useSaveToNotes = create<SaveToNotesState>((set) => ({
  payload: null,
  open: (payload) => set({ payload }),
  close: () => set({ payload: null }),
}));

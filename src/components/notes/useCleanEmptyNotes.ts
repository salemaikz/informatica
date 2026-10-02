"use client";

import { useEffect } from "react";
import { isEmptyNote } from "@/lib/note-markdown";
import { useApp } from "@/lib/store";

/**
 * Нажали «+ Запись» и ушли, ничего не написав, — пустая запись остаётся в сторе.
 * На экранах-списках при открытии подчищаем такие (редактор в этот момент закрыт). Только действие стора, без setState.
 */
export function useCleanEmptyNotes() {
  useEffect(() => {
    for (const n of useApp.getState().notebook.notes) if (isEmptyNote(n)) useApp.getState().deleteNote(n.id);
  }, []);
}

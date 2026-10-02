"use client";
// ВРЕМЕННАЯ страница для проверки ревьюером — удалить.
import { SaveToNotesSheet } from "@/components/notes/SaveToNotesSheet";
import { useSaveToNotes } from "@/components/notes/saveToNotesBus";
export default function P() {
  return (
    <div>
      <button id="open" onClick={() => useSaveToNotes.getState().open({ source: "ai", text: "**Бит** — наименьшая единица информации. ==Важно==" })}>open</button>
      <SaveToNotesSheet />
    </div>
  );
}

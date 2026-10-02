"use client";

import { NoteEditor } from "@/components/notes/NoteEditor";

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Редактор записи по id записи. */
export function NoteScreen({ id }: { id: string }) {
  return <NoteEditor id={safeDecode(id)} />;
}

// Тонкая обёртка над IndexedDB для резервной копии: собрать данные для экспорта и записать при импорте.
// Вся логика проверки и бюджетов — в lib/backup.ts (там же тесты); здесь только ввод-вывод.

import { buildBackup, noteImageIds, type IdbSnapshot, type ParsedBackup } from "./backup";
import { deleteMessages, loadMessagesChecked, saveMessages } from "./chat-store";
import { deleteImages, getImageChecked, putImageWithId } from "./note-images";
import { loadScratchChecked, saveScratch } from "./scratch";
import { useApp, type AppState } from "./store";

/** Сообщения чатов, фото записей и листы черновика этого устройства. unreadable — сколько частей IndexedDB не прочиталось. */
export async function collectIdb(state: Pick<AppState, "chats" | "notebook">): Promise<{ snapshot: IdbSnapshot; unreadable: number }> {
  let unreadable = 0;
  const chats: Record<string, unknown> = {};
  for (const c of state.chats) {
    const r = await loadMessagesChecked(c.id);
    if (r.failed) unreadable++;
    chats[c.id] = r.messages;
  }
  const images: Record<string, string> = {};
  for (const id of noteImageIds(state.notebook)) {
    const r = await getImageChecked(id);
    if (r.failed) unreadable++;
    if (r.url) images[id] = r.url;
  }
  const scratch = await loadScratchChecked();
  if (scratch.failed) unreadable++;
  return { snapshot: { chats, images, scratch: scratch.pages }, unreadable };
}

/**
 * Полная копия v3: состояние стора + IndexedDB. Файл — компактный JSON (отступы раздули бы штрихи черновика втрое).
 * unreadable > 0 — часть чатов, фото или черновик не прочиталась из браузера и в файл не попала: сообщите ученику.
 */
export async function exportBackup(): Promise<{ blob: Blob; droppedImages: number; unreadable: number }> {
  const state = useApp.getState();
  const { snapshot, unreadable } = await collectIdb(state);
  const { file, droppedImages } = buildBackup(state, snapshot, Date.now());
  return { blob: new Blob([JSON.stringify(file)], { type: "application/json" }), droppedImages, unreadable };
}

/** ok — всё восстановлено; partial — прогресс загружен, но чаты или фото остались только в памяти вкладки; error — не загружено. */
export type ImportOutcome = "ok" | "partial" | "error";

/**
 * Восстановление из проверенной копии: сначала IndexedDB, потом состояние (чтобы чаты и записи не ссылались
 * на то, чего ещё нет), потом уборка того, на что прежний прогресс ссылался, а новый — нет.
 * Старые чаты и фото удаляются только если новые записались в IndexedDB: иначе старое — единственное, что переживёт перезагрузку.
 * Тариф и пробный период не меняются (это делает importProgress).
 */
export async function importBackup(parsed: ParsedBackup): Promise<ImportOutcome> {
  try {
    const before = useApp.getState();
    const oldChatIds = before.chats.map((c) => c.id);
    const oldImageIds = noteImageIds(before.notebook);
    const { idb } = parsed;

    let imagesOk = true;
    let chatsOk = true;
    let scratchOk = true;
    if (idb?.images) for (const [id, url] of Object.entries(idb.images)) if (!(await putImageWithId(id, url).catch(() => false))) imagesOk = false;
    if (idb?.chats) for (const [id, msgs] of Object.entries(idb.chats)) if (!(await saveMessages(id, msgs))) chatsOk = false;
    if (idb?.scratch) scratchOk = await saveScratch(idb.scratch);

    if (!useApp.getState().importProgress(parsed.state)) return "error";

    const after = useApp.getState();
    if (idb?.chats && chatsOk) {
      const keep = new Set(after.chats.map((c) => c.id));
      for (const id of oldChatIds) if (!keep.has(id)) await deleteMessages(id);
    }
    if (idb?.images && imagesOk) {
      const keep = new Set(noteImageIds(after.notebook));
      await deleteImages(oldImageIds.filter((id) => !keep.has(id)));
    }
    return imagesOk && chatsOk && scratchOk ? "ok" : "partial";
  } catch {
    return "error";
  }
}

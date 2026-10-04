// Тонкая обёртка над IndexedDB для резервной копии: собрать данные для экспорта и записать при импорте.
// Вся логика проверки и бюджетов — в lib/backup.ts (там же тесты); здесь только ввод-вывод.

import { buildBackup, noteImageIds, type IdbSnapshot, type ParsedBackup } from "./backup";
import { deleteMessages, loadMessages, saveMessages } from "./chat-store";
import { deleteImages, getImage, putImageWithId } from "./note-images";
import { loadScratch, saveScratch } from "./scratch";
import { useApp, type AppState } from "./store";

/** Сообщения чатов, фото записей и листы черновика этого устройства. */
export async function collectIdb(state: Pick<AppState, "chats" | "notebook">): Promise<IdbSnapshot> {
  const chats: Record<string, unknown> = {};
  for (const c of state.chats) chats[c.id] = await loadMessages(c.id);
  const images: Record<string, string> = {};
  for (const id of noteImageIds(state.notebook)) {
    const url = await getImage(id);
    if (url) images[id] = url;
  }
  return { chats, images, scratch: await loadScratch() };
}

/** Полная копия v3: состояние стора + IndexedDB. Файл — компактный JSON (отступы раздули бы штрихи черновика втрое). */
export async function exportBackup(): Promise<{ blob: Blob; droppedImages: number }> {
  const state = useApp.getState();
  const { file, droppedImages } = buildBackup(state, await collectIdb(state), Date.now());
  return { blob: new Blob([JSON.stringify(file)], { type: "application/json" }), droppedImages };
}

/**
 * Восстановление из проверенной копии: сначала IndexedDB, потом состояние (чтобы чаты и записи не ссылались
 * на то, чего ещё нет), потом уборка того, на что прежний прогресс ссылался, а новый — нет.
 * Тариф и пробный период не меняются (это делает importProgress).
 */
export async function importBackup(parsed: ParsedBackup): Promise<boolean> {
  try {
    const before = useApp.getState();
    const oldChatIds = before.chats.map((c) => c.id);
    const oldImageIds = noteImageIds(before.notebook);
    const { idb } = parsed;

    if (idb?.images) for (const [id, url] of Object.entries(idb.images)) await putImageWithId(id, url).catch(() => {});
    if (idb?.chats) for (const [id, msgs] of Object.entries(idb.chats)) await saveMessages(id, msgs);
    if (idb?.scratch) await saveScratch(idb.scratch);

    if (!useApp.getState().importProgress(parsed.state)) return false;

    const after = useApp.getState();
    if (idb?.chats) {
      const keep = new Set(after.chats.map((c) => c.id));
      for (const id of oldChatIds) if (!keep.has(id)) await deleteMessages(id);
    }
    if (idb?.images) {
      const keep = new Set(noteImageIds(after.notebook));
      await deleteImages(oldImageIds.filter((id) => !keep.has(id)));
    }
    return true;
  } catch {
    return false;
  }
}
